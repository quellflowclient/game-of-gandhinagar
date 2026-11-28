// Supabase backend. Used when VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set.
// Needs the tables, policies and functions in supabase/schema.sql.
import { createClient } from "@supabase/supabase-js";
import { ENV, LIMITS, CONTACT_PATTERN } from "../config.js";
import {emailAddress,emailOtpRequest} from './email.js';
import {timeoutSignal} from '../systems/network.js';

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

// ---------- multiplayer networking, built for ~500 concurrent players ----------
// Positions: write ≤1/s when moving (heartbeat 12 s when idle), read a compact
// CDN-cached area snapshot every second (api/positions.js). Names/looks come from
// a nearby roster refreshed every 20 s. Private events (DMs, waves, calls, voice
// signals) arrive on the private Realtime topic user:<id>, pushed by DB triggers to
// just the two people involved. Nothing fans out to all players any more.
const CELL=160, POS_MS=1000, ROSTER_MS=20000, LEGACY_MS=4000, HEARTBEAT_MS=12000, INBOX_POLL_MS=12000;
let online=[], counts={}, roster=new Map(), state=null, generation=0, joinRevision=0;
let timers=[], inbox=null, inboxLive=false, inboxSeen=null, sendTask=null, lastSent=null, dirty=false;
let snapshotApi=true, legacy=false, worldTop=0, polling=false;
const presenceFns = [];
const messageFns = [], worldFns = [], waveFns = [], planFns = [];
const callFns=[],signalFns=[];
const sessionValue = s => s?.user?.email_confirmed_at ? { userId:s.user.id, contact:s.user.email } : null;
const emitPresence = () => presenceFns.forEach(fn => fn(online));
const missingFn = e => /PGRST202|Could not find the function|does not exist/i.test(`${e?.code||''} ${e?.message||''}`);
const rebuildOnline = () => { online=[...roster.values()]; emitPresence(); };
async function refreshRoster(epoch=generation) {
  if (!state?.userId) return;
  if (!legacy) {
    const {data,error}=await sb.rpc('online_players_near',{pp:state.place||null,px:state.x??0,pz:state.z??0});
    if (epoch!==generation) return;
    if (error) { if(missingFn(error)) {legacy=true;openLegacyEvents(state.userId);} else return; }
    else if (data) {
      counts=data.counts||{}; const next=new Map();
      for (const p of data.players||[]) {
        const old=roster.get(p.residentNo);
        // Keep the fresher snapshot position if the roster row is older.
        next.set(p.residentNo, old&&+new Date(old.updatedAt)>+new Date(p.updatedAt)?{...p,x:old.x,y:old.y,z:old.z,heading:old.heading,vehicle:old.vehicle,updatedAt:old.updatedAt}:p);
      }
      roster=next; rebuildOnline(); return;
    }
  }
  // Older database without scale-500.sql: plain polling, still no realtime fan-out.
  const {data,error}=await sb.rpc('online_players');
  if (epoch!==generation||error) return;
  roster=new Map((data||[]).map((p,i)=>[p.residentNo??`l${i}`,p])); counts={};
  for (const p of data||[]) if(p.place) counts[p.place]=(counts[p.place]||0)+1;
  rebuildOnline();
}
async function fetchSnapshot(place,cx,cz) {
  if (snapshotApi) {
    try {
      const r=await fetch(`/api/positions?place=${place}&cx=${cx}&cz=${cz}`,{signal:timeoutSignal(4000)});
      if (r.ok && (r.headers.get('content-type')||'').includes('json')) return await r.json();
      if (r.status===404 || r.ok) snapshotApi=false; // dev server / not deployed: ask the DB directly
      else return null; // temporary edge/DB error: try again next tick
    } catch { return null; }
  }
  const {data,error}=await sb.rpc('positions_snapshot',{pp:place,cx,cz});
  if (error) { if(missingFn(error)) legacy=true; return null; }
  return data;
}
async function pollPositions(epoch=generation) {
  if (polling || legacy || !state?.userId || !['ldrp','dandi','gift','swagat'].includes(state.place) || state.x==null || document.hidden) return;
  polling=true;
  try {
    const snap=await fetchSnapshot(state.place, Math.floor(state.x/CELL), Math.floor(state.z/CELL));
    if (epoch!==generation || !snap) return;
    const at=new Date(snap.t||Date.now()).toISOString();
    for (const [n,x,y,z,h,v] of snap.p||[]) { const p=roster.get(n); if(p){p.x=x;p.y=y;p.z=z;p.heading=h;p.vehicle=v;p.updatedAt=at;} }
    if (snap.w>worldTop) { if(worldTop) worldFns.forEach(fn=>fn({id:snap.w,from:null,name:'',text:'',at:Date.now()})); worldTop=snap.w; }
    rebuildOnline();
  } finally { polling=false; }
}
async function sendPosition(force=false) {
  if (!state?.userId || sendTask || !['ldrp','dandi','gift','swagat'].includes(state.place) || state.x==null) return;
  const now=Date.now(), p={...state};
  const moved=!lastSent || Math.hypot(p.x-lastSent.x,p.z-lastSent.z)>.4 || Math.abs((p.heading||0)-lastSent.heading)>.25
    || p.vehicle!==lastSent.vehicle || p.place!==lastSent.place || Math.abs((p.y||0)-lastSent.y)>.5;
  // Busy city (>400 online): send every 2 s instead of 1 s so DB load stays flat as
  // more people join. There is no player limit; the game just gets slightly less chatty.
  const gap=Object.values(counts).reduce((x,y)=>x+y,0)>400?2000:1000;
  if (!force && (!dirty || now-(lastSent?.at||0)<gap || (!moved && now-lastSent.at<HEARTBEAT_MS))) return;
  dirty=false; lastSent={x:p.x,z:p.z,y:p.y||0,heading:p.heading||0,vehicle:p.vehicle,place:p.place,at:now};
  try {
    sendTask=sb.rpc('update_player_presence', {px:p.x,py:p.y||0,pz:p.z,ph:p.heading||0,pv:p.vehicle||'walk',pp:p.place});
    const {error} = await sendTask;
    if(error) console.warn('Multiplayer position:',error.message);
  } finally { sendTask=null; }
}
function every(ms,fn) { timers.push(setInterval(fn,ms)); }
// Fallback when the private Realtime topic is unavailable: tiny "anything new?" check.
async function pollInbox() {
  if (inboxLive || !state?.userId || legacy) return;
  const {data,error}=await sb.rpc('my_inbox_version'); if(error||!data) return;
  if (inboxSeen && data.m>inboxSeen.m) messageFns.forEach(fn=>fn({id:data.m,thread:null,from:null,text:'',at:Date.now()}));
  inboxSeen=data;
}
function openInbox(userId) {
  inboxLive=false;
  inbox=sb.channel(`user:${userId}`,{config:{private:true,broadcast:{self:false,ack:false}}});
  inbox.on('broadcast',{event:'message'},({payload:m})=>messageFns.forEach(fn=>fn(m)));
  inbox.on('broadcast',{event:'wave'},({payload:w})=>waveFns.forEach(fn=>fn(w)));
  inbox.on('broadcast',{event:'call'},({payload:c})=>callFns.forEach(fn=>fn(c)));
  inbox.on('broadcast',{event:'signal'},({payload:s})=>signalFns.forEach(fn=>fn(s)));
  inbox.subscribe(status=>{inboxLive=status==='SUBSCRIBED'; if(!inboxLive)pollInbox();});
}
let visibilityBound=false, legacyEvents=null;
function openLegacyEvents(userId) {
  if (legacyEvents) return;
  legacyEvents=sb.channel(`legacy-${userId}-${generation}`);
  legacyEvents.on("postgres_changes",{event:"INSERT",schema:"public",table:"messages"},({new:m})=>messageFns.forEach(fn=>fn({id:m.id,thread:m.thread,from:m.sender,text:m.body,at:+new Date(m.created_at)})));
  legacyEvents.on("postgres_changes",{event:"INSERT",schema:"public",table:"waves",filter:`target=eq.${userId}`},({new:w})=>waveFns.forEach(fn=>fn({from:w.sender,to:w.target})));
  legacyEvents.on("postgres_changes",{event:"*",schema:"public",table:"voice_calls"},({new:c})=>callFns.forEach(fn=>fn(c)));
  legacyEvents.on("postgres_changes",{event:"INSERT",schema:"public",table:"voice_signals"},({new:x})=>signalFns.forEach(fn=>fn(x)));
  legacyEvents.on("postgres_changes",{event:"INSERT",schema:"public",table:"world_messages"},({new:m})=>worldFns.forEach(fn=>fn({id:m.id,from:m.sender,name:"",text:m.body,at:+new Date(m.created_at)})));
  legacyEvents.subscribe();
}
async function leavePresence() {
  generation++; timers.forEach(clearInterval); timers=[];
  if(inbox) { sb.removeChannel(inbox); inbox=null; inboxLive=false; }
  if(legacyEvents) { sb.removeChannel(legacyEvents); legacyEvents=null; }
  const wasJoined = !!state?.userId;
  state=null; dirty=false; lastSent=null; online=[]; roster=new Map(); counts={}; inboxSeen=null; emitPresence();
  if(wasJoined) {if(sendTask)await sendTask;await sb.rpc('leave_city');}
}

