import { h, openPanel, setPanelBody, toast, closePanel } from "./dom.js";
import { CHAPTER, STORIES, GIGS, REAL_MISSIONS, BADGES, FIRSTS } from "../data/content.js";
import { hubs, placeById } from "../data/places.js";

// ---------- current mission brief ----------
export function openMissionBrief(app) {
  const cur = app.progress.current();
  if (!cur) return openMissions(app);
  const { def, index, counts } = cur;
  openPanel(`MISSION ${index + 1}/${CHAPTER.missions.length} · ANYWHERE IN THE CITY`, h("div", { class: "center-col" },
    h("h2", { class: "big" }, `${def.emoji} ${def.title.toUpperCase()}`),
    h("p", {}, def.brief),
    def.gu ? h("button", { type: "button", class: "btn", onclick: () => { app.sound.start(); app.sound.say(def.gu); } }, "🔊 સાંભળો") : null,
    def.gu ? h("p", { class: "gu-line" }, def.gu) : null,
    h("ul", { class: "goals" }, def.goals.map((g, i) => h("li", { class: (counts[i] || 0) >= (g.n || 1) ? "done" : "" },
      `${(counts[i] || 0) >= (g.n || 1) ? "✅" : "⬜"} ${g.label}${g.n > 1 ? ` (${Math.min(counts[i] || 0, g.n)}/${g.n})` : ""}`))),
    h("button", { type: "button", class: "btn primary wide", onclick: () => { closePanel(); app.missionHint(def); } }, "START ▸"),
    h("button", { type: "button", class: "link", onclick: closePanel }, "NOT NOW")));
}

// ---------- all missions ----------
export function openMissions(app) {
  const s = app.progress.state;
  const doneN = s.chapter.filter((m) => m.done).length;
  const cur = app.progress.current();
  const body = h("div", {},
    h("h3", {}, CHAPTER.title.toUpperCase()),
    h("p", { class: "muted small" }, `${doneN} of ${CHAPTER.missions.length} done. Saved on this device. Wallet: ₹${s.coins} (play money).`),
    CHAPTER.missions.map((m, i) => {
      const st = s.chapter[i];
      const locked = !st.done && cur && cur.index < i;
      return h("div", { class: "mission" + (st.done ? " done" : "") + (locked ? " locked" : "") },
        h("span", { class: "emo" }, st.done ? "✅" : locked ? "🔒" : m.emoji),
        h("div", { class: "grow" }, h("div", { class: "nm" }, `${i + 1}. ${m.title.toUpperCase()}`),
          h("div", { class: "muted small" }, locked ? `Finish "${CHAPTER.missions[i - 1].title}" first` : m.brief)),
        !st.done && !locked ? h("button", { type: "button", class: "btn sm", onclick: () => openMissionBrief(app) }, "BRIEF") : null);
    }),
    h("h3", { class: "sec" }, "STORY · ANY TIME"),
    STORIES.map((st) => {
      const prog = s.stories[st.id];
      const place = placeById(st.place);
      return h("div", { class: "mission" + (prog?.done ? " done" : "") },
        h("span", { class: "emo" }, prog?.done ? "✅" : st.emoji),
        h("div", { class: "grow" }, h("div", { class: "nm" }, st.title.toUpperCase()),
          h("div", { class: "muted small" }, `${place.name} · about ${st.minutes} minutes, solo · ${st.brief}`)),
        prog?.done ? null : h("button", { type: "button", class: "btn sm", onclick: () => { app.progress.startStory(st.id); closePanel(); app.travel(st.place); app.showCheckpoints(st.id); } },
          s.activeStory === st.id ? "GO ▸" : "START"));
    }),
    h("h3", { class: "sec" }, "GIGS · EARN A FEW COINS (PLAY MONEY)"),
    GIGS.map((g) => {
      const open = app.progress.gigUnlocked(g);
      return h("div", { class: "mission" + (open ? "" : " locked") },
        h("span", { class: "emo" }, open ? g.emoji : "🔒"),
        h("div", { class: "grow" }, h("div", { class: "nm" }, g.title.toUpperCase()),
          h("div", { class: "muted small" }, open ? `${placeById(g.place).name} · ${g.brief} Best: ₹${s.gigsDone[g.id] || 0}` : `Opens after mission 3, ${CHAPTER.missions[2].title}`)),
        open ? h("button", { type: "button", class: "btn sm", onclick: () => { closePanel(); app.startGig(g); } }, "START") : null);
    }),
    h("h3", { class: "sec" }, "REAL PEOPLE · ANY TIME"),
    REAL_MISSIONS.map((r) => h("div", { class: "mission" + (s.real[r.id] ? " done" : "") },
      h("span", { class: "emo" }, s.real[r.id] ? "✅" : r.emoji),
      h("div", { class: "grow" }, h("div", { class: "nm" }, r.title.toUpperCase()), h("div", { class: "muted small" }, r.brief)),
      s.real[r.id] ? null : h("button", { type: "button", class: "btn sm", onclick: () => app.open(r.type === "post_plan" ? "plans" : "find") }, "SHOW ME"))),
    h("h3", { class: "sec" }, `BADGES · ${s.badges.length}/${BADGES.length}`),
    h("div", { class: "badges" }, BADGES.map((b) => h("div", { class: "badge-c" + (s.badges.includes(b.id) ? " got" : "") },
      h("span", {}, s.badges.includes(b.id) ? "🏅" : "❔"), h("b", {}, b.label.toUpperCase()), h("i", {}, s.badges.includes(b.id) ? "Earned" : "Not yet")))),
    h("label", { class: "check" }, h("input", { type: "checkbox", checked: s.showCurrent, onchange: (e) => app.progress.setShowCurrent(e.target.checked) }), " Show my current mission on screen"));
  openPanel("🎯 MISSIONS", body, { wide: true });
}

