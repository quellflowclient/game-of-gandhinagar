import {CONTENT} from '../systems/game-content.js';
import { h, openPanel, toast, chips, closePanel, ago } from "./dom.js";
import { PLAN_CATEGORIES, SAMPLE_EVENTS, FESTIVALS, STALLS } from "../data/live-content.js";
import { hubs, placedPlaces, placePos, HOME_DISTRICTS } from "../data/places.js";
import { fmtHour } from "../systems/clock.js";

// ---------- Plans ----------
export async function openPlans(app, prefill) {
  let cat = "all";
  const list = h("div", {});
  async function render() {
    const plans = (await app.backend.listPlans()).filter((p) => cat === "all" || p.cat === cat).sort((a, b) => b.created - a.created);
    const me = app.session?.userId;
    list.replaceChildren(
      h("h3", { class: "sec" }, "PLANS BY PEOPLE · KOI AAVSE?"),
      plans.length ? plans.map((p) => {
        const inIt = me && p.joined.includes(me);
        return h("div", { class: "plan" },
          h("div", { class: "grow" },
            h("div", { class: "nm" }, PLAN_CATEGORIES.find((c) => c.id === p.cat)?.label.split(" ")[0] || "✨", " ", p.title),
            h("div", { class: "muted small" }, p.host?.name || "Someone", " · 📍 ", [p.when, p.where].filter(Boolean).join(" · ")),
            h("div", { class: "small" }, `${p.people.length} in: ${p.people.slice(0, 4).join(", ")}${p.people.length > 4 ? "…" : ""}`),
            h("div", { class: "muted small" }, ago(p.created))),
          p.by === me ? h("span", { class: "muted small" }, "Your plan")
            : h("button", { type: "button", class: "btn sm" + (inIt ? "" : " primary"), onclick: async () => {
              if (!app.requireSignIn("join plans")) return;
              await app.backend.joinPlan(p.id, !inIt);
              if (!inIt) { app.progress.track("join_plan"); toast("You're in! Say hi to the host in chat.", "good"); }
              render();
            } }, inIt ? "LEAVE" : "I'M IN"));
      }) : h("p", { class: "muted" }, "No plans yet. Post the first one!"),
      h("h3", { class: "sec" }, "📍 HAPPENING IN GANDHINAGAR · sample listings, check the organiser before you go"),
      SAMPLE_EVENTS.filter((e) => cat === "all" || e.cat === cat).map((e) => h("div", { class: "plan" },
        h("span", { class: "emo" }, e.emoji),
        h("div", { class: "grow" }, h("div", { class: "nm" }, e.title), h("div", { class: "muted small" }, `${e.when} · ${e.where}`)),
        h("button", { type: "button", class: "btn sm", onclick: () => postForm({ cat: e.cat, title: `${e.title}, koi aavse?`, when: e.when, where: e.where }) }, "FIND COMPANY ▸"))));
  }
  function postForm(pre = {}) {
    if (!app.requireSignIn("post a plan")) return;
    const plan = { cat: pre.cat || "chai", title: pre.title || "", when: pre.when || "", where: pre.where || app.currentPlace?.name || "" };
    const field = (k, ph, max) => h("input", { type: "text", maxlength: max, placeholder: ph, value: plan[k], oninput: (e) => { plan[k] = e.target.value; } });
    openPanel("＋ POST A PLAN", h("div", {},
      chips(PLAN_CATEGORIES.filter((c) => c.id !== "all"), [plan.cat], { onChange: ([v]) => { plan.cat = v; } }),
      field("title", "What's the plan? e.g. Chai at Infocity after work", 100),
      field("when", "When? e.g. Today 7 pm", 40),
      field("where", "Where?", 60),
      h("p", { class: "muted small" }, "Plans are made between people. We do not organise or check them. Meet in public places. Plans disappear after about three days."),
      h("button", { type: "button", class: "btn primary wide", onclick: async () => {
        if (plan.title.trim().length < 3) return toast("Add a short title.");
        try { await app.backend.postPlan(plan); app.progress.track("post_plan"); toast("Plan posted ✓", "good"); openPlans(app); }
        catch (e) { toast(e.message, "bad"); }
      } }, "POST PLAN")));
  }
  openPanel("🎬 PLANS · KOI CHE?", h("div", {},
    h("p", { class: "muted" }, "FIND SOMEONE TO DO IT WITH"),
    chips(PLAN_CATEGORIES, [cat], { onChange: ([v]) => { cat = v; render(); } }),
    h("button", { type: "button", class: "btn primary wide", onclick: () => postForm() }, "＋ POST A PLAN"),
    list), { wide: true });
  render();
  if (prefill) postForm(prefill);
}

