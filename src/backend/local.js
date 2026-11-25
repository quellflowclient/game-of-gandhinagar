// Local demo backend. Same interface as supabase.js, but the "database" is localStorage
// (shared by every tab on this origin) and realtime is a BroadcastChannel. Each tab keeps
// its own session in sessionStorage, so two tabs can be two different users for testing.
// Sign-in codes are shown on screen because no email is sent in demo mode.
import { LIMITS, CONTACT_PATTERN } from "../config.js";
import {emailAddress} from './email.js';

const DB_KEY = "gnr-db-v1";
const SESSION_KEY = "gnr-session";
const bc = typeof BroadcastChannel !== "undefined" ? new BroadcastChannel("gnr-realtime") : null;
const handlers = { presence: [], message: [], world: [], wave: [], plans: [], auth: [] };

const now = () => Date.now();
const DAY = 86400000;
const uid = () => Math.random().toString(36).slice(2, 10) + now().toString(36);
const today = () => new Date().toISOString().slice(0, 10);

function load() {
  try {
    return JSON.parse(localStorage.getItem(DB_KEY)) || empty();
  } catch { return empty(); }
}
function empty() {
  return { users: {}, profiles: {}, waves: [], threads: {}, messages: [], world: [], plans: [],
    suggestions: [], ads: [], twins: {}, twinChats: [], blocks: [], reports: [], scores: [],
    views: [], interests: {}, counter: 1000, otps: {} };
}
function save(db) { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function tx(fn) { const db = load(); const out = fn(db); save(db); return out; }
function emit(type, payload) {
  bc?.postMessage({ type, payload });
  for (const h of handlers[type] || []) h(payload);
}
bc?.addEventListener("message", (e) => { for (const h of handlers[e.data.type] || []) h(e.data.payload); });

function session() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; }
}
function requireUser() {
  const s = session();
  if (!s) throw new Error("Please sign in first.");
  return s.userId;
}
function assertClean(text) {
  if (CONTACT_PATTERN.test(text)) throw new Error("No phone numbers, emails or links, please.");
}
function isBlocked(db, a, b) {
  return db.blocks.some((x) => (x.by === a && x.who === b) || (x.by === b && x.who === a));
}

