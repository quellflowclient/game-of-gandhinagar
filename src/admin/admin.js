import { createClient } from "@supabase/supabase-js";
import { ENV } from "../config.js";
import { h } from "../ui/dom.js";

// People of Gandhinagar · admin console.
// Read-only views over admin_* RPCs (supabase/admin.sql). Only accounts listed in
// public.admins can read anything; everyone else gets "not an admin".
// "Real time": live positions refresh every 3 s, everything else every 15 s.
const sb = createClient(ENV.supabaseUrl, ENV.supabaseAnonKey);
const root = document.getElementById("admin");
const fmt = {
  n: (v) => (v ?? 0).toLocaleString("en-IN"),
  ago: (t) => { if (!t) return "—"; const s = (Date.now() - Date.parse(t)) / 1000; if (s < 60) return `${Math.max(1, s | 0)}s ago`; if (s < 3600) return `${(s / 60) | 0}m ago`; if (s < 86400) return `${(s / 3600) | 0}h ago`; return `${(s / 86400) | 0}d ago`; },
  date: (t) => t ? new Date(t).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—",
  place: (p) => ({ ldrp: "LDRP campus", dandi: "Mahatma Mandir" })[p] || "—",
};
// Dev-only sample data (npm run dev, /admin.html?mock) to review the console layout.
const MOCK = import.meta.env?.DEV && new URLSearchParams(location.search).has("mock");
const mockData = () => { const now = Date.now(), iso = (m) => new Date(now - m * 60000).toISOString(); const ids = ["a", "b", "c", "d", "e"].map((x) => x.repeat(8) + "-0000-0000-0000-000000000000");
  const users = ["Aarav Patel", "Diya Shah", "Kabir Mehta", "Isha Joshi", "Rohan Desai"].map((n, i) => ({ id: ids[i], email: n.split(" ")[0].toLowerCase() + "@example.com", name: n, role: ["CE student", "IT student", "Visitor", "Faculty", "Hostel D"][i], one_liner: "", resident_no: 1001 + i, visible: true, joined: iso(60 * 24 * (i + 1)), last_sign_in: iso(i * 7), verified: i !== 4, online: i < 3, x: -630 + i * 12, z: -4960 + i * 9, place: i < 2 ? "ldrp" : "dandi", vehicle: ["walk", "cycle", "walk", "walk", "car"][i], seen: iso(i * 3), connections: [2, 2, 1, 1, 0][i], messages: [14, 9, 3, 1, 0][i] }));
  return { is_admin: true, admin_users: users, admin_live: users.filter((u) => u.online).map((u) => ({ id: u.id, name: u.name, x: u.x, z: u.z, heading: 0.6, vehicle: u.vehicle, place: u.place, updated_at: iso(0.1) })),
    admin_overview: { users: 5, verified: 4, new_today: 1, online: 3, connections: 3, accepted: 2, messages: 27, world_messages: 12, waves: 6, calls: 2, history_points: 340 },
    admin_connections: [[0, 1, true, 18], [0, 2, true, 6], [1, 3, false, 0]].map(([a, b, acc, m]) => ({ a: ids[a], a_name: users[a].name, b: ids[b], b_name: users[b].name, accepted: acc, started_by: ids[a], since: iso(300 * (a + 1)), messages: m, last_message: iso(20), waves: 1 })),
    admin_history: Array.from({ length: 8 }, (_, i) => ({ x: -630 + i * 3, z: -4960 + i * 2, place: "ldrp", vehicle: "walk", at: iso(i * 0.4) })) }; };
const rpc = async (name, args) => { if (MOCK) return mockData()[name]; const { data, error } = await sb.rpc(name, args); if (error) throw error; return data; };