// ---------- Utsav ----------
export async function openUtsav(app) {
  const today = new Date();
  const active = (f) => f.fixed && today.getMonth() === f.month && today.getDate() >= f.from && today.getDate() <= f.to;
  const nextDate = (f) => {
    if (!f.fixed) return "Date set each year";
    let y = today.getFullYear();
    const d = new Date(y, f.month, f.from);
    if (d < new Date(y, today.getMonth(), today.getDate()) && !active(f)) d.setFullYear(y + 1);
    return d.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
  };
  const upcoming = [
    { id: "ai-meetup", title: "AI virtual meetup · Gandhinagar", when: "Date to be announced · right here, in the virtual city", note: "An AI meetup inside People of Gandhinagar. Builders, students and the curious, all welcome." },
    { id: "garba-night", title: "Garba night", when: "Date to be announced · venue to be announced", note: "A garba event listing. Ticket link will be added here." },
  ];
  const counts = await Promise.all(upcoming.map((u) => app.backend.interestCount(u.id)));
  openPanel("🎉 UTSAV · WHAT'S ON IN GANDHINAGAR", h("div", {},
    h("h3", {}, "AAJE SU CHE?"),
    FESTIVALS.map((f) => h("div", { class: "plan" + (active(f) ? " live" : "") },
      h("span", { class: "emo" }, f.emoji),
      h("div", { class: "grow" }, h("div", { class: "nm" }, f.title, active(f) ? h("span", { class: "here" }, " ● ON NOW") : null),
        h("div", { class: "muted small" }, `${active(f) ? "Today" : nextDate(f)} · ${f.where}`), h("div", { class: "small" }, f.note)),
      h("button", { type: "button", class: "btn sm", onclick: () => { app.setFestival(app.festival === f.id ? null : f.id); closePanel(); } },
        app.festival === f.id ? "STOP PREVIEW" : "PREVIEW"))),
    h("h3", { class: "sec" }, "COMING UP IN THE REAL CITY"),
    upcoming.map((u, i) => {
      const n = h("span", { class: "muted small" }, counts[i] ? ` · ${counts[i]} interested` : "");
      return h("div", { class: "plan" }, h("div", { class: "grow" }, h("div", { class: "nm" }, u.title), h("div", { class: "muted small" }, u.when), h("div", { class: "small" }, u.note), n),
        h("div", { class: "col" }, h("span", { class: "muted small" }, "TICKETS SOON"),
          h("button", { type: "button", class: "btn sm", onclick: async () => { const c = await app.backend.markInterested(u.id, true); n.textContent = ` · ${c} interested`; toast("Noted! We'll show it here when tickets open.", "good"); } }, "I AM INTERESTED")));
    }),
    h("p", { class: "muted small" }, "Sample calendar. Festival dates that move each year are marked; only fixed dates switch on by themselves. \"Preview\" turns an event on so you can see it now.")));
}

// ---------- Travel (BRTS) ----------
export function openTravel(app) {
  const here = app.currentPlace?.id;
  const counts = app.countsByPlace();
  openPanel("🚌 BRTS · જનમાર્ગ", h("div", {},
    h("h3", {}, "KYA JAVU CHE?"),
    hubs().map((p) => h("button", { type: "button", class: "dest" + (p.id === here ? " here" : ""), disabled: p.id === here, onclick: () => { closePanel(); app.travel(p.id); } },
      h("div", { class: "nm" }, p.name.toUpperCase(), h("span", { class: "gu" }, " ", p.gu)),
      h("div", { class: "muted small" }, p.blurb),
      h("div", { class: "small" }, p.id === here ? "YOU ARE HERE" : `${counts[p.id] || 0} PEOPLE HERE · START MEETING NEW PEOPLE ▸`))),
    app.world.stage ? h("button", { type: "button", class: "dest", onclick: () => { closePanel(); app.goNear(app.world.stage.x, app.world.stage.z + 8); } },
      h("div", { class: "nm" }, "🎤 OPEN MIC STAGE"), h("div", { class: "muted small" }, "Sector 1 Lake Garden · take the mic or just listen"), h("div", { class: "small" }, "GO TO THE STAGE ▸")) : null,
    placedPlaces().some(p=>!p.hub)?h("h3", { class: "sec" }, "OTHER PLACES (WALK OR CYCLE)"):null,
    placedPlaces().filter((p) => !p.hub).map((p) => h("button", { type: "button", class: "dest small-dest", onclick: () => { closePanel(); app.travel(p.id); } },
      h("div", { class: "nm" }, p.name, p.approx ? h("span", { class: "muted small" }, " (approx. spot)") : null), h("div", { class: "muted small" }, p.blurb)))));
}