export const supabase = {
  async entertainmentCatalog(){return ok(await sb.rpc('entertainment_catalog'));},
  async joinConcert(eventId,tier){return ok(await sb.rpc('join_concert',{eid:eventId,zone:tier}));},
  async renewConcert(eventId){return ok(await sb.rpc('renew_concert',{eid:eventId}));},
  async eventReceipt(eventId){return ok(await sb.rpc('event_receipt',{eid:eventId}));},
  async leaveConcert(eventId){return ok(await sb.rpc('leave_concert',{eid:eventId}));},
  async venueAction(venue,kind){return ok(await sb.rpc('venue_action',{venue,kind}));},
  async venuePeople(venue){return ok(await sb.rpc('venue_people',{venue}));},
  refreshNearby(){return refreshRoster();},
  watchVenue(venue,fn){const ch=sb.channel(`venue:${venue}:${Math.random().toString(36).slice(2)}`).on('postgres_changes',{event:'*',schema:'public',table:'venue_presence',filter:`venue_id=eq.${venue}`},fn).subscribe();return()=>sb.removeChannel(ch);},
  watchEntertainment(fn){const ch=sb.channel('events:catalog').on('broadcast',{event:'update'},fn).subscribe();return()=>sb.removeChannel(ch);},
  async getGameContent(){const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),3500);try{const {data,error}=await sb.from('game_content').select('config,revision').eq('id','published').maybeSingle().abortSignal(controller.signal);if(error)throw error;return data;}finally{clearTimeout(timer);}},
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
  async signInWithOtp(contact,options) {
    ok(await sb.auth.signInWithOtp(emailOtpRequest(contact,{...options,origin:location.origin})));
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
    if(!visibilityBound){visibilityBound=true;document.addEventListener('visibilitychange',()=>{if(!document.hidden&&state){pollPositions();refreshRoster();}});}
    openInbox(next.userId);
    every(POS_MS,()=>{sendPosition();pollPositions(epoch);});
    every(ROSTER_MS,()=>{if(!legacy)refreshRoster(epoch);});
    every(LEGACY_MS,()=>{if(legacy)refreshRoster(epoch);});
    every(INBOX_POLL_MS,()=>pollInbox());
    dirty=true; await sendPosition(true); await refreshRoster(epoch); await pollPositions(epoch);
  },
  updatePresence(patch) {
    if (!state) {if(patch.userId)this.joinPresence(patch);return;}
    if(patch.userId === undefined && 'key' in patch) {leavePresence();return;}
    const placeChanged=patch.place&&patch.place!==state.place;
    Object.assign(state,patch);dirty=true;
    if(placeChanged){sendPosition(true);refreshRoster();}
  },
  onPresence(fn) { presenceFns.push(fn); },
  presenceList() { return online; },
  placeCounts() { return counts; },
  // Consented GPS location; only admins can read it (admin_locations).
  async updateLocation(lat,lng,accuracy){ok(await sb.rpc("update_my_location",{plat:lat,plng:lng,pacc:accuracy??null}));},
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
  async incomingCall(){const id=await me();if(!id)return null;return ok(await sb.from('voice_calls').select('*').eq('callee',id).eq('status','ringing').gte('created_at',new Date(Date.now()-45000).toISOString()).order('created_at',{ascending:false}).limit(1).maybeSingle());},
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
    const row=ok(await sb.from("world_messages").insert({ body: text.slice(0, 280) }).select().single());
    if(row?.id>worldTop)worldTop=row.id;
    return row;
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
