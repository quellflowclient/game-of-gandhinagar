import { h, openPanel, setPanelBody, toast, chips, closePanel } from "./dom.js";
import { OPEN_TO, INTERESTS, REASONS, TIMES, CHARACTERS, SKIN_TONES } from "../data/content.js";
import { HOME_DISTRICTS } from "../data/places.js";
import { LIMITS } from "../config.js";
import { askTwin } from "../systems/ai.js";

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

// Listen once and return the transcript (Web Speech API; Chrome and Edge).
function listen(lang = "en-IN") {
  return new Promise((resolve, reject) => {
    if (!SR) return reject(new Error("Voice input is not supported in this browser. Type instead."));
    const r = new SR();
    r.lang = lang; r.interimResults = false; r.maxAlternatives = 1;
    r.onresult = (e) => resolve(e.results[0][0].transcript);
    r.onerror = (e) => reject(new Error(e.error === "not-allowed" ? "Microphone permission was blocked." : "Could not hear that, try again."));
    r.onend = () => resolve("");
    r.start();
  });
}

// ---------- sign in ----------
export function openSignIn(app, reason) {
  const contact = h("input", { type: "text", placeholder: "Email or WhatsApp number", autocomplete: "email" });
  const adult = h("input", { type: "checkbox", id: "adult" });
  const terms = h("input", { type: "checkbox", id: "terms" });
  const note = h("p", { class: "muted small" });
  const step1 = h("div", {},
    h("p", {}, reason ? `Sign in to ${reason}.` : "Sign in to become visible, wave and chat."),
    h("p", { class: "muted small" }, "We send a one-time code. Your email or number is never shown to anyone."),
    contact,
    h("label", { class: "check" }, adult, " I am 18 or older"),
    h("label", { class: "check" }, terms, " I agree to the ", h("a", { href: "/terms.html", target: "_blank" }, "house rules"), " and ", h("a", { href: "/privacy.html", target: "_blank" }, "privacy note")),
    h("button", { type: "button", class: "btn primary wide", onclick: send }, "Send code ▸"), note);
  async function send() {
    if (!adult.checked || !terms.checked) return toast("Please confirm both boxes.");
    try {
      const r = await app.backend.signInWithOtp(contact.value);
      const code = h("input", { type: "text", inputmode: "numeric", maxlength: 6, placeholder: "6-digit code" });
      setPanelBody(h("div", {},
        h("p", {}, `Code sent to ${contact.value}.`),
        r.demoCode ? h("p", { class: "demo-note" }, `Demo mode (no email is sent): your code is ${r.demoCode}`) : null,
        code,
        h("button", { type: "button", class: "btn primary wide", onclick: async () => {
          try {
            await app.backend.verifyOtp(contact.value, code.value);
            closePanel();
            await app.onSignedIn();
          } catch (e) { toast(e.message, "bad"); }
        } }, "Verify and walk in ▸")));
      setTimeout(() => code.focus(), 50);
    } catch (e) { note.textContent = e.message; }
  }
  openPanel("SIGN IN", step1);
  setTimeout(() => contact.focus(), 50);
}

// ---------- EDIT hub: make your AI twin ----------
export function openEdit(app) {
  if (!app.requireSignIn("set up your profile")) return;
  let lang = "en-IN";
  const status = h("p", { class: "muted small" });
  openPanel("PEOPLE OF GANDHINAGAR · AI TWIN", h("div", { class: "center-col" },
    h("h2", { class: "big" }, "Make your AI twin"),
    h("p", {}, "Talk to it for a minute. It learns who you are, then lives in Gandhinagar and answers people for you while you are away."),
    h("button", { type: "button", class: "btn primary wide", onclick: () => interview(app, lang, status) }, "🎙️ Start talking"),
    chips([{ id: "gu-IN", label: "ગુજરાતી" }, { id: "hi-IN", label: "हिंदी" }, { id: "en-IN", label: "English" }], [lang], { onChange: ([v]) => { lang = v; } }),
    status,
    h("button", { type: "button", class: "btn wide", onclick: () => openTwin(app) }, "✏️ Edit what my twin knows"),
    h("button", { type: "button", class: "link", onclick: () => openProfile(app) }, "More profile settings")));
}