// ---------- City map ----------
export function openMap(app) {
  const canvas = h("canvas", { class: "map-canvas" });
  const filters = new Set(["people", "food", "shops", "events", "cafes"]);
  let zoom = 0.18, cx = app.player.position.x, cz = app.player.position.z, full = false;
  const map = app.world.map;
  const major = map.roads.filter((r) => ["motorway", "trunk", "primary", "secondary", "tertiary"].includes(r.kind));
  const markers = [];

  function draw() {
    const w = canvas.clientWidth, hh = canvas.clientHeight;
    canvas.width = w * devicePixelRatio; canvas.height = hh * devicePixelRatio;
    const c = canvas.getContext("2d");
    c.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    const X = (x) => w / 2 + (x - cx) * zoom, Y = (z) => hh / 2 + (z - cz) * zoom;
    c.fillStyle = "#efe6d2"; c.fillRect(0, 0, w, hh);
    c.fillStyle = "#c9dcb0";
    for (const p of map.parks) { c.beginPath(); p.pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z)))); c.fill(); }
    c.strokeStyle = "#8cc4e0"; c.fillStyle = "#8cc4e0";
    for (const wv of map.water) {
      c.beginPath(); wv.pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z))));
      if (wv.closed) c.fill(); else { c.lineWidth = Math.max(3, 110 * zoom); c.stroke(); }
    }
    c.strokeStyle = "#ffffff"; c.lineCap = "round";
    for (const r of major) {
      c.lineWidth = r.kind === "tertiary" ? 2 : 3.5;
      c.beginPath(); r.pts.forEach(([x, z], i) => (i ? c.lineTo(X(x), Y(z)) : c.moveTo(X(x), Y(z)))); c.stroke();
    }
    markers.length = 0;
    // Places
    for (const p of placedPlaces()) {
      const { x, z } = placePos(p);
      const px = X(x), py = Y(z);
      c.fillStyle = "#" + p.color.toString(16).padStart(6, "0");
      c.beginPath(); c.arc(px, py, p.hub ? 7 : 5, 0, Math.PI * 2); c.fill();
      c.font = "700 11px Inter, sans-serif"; c.fillStyle = "#14182b";
      c.fillText(p.name.toUpperCase(), px + 9, py + 4);
      markers.push({ x: px, y: py, place: p });
    }
    // Stalls (food, cafes, shops)
    if (filters.has("food") || filters.has("cafes") || filters.has("shops")) {
      for (const s of app.world.stalls) {
        const isShop = /stall|bandhani|khadi|toys/i.test(s.name) && !/chai|bhel|dabeli|gola|juice|makai|food|canteen|coffee/i.test(s.name);
        const isCafe = /chai|coffee/i.test(s.name);
        if ((isShop && !filters.has("shops")) || (isCafe && !filters.has("cafes")) || (!isShop && !isCafe && !filters.has("food"))) continue;
        c.font = "14px sans-serif"; c.fillText(s.emoji, X(s.x) - 7, Y(s.z) + 5);
      }
    }
    if (filters.has("events") && app.world.stage) { c.font = "14px sans-serif"; c.fillText("🎤", X(app.world.stage.x) - 7, Y(app.world.stage.z) + 5); }
    // People
    if (filters.has("people")) {
      c.fillStyle = "#7a5cd8";
      for (const m of app.presenceMembers()) { c.beginPath(); c.arc(X(m.x), Y(m.z), 4, 0, Math.PI * 2); c.fill(); }
      c.fillStyle = "#4fb6a8";
      for (const p of app.people.all()) { c.beginPath(); c.arc(X(p.x), Y(p.z), 2.5, 0, Math.PI * 2); c.fill(); }
    }
    // You
    const me = app.player.position;
    c.save(); c.translate(X(me.x), Y(me.z)); c.rotate(-app.player.heading + Math.PI);
    c.fillStyle = "#e0532f"; c.beginPath(); c.moveTo(0, -9); c.lineTo(6, 6); c.lineTo(-6, 6); c.closePath(); c.fill(); c.restore();
    // Scale bar
    const meters = zoom > 0.5 ? 100 : zoom > 0.12 ? 500 : 2000;
    c.fillStyle = "#14182b"; c.fillRect(12, hh - 18, meters * zoom, 3);
    c.font = "11px Inter, sans-serif"; c.fillText(meters >= 1000 ? `${meters / 1000} km` : `${meters} m`, 16 + meters * zoom, hh - 14);
  }

  // Drag to pan, tap a place to travel there.
  let drag = null;
  canvas.addEventListener("pointerdown", (e) => { drag = { x: e.clientX, y: e.clientY, cx, cz, moved: 0 }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener("pointermove", (e) => {
    if (!drag) return;
    drag.moved += Math.abs(e.movementX) + Math.abs(e.movementY);
    cx = drag.cx - (e.clientX - drag.x) / zoom; cz = drag.cz - (e.clientY - drag.y) / zoom; draw();
  });
  canvas.addEventListener("pointerup", (e) => {
    const wasTap = drag && drag.moved < 6;
    drag = null;
    if (!wasTap) return;
    const b = canvas.getBoundingClientRect();
    const hit = markers.find((m) => Math.hypot(m.x - (e.clientX - b.left), m.y - (e.clientY - b.top)) < 14);
    if (hit) { closePanel(); app.travel(hit.place.id); }
  });
  canvas.addEventListener("wheel", (e) => { e.preventDefault(); zoom = Math.min(2, Math.max(0.03, zoom * (e.deltaY < 0 ? 1.2 : 0.83))); draw(); }, { passive: false });

  const FILTERS = [["cafes", "☕ Cafes"], ["food", "🍲 Food"], ["shops", "🛍️ Shops"], ["events", "🎉 Events"], ["people", "👥 People"]];
  const sheet = h("div", { class: "map-wrap" },
    h("div", { class: "chips" }, FILTERS.map(([id, label]) => h("button", { type: "button", class: "chip-btn on", onclick: (e) => {
      filters.has(id) ? filters.delete(id) : filters.add(id); e.target.classList.toggle("on"); draw(); } }, label))),
    h("div", { class: "map-area" }, canvas,
      h("div", { class: "map-ctrl" },
        h("button", { type: "button", "aria-label": "Zoom in", onclick: () => { zoom = Math.min(2, zoom * 1.4); draw(); } }, "+"),
        h("button", { type: "button", "aria-label": "Zoom out", onclick: () => { zoom = Math.max(0.03, zoom / 1.4); draw(); } }, "−"),
        h("button", { type: "button", "aria-label": "Recentre on me", onclick: () => { cx = app.player.position.x; cz = app.player.position.z; draw(); } }, "◎"),
        h("button", { type: "button", "aria-label": "Fullscreen", onclick: () => { full = !full; sheet.closest(".sheet").classList.toggle("full", full); setTimeout(draw, 50); } }, "⤢"))),
    h("p", { class: "muted small" }, "Tap a place to take the BRTS there. Drag to move, scroll to zoom. Map data © OpenStreetMap contributors."));
  openPanel("GANDHINAGAR MAP", sheet, { wide: true });
  requestAnimationFrame(draw);
}

// ---------- Time ----------
export function openTime(app) {
  const c = app.clock;
  const big = h("div", { class: "big-time" });
  const per = h("div", { class: "muted" });
  const mood = h("p", {});
  const weather = h("p", { class: "small" });
  const tick = () => {
    const hr = c.hour();
    big.textContent = fmtHour(hr);
    per.textContent = `${c.period.toUpperCase()} · ${c.mode === "live" ? "Live IST" : c.mode === "lapse" ? "24h in 60s" : "Preview"}`;
    mood.textContent = c.mood();
    weather.textContent = [c.weatherText(), c.aqiText()].filter(Boolean).join(" · ");
  };
  const iv = setInterval(tick, 500);
  tick();
  openPanel("🕒 TIME OF DAY", h("div", {}, big, per,
    h("div", { class: "chips" },
      h("button", { type: "button", class: "chip-btn", onclick: () => { c.setLive(); tick(); } }, "Live IST"),
      ...["Morning", "Day", "Evening", "Night"].map((n) => h("button", { type: "button", class: "chip-btn", onclick: () => { c.setPreset(n); tick(); } }, n)),
      h("button", { type: "button", class: "chip-btn", onclick: () => { c.timelapse(); } }, "▶ 24h in 60s")),
    weather, mood), { onClose: () => clearInterval(iv) });
}

// ---------- Sound ----------
export function openSound(app) {
  const s = app.sound;
  const slider = (k, label, desc) => h("div", { class: "field" }, h("b", {}, label), h("span", { class: "muted small" }, desc),
    h("input", { type: "range", min: 0, max: 100, value: s.state[k], oninput: (e) => s.set(k, +e.target.value) }));
  openPanel("🔊 SOUND · AVAAJ", h("div", {},
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: s.state.on, onchange: (e) => { s.start(); s.set("on", e.target.checked); } }), " Sound: everything on or off"),
    slider("city", "🏙️ City", "Footsteps, horns and collision effects · continuous wind noise removed"),
    slider("voice", "🗣️ Voice guide", "A Gujarati hello and the place names"),
    h('p',{class:'muted small'},'Voice previews use recorded dialogue where available. Enable Sound and raise Voice guide volume to listen.'),
    h('div',{class:'row'},
      h('button',{type:'button',class:'btn',onclick:()=>s.say(CONTENT.dialogues.guard.idWhere,'hi-IN',{...CONTENT.voices.guard,profile:'guard'})},'▶ Security guard'),
      h('button',{type:'button',class:'btn',onclick:()=>s.say(CONTENT.stalls[0].callText,'hi-IN',CONTENT.voices.male)},'▶ Male player'),
      h('button',{type:'button',class:'btn',onclick:()=>s.say(CONTENT.stalls[0].callText,'hi-IN',CONTENT.voices.female)},'▶ Female player')),
    h("button", { type: "button", class: "btn", onclick: () => { s.start(); s.say(CONTENT.dialogues.guide.welcome); } }, "▶ Test the voice guide")));
}