export const local = {
  mode: "demo",

  // ---------- auth ----------
  async getSession() { return session(); },
  onAuth(fn) { handlers.auth.push(fn); },
  async signInWithOtp(contact) {
    contact = emailAddress(contact);
    const code = String(Math.floor(100000 + Math.random() * 900000));
    tx((db) => { db.otps[contact] = { code, at: now() }; });
    return { sent: true, demoCode: code };
  },
  async verifyOtp(contact, code) {
    contact = emailAddress(contact);
    const userId = tx((db) => {
      const o = db.otps[contact];
      if (!o || o.code !== code.trim() || now() - o.at > 10 * 60000) throw new Error("That code is not right or has expired.");
      delete db.otps[contact];
      let u = Object.values(db.users).find((x) => x.contact === contact);
      if (!u) {
        u = { id: uid(), contact, created: now() };
        db.users[u.id] = u;
        db.counter += 1;
        db.profiles[u.id] = { id: u.id, residentNo: db.counter, visible: true, emailAlerts: true,
          name: "", role: "", oneLiner: "", openTo: "walk", interests: [], reasons: [],
          links: {}, look: "casual", skin: 0xa86b47, home: "", hours: [], about: {}, created: now() };
      }
      return u.id;
    });
    sessionStorage.setItem(SESSION_KEY, JSON.stringify({ userId, contact }));
    for (const h of handlers.auth) h(session());
    return session();
  },
  async signOut() {
    sessionStorage.removeItem(SESSION_KEY);
    for (const h of handlers.auth) h(null);
  },

  // ---------- profiles ----------
  async getMyProfile() { const id = session()?.userId; return id ? load().profiles[id] : null; },
  async saveProfile(patch) {
    const id = requireUser();
    if (patch.oneLiner) assertClean(patch.oneLiner);
    return tx((db) => (db.profiles[id] = { ...db.profiles[id], ...patch, updated: now() }));
  },
  async getProfile(id) {
    const db = load();
    const p = db.profiles[id];
    if (!p) return null;
    const me = session()?.userId;
    if (me && isBlocked(db, me, id)) return { ...p, links: {} };
    return p;
  },
  async listMembers() {
    const db = load();
    const me = session()?.userId;
    return Object.values(db.profiles).filter((p) => p.name && p.visible && p.id !== me && !(me && isBlocked(db, me, p.id)));
  },
  async recordView(id) {
    const me = session()?.userId;
    if (!me || me === id) return;
    tx((db) => { db.views.push({ by: me, who: id, at: now() }); });
  },
  async viewsThisWeek() {
    const me = session()?.userId;
    if (!me) return [];
    const db = load();
    const ids = [...new Set(db.views.filter((v) => v.who === me && now() - v.at < 7 * DAY).map((v) => v.by))];
    return ids.map((id) => db.profiles[id]).filter(Boolean);
  },

  // ---------- presence ----------
  _presence: new Map(),
  _self: null,
  joinPresence(state) {
    this._self = { ...state, at: now() };
    if (this._timer) clearInterval(this._timer);
    const tick = () => { this._self.at = now(); bc?.postMessage({ type: "presence", payload: this._self }); this._prune(); };
    this._timer = setInterval(tick, 1500);
    tick();
  },
  updatePresence(patch) { if (this._self) Object.assign(this._self, patch); },
  onPresence(fn) {
    handlers.presence.push((p) => {
      if (!p || !p.key) return;
      this._presence.set(p.key, p);
      fn(this.presenceList());
    });
  },
  _prune() {
    for (const [k, p] of this._presence) if (now() - p.at > 6000) this._presence.delete(k);
  },
  presenceList() {
    this._prune();
    return [...this._presence.values()];
  },

  // ---------- waves ----------
  async wave(toId) {
    const me = requireUser();
    const w = tx((db) => {
      if (isBlocked(db, me, toId)) throw new Error("You cannot wave at this person.");
      const mine = db.waves.filter((x) => x.from === me && x.day === today());
      if (mine.length >= LIMITS.wavesPerDay) throw new Error("That is enough waves for today.");
      if (mine.filter((x) => x.to === toId).length >= LIMITS.wavesPerPersonPerDay) throw new Error("You already waved at them today.");
      const wave = { id: uid(), from: me, to: toId, day: today(), at: now() };
      db.waves.push(wave);
      return wave;
    });
    emit("wave", w);
    return w;
  },
  onWave(fn) { handlers.wave.push(fn); },

  // ---------- connections and chat ----------
  async sendRequest(toId, text) {
    const me = requireUser();
    assertClean(text);
    const msg = tx((db) => {
      if (isBlocked(db, me, toId)) throw new Error("You cannot message this person.");
      const key = [me, toId].sort().join(":");
      let t = db.threads[key];
      if (!t) {
        const todays = Object.values(db.threads).filter((x) => x.from === me && new Date(x.created).toISOString().slice(0, 10) === today());
        if (todays.length >= LIMITS.requestsPerDay) throw new Error("That is enough new requests for today.");
        t = db.threads[key] = { id: key, from: me, to: toId, accepted: false, created: now() };
      }
      if (!t.accepted) {
        if (t.from !== me) { t.accepted = true; } // replying accepts
        else {
          const sent = db.messages.filter((m) => m.thread === key && m.from === me).length;
          if (sent >= LIMITS.messagesBeforeReply) throw new Error("Wait for them to reply before sending more.");
        }
      }
      const m = { id: uid(), thread: key, from: me, to: toId, text, at: now() };
      db.messages.push(m);
      return m;
    });
    emit("message", msg);
    return msg;
  },
  async listConnections() {
    const me = requireUser();
    const db = load();
    const out = { chats: [], requests: [], sent: [] };
    for (const t of Object.values(db.threads)) {
      if (t.from !== me && t.to !== me) continue;
      const other = t.from === me ? t.to : t.from;
      if (isBlocked(db, me, other)) continue;
      const msgs = db.messages.filter((m) => m.thread === t.id);
      const last = msgs[msgs.length - 1];
      const expired = !t.accepted && now() - t.created > LIMITS.requestExpiryDays * DAY;
      if (expired) continue;
      const row = { thread: t.id, other: db.profiles[other] || { id: other, name: "Someone" }, last, accepted: t.accepted, msgs };
      if (t.accepted) out.chats.push(row);
      else if (t.from === me) out.sent.push(row);
      else out.requests.push(row);
    }
    for (const k of ["chats", "requests", "sent"]) out[k].sort((a, b) => (b.last?.at || 0) - (a.last?.at || 0));
    return out;
  },
  async getMessages(threadId) {
    const me = requireUser();
    const db = load();
    const t = db.threads[threadId];
    if (!t || (t.from !== me && t.to !== me)) return [];
    return db.messages.filter((m) => m.thread === threadId);
  },
  async getMessagesWith(otherId) {
    const me = requireUser();
    return this.getMessages([me, otherId].sort().join(":"));
  },
  onMessage(fn) { handlers.message.push(fn); },

  // ---------- world chat ----------
  async postWorld(text) {
    const me = requireUser();
    assertClean(text);
    if (!text.trim()) return;
    const db0 = load();
    const name = db0.profiles[me]?.name || "Someone";
    const m = tx((db) => { const m = { id: uid(), from: me, name, text: text.slice(0, 280), at: now() }; db.world.push(m); db.world = db.world.slice(-200); return m; });
    emit("world", m);
    return m;
  },
  async listWorld() { return load().world.slice(-100); },
  onWorld(fn) { handlers.world.push(fn); },

  // ---------- plans ----------
  async listPlans() {
    const db = load();
    return db.plans.filter((p) => now() - p.created < LIMITS.planLifetimeDays * DAY)
      .map((p) => ({ ...p, host: db.profiles[p.by], people: p.joined.map((id) => db.profiles[id]?.name || "Someone") }));
  },
  async postPlan(plan) {
    const me = requireUser();
    assertClean(plan.title + " " + (plan.where || ""));
    const p = tx((db) => { const p = { id: uid(), by: me, joined: [me], created: now(), ...plan }; db.plans.push(p); return p; });
    emit("plans", p);
    return p;
  },
  async joinPlan(id, on = true) {
    const me = requireUser();
    tx((db) => {
      const p = db.plans.find((x) => x.id === id);
      if (!p) return;
      p.joined = on ? [...new Set([...p.joined, me])] : p.joined.filter((x) => x !== me);
    });
    emit("plans", { id });
  },
  onPlans(fn) { handlers.plans.push(fn); },
  async markInterested(eventId, on = true) {
    const me = session()?.userId || "visitor";
    return tx((db) => {
      const set = new Set(db.interests[eventId] || []);
      on ? set.add(me) : set.delete(me);
      db.interests[eventId] = [...set];
      return set.size;
    });
  },
  async interestCount(eventId) { return (load().interests[eventId] || []).length; },

  // ---------- feedback and ads ----------
  async sendSuggestion(s) { tx((db) => db.suggestions.push({ ...s, by: session()?.userId || null, at: now() })); },
  async sendAdRequest(a) { tx((db) => db.ads.push({ ...a, by: session()?.userId || null, at: now() })); },

  // ---------- AI twin ----------
  async getTwin(ownerId) { return load().twins[ownerId || session()?.userId] || null; },
  async saveTwin(t) {
    const me = requireUser();
    for (const v of Object.values(t.answers || {})) assertClean(v || "");
    return tx((db) => (db.twins[me] = { ...db.twins[me], ...t, updated: now() }));
  },
  async clearTwin() {
    const me = requireUser();
    tx((db) => { delete db.twins[me]; db.twinChats = db.twinChats.filter((c) => c.owner !== me); });
  },
  async logTwinChat(owner, from, q, a) {
    tx((db) => {
      db.twinChats.push({ owner, from, q, a, at: now() });
      db.twinChats = db.twinChats.filter((c) => now() - c.at < LIMITS.twinChatRetentionDays * DAY);
    });
  },
  async twinChats() {
    const me = requireUser();
    const db = load();
    return db.twinChats.filter((c) => c.owner === me).map((c) => ({ ...c, fromName: db.profiles[c.from]?.name || "A member" }));
  },

  // ---------- safety ----------
  async block(id) { const me = requireUser(); tx((db) => db.blocks.push({ by: me, who: id, at: now() })); },
  async report(id, reason) {
    const me = requireUser();
    tx((db) => {
      const key = [me, id].sort().join(":");
      db.reports.push({ by: me, who: id, reason, chat: db.messages.filter((m) => m.thread === key), at: now() });
    });
  },

  // ---------- scores ----------
  async submitScore(game, score) {
    const me = session()?.userId;
    if (!me) return;
    const name = load().profiles[me]?.name || "Someone";
    tx((db) => { db.scores.push({ game, score, by: me, name, at: now() }); });
  },
  async topScores(game) {
    const best = new Map();
    for (const s of load().scores.filter((x) => x.game === game)) if (!best.has(s.by) || best.get(s.by).score < s.score) best.set(s.by, s);
    return [...best.values()].sort((a, b) => b.score - a.score).slice(0, 10);
  },
};