// ---------------- sign in ----------------
let mounted=false;
async function start() {
  if (MOCK) return app("mock@example.com");
  // Render an interactive form immediately, even while session restoration waits.
  signIn();
  try {
    const {data,error}=await sb.auth.getSession();
    if(error)throw error;
    if(!data.session)return;
    let admin=false;
    try{admin=await rpc("is_admin");}catch(e){return notAdmin(data.session.user.email,`Admin access could not be checked: ${e.message}`);}
    if(!admin)return notAdmin(data.session.user.email,"This account is not on the admin list.");
    if(!mounted){mounted=true;app(data.session.user.email);}
  }catch(e){root.querySelector(".err")?.replaceChildren(document.createTextNode(e.message));}
}
function authCard(...children) {
  root.replaceChildren(h("main",{class:"auth"},h("section",{class:"auth-card"},
    h("a",{class:"auth-back",href:"/"},"← Back to game"),h("div",{class:"mark"},"GOG"),h("small",{class:"eyebrow"},"CONTROL ROOM / ADMIN ACCESS"),...children)));
}
function signIn() {
  const email=h("input",{id:"admin-email",name:"email",class:"in",type:"email",placeholder:"you@example.com",autocomplete:"email",inputmode:"email",required:true,"aria-label":"Admin email",spellcheck:"false",autocapitalize:"none"});
  const err=h("p",{class:"err",role:"alert","aria-live":"polite"});
  const btn=h("button",{type:"submit",class:"btn primary"},"Send email code →");
  const form=h("form",{class:"auth-form",onsubmit:send},h("label",{for:"admin-email"},"Email address"),email,btn,err);
  authCard(h("h1",{},"Welcome back."),h("p",{},"Sign in with your authorised admin email."),form,h("small",{class:"muted"},"Email only · Access is checked securely on the server."));
  async function send(e){
    e?.preventDefault();if(btn.disabled||!email.reportValidity())return;
    const address=email.value.trim();err.textContent="";btn.disabled=true;btn.textContent="Sending…";
    try{
      const {error}=await sb.auth.signInWithOtp({email:address,options:{shouldCreateUser:false,emailRedirectTo:location.origin+"/admin"}});if(error)throw error;
      codeStep(address);
    }catch(error){err.textContent=error.message;btn.disabled=false;btn.textContent="Send email code →";}
  }
}
function codeStep(address){
  let busy=false;
  const code=h("input",{id:"admin-code",name:"code",class:"in otp",type:"text",inputmode:"numeric",maxlength:8,minlength:6,required:true,pattern:"[0-9]{6,8}",placeholder:"000000",autocomplete:"one-time-code","aria-label":"Email verification code"});
  const err=h("p",{class:"err",role:"alert"}),verify=h("button",{type:"submit",class:"btn primary"},"Verify & open console →");
  const form=h("form",{class:"auth-form",onsubmit:async e=>{
    e.preventDefault();if(busy||!code.reportValidity())return;busy=true;verify.disabled=true;err.textContent="";
    try{const {error}=await sb.auth.verifyOtp({email:address,token:code.value.trim(),type:"email"});if(error)throw error;await start();}
    catch(error){err.textContent=error.message;}
    finally{busy=false;verify.disabled=false;}
  }},h("label",{for:"admin-code"},"Verification code"),code,verify,err);
  code.addEventListener("input",()=>{code.value=code.value.replace(/\D/g,"");});
  authCard(h("h1",{},"Check your inbox."),h("p",{},`Enter the code sent to ${address}.`),form,h("button",{type:"button",class:"btn",onclick:signIn},"Use another email / resend"));
  code.focus();
}

function notAdmin(email, why) {
  authCard(h("h1", {}, "No access"), h("p", {}, why), h("p", { class: "muted" }, email || ""),
    h("button", { class: "btn", onclick: async () => { await sb.auth.signOut(); signIn(); } }, "Sign out"));
}