const TWIN_QS = [
  ["work", "What do you do, and what are you working on right now?"],
  ["looking", "What are you looking for in Gandhinagar?"],
  ["askMe", "What can people ask you about?"],
  ["workWith", "What is the best way to work with you?"],
  ["fun", "Tell me one fun Gandhinagar thing about you."],
];

async function interview(app, lang, status) {
  if (!SR) { status.textContent = "Voice is not supported in this browser, so type your answers instead."; return openTwin(app); }
  const answers = { ...((await app.backend.getTwin())?.answers || {}) };
  for (const [key, q] of TWIN_QS) {
    status.textContent = `🎙 ${q}`;
    app.sound.say(q, lang);
    await new Promise((r) => setTimeout(r, 2200));
    try { const said = await listen(lang); if (said) answers[key] = said; } catch (e) { status.textContent = e.message; return; }
  }
  status.textContent = "Got it. Check what your twin learned, then save.";
  openTwin(app, answers);
}

// ---------- AI twin settings ----------
export async function openTwin(app, draft) {
  if (!app.requireSignIn("teach your AI twin")) return;
  const twin = (await app.backend.getTwin()) || { enabled: false, adult: false, answers: {} };
  const answers = { ...twin.answers, ...(draft || {}) };
  const enabled = h("input", { type: "checkbox", checked: twin.enabled });
  const adult = h("input", { type: "checkbox", checked: twin.adult });
  const fields = [
    ["work", "What I do, and what I am working on"], ["looking", "What I am looking for"],
    ["askMe", "Ask me about"], ["workWith", "Best way to work with me"], ["fun", "One fun Gandhinagar thing about me"],
  ].map(([k, label]) => [k, h("label", { class: "field" }, label, h("textarea", { rows: 2, maxlength: 400, "data-k": k }, answers[k] || ""))]);
  const get = () => Object.fromEntries(fields.map(([k, el]) => [k, el.querySelector("textarea").value.trim()]));

  const teach = h("div", {},
    h("p", {}, "While you are offline, your AI twin can answer signed-in members for you. It is off until you switch it on. It uses only what you write here and your public profile (first name, work, home district, status line, open to)."),
    h("label", { class: "check" }, enabled, " Let an AI answer for me when I am offline."),
    h("p", { class: "muted small" }, "Signed-in members can chat with it. It is an AI and can make mistakes. What they type and what it replies is stored for 14 days for you to read, and is processed by our AI provider (Anthropic)."),
    h("label", { class: "check" }, adult, " I am 18 or older."),
    fields.map(([, el]) => el),
    h("div", { class: "row" },
      h("button", { type: "button", class: "btn primary", onclick: async () => {
        if (enabled.checked && !adult.checked) return toast("Confirm you are 18 or older to switch the twin on.");
        try { await app.backend.saveTwin({ enabled: enabled.checked, adult: adult.checked, answers: get() }); toast("Twin saved ✓", "good"); }
        catch (e) { toast(e.message, "bad"); }
      } }, "SAVE"),
      h("button", { type: "button", class: "btn", onclick: () => tryTwin(app, get()) }, "TRY MY TWIN")),
    h("div", { class: "rules" },
      h("h3", {}, "YOUR TWIN IS TOLD TO"),
      h("ul", {}, h("li", {}, "answer only from what you wrote here and your public profile"),
        h("li", {}, "say it is an AI twin, never that it is you"),
        h("li", {}, `say "I'll tell ${(app.me?.name || "you").split(" ")[0]}" when it does not know, and point people to a connect request`),
        h("li", {}, "show you every chat, in the Chats tab, for 14 days")),
      h("h3", {}, "YOUR TWIN IS TOLD NEVER TO"),
      h("ul", {}, h("li", {}, "share a phone number, email, link, handle or address"),
        h("li", {}, "agree to a meeting, call, price, job or any promise"),
        h("li", {}, "make things up about you, or say anything about other people"),
        h("li", {}, "answer while you are online, or after you switch it off"))),
    h("p", { class: "muted small" }, "Leave out phone numbers, emails, links, claims about other people and anything sexual: an answer with one is not saved. You can edit, switch off or clear all of this at any time."),
    h("button", { type: "button", class: "link danger", onclick: async () => {
      if (!confirm("Clear everything your twin knows and its chats?")) return;
      await app.backend.clearTwin(); toast("Twin cleared."); closePanel();
    } }, "Clear everything my twin knows"));

  const chatsTab = h("div", {});
  const body = h("div", {}, h("div", { class: "tabs" },
    h("button", { type: "button", class: "on", onclick: (e) => switchTab(e, teach) }, "Teach your twin"),
    h("button", { type: "button", onclick: async (e) => {
      const rows = await app.backend.twinChats();
      chatsTab.replaceChildren(...(rows.length ? rows.map((c) => h("div", { class: "twin-chat" }, h("b", {}, c.fromName), h("p", {}, "Q: ", c.q), h("p", {}, "A: ", c.a)))
        : [h("p", { class: "muted" }, "No one has talked to your twin yet.")]));
      switchTab(e, chatsTab);
    } }, "Chats")), teach);
  function switchTab(e, node) {
    body.querySelectorAll(".tabs button").forEach((b) => b.classList.toggle("on", b === e.target));
    body.lastChild.replaceWith(node);
  }
  openPanel("🪞 YOUR AI TWIN", body);
}

