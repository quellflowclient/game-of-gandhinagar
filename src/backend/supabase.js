// Supabase backend. Used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
// Needs the tables, policies and functions in supabase/schema.sql.
// NOTE: written against supabase-js v2 but not yet run against a live project.
import { createClient } from "@supabase/supabase-js";
import { ENV, LIMITS, CONTACT_PATTERN } from "../config.js";

const sb = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
const DAY = 86400000;

// DB rows use snake_case; the app uses camelCase.
const toApp = (r) => r && ({
  id: r.id, residentNo: r.resident_no, name: r.name, role: r.role, oneLiner: r.one_liner,
  openTo: r.open_to, interests: r.interests || [], reasons: r.reasons || [], links: r.links || {},
  look: r.look, skin: r.skin, home: r.home, hours: r.hours || [], about: r.about || {},
  visible: r.visible, emailAlerts: r.email_alerts, lastX: r.last_x, lastZ: r.last_z,
});
const toDb = (p) => {
  const map = { residentNo: "resident_no", oneLiner: "one_liner", openTo: "open_to", emailAlerts: "email_alerts" };
  const out = {};
  for (const [k, v] of Object.entries(p)) out[map[k] || k] = v;
  return out;
};
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const me = async () => (await sb.auth.getSession()).data.session?.user?.id || null;
const clean = (t) => { if (CONTACT_PATTERN.test(t || "")) throw new Error("No phone numbers, emails or links, please."); };

let channel = null;
const presenceFns = [];

