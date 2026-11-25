// Supabase backend. Used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
// Needs the tables, policies and functions in supabase/schema.sql.
import { createClient } from "@supabase/supabase-js";
import { ENV, LIMITS, CONTACT_PATTERN } from "../config.js";
import {emailAddress} from './email.js';

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
  const map = { residentNo: "resident_no", oneLiner: "one_liner", openTo: "open_to", emailAlerts: "email_alerts",lastX:'last_x',lastZ:'last_z' };
  const out = {};
  for (const [k, v] of Object.entries(p)) if(v!==undefined)out[map[k] || k] = v;
  return out;
};
const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const me = async () => (await sb.auth.getSession()).data.session?.user?.id || null;
const clean = (t) => { if (CONTACT_PATTERN.test(t || "")) throw new Error("No phone numbers, emails or links, please."); };

let channel = null, online = [], state = null, generation = 0, joinRevision=0, refreshTimer, heartbeat, sending = false, dirty = false, sendTask=null;
const presenceFns = [];
const messageFns = [], worldFns = [], waveFns = [], planFns = [];
const callFns=[],signalFns=[];
const sessionValue = s => s?.user?.email_confirmed_at ? { userId:s.user.id, contact:s.user.email } : null;
const emitPresence = () => presenceFns.forEach(fn => fn(online));
async function refreshOnline(epoch = generation) {
  if (!state?.userId) return;
  const {data,error} = await sb.rpc('online_players');
  if (epoch !== generation || error) return;
  online = data || []; emitPresence();
}
async function sendPosition() {
  if (!state?.userId || sending || !dirty || !['ldrp','dandi'].includes(state.place)) return;
  sending = true; dirty = false;
  const p = {...state};
  try {
    sendTask=sb.rpc('update_player_presence', {px:p.x,py:p.y||0,pz:p.z,ph:p.heading||0,pv:p.vehicle||'walk',pp:p.place});
    const {error} = await sendTask;
    if(error) console.warn('Multiplayer position:',error.message);
  } finally { sending=false;sendTask=null; }
}
async function leavePresence() {
  generation++; clearTimeout(refreshTimer); clearInterval(heartbeat);
  if(channel) { sb.removeChannel(channel); channel=null; }
  const wasJoined = !!state?.userId;
  state=null; dirty=false; online=[]; emitPresence();
  if(wasJoined) {if(sendTask)await sendTask;await sb.rpc('leave_city');}
}

