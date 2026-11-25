import { h, openPanel, setPanelBody, toast, initials, ago, chips, closePanel } from "./dom.js";
import { OPEN_TO, MATCHES, REASONS } from "../data/content.js";
import { askResident, askTwin, aiStatus } from "../systems/ai.js";
import { CONTACT_PATTERN } from "../config.js";

const chipOf = (id) => OPEN_TO.find((o) => o.id === id)?.chip;

// Direction words relative to where the player faces.
export function direction(app, x, z) {
  const p = app.player.position;
  const d = Math.hypot(x - p.x, z - p.z);
  let a = Math.atan2(x - p.x, z - p.z) - app.player.heading;
  a = Math.atan2(Math.sin(a), Math.cos(a)) * (180 / Math.PI);
  const words = Math.abs(a) < 25 ? "AHEAD" : Math.abs(a) > 155 ? "BEHIND YOU" : a > 0
    ? (a < 70 ? "AHEAD LEFT" : a < 110 ? "TO YOUR LEFT" : "BEHIND LEFT")
    : (a > -70 ? "AHEAD RIGHT" : a > -110 ? "TO YOUR RIGHT" : "BEHIND RIGHT");
  return { d, text: `${d < 1000 ? Math.round(d) + "m" : (d / 1000).toFixed(1) + "km"} · ${words}` };
}

function avatarDot(name, ai) {
  return h("span", { class: "av" + (ai ? " ai" : "") }, initials(name));
}

// ---------- profile card ----------
export async function openCard(app, target) {
  // target: a world person ({data, x, z}) or a member profile object.
  const data = target.data || target;
  const ai = !!data.ai;
  if (!ai) app.backend.recordView?.(data.id);
  const full = ai ? data : (await app.backend.getProfile(data.id)) || data;
  const online = !ai && app.isOnline(data.id);
  const twin = !ai && !online ? await app.backend.getTwin(data.id) : null;

  const actions = h("div", { class: "row wrap" });
  const wave = h("button", { type: "button", class: "btn", onclick: () => app.waveAt(target) }, "👋 Wave");
  actions.append(wave);
  if (ai) {
    actions.append(h("button", { type: "button", class: "btn primary", onclick: () => openAiChat(app, target) }, "💬 Chat"));
  } else {
    actions.append(h("button", { type: "button", class: "btn primary", onclick: () => openThread(app, full) }, "💬 Connect"));
    if (twin?.enabled) actions.append(h("button", { type: "button", class: "btn", onclick: () => openTwinChat(app, full, twin) }, "🪞 Talk to their AI twin"));
    if (online && app.voice) actions.append(h('button',{type:'button',class:'btn',onclick:()=>app.voice.start(full)},'🎙 Voice call'));
    if (target.x != null) actions.append(h("button", { type: "button", class: "btn", onclick: () => { closePanel(); app.goNear(target.x, target.z); } }, "Go nearby"));
  }

  const about = full.about || {};
  const links = full.links || {};
  const body = h("div", { class: "card" },
    h("div", { class: "card-head" }, avatarDot(full.name, ai),
      h("div", {}, h("div", { class: "nm" }, ai ? h("i", { class: "ai-badge" }, "AI") : null, full.name),
        h("div", { class: "muted" }, full.role || "Gandhinagari"),
        online ? h("div", { class: "here" }, "● HERE NOW") : !ai ? h("div", { class: "muted small" }, "Away") : null)),
    chipOf(full.openTo) ? h("div", { class: "chip" }, chipOf(full.openTo)) : null,
    full.oneLiner ? h("p", { class: "says" }, "“", full.oneLiner, "”") : null,
    ai ? h("p", { class: "muted small" }, "AI resident. Keeps the streets lively; replies are written by AI.") : null,
    (full.interests || []).length ? h("div", {}, h("h3", {}, "Into"), h("div", { class: "tags" }, full.interests.map((i) => h("span", { class: "tag-s" }, i)))) : null,
    (full.reasons || []).length ? h("div", {}, h("h3", {}, "Looking for"), h("div", { class: "tags" },
      full.reasons.map((r) => h("span", { class: "tag-s" }, REASONS.find((x) => x.id === r)?.label || r)))) : null,
    about.company || about.building || about.skills ? h("div", {}, h("h3", {}, "About"),
      about.company ? h("p", {}, "🏢 ", about.company) : null,
      about.building ? h("p", {}, "🛠 ", about.building) : null,
      about.skills ? h("div", { class: "tags" }, about.skills.split(",").map((s) => h("span", { class: "tag-s" }, s.trim()))) : null) : null,
    app.session && (links.linkedin || links.instagram || about.website) ? h("div", {}, h("h3", {}, "Connect"),
      h("div", { class: "row wrap" },
        links.linkedin ? h("a", { class: "btn", href: safeUrl(links.linkedin, "linkedin.com/in/"), target: "_blank", rel: "noopener noreferrer" }, "in LinkedIn ↗") : null,
        links.instagram ? h("a", { class: "btn", href: safeUrl(links.instagram, "instagram.com/"), target: "_blank", rel: "noopener noreferrer" }, "◎ Instagram ↗") : null,
        about.website ? h("a", { class: "btn", href: safeUrl(about.website, ""), target: "_blank", rel: "noopener noreferrer" }, "🌐 Website ↗") : null)) : null,
    actions,
    !ai && app.session ? h("div", { class: "row small-links" },
      h("button", { type: "button", class: "link", onclick: async () => { await app.backend.block(full.id); toast("Blocked. They will not see you or message you."); closePanel(); } }, "Block"),
      h("button", { type: "button", class: "link", onclick: () => reportFlow(app, full) }, "Report")) : null);
  openPanel(ai ? "AI RESIDENT" : "PROFILE", body);
}