export const supabase = {
  mode: "live",

  async getSession() {
    const s = (await sb.auth.getSession()).data.session;
    return s ? { userId: s.user.id, contact: s.user.email || s.user.phone } : null;
  },
  onAuth(fn) {
    sb.auth.onAuthStateChange((_e, s) => fn(s ? { userId: s.user.id, contact: s.user.email || s.user.phone } : null));
  },
  async signInWithOtp(contact) {
    const isEmail = contact.includes("@");
    const opts = isEmail ? { email: contact.trim() } : { phone: contact.replace(/\s/g, ""), options: { channel: "whatsapp" } };
    ok(await sb.auth.signInWithOtp(opts));
    return { sent: true };
  },
  async verifyOtp(contact, code) {
    const isEmail = contact.includes("@");
    const opts = isEmail ? { email: contact.trim(), token: code.trim(), type: "email" }
      : { phone: contact.replace(/\s/g, ""), token: code.trim(), type: "sms" };
    ok(await sb.auth.verifyOtp(opts));
    return this.getSession();
  },
  async signOut() { await sb.auth.signOut(); },
  async accessToken() { return (await sb.auth.getSession()).data.session?.access_token || null; },

  async getMyProfile() {
    if (!(await me())) return null;
    return toApp(ok(await sb.rpc("my_profile")));
  },
  async saveProfile(patch) {
    const id = await me();
    clean(patch.oneLiner);
    const { residentNo, id: _id, ...rest } = patch; // not writable
    ok(await sb.from("profiles").update(toDb(rest)).eq("id", id));
    return this.getMyProfile();
  },
  async getProfile(id) {
    // Links come from a separate view that hides them from blocked people (see schema).
    const p = toApp(ok(await sb.from("public_profiles").select("*").eq("id", id).maybeSingle()));
    return p;
  },
  async listMembers() {
    return (ok(await sb.from("public_profiles").select("*").neq("name", "")) || []).map(toApp);
  },
  async recordView(id) { const m = await me(); if (m && m !== id) await sb.from("profile_views").insert({ who: id }); },
  async viewsThisWeek() {
    const rows = ok(await sb.rpc("views_this_week")) || [];
    return rows.map(toApp);
  },

  // Presence: one realtime channel for the whole city.
  joinPresence(state) {
    channel = sb.channel("city", { config: { presence: { key: state.key } } });
    channel.on("presence", { event: "sync" }, () => {
      const list = Object.values(channel.presenceState()).map((arr) => arr[0]);
      for (const fn of presenceFns) fn(list);
    });
    channel.on("broadcast", { event: "wave" }, ({ payload }) => this._onWave?.(payload));
    channel.subscribe((status) => { if (status === "SUBSCRIBED") channel.track(state); });
    this._state = state;
  },
  updatePresence(patch) {
    if (!channel) return;
    Object.assign(this._state, patch);
    clearTimeout(this._t);
    this._t = setTimeout(() => channel.track(this._state), 400); // throttle position updates
  },
  onPresence(fn) { presenceFns.push(fn); },
  presenceList() { return channel ? Object.values(channel.presenceState()).map((a) => a[0]) : []; },

  async wave(toId) {
    const w = ok(await sb.rpc("send_wave", { target: toId }));
    channel?.send({ type: "broadcast", event: "wave", payload: { from: await me(), to: toId } });
    return w;
  },
  onWave(fn) { this._onWave = fn; },

  async sendRequest(toId, text) {
    clean(text);
    return ok(await sb.rpc("send_message", { target: toId, body: text }));
  },
  async listConnections() {
    const id = await me();
    const threads = ok(await sb.from("threads").select("*, messages(*)").or(`a.eq.${id},b.eq.${id}`)) || [];
    const others = [...new Set(threads.map((t) => (t.a === id ? t.b : t.a)))];
    const profs = others.length ? ok(await sb.from("public_profiles").select("*").in("id", others)) : [];
    const pmap = Object.fromEntries(profs.map((p) => [p.id, toApp(p)]));
    const out = { chats: [], requests: [], sent: [] };
    for (const t of threads) {
      const other = t.a === id ? t.b : t.a;
      const msgs = (t.messages || []).sort((x, y) => new Date(x.created_at) - new Date(y.created_at))
        .map((m) => ({ id: m.id, from: m.sender, text: m.body, at: +new Date(m.created_at) }));
      const expired = !t.accepted && Date.now() - +new Date(t.created_at) > LIMITS.requestExpiryDays * DAY;
      if (expired) continue;
      const row = { thread: t.id, other: pmap[other] || { id: other, name: "Someone" }, last: msgs.at(-1), accepted: t.accepted, msgs };
      if (t.accepted) out.chats.push(row); else if (t.started_by === id) out.sent.push(row); else out.requests.push(row);
    }
    return out;
  },
  async getMessages(threadId) {
    return (ok(await sb.from("messages").select("*").eq("thread", threadId).order("created_at")) || [])
      .map((m) => ({ id: m.id, from: m.sender, text: m.body, at: +new Date(m.created_at) }));
  },
  async getMessagesWith(otherId) {
    const id = await me();
    const [a, b] = [id, otherId].sort();
    const t = ok(await sb.from("threads").select("id").eq("a", a).eq("b", b).maybeSingle());
    return t ? this.getMessages(t.id) : [];
  },
  onMessage(fn) {
    sb.channel("my-messages").on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" },
      (p) => fn({ id: p.new.id, thread: p.new.thread, from: p.new.sender, text: p.new.body, at: +new Date(p.new.created_at) })).subscribe();
  },

  async postWorld(text) {
    clean(text);
    return ok(await sb.from("world_messages").insert({ body: text.slice(0, 280) }).select().single());
  },
  async listWorld() {
    const rows = ok(await sb.from("world_messages").select("*, profiles(name)").order("created_at", { ascending: false }).limit(100)) || [];
    return rows.reverse().map((m) => ({ id: m.id, from: m.sender, name: m.profiles?.name || "Someone", text: m.body, at: +new Date(m.created_at) }));
  },
  onWorld(fn) {
    sb.channel("world").on("postgres_changes", { event: "INSERT", schema: "public", table: "world_messages" },
      (p) => fn({ id: p.new.id, from: p.new.sender, name: "", text: p.new.body, at: +new Date(p.new.created_at) })).subscribe();
  },

  async listPlans() {
    const rows = ok(await sb.from("plans").select("*, plan_members(user_id, profiles(name)), profiles!plans_host_fkey(name)")
      .gt("created_at", new Date(Date.now() - LIMITS.planLifetimeDays * DAY).toISOString())) || [];
    return rows.map((p) => ({ id: p.id, by: p.host, cat: p.cat, title: p.title, when: p.when_text, where: p.where_text,
      host: { name: p.profiles?.name }, joined: p.plan_members.map((m) => m.user_id),
      people: p.plan_members.map((m) => m.profiles?.name || "Someone"), created: +new Date(p.created_at) }));
  },
  async postPlan(plan) {
    clean(plan.title + " " + (plan.where || ""));
    const p = ok(await sb.from("plans").insert({ cat: plan.cat, title: plan.title, when_text: plan.when, where_text: plan.where }).select().single());
    await sb.from("plan_members").insert({ plan: p.id });
    return p;
  },
  async joinPlan(id, on = true) {
    if (on) await sb.from("plan_members").insert({ plan: id });
    else await sb.from("plan_members").delete().eq("plan", id).eq("user_id", await me());
  },
  onPlans(fn) {
    sb.channel("plans").on("postgres_changes", { event: "*", schema: "public", table: "plans" }, () => fn({})).subscribe();
  },
  async markInterested(eventId, on = true) {
    if (on) await sb.from("event_interests").upsert({ event_id: eventId });
    else await sb.from("event_interests").delete().eq("event_id", eventId).eq("user_id", await me());
    return this.interestCount(eventId);
  },
  async interestCount(eventId) {
    const { count } = await sb.from("event_interests").select("*", { count: "exact", head: true }).eq("event_id", eventId);
    return count || 0;
  },

  async sendSuggestion(s) { ok(await sb.from("suggestions").insert({ kind: s.type, body: s.text })); },
  async sendAdRequest(a) { ok(await sb.from("ad_requests").insert({ kind: a.kind, place: a.place, business: a.business, contact: a.contact, note: a.note })); },

  async getTwin(ownerId) {
    const id = ownerId || (await me());
    const r = ok(await sb.from("twins").select("*").eq("owner", id).maybeSingle());
    return r && { enabled: r.enabled, adult: r.adult, answers: r.answers || {} };
  },
  async saveTwin(t) {
    for (const v of Object.values(t.answers || {})) clean(v);
    ok(await sb.from("twins").upsert({ owner: await me(), enabled: !!t.enabled, adult: !!t.adult, answers: t.answers || {} }));
  },
  async clearTwin() { const id = await me(); await sb.from("twins").delete().eq("owner", id); await sb.from("twin_chats").delete().eq("owner", id); },
  async logTwinChat() { /* written server-side by the AI endpoint */ },
  async twinChats() {
    return (ok(await sb.from("twin_chats").select("*, profiles!twin_chats_asker_fkey(name)").eq("owner", await me()).order("created_at")) || [])
      .map((c) => ({ q: c.question, a: c.answer, fromName: c.profiles?.name || "A member", at: +new Date(c.created_at) }));
  },

  async block(id) { ok(await sb.from("blocks").insert({ who: id })); },
  async report(id, reason) { ok(await sb.rpc("report_user", { target: id, reason })); },

  async submitScore(game, score) { if (await me()) await sb.from("scores").insert({ game, score }); },
  async topScores(game) {
    return (ok(await sb.rpc("top_scores", { g: game })) || []).map((s) => ({ name: s.name, score: s.score }));
  },
};