export const supabase = {
  mode: "live",

  async getSession() {
    const s = (await sb.auth.getSession()).data.session;
    return sessionValue(s);
  },
  onAuth(fn) {
    const {data} = sb.auth.onAuthStateChange((_e, s) => {
      // Supabase auth callbacks must finish before making another auth request.
      setTimeout(()=>fn(sessionValue(s)),0);
    });
    return () => data.subscription.unsubscribe();
  },
  async signInWithOtp(contact) {
    ok(await sb.auth.signInWithOtp({email:emailAddress(contact),options:{emailRedirectTo:location.origin}}));
    return { sent: true };
  },
  async verifyOtp(contact, code) {
    ok(await sb.auth.verifyOtp({email:emailAddress(contact),token:code.trim(),type:'email'}));
    return this.getSession();
  },
  async signOut() { await leavePresence(); ok(await sb.auth.signOut()); },
  async health() { return ok(await sb.rpc('game_health')); },
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
    if (!(await me())) return [];
    return (ok(await sb.from("public_profiles").select("*").neq("name", "")) || []).map(toApp);
  },
  async recordView(id) { const m = await me(); if (m && m !== id) await sb.from("profile_views").insert({ who: id }); },
  async viewsThisWeek() {
    const rows = ok(await sb.rpc("views_this_week")) || [];
    return rows.map(toApp);
  },

  // Authenticated database rows, not client-supplied identity in a public room.
  async joinPresence(next) {
    const request=++joinRevision;
    await leavePresence();
    const session=await this.getSession();
    if(request!==joinRevision||!next.userId || session?.userId!==next.userId) return;
    state={...next}; const epoch=generation;
    channel=sb.channel(`city-${next.userId}-${epoch}`);
    channel.on('postgres_changes',{event:'*',schema:'public',table:'player_presence'},()=>{
      clearTimeout(refreshTimer);refreshTimer=setTimeout(()=>refreshOnline(epoch),80);
    });
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'messages'},({new:m})=>messageFns.forEach(fn=>fn({id:m.id,thread:m.thread,from:m.sender,text:m.body,at:+new Date(m.created_at)})));
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'world_messages'},({new:m})=>worldFns.forEach(fn=>fn({id:m.id,from:m.sender,name:'',text:m.body,at:+new Date(m.created_at)})));
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'waves',filter:`target=eq.${next.userId}`},({new:w})=>waveFns.forEach(fn=>fn({from:w.sender,to:w.target})));
    channel.on('postgres_changes',{event:'*',schema:'public',table:'plans'},()=>planFns.forEach(fn=>fn({})));
    channel.on('postgres_changes',{event:'*',schema:'public',table:'voice_calls'},({new:c})=>callFns.forEach(fn=>fn(c)));
    channel.on('postgres_changes',{event:'INSERT',schema:'public',table:'voice_signals'},({new:s})=>signalFns.forEach(fn=>fn(s)));
    channel.subscribe(status=>{if(status==='SUBSCRIBED'&&epoch===generation){dirty=true;sendPosition();refreshOnline(epoch);}});
    heartbeat=setInterval(()=>{dirty=true;sendPosition();refreshOnline(epoch);},10000);
    dirty=true; await sendPosition(); await refreshOnline(epoch);
  },
  updatePresence(patch) {
    if (!state) {if(patch.userId)this.joinPresence(patch);return;}
    if(patch.userId === undefined && 'key' in patch) {leavePresence();return;}
    Object.assign(state,patch);dirty=true;sendPosition();
  },
  onPresence(fn) { presenceFns.push(fn); },
  presenceList() { return online; },
  async listSeats(){return ok(await sb.from('city_seats').select('*'))||[];},
  async tableAction(id,action,pose={}){return ok(await sb.rpc('table_action',{sid:id,action,px:pose.x??null,pz:pose.z??null,ph:pose.yaw??null}));},
  // Low-latency group voice signalling: realtime presence + broadcast, no table writes.
  voiceRoom(room,who,{onPeers,onSignal}){
    const ch=sb.channel(`voice-room:${room}`,{config:{broadcast:{self:false,ack:false},presence:{key:who.userId}}});
    ch.on('presence',{event:'sync'},()=>onPeers(Object.keys(ch.presenceState())));
    ch.on('broadcast',{event:'signal'},({payload})=>{if(payload?.to===who.userId)onSignal(payload);});
    ch.subscribe(async status=>{if(status==='SUBSCRIBED')await ch.track({name:who.name,at:Date.now()});});
    return {send:payload=>ch.send({type:'broadcast',event:'signal',payload}),leave:()=>{ch.untrack().catch(()=>{});sb.removeChannel(ch);}};
  },
  onCall(fn){callFns.push(fn);},onVoiceSignal(fn){signalFns.push(fn);},
  async startCall(target){return ok(await sb.rpc('start_voice_call',{target}));},
  async setCall(id,status){return ok(await sb.rpc('set_voice_call',{cid:id,next_status:status}));},
  async getCall(id){return ok(await sb.from('voice_calls').select('*').eq('id',id).maybeSingle());},
  async sendVoiceSignal(id,payload){ok(await sb.rpc('send_voice_signal',{cid:id,signal:payload}));},
  async voiceSignals(id){return ok(await sb.from('voice_signals').select('*').eq('call_id',id).order('id'))||[];},

  async wave(toId) {
    const w = ok(await sb.rpc("send_wave", { target: toId }));
    return w;
  },
  onWave(fn) { waveFns.push(fn); },

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
    messageFns.push(fn);
  },

  async postWorld(text) {
    clean(text);
    return ok(await sb.from("world_messages").insert({ body: text.slice(0, 280) }).select().single());
  },
  async listWorld() {
    if (!(await me())) return [];
    const rows = ok(await sb.from("world_messages").select("*, profiles(name)").order("created_at", { ascending: false }).limit(100)) || [];
    return rows.reverse().map((m) => ({ id: m.id, from: m.sender, name: m.profiles?.name || "Someone", text: m.body, at: +new Date(m.created_at) }));
  },
  onWorld(fn) {
    worldFns.push(fn);
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
    planFns.push(fn);
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