// ---------- Suggest ----------
export function openSuggest(app) {
  let type = "Feature request";
  const text = h("textarea", { rows: 5, maxlength: 2000, placeholder: "What should we add? What broke?" });
  openPanel("💡 SUGGEST", h("div", {}, h("h3", {}, "WHAT SHOULD WE ADD?"), h("p", { class: "muted small" }, "THIS IS A"),
    chips(["Feature request", "Something is broken", "Other"], [type], { onChange: ([v]) => { type = v; } }),
    text, h("p", { class: "muted small" }, "Every note is read."),
    h("button", { type: "button", class: "btn primary wide", onclick: async () => {
      if (text.value.trim().length < 3) return toast("Write a few words first.");
      await app.backend.sendSuggestion({ type, text: text.value.trim() });
      toast("Thank you! Sent ✓", "good"); closePanel();
    } }, "SEND")));
}

// ---------- Advertise ----------
export function openAds(app) {
  const ad = { kind: "Startup", place: "Anywhere", business: "", contact: "", note: "" };
  const input = (k, ph, type = "text") => h("input", { type, placeholder: ph, maxlength: 120, oninput: (e) => { ad[k] = e.target.value; } });
  openPanel("📣 ADVERTISE", h("div", {},
    h("h2", { class: "big" }, "Advertise your startup, store or cafe"),
    h("p", { class: "good-note" }, "Free for the first month: add your startup, store or cafe at no cost."),
    h("p", {}, "Put your business in front of people walking the city: a named shopfront, a billboard, a stall or an event. Tell us what you have in mind and we will get back to you."),
    h("h3", {}, "WHAT IS IT"), chips(["Startup", "Store", "Cafe or restaurant", "Other"], [ad.kind], { onChange: ([v]) => { ad.kind = v; } }),
    h("h3", {}, "WHERE IN THE CITY"), chips(["Anywhere", ...HOME_DISTRICTS], [ad.place], { onChange: ([v]) => { ad.place = v; } }),
    input("business", "Business name"), input("contact", "Your email or phone, so we can reply"),
    h("textarea", { rows: 3, maxlength: 600, placeholder: "What do you have in mind?", oninput: (e) => { ad.note = e.target.value; } }),
    h("p", { class: "muted small" }, "We only use these details to reply to you about advertising."),
    h("button", { type: "button", class: "btn primary wide", onclick: async () => {
      if (!ad.business.trim() || !ad.contact.trim()) return toast("Add the business name and how to reach you.");
      await app.backend.sendAdRequest(ad); toast("Request sent ✓ We'll get back to you.", "good"); closePanel();
    } }, "SEND REQUEST")));
}

export { STALLS };