function tryTwin(app, answers) {
  const me = app.me || {};
  const log = h("div", { class: "chat-log" });
  const input = h("input", { type: "text", placeholder: "Ask your twin something a member might ask" });
  const history = [];
  async function send() {
    const text = input.value.trim(); if (!text) return;
    input.value = "";
    log.append(h("div", { class: "msg me" }, text));
    const reply = await askTwin({ ...me, id: app.session.userId }, { answers }, text, history);
    history.push({ role: "user", content: text }, { role: "assistant", content: reply });
    log.append(h("div", { class: "msg them" }, reply)); log.scrollTop = log.scrollHeight;
  }
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") send(); });
  openPanel("🪞 TRY MY TWIN", h("div", { class: "chat" }, h("p", { class: "muted small" }, "This is how members will see your twin. Nothing here is saved."),
    log, h("div", { class: "composer" }, input, h("button", { type: "button", class: "btn primary", onclick: send }, "➤")),
    h("button", { type: "button", class: "link", onclick: () => openTwin(app, answers) }, "◀ Back to settings")));
}

// ---------- 8-step profile ----------
export async function openProfile(app, startStep = 0) {
  if (!app.requireSignIn("set up your profile")) return;
  const p = { ...(await app.backend.getMyProfile()) };
  p.links ||= {}; p.interests ||= []; p.reasons ||= []; p.hours ||= [];
  const twin = await app.backend.getTwin();
  let step = startStep;
  const STEPS = 8;

  const voiceBtn = (target, lang = "en-IN") => h("button", { type: "button", class: "btn voice", onclick: async () => {
    try { const said = await listen(lang); if (said) { target.value = said; target.dispatchEvent(new Event("input")); } } catch (e) { toast(e.message, "bad"); }
  } }, "🎙️ Talk instead");

  function stepNode() {
    switch (step) {
      case 0: {
        const name = h("input", { type: "text", maxlength: 40, placeholder: "Your name", value: p.name || "", oninput: (e) => { p.name = e.target.value; } });
        const role = h("input", { type: "text", maxlength: 80, placeholder: "What you do (Designer · Your company)", value: p.role || "", oninput: (e) => { p.role = e.target.value; } });
        return h("div", {}, h("p", { class: "muted small" }, "Answer out loud, in English or Gujarati. We fill the form."),
          h("h3", {}, "TAMARU NAAM?"), name, voiceBtn(name), role, voiceBtn(role));
      }
      case 1: {
        const line = h("input", { type: "text", maxlength: 120, placeholder: "e.g. Building a SaaS for schools, looking for a designer", value: p.oneLiner || "", oninput: (e) => { p.oneLiner = e.target.value; } });
        return h("div", {}, h("h3", {}, "YOUR ONE-LINER"), h("p", { class: "muted small" }, "Shown in a bubble above your head. Say what you are building, selling or looking for."),
          line, voiceBtn(line), h("h3", {}, "OPEN TO"), chips(OPEN_TO, [p.openTo || "walk"], { onChange: ([v]) => { p.openTo = v; } }));
      }
      case 2:
        return h("div", {}, h("h3", {}, "TAMNE SHU GAME CHHE?"),
          h("p", { class: "muted small" }, `What are you into? Pick up to ${LIMITS.maxInterests}. The city uses this to find your kind of people.`),
          chips(INTERESTS, p.interests, { max: LIMITS.maxInterests, onChange: (v) => { p.interests = v; } }));
      case 3:
        return h("div", {}, h("h3", {}, "AHIN KEM AAVYA?"), h("p", { class: "muted small" }, `What are you here for? Pick up to ${LIMITS.maxReasons}.`),
          chips(REASONS, p.reasons, { max: LIMITS.maxReasons, onChange: (v) => { p.reasons = v; } }));
      case 4: {
        const li = h("input", { type: "text", maxlength: 100, placeholder: "LinkedIn profile URL or name", value: p.links.linkedin || "", oninput: (e) => { p.links.linkedin = e.target.value.trim(); } });
        const ig = h("input", { type: "text", maxlength: 60, placeholder: "Instagram handle", value: p.links.instagram || "", oninput: (e) => { p.links.instagram = e.target.value.trim(); } });
        return h("div", {}, h("h3", {}, "HOW CAN PEOPLE REACH YOU?"), h("p", { class: "muted small" }, "Shown to signed-in people who open your profile. Never to people you block."), li, ig);
      }
      case 5: {
        const grid = h("div", {});
        const render = () => grid.replaceChildren(
          ...["male", "female"].map((g) => h("div", {}, h("h3", {}, g.toUpperCase()),
            h("div", { class: "chips" }, CHARACTERS[g].map((c) => h("button", { type: "button", class: "chip-btn look" + (p.look === c.id ? " on" : ""),
              onclick: () => { p.look = c.id; render(); app.player.setLook(p.look, p.skin); } },
              h("i", { class: "swatch", style: { background: "#" + c.top.toString(16).padStart(6, "0") } }), c.label))))),
          h("h3", {}, "SKIN"),
          h("div", { class: "chips" }, SKIN_TONES.map((s) => h("button", { type: "button", "aria-label": "Skin tone", class: "chip-btn tone" + (p.skin === s ? " on" : ""),
            style: { background: "#" + s.toString(16).padStart(6, "0") }, onclick: () => { p.skin = s; render(); app.player.setLook(p.look, p.skin); } }))));
        render();
        return h("div", {}, h("h3", {}, "PICK YOUR CHARACTER"), grid);
      }
      case 6:
        return h("div", {}, h("h3", {}, "WHERE AND WHEN?"), h("h3", { class: "sub" }, "HOME DISTRICT"),
          chips(HOME_DISTRICTS, [p.home || HOME_DISTRICTS[0]], { onChange: ([v]) => { p.home = v; } }),
          h("h3", { class: "sub" }, "USUALLY HERE"), chips(TIMES, p.hours, { max: 4, onChange: (v) => { p.hours = v; } }));
      case 7: {
        const vis = h("input", { type: "checkbox", checked: p.visible !== false, onchange: (e) => { p.visible = e.target.checked; } });
        const mail = h("input", { type: "checkbox", checked: p.emailAlerts !== false, onchange: (e) => { p.emailAlerts = e.target.checked; } });
        return h("div", {}, h("h3", {}, "WHO CAN SEE YOU?"),
          h("label", { class: "check" }, vis, " Show me to other people"),
          h("label", { class: "check" }, mail, " Email me when someone waves or wants to connect"));
      }
    }
  }

  async function save(next) {
    if (!p.name?.trim()) { step = 0; render(); return toast("Add your name first."); }
    try {
      const { id, residentNo, ...patch } = p;
      await app.backend.saveProfile(patch);
      await app.refreshMe();
      toast("Saved ✓", "good");
      if (next) { step = Math.min(STEPS - 1, step + 1); render(); }
    } catch (e) { toast(e.message, "bad"); }
  }

  function render() {
    setPanelBody(h("div", {},
      h("div", { class: "steps" }, Array.from({ length: STEPS }, (_, i) => h("i", { class: i === step ? "on" : i < step ? "done" : "" }))),
      stepNode(),
      h("p", { class: "muted small" }, "Others see your name, what you do and where you hang out. Never your email."),
      h("button", { type: "button", class: "twin-line", onclick: () => openTwin(app) }, "🪞 ",
        twin?.enabled ? "Your AI twin is on" : "Your AI twin is off", h("span", { class: "muted small" }, " · An AI that answers members for you while you are away. Teach it →")),
      h("div", { class: "row" },
        step > 0 ? h("button", { type: "button", class: "btn", onclick: () => { step--; render(); } }, "◀ BACK") : null,
        h("button", { type: "button", class: "btn primary", onclick: () => save(false) }, "SAVE"),
        step < STEPS - 1 ? h("button", { type: "button", class: "btn", onclick: () => { step++; render(); } }, "NEXT ▸") : null),
      h("button", { type: "button", class: "link", onclick: async () => { await app.backend.signOut(); closePanel(); app.onSignedOut(); } }, "Sign out")));
  }
  openPanel("👤 YOUR PROFILE", h("div", {}));
  render();
}