function safeUrl(v, prefix) {
  v = String(v).trim();
  if (/^https:\/\//i.test(v)) return v;
  return "https://" + (prefix && !v.includes(".") ? "www." + prefix + v.replace(/^@/, "") : v.replace(/^https?:\/\//i, ""));
}

function reportFlow(app, p) {
  const reason = h("textarea", { placeholder: "What happened? (a copy of your chat with them is attached for review)", rows: 3 });
  openPanel("REPORT", h("div", {}, h("p", {}, `Report ${p.name}`), reason,
    h("button", { type: "button", class: "btn primary", onclick: async () => {
      await app.backend.report(p.id, reason.value.trim());
      toast("Thanks. The owner will review this."); closePanel();
    } }, "Send report")));
}

// ---------- AI resident chat ----------
export function openAiChat(app, person) {
  const history = [];
  const log = h("div", { class: "chat-log" });
  const input = h("input", { type: "text", placeholder: `Say kem cho to ${person.data.firstName || person.data.name}`, maxlength: 300 });
  const add = (role, text) => {
    log.append(h("div", { class: `msg ${role === "user" ? "me" : "them"}` }, text));
    log.scrollTop = log.scrollHeight;
  };
  async function send() {
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    add("user", text);
    const typing = h("div", { class: "msg them typing" }, "…");
    log.append(typing);
    const reply = await askResident(person, text, history);
    typing.remove();
    history.push({ role: "user", content: text }, { role: "assistant", content: reply });
    add("assistant", reply);
    app.people.say(person, reply.slice(0, 60) + (reply.length > 60 ? "…" : ""), 5);
    app.progress.track("chat_ai", { place: person.data.place });
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  openPanel(`💬 ${person.data.name.toUpperCase()} · AI`, h("div", { class: "chat" },
    h("p", { class: "muted small" }, `AI resident · ${person.data.role}. Replies by ${aiStatus()}.`),
    log, h("div", { class: "composer" }, input, h("button", { type: "button", class: "btn primary", onclick: send }, "➤"))));
  add("assistant", `Kem cho! Hu ${person.data.firstName}. ${person.data.oneLiner}.`);
  setTimeout(() => input.focus(), 50);
}

// ---------- AI twin chat (someone else's twin) ----------
export function openTwinChat(app, owner, twin) {
  if (!app.requireSignIn("chat with AI twins")) return;
  const history = [];
  const log = h("div", { class: "chat-log" });
  const input = h("input", { type: "text", placeholder: "Ask about their work, what they are looking for…", maxlength: 300 });
  const add = (role, text) => { log.append(h("div", { class: `msg ${role === "user" ? "me" : "them"}` }, text)); log.scrollTop = log.scrollHeight; };
  async function send() {
    const text = input.value.trim();
    if (!text) return;
    if (CONTACT_PATTERN.test(text)) return toast("No phone numbers, emails or links, please.");
    input.value = ""; add("user", text);
    const reply = await askTwin(owner, twin, text, history, await app.accessToken?.());
    history.push({ role: "user", content: text }, { role: "assistant", content: reply });
    add("assistant", reply);
    app.backend.logTwinChat(owner.id, app.session.userId, text, reply);
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  openPanel(`🪞 ${owner.name.toUpperCase()}'S AI TWIN`, h("div", { class: "chat" },
    h("p", { class: "muted small" }, `This is an AI, not ${owner.name.split(" ")[0]}. It can make mistakes and cannot agree to anything for them. ${owner.name.split(" ")[0]} can read this chat for 14 days.`),
    log, h("div", { class: "composer" }, input, h("button", { type: "button", class: "btn primary", onclick: send }, "➤"))));
  add("assistant", `Kem cho! I'm ${owner.name.split(" ")[0]}'s AI twin. Ask me what they do or what they're looking for.`);
}

// ---------- Find someone ----------
export async function openFind(app) {
  let filter = "all", query = "";
  const members = await app.backend.listMembers();
  const online = app.presenceMembers();
  const me = app.me;
  const listEl = h("div", {});
  const FILTERS = [{ id: "all", label: "Everyone" }, { id: "plan", label: "Hosting a plan" },
    ...OPEN_TO.filter((o) => o.id !== "walk").map((o) => ({ id: o.id, label: o.label }))];
  const plans = await app.backend.listPlans();
  const hosts = new Set(plans.map((p) => p.by));

  function matches(p) {
    if (filter === "plan" && !hosts.has(p.id)) return false;
    if (filter !== "all" && filter !== "plan" && p.openTo !== filter) return false;
    if (query) {
      const hay = [p.name, p.role, p.oneLiner, ...(p.interests || [])].join(" ").toLowerCase();
      if (!hay.includes(query)) return false;
    }
    return true;
  }

  function row(p, extra) {
    return h("button", { type: "button", class: "person-row", onclick: () => openCard(app, p) },
      avatarDot(p.name, p.ai),
      h("div", { class: "grow" },
        h("div", { class: "nm" }, p.ai ? h("i", { class: "ai-badge" }, "AI") : null, p.name, app.isOnline(p.id) ? h("span", { class: "here" }, " ● HERE NOW") : null),
        chipOf(p.openTo) ? h("div", { class: "chip sm" }, chipOf(p.openTo)) : null,
        h("div", { class: "muted small" }, p.role || "Gandhinagari"),
        extra ? h("div", { class: "small dir" }, extra) : null));
  }

  function render() {
    const onlineRows = online.filter(matches).map((m) => ({ m, dir: direction(app, m.x, m.z) })).sort((a, b) => a.dir.d - b.dir.d);
    const nearbyAi = app.people.all().filter((p) => p.data.ai).map((p) => ({ p, dir: direction(app, p.x, p.z) }))
      .filter(({ p }) => matches(p.data)).sort((a, b) => a.dir.d - b.dir.d).slice(0, 8);
    const wants = new Set((me?.reasons || []).flatMap((r) => MATCHES[r] || []));
    const forYou = me ? members.filter((p) => wants.has(p.openTo) || (p.interests || []).some((i) => me.interests?.includes(i)))
      .filter(matches).slice(0, 6) : [];
    const everyone = members.filter(matches);
    listEl.replaceChildren(
      h("h3", {}, `NEAREST FIRST · ${onlineRows.length + nearbyAi.length + everyone.length}`),
      h("h3", { class: "sec" }, "ONLINE NOW · GO AND TALK"),
      onlineRows.length ? onlineRows.map(({ m, dir }) => h("div", { class: "row-wrap" }, row(m, `${m.placeName || ""} · ${dir.text}`),
        h("button", { type: "button", class: "btn sm", onclick: () => { closePanel(); app.goNear(m.x, m.z); } }, "🎙 GO AND TALK ▸")))
        : h("p", { class: "muted small" }, "Nobody else is online right now. Open the app in a second tab to test (demo mode)."),
      forYou.length ? [h("h3", { class: "sec" }, "✨ FOR YOU · TAMARA JEVA LOKO"),
        forYou.map((p) => row(p, (p.interests || []).some((i) => me.interests?.includes(i)) ? "✨ You share interests" : "✨ Open to what you are looking for"))] : null,
      h("h3", { class: "sec" }, "AI RESIDENTS NEAR YOU"),
      nearbyAi.length ? nearbyAi.map(({ p, dir }) => row(p.data, dir.text)) : h("p", { class: "muted small" }, "Walk to a place to meet its residents."),
      h("h3", { class: "sec" }, "EVERYONE"),
      everyone.length ? everyone.map((p) => row(p)) : h("p", { class: "muted small" }, "No members match yet."));
  }

  const search = h("input", { type: "search", placeholder: "Koi ne shodho · search names, work, interests", oninput: (e) => { query = e.target.value.toLowerCase().trim(); render(); } });
  openPanel("🔍 FIND SOMEONE IN THE CITY", h("div", {}, search,
    chips(FILTERS, ["all"], { onChange: ([v]) => { filter = v; render(); } }), listEl), { wide: true });
  render();
}

// ---------- Online now ----------
export function openOnline(app) {
  const list = app.presenceMembers();
  const visitors = app.visitorCount();
  openPanel("● ONLINE NOW", h("div", {},
    h("p", { class: "muted small" }, `${list.length} member${list.length === 1 ? "" : "s"} online${visitors ? ` · ${visitors} just looking` : ""}`),
    list.length ? list.map((m) => h("div", { class: "person-row static" }, avatarDot(m.name),
      h("div", { class: "grow" }, h("div", { class: "nm" }, m.name), h("div", { class: "muted small" }, [m.role, m.placeName].filter(Boolean).join(" · "))),
      h("button", { type: "button", class: "btn sm", onclick: () => { closePanel(); app.goNear(m.x, m.z); } }, "Go and talk ▸")))
      : h("p", {}, "Nobody else is here yet. AI residents are always around; tap a name above someone's head to say hi.")));
}

// ---------- Connections and chats ----------
export async function openChats(app, tab = "chats") {
  if (!app.requireSignIn("see your connections")) return;
  const data = await app.backend.listConnections();
  const body = h("div", {});
  const render = () => {
    const rows = data[tab];
    body.replaceChildren(
      h("div", { class: "tabs" }, ["chats", "requests", "sent"].map((t) => h("button", { type: "button", class: t === tab ? "on" : "", onclick: () => { tab = t; render(); } },
        `${t.toUpperCase()}${data[t].length ? " " + data[t].length : ""}`))),
      rows.length ? rows.map((r) => h("div", { class: "person-row static" }, avatarDot(r.other.name),
        h("div", { class: "grow" }, h("div", { class: "nm" }, r.other.name), h("div", { class: "muted small" }, r.last ? `${r.last.from === app.session.userId ? "You: " : ""}${r.last.text}` : ""),
          tab === "sent" ? h("div", { class: "small" }, `Sent. When ${r.other.name.split(" ")[0]} replies, you two are connected.`) : null,
          h("div", { class: "muted small" }, r.last ? ago(r.last.at) : "")),
        h("button", { type: "button", class: "btn sm", onclick: () => openThread(app, r.other) },
          tab === "requests" ? "REPLY" : tab === "sent" ? "💬 ADD A MESSAGE" : "OPEN CHAT")))
        : h("p", { class: "muted" }, tab === "chats" ? "No chats yet. Wave at someone and say hi." : tab === "requests" ? "No requests waiting." : "Nothing sent yet."));
  };
  render();
  openPanel("CONNECTIONS", body);
  app.clearBadge("chats");
}

export async function openThread(app, other) {
  if (!app.requireSignIn("message people")) return;
  const key = [app.session.userId, other.id].sort().join(":");
  const log = h("div", { class: "chat-log" });
  const input = h("input", { type: "text", placeholder: "👋 Hi! Saw you in the city. Kem cho?", maxlength: 500 });
  async function load() {
    const msgs = await app.backend.getMessagesWith(other.id).catch(() => []);
    log.replaceChildren(...msgs.map((m) => h("div", { class: `msg ${m.from === app.session.userId ? "me" : "them"}` }, m.text, h("i", {}, ago(m.at)))));
    if (!msgs.length) log.append(h("p", { class: "muted small" }, "Your first message is a connect request. You can send up to 3 before they reply. No phone numbers, emails or links."));
    log.scrollTop = log.scrollHeight;
  }
  async function send() {
    const text = input.value.trim() || "👋 Hi! Saw you in the city. Kem cho?";
    try {
      await app.backend.sendRequest(other.id, text);
      input.value = "";
      app.progress.track("connect_real");
      const me = app.me;
      if (me && (me.reasons || []).some((r) => (MATCHES[r] || []).includes(other.openTo))) app.progress.track("message_match");
      load();
    } catch (e) { toast(e.message, "bad"); }
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  openPanel(`💬 ${other.name.toUpperCase()}`, h("div", { class: "chat" }, log,
    h("div", { class: "composer" }, input, h("button", { type: "button", class: "btn primary", onclick: send }, "➤")),
    h("div", { class: "row small-links" },
      h("button", { type: "button", class: "link", onclick: () => openCard(app, other) }, "View profile"),
      h("button", { type: "button", class: "link", onclick: () => reportFlow(app, other) }, "Report"))),
    { onClose: () => { app.openThreadKey = null; } });
  app.openThreadKey = key;
  app.reloadThread = load;
  load();
}

// ---------- World chat ----------
const EMOJI = ["😊", "😂", "🙏", "👋", "🔥", "❤️", "☕", "🪁", "💃", "🏏", "🎉", "👍"];
export async function openWorld(app) {
  const log = h("div", { class: "chat-log world" });
  const input = h("input", { type: "text", placeholder: "Say kem cho to the whole city", maxlength: 280 });
  const emo = h("div", { class: "emoji-row", hidden: true }, EMOJI.map((e) => h("button", { type: "button", onclick: () => { input.value += e; input.focus(); } }, e)));
  const render = async () => {
    const msgs = await app.backend.listWorld();
    log.replaceChildren(...(msgs.length ? msgs.map((m) => h("div", { class: "wmsg" }, h("b", {}, m.name || "Someone"), " ", m.text, h("i", {}, ago(m.at))))
      : [h("p", { class: "muted" }, "Nobody has said anything yet. Say kem cho to the whole city.")]));
    log.scrollTop = log.scrollHeight;
  };
  async function send() {
    if (!app.requireSignIn("post in world chat")) return;
    try { await app.backend.postWorld(input.value); input.value = ""; render(); } catch (e) { toast(e.message, "bad"); }
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  openPanel("🌍 WORLD CHAT", h("div", { class: "chat" },
    h("p", { class: "muted small" }, "Everyone in the city can read this. Be kind. No numbers, emails or links."),
    log, emo,
    h("div", { class: "composer" }, h("button", { type: "button", class: "btn", "aria-label": "Emoji", onclick: () => { emo.hidden = !emo.hidden; } }, "😊"),
      input, h("button", { type: "button", class: "btn primary", "aria-label": "Send", onclick: send }, "➤"))),
    { onClose: () => { app.worldOpen = false; } });
  app.worldOpen = true;
  app.reloadWorld = render;
  app.clearBadge("world");
  render();
}

export { setPanelBody };