// ---------- passport and day one ----------
export function openPassport(app) {
  const s = app.progress.state;
  const tasks = app.progress.dayOne();
  openPanel("🎟 GANDHINAGAR PASSPORT", h("div", {},
    h("div", { class: "streak" }, `🔥 Day ${s.streak.count}`, h("span", { class: "muted small" }, ` Best ${s.streak.best} · ${s.streak.rest} rest day${s.streak.rest === 1 ? "" : "s"} in hand`)),
    h("h3", {}, "TODAY"),
    tasks.map((t) => h("div", { class: "task" + (t.done ? " done" : "") }, t.done ? "✅ " : "⬜ ", h("b", {}, t.label.toUpperCase()), h("span", { class: "muted small" }, ` ${t.have}/${t.n} · ${t.hint}`))),
    h("h3", { class: "sec" }, "STAMPS"),
    h("div", { class: "stamps" }, hubs().map((p) => h("div", { class: "stamp" + (s.stamps.includes(p.id) ? " got" : "") }, h("b", {}, p.name), h("span", { class: "gu" }, p.gu)))),
    h("h3", { class: "sec" }, "FIRSTS"),
    h("div", { class: "firsts" }, FIRSTS.map((f) => h("div", { class: "first" + (s.firsts.includes(f.id) ? " got" : "") }, f.label))),
    h("p", { class: "muted small" }, "Saved on this device. Miss one day and your rest day keeps the streak.")));
}

export function openDayOne(app) {
  const tasks = app.progress.dayOne();
  openPanel(`🌅 DAY ONE · ${tasks.filter((t) => t.done).length}/${tasks.length}`, h("div", {},
    h("p", {}, "Your first-day missions. Do all three to feel at home."),
    tasks.map((t) => h("div", { class: "task" + (t.done ? " done" : "") }, t.done ? "✅ " : "⬜ ", h("b", {}, t.label), h("span", { class: "muted small" }, ` ${t.have}/${t.n} · ${t.hint}`))),
    h("div", { class: "row" },
      h("button", { type: "button", class: "btn", onclick: () => app.open("travel") }, "🚌 BRTS"),
      h("button", { type: "button", class: "btn", onclick: () => app.open("plans") }, "🎬 Plans"))));
}