// ---------- About you ----------
export async function openAbout(app) {
  if (!app.requireSignIn("fill in your details")) return;
  const p = await app.backend.getMyProfile();
  const views = await app.backend.viewsThisWeek();
  const about = { ...(p.about || {}) };
  const field = (k, label, ph, max = 80) => h("label", { class: "field" }, label,
    h("input", { type: "text", maxlength: max, placeholder: ph, value: about[k] || "", oninput: (e) => { about[k] = e.target.value; } }));
  openPanel("🧑‍💻 ABOUT YOU", h("div", {},
    h("p", { class: "big-stat" }, `${views.length} ${views.length === 1 ? "person" : "people"} looked at your profile this week`),
    views.slice(0, 5).map((v) => h("div", { class: "muted small" }, v.name, v.role ? ` · ${v.role}` : "")),
    h("h3", {}, "WHAT YOU LIKE · WHAT YOU ARE HERE FOR"),
    h("div", { class: "tags" }, [...(p.interests || []), ...(p.reasons || []).map((r) => REASONS.find((x) => x.id === r)?.label)].filter(Boolean).map((t) => h("span", { class: "tag-s" }, t))),
    h("p", { class: "muted small" }, "People who share these see you first in Koi ne shodho. People can see when you open their profile."),
    h("button", { type: "button", class: "link", onclick: () => openProfile(app, 2) }, "✏️ CHANGE THESE"),
    h("h3", {}, "TAMARA VISHE"), h("p", { class: "muted small" }, "Shown on your profile card to anyone who walks up to you. All optional."),
    field("company", "COMPANY OR COLLEGE", "e.g. DAIICT, or your startup"),
    field("building", "WHAT YOU ARE BUILDING", "One line", 120),
    field("website", "WEBSITE OR PORTFOLIO", "example.com", 100),
    field("skills", `SKILLS (UP TO ${LIMITS.maxSkills}, COMMAS BETWEEN)`, "React, Figma, Sales", 160),
    h("button", { type: "button", class: "btn primary", onclick: async () => {
      about.skills = (about.skills || "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, LIMITS.maxSkills).join(", ");
      try { await app.backend.saveProfile({ about }); await app.refreshMe(); toast("Saved ✓", "good"); } catch (e) { toast(e.message, "bad"); }
    } }, "SAVE")));
}

// ---------- Resident card ----------
const SIZES = { story: [1080, 1920, "Story 9:16"], post: [1080, 1350, "Post 4:5"], link: [1200, 630, "Link preview"] };

function drawCard(canvas, p, kind) {
  const [w, hgt] = SIZES[kind];
  canvas.width = w; canvas.height = hgt;
  const c = canvas.getContext("2d");
  const g = c.createLinearGradient(0, 0, 0, hgt);
  g.addColorStop(0, "#1b2448"); g.addColorStop(1, "#14182b");
  c.fillStyle = g; c.fillRect(0, 0, w, hgt);
  // skyline
  c.fillStyle = "#2b3560";
  for (let i = 0; i < 18; i++) { const bw = w / 18; const bh = (0.08 + ((i * 37) % 11) / 40) * hgt; c.fillRect(i * bw, hgt * 0.78 - bh, bw - 6, bh); }
  c.fillStyle = "#3f87b0"; c.fillRect(0, hgt * 0.78, w, hgt * 0.04);
  c.fillStyle = "#5f9a4c"; c.fillRect(0, hgt * 0.82, w, hgt * 0.18);
  const s = Math.min(w, hgt) / 1080;
  c.fillStyle = "#f2b84b"; c.font = `800 ${46 * s}px "Baloo Bhai 2", Inter, sans-serif`;
  c.fillText("PEOPLE OF GANDHINAGAR", 70 * s, 120 * s);
  c.fillStyle = "#fff7e0"; c.font = `800 ${120 * s}px "Baloo Bhai 2", Inter, sans-serif`;
  c.fillText((p.name || "Resident").toUpperCase(), 70 * s, kind === "link" ? 280 * s : 330 * s, w - 140 * s);
  c.font = `500 ${44 * s}px Inter, sans-serif`; c.fillStyle = "#cfd6e8";
  c.fillText(p.role || "Gandhinagari", 70 * s, kind === "link" ? 350 * s : 410 * s, w - 140 * s);
  c.fillStyle = "#f2b84b"; c.font = `700 ${64 * s}px "Baloo Bhai 2", Inter, sans-serif`;
  c.fillText(`Resident No. ${p.residentNo}`, 70 * s, kind === "link" ? 450 * s : 540 * s);
  if (p.oneLiner && kind !== "link") { c.fillStyle = "#fff7e0"; c.font = `italic 400 ${40 * s}px Inter, sans-serif`; c.fillText(`“${p.oneLiner}”`, 70 * s, 630 * s, w - 140 * s); }
  c.fillStyle = "#fff7e0"; c.font = `500 ${34 * s}px Inter, sans-serif`;
  c.fillText("ગાંધીનગર · walk the city, meet Gandhinagaris", 70 * s, hgt - 60 * s, w - 140 * s);
}

export async function openResidentCard(app) {
  if (!app.requireSignIn("get your resident card")) return;
  const p = await app.backend.getMyProfile();
  if (!p.name) { toast("Add your name first."); return openProfile(app); }
  let kind = "story";
  const canvas = h("canvas", { class: "card-canvas" });
  const caption = `Hu have Gandhinagar no resident chhu! 🪪 Resident No. ${p.residentNo}. Walk the city with me: People of Gandhinagar`;
  const download = (k) => { const cv = document.createElement("canvas"); drawCard(cv, p, k); const a = document.createElement("a"); a.download = `gandhinagar-resident-${p.residentNo}-${k}.png`; a.href = cv.toDataURL("image/png"); a.click(); };
  const render = () => drawCard(canvas, p, kind);
  openPanel("🪪 RESIDENT CARD", h("div", { class: "center-col" },
    chips(Object.entries(SIZES).map(([id, v]) => ({ id, label: v[2] })), [kind], { onChange: ([v]) => { kind = v; render(); } }),
    canvas,
    h("p", {}, `You are Resident No. ${p.residentNo}. Tamaru card taiyar che.`),
    h("button", { type: "button", class: "btn primary wide", onclick: () => download(kind) }, "⬇ DOWNLOAD"),
    h("button", { type: "button", class: "btn wide", onclick: () => Object.keys(SIZES).forEach(download) }, "ALL THREE SIZES"),
    h("h3", {}, "CAPTION, READY TO PASTE"), h("p", { class: "caption" }, caption),
    h("button", { type: "button", class: "btn", onclick: async () => { try { await navigator.clipboard.writeText(caption); toast("Caption copied ✓", "good"); } catch { toast("Copy blocked by the browser."); } } }, "COPY CAPTION")));
  render();
}