// ---------------- console ----------------
function app(email) {
  // Clean URLs: /admin, /admin/live, /admin/users, /admin/connections
  const ROUTES = { overview: "/admin", live: "/admin/live", users: "/admin/users", connections: "/admin/connections", settings:"/admin/settings" };
  const viewFromPath = () => { const seg = location.pathname.replace(/\/+$/, "").split("/")[2] || "overview"; return ROUTES[seg] ? seg : "overview"; };
  const state = { view: viewFromPath(), overview: null, users: [], connections: [], live: [], updated: 0, error: "", map: null, area: 0, query: "" };
  const views = [["overview", "📊", "Overview"], ["live", "🛰", "Live map"], ["users", "👤", "Users"], ["connections", "🔗", "Connections"], ["settings", "⚙", "Settings"]];
  const navs = {};
  const content = h("div", { class: "main" });
  const liveChip = h("span", { class: "live" }, h("i", { class: "dot" }), h("span", {}, "Connecting…"));
  const side = h("aside", { class: "side" },
    h("div", { class: "brand" }, h("div", { class: "mark" }, "🌿"), h("div", {}, "Gandhinagar", h("small", {}, "GOG / Control room"))),
    ...views.map(([id, icon, label]) => (navs[id] = h("button", { class: "nav", onclick: () => { state.view = id; if (location.pathname !== ROUTES[id]) history.pushState({}, "", ROUTES[id] + location.search); render(); } }, h("span", {}, icon), label))),
    h("div", { class: "spacer" }),
    h("div", { class: "who" }, email, h("br"), h("button", { class: "btn", style: { marginTop: "8px" }, onclick: async () => { await sb.auth.signOut(); location.reload(); } }, "Sign out")));
  root.replaceChildren(h("div", { class: "shell" }, side, content));

  async function refresh(full) {
    try {
      const jobs = [rpc("admin_live").then((d) => (state.live = d || []))];
      if (full) jobs.push(rpc("admin_overview").then((d) => (state.overview = d)), rpc("admin_users").then((d) => (state.users = d || [])), rpc("admin_connections").then((d) => (state.connections = d || [])));
      await Promise.all(jobs);
      state.updated = Date.now(); state.error = "";
    } catch (e) { state.error = e.message; }
    if ((full && !(document.activeElement?.matches("input,textarea,select") || document.querySelector(".drawer"))) || state.view === "live" || state.view === "overview") render();
    else stamp();
  }
  function stamp() {
    const ok = !state.error && Date.now() - state.updated < 20000;
    liveChip.firstChild.className = "dot" + (ok ? "" : " off");
    liveChip.lastChild.textContent = state.error ? `Error: ${state.error}` : `Live · updated ${fmt.ago(new Date(state.updated).toISOString())}`;
  }
  const header = (title, ...extra) => h("div", { class: "top" }, h("h2", {}, title), h("div", { style: { display: "flex", gap: "10px", alignItems: "center" } }, ...extra, liveChip));

  function render() {
    for (const [id, el] of Object.entries(navs)) el.classList.toggle("on", id === state.view);
    stamp();
    const v = { overview, live, users, connections, settings }[state.view];
    document.title=`${state.view[0].toUpperCase()+state.view.slice(1)} · GOG Admin`;
    for(const [id,el] of Object.entries(navs))el.setAttribute("aria-current",id===state.view?"page":"false");
    content.replaceChildren(...v());
  }

  function settings(){return [header("Console settings"),h("div",{class:"grid2"},
    h("section",{class:"box"},h("h3",{},"Access & security"),h("div",{class:"settings-body"},h("p",{},"Email-only sign-in. Admin privileges are verified by server-side permissions."),h("p",{class:"muted"},email),h("a",{class:"btn",href:"/",target:"_blank",rel:"noopener"},"Open game ↗"))),
    h("section",{class:"box"},h("h3",{},"Live data"),h("div",{class:"settings-body"},h("p",{},"Live positions refresh every 3 seconds. Player and connection summaries refresh every 15 seconds."),h("button",{class:"btn primary",onclick:()=>refresh(true)},"Refresh console"),h("p",{class:"muted"},"This console is read-only. Account roles and email delivery are managed in Supabase."))))];}

  function overview() {
    const o = state.overview || {};
    const card = (k, v, s) => h("div", { class: "card" }, h("div", { class: "k" }, k), h("div", { class: "v" }, fmt.n(v)), s ? h("div", { class: "s" }, s) : null);
    const recent = [...state.users].sort((a, b) => Date.parse(b.joined) - Date.parse(a.joined)).slice(0, 8);
    return [header("Overview"),
      h("div", { class: "cards" },
        card("Players", o.users, `${fmt.n(o.verified)} verified email`), card("Online now", o.online, "active in last 60 s"), card("New today", o.new_today, "IST"),
        card("Connections", o.connections, `${fmt.n(o.accepted)} accepted`), card("Messages", o.messages, `${fmt.n(o.world_messages)} in city chat`),
        card("Waves", o.waves), card("Voice calls", o.calls), card("History points", o.history_points, "movement log, never deleted")),
      h("div", { class: "grid2" },
        h("div", { class: "box" }, h("h3", {}, "Online now", h("small", {}, `${state.live.length} players`)),
          state.live.length ? h("div", { class: "list", style: { padding: "12px" } }, state.live.map((p) => h("div", { class: "li" }, h("b", {}, p.name || "Player"), h("span", { class: "muted" }, `${fmt.place(p.place)} · ${p.vehicle} · ${fmt.ago(p.updated_at)}`)))) : h("div", { class: "empty" }, "Nobody is online right now.")),
        h("div", { class: "box" }, h("h3", {}, "Newest players"),
          recent.length ? h("div", { class: "list", style: { padding: "12px" } }, recent.map((u) => h("div", { class: "li", onclick: () => drawer(u) }, h("b", {}, u.name || u.email), h("span", { class: "muted" }, fmt.ago(u.joined))))) : h("div", { class: "empty" }, "No players yet.")))];
  }

  function users() {
    const q = state.query.toLowerCase();
    const list = state.users.filter((u) => !q || [u.name, u.email, u.role].some((x) => (x || "").toLowerCase().includes(q)));
    const search = h("input", { class: "in search", placeholder: "Search name, email, role…", value: state.query, oninput: (e) => { state.query = e.target.value; const pos = e.target.selectionStart; render(); const el = content.querySelector(".search"); el.focus(); el.setSelectionRange(pos, pos); } });
    return [header("Users", search),
      h("div", { class: "box" }, h("div", { class: "tbl-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ...["Player", "Email", "Status", "Where", "Last seen", "Joined", "Connections", "Messages"].map((t) => h("th", {}, t)))),
        h("tbody", {}, list.map((u) => h("tr", { onclick: () => drawer(u) },
          h("td", {}, h("b", {}, u.name || "—"), u.role ? h("div", { class: "muted" }, u.role) : null),
          h("td", {}, u.email || "—"),
          h("td", {}, h("span", { class: "pill" + (u.online ? " on" : "") }, u.online ? "● Online" : "Offline"), u.verified ? null : h("span", { class: "pill warn", style: { marginLeft: "6px" } }, "unverified")),
          h("td", {}, u.online ? fmt.place(u.place) : "—"),
          h("td", {}, fmt.ago(u.seen)), h("td", {}, fmt.date(u.joined)),
          h("td", {}, fmt.n(u.connections)), h("td", {}, fmt.n(u.messages)))))),
        list.length ? null : h("div", { class: "empty" }, "No players match.")))];
  }

  function connections() {
    const canvas = h("canvas", { width: 1200, height: 560, style: { width: "100%", height: "auto", display: "block", background: "#0e1519" } });
    setTimeout(() => drawGraph(canvas), 0);
    return [header("Connections"),
      h("div", { class: "box" }, h("h3", {}, "Who is connected to whom", h("small", {}, `${state.connections.length} links`)), canvas),
      h("div", { class: "box" }, h("div", { class: "tbl-wrap" }, h("table", {},
        h("thead", {}, h("tr", {}, ...["Player A", "Player B", "Status", "Since", "Messages", "Last message", "Waves"].map((t) => h("th", {}, t)))),
        h("tbody", {}, state.connections.map((c) => h("tr", { onclick: () => { const u = state.users.find((x) => x.id === c.a); if (u) drawer(u); } },
          h("td", {}, c.a_name || "—"), h("td", {}, c.b_name || "—"),
          h("td", {}, h("span", { class: "pill" + (c.accepted ? " on" : "") }, c.accepted ? "Connected" : "Request")),
          h("td", {}, fmt.date(c.since)), h("td", {}, fmt.n(c.messages)), h("td", {}, fmt.ago(c.last_message)), h("td", {}, fmt.n(c.waves)))))),
        state.connections.length ? null : h("div", { class: "empty" }, "No connections yet.")))];
  }
  function drawGraph(canvas) {
    const ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    const ids = [...new Set(state.connections.flatMap((c) => [c.a, c.b]))];
    if (!ids.length) { ctx.fillStyle = "#7d8d86"; ctx.font = "16px Inter"; ctx.fillText("No connections yet.", 24, 40); return; }
    const name = (id) => state.users.find((u) => u.id === id)?.name || "Player";
    const nodes = ids.map((id, i) => ({ id, x: W / 2 + Math.cos(i * 2.4) * (60 + i * 9), y: H / 2 + Math.sin(i * 2.4) * (60 + i * 6), vx: 0, vy: 0 }));
    const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
    for (let it = 0; it < 260; it++) {
      for (const a of nodes) for (const b of nodes) if (a !== b) { const dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy + 0.01, f = 2600 / d2; a.vx += dx * f / 40; a.vy += dy * f / 40; }
      for (const c of state.connections) { const a = by[c.a], b = by[c.b], dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || 1, f = (d - 120) * 0.01; a.vx += dx / d * f * 10; a.vy += dy / d * f * 10; b.vx -= dx / d * f * 10; b.vy -= dy / d * f * 10; }
      for (const n of nodes) { n.vx += (W / 2 - n.x) * 0.002; n.vy += (H / 2 - n.y) * 0.002; n.x = Math.max(40, Math.min(W - 40, n.x + n.vx * 0.2)); n.y = Math.max(30, Math.min(H - 30, n.y + n.vy * 0.2)); n.vx *= 0.6; n.vy *= 0.6; }
    }
    ctx.clearRect(0, 0, W, H);
    for (const c of state.connections) { const a = by[c.a], b = by[c.b]; ctx.strokeStyle = c.accepted ? "rgba(31,178,122,.75)" : "rgba(242,163,58,.55)"; ctx.lineWidth = 1 + Math.min(6, Math.log2(1 + (c.messages || 0))); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    const online = new Set(state.live.map((p) => p.id));
    for (const n of nodes) { ctx.fillStyle = online.has(n.id) ? "#1fb27a" : "#5b6b73"; ctx.beginPath(); ctx.arc(n.x, n.y, 13, 0, 7); ctx.fill(); ctx.fillStyle = "#e7eeea"; ctx.font = "600 22px Inter"; ctx.fillText(name(n.id), n.x + 18, n.y + 7); }
  }

  // Live map: roads/buildings of the two live areas + every online player.
  function live() {
    const canvas = h("canvas", { width: 1400, height: 820 });
    const tabs = h("div", { class: "map-tabs" }, ["LDRP campus", "Mahatma Mandir"].map((t, i) => h("button", { class: "btn" + (state.area === i ? " primary" : ""), onclick: () => { state.area = i; render(); } }, t)));
    setTimeout(() => drawMap(canvas), 0);
    return [header("Live map"), h("div", { class: "map-wrap" }, canvas, tabs, h("div", { class: "map-legend" }, `● ${state.live.length} online · refreshes every 3 s`)),
      h("div", { class: "box" }, h("h3", {}, "Online players"), state.live.length ? h("table", {}, h("tbody", {}, state.live.map((p) => h("tr", { onclick: () => { const u = state.users.find((x) => x.id === p.id); if (u) drawer(u); } }, h("td", {}, h("b", {}, p.name || "Player")), h("td", {}, fmt.place(p.place)), h("td", {}, p.vehicle), h("td", {}, `x ${p.x.toFixed(0)}, z ${p.z.toFixed(0)}`), h("td", {}, fmt.ago(p.updated_at)))))) : h("div", { class: "empty" }, "Nobody is online right now."))];
  }
  async function drawMap(canvas) {
    if (!state.map) { try { state.map = await (await fetch("/data/gandhinagar-live.json")).json(); } catch { return; } }
    const m = state.map, ctx = canvas.getContext("2d"), W = canvas.width, H = canvas.height;
    // split the live map into its two areas (2-means on road points)
    const pts = m.roads.flatMap((r) => r.pts);
    let c = [pts[0], pts[pts.length - 1]];
    for (let i = 0; i < 8; i++) { const g = [[], []]; for (const p of pts) g[Math.hypot(p[0] - c[0][0], p[1] - c[0][1]) < Math.hypot(p[0] - c[1][0], p[1] - c[1][1]) ? 0 : 1].push(p); c = g.map((s, k) => s.length ? [s.reduce((a, p) => a + p[0], 0) / s.length, s.reduce((a, p) => a + p[1], 0) / s.length] : c[k]); }
    // area 0 = the one containing LDRP players / more buildings in the north (smaller z)
    const order = c[0][1] < c[1][1] ? [0, 1] : [1, 0];
    const centre = c[order[state.area]];
    const span = 900, sc = Math.min(W, H) / span, X = (x) => W / 2 + (x - centre[0]) * sc, Y = (z) => H / 2 + (z - centre[1]) * sc;
    ctx.fillStyle = "#0e1519"; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = "#1a252c"; for (const b of m.buildings) { ctx.beginPath(); b.pts.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))); ctx.fill(); }
    ctx.strokeStyle = "#2c3a43"; ctx.lineCap = "round";
    for (const r of m.roads) { ctx.lineWidth = Math.max(1.5, (r.width || 7) * sc); ctx.beginPath(); r.pts.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))); ctx.stroke(); }
    ctx.strokeStyle = "rgba(91,156,255,.5)"; ctx.lineWidth = 3; for (const l of m.metro || []) { ctx.beginPath(); l.pts.forEach(([x, z], i) => i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z))); ctx.stroke(); }
    for (const p of state.live) { const x = X(p.x), y = Y(p.z); if (x < -20 || y < -20 || x > W + 20 || y > H + 20) continue;
      ctx.fillStyle = "rgba(31,178,122,.25)"; ctx.beginPath(); ctx.arc(x, y, 16, 0, 7); ctx.fill();
      ctx.fillStyle = "#1fb27a"; ctx.beginPath(); ctx.arc(x, y, 7, 0, 7); ctx.fill();
      ctx.strokeStyle = "#e7eeea"; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(p.heading || 0) * 16, y + Math.cos(p.heading || 0) * 16); ctx.stroke();
      ctx.fillStyle = "#e7eeea"; ctx.font = "600 20px Inter"; ctx.fillText(p.name || "Player", x + 16, y - 12); }
  }

  async function drawer(u) {
    document.querySelector(".drawer")?.remove();
    const conns = state.connections.filter((c) => c.a === u.id || c.b === u.id);
    const hist = h("div", { class: "list" }, h("div", { class: "muted" }, "Loading movement history…"));
    const d = h("div", { class: "drawer" },
      h("div", { class: "top" }, h("h3", {}, u.name || "Player"), h("button", { class: "btn", onclick: () => d.remove() }, "Close")),
      h("dl", { class: "kv" },
        ...[["Email", u.email], ["Role", u.role || "—"], ["One-liner", u.one_liner || "—"], ["Resident #", u.resident_no], ["Status", u.online ? `Online · ${fmt.place(u.place)} · ${u.vehicle}` : `Offline · last seen ${fmt.ago(u.seen)}`],
          ["Position", u.x != null ? `x ${u.x.toFixed(1)}, z ${u.z.toFixed(1)}` : "—"], ["Joined", fmt.date(u.joined)], ["Last sign-in", fmt.date(u.last_sign_in)], ["Verified", u.verified ? "Yes" : "No"], ["Visible", u.visible ? "Yes" : "Hidden"], ["Messages sent", fmt.n(u.messages)]]
          .flatMap(([k, v]) => [h("dt", {}, k), h("dd", {}, String(v ?? "—"))])),
      h("h3", {}, `Connections (${conns.length})`),
      conns.length ? h("div", { class: "list" }, conns.map((c) => { const other = c.a === u.id ? c.b_name : c.a_name; return h("div", { class: "li" }, h("b", {}, other || "Player"), h("span", { class: "muted" }, `${c.accepted ? "connected" : "request"} · ${fmt.n(c.messages)} msgs · ${fmt.ago(c.since)}`)); })) : h("div", { class: "muted" }, "No connections yet."),
      h("h3", {}, "Movement history"), hist);
    document.body.append(d);
    try {
      const rows = await rpc("admin_history", { target: u.id, max_rows: 60 });
      hist.replaceChildren(...(rows.length ? rows.map((r) => h("div", { class: "li" }, h("span", {}, `${fmt.place(r.place)} · ${r.vehicle || "walk"}`), h("span", { class: "muted" }, `x ${r.x.toFixed(0)}, z ${r.z.toFixed(0)} · ${fmt.date(r.at)}`))) : [h("div", { class: "muted" }, "No movement recorded yet.")]));
    } catch (e) { hist.replaceChildren(h("div", { class: "muted" }, e.message)); }
  }

  addEventListener("popstate", () => { state.view = viewFromPath(); render(); });
  if (!ROUTES[location.pathname.replace(/\/+$/, "").split("/")[2] || "overview"]) history.replaceState({}, "", ROUTES[state.view] + location.search);
  render();
  refresh(true);
  setInterval(() => refresh(false), 3000);
  setInterval(() => refresh(true), 15000);
  setInterval(stamp, 1000);
}

start();