// ---------- stalls and bargaining ----------
export function openStall(app, stall) {
  const s = app.progress.state;
  openPanel(`${stall.emoji} ${stall.name.toUpperCase()}`, h("div", {},
    h("p", { class: "muted small" }, `Wallet: ₹${s.coins} (play money). Prices here are samples, not real shop prices.`),
    stall.items.map(([item, price]) => h("div", { class: "plan" },
      h("div", { class: "grow" }, h("div", { class: "nm" }, item), h("div", { class: "muted small" }, `₹${price}`)),
      h("button", { type: "button", class: "btn sm", onclick: () => buy(app, stall, item, price) }, "BUY"),
      h("button", { type: "button", class: "btn sm primary", onclick: () => bargain(app, stall, item, price) }, "🤝 BHAAV KARO")))));
}

function buy(app, stall, item, price) {
  if (!app.progress.spend(price)) return toast("Not enough play money. Try a gig!", "bad");
  app.progress.track("buy", { item, place: stall.place });
  toast(`${stall.emoji} ${item} for ₹${price}. Majja karo!`, "good");
  closePanel();
}

function bargain(app, stall, item, price) {
  const floor = Math.round(price * (0.68 + Math.random() * 0.14));
  let ask = price, round = 0;
  const log = h("div", { class: "chat-log" });
  const offer = h("input", { type: "range", min: Math.round(price * 0.4), max: price, value: Math.round(price * 0.7) });
  const val = h("b", {}, `₹${offer.value}`);
  offer.addEventListener("input", () => { val.textContent = `₹${offer.value}`; });
  const say = (who, t) => { log.append(h("div", { class: `msg ${who}` }, t)); log.scrollTop = log.scrollHeight; };
  say("them", `${item}? ₹${ask}, fix bhaav!`);
  const go = () => {
    const o = +offer.value;
    say("me", `₹${o} ma aapo ne?`);
    round++;
    if (o < price * 0.5) return end(false, "Arre, aatlu ochhu? Jao bhai jao! 😤");
    if (o >= floor) {
      if (!app.progress.spend(o)) return end(false, "Paisa to laavo pehla! (not enough play money)");
      app.progress.track("buy", { item, place: stall.place });
      if (o < price) app.progress.track("bargain_win", { saved: price - o });
      return end(true, o < price ? `Chalo, ₹${o}. Tame pakka Gandhinagari! 🤝 (saved ₹${price - o})` : "Done! Full price, thank you!");
    }
    if (round >= 3) return end(false, "Last price was last price. Aavjo!");
    ask = Math.max(floor, Math.round((ask + o) / 2 + price * 0.05));
    say("them", `Na, na. ₹${ask} last.`);
  };
  const end = (okDeal, text) => {
    say("them", text);
    setTimeout(() => setPanelBody(h("div", {}, log, h("button", { type: "button", class: "btn wide", onclick: closePanel }, okDeal ? "Majja karo ▸" : "Close"))), 300);
  };
  openPanel("🤝 BHAAV KARO", h("div", {}, h("p", { class: "muted small" }, "Make an offer. Too low and they walk away; three tries."),
    log, h("div", { class: "row" }, offer, val), h("button", { type: "button", class: "btn primary wide", onclick: go }, "OFFER")));
}

// ---------- scores ----------
export async function openScores(app) {
  const s = app.progress.state;
  const boards = await Promise.all(GIGS.map((g) => app.backend.topScores(g.id)));
  openPanel("🏆 TOP SCORES", h("div", {},
    h("p", {}, `Your wallet: ₹${s.coins} · earned ₹${s.earned} in total (play money, cannot be paid out).`),
    GIGS.map((g, i) => h("div", {}, h("h3", { class: "sec" }, `${g.emoji} ${g.title.toUpperCase()}`),
      boards[i].length ? h("ol", { class: "board" }, boards[i].map((r) => h("li", {}, h("b", {}, r.name), ` ₹${r.score}`)))
        : h("p", { class: "muted small" }, app.session ? "No scores yet. Be the first!" : "Sign in to appear on the board.")))));
}
