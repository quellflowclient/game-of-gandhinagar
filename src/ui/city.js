import {CONTENT} from '../systems/game-content.js';
import { h, openPanel, toast, chips, closePanel, ago } from "./dom.js";
import { PLAN_CATEGORIES, SAMPLE_EVENTS, FESTIVALS, STALLS } from "../data/live-content.js";
import { hubs, placedPlaces, placePos, HOME_DISTRICTS } from "../data/places.js";
import { fmtHour } from "../systems/clock.js";
import {explorationAreaForPlace,explorationAreaLabel,explorationCorners} from '../world/exploration-areas.js';

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

// ---------- Metro transfers between bounded neighbourhoods ----------
export function openTravel(app) {
  const here = app.player.areaId||explorationAreaForPlace(app.currentPlace?.id);
  const counts = app.countsByPlace();
  openPanel("Ⓜ METRO · મેટ્રો", h("div", {},
    h("div", {class:'metro-transfer-note'},h('b',{},'Your next neighbourhood'),h('span',{},'Mahatma Mandir aur poora Swarnim Park ek hi walkable area hain. Door ki locations ke liye metro chuno.'),h('small',{class:'muted',style:'display:block;margin-top:6px'},'Game transfers · destination names, not a real station or timetable guide.')),
    h("h3", {}, "KYA JAVU CHE?"),
    hubs().filter(p=>p.id!=='swarnim').map((p) => h("button", { type: "button", class: "dest" + (p.id === here ? " here" : ""), disabled: p.id === here, onclick: () => { closePanel(); app.travel(p.id); } },
      h("div", { class: "nm" }, explorationAreaLabel(p.id).toUpperCase(), h("span", { class: "gu" }, " ", p.id==='dandi'?'મહાત્મા મંદિર · સ્વર્ણિમ પાર્ક':p.gu)),
      h("div", { class: "muted small" }, p.id==='dandi'?'Museum, convention campus and the full Central Vista promenade':p.blurb),
      h("div", { class: "small" }, p.id === here ? "YOU ARE HERE · EXPLORE ON FOOT" : `${(counts[p.id] || 0)+(p.id==='dandi'?(counts.swarnim||0):0)} PEOPLE HERE · TAKE THE METRO →`))),
    app.world.stage ? h("button", { type: "button", class: "dest", onclick: () => { closePanel(); app.goNear(app.world.stage.x, app.world.stage.z + 8); } },
      h("div", { class: "nm" }, "🎤 OPEN MIC STAGE"), h("div", { class: "muted small" }, "Sector 1 Lake Garden · take the mic or just listen"), h("div", { class: "small" }, "GO TO THE STAGE ▸")) : null,
    placedPlaces().some(p=>!p.hub)?h("h3", { class: "sec" }, "OTHER PLACES (WALK OR CYCLE)"):null,
    placedPlaces().filter((p) => !p.hub).map((p) => h("button", { type: "button", class: "dest small-dest", onclick: () => { closePanel(); app.travel(p.id); } },
      h("div", { class: "nm" }, p.name, p.approx ? h("span", { class: "muted small" }, " (approx. spot)") : null), h("div", { class: "muted small" }, p.blurb)))));
}

// The map shares safe arrival targets with Metro and local quick travel.
export {openCityMap as openMap} from './city-map.js';

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
