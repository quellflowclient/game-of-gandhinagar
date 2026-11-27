import { CHAPTER, STORIES, GIGS, REAL_MISSIONS, BADGES, FIRSTS, DAY_ONE } from "../data/live-content.js";
import { hubs } from "../data/places.js";

// Missions, story missions, gigs, badges, firsts, passport stamps, day-one tasks,
// daily streak and play money. Saved on this device (localStorage), like the reference.
const KEY = "gnr-progress-v1";
const todayStr = () => new Date().toISOString().slice(0, 10);

function fresh() {
  return {
    chapter: CHAPTER.missions.map(() => ({ counts: [], done: false })),
    activeStory: null,
    stories: {}, // id -> { counts: [indices found], done }
    gigsDone: {}, // id -> best seconds
    real: {},
    badges: [],
    firsts: [],
    stamps: [],
    coins: 100, // starting play money so you can buy chai on day one
    earned: 0,
    waves: 0,
    streak: { last: null, count: 0, best: 0, rest: 1 },
    day: { date: todayStr(), visited: [], waves: 0, plans: 0 },
    showCurrent: true,
  };
}

function load(key=KEY) {
  try { return { ...fresh(), ...JSON.parse(localStorage.getItem(key)) }; } catch { return fresh(); }
}

export function createProgress(key=KEY,{missionsEnabled=false}={}) {
  let s = load(key);
  if(s.activeStory&&!STORIES.some(st=>st.id===s.activeStory))s.activeStory=null;
  const subs = [];
  const toast = (msg, kind = "info") => {if(missionsEnabled)subs.forEach((f) => f({ toast: msg, kind }));};
  const save = () => {
    try { localStorage.setItem(key, JSON.stringify(s)); } catch { /* storage blocked */ }
    subs.forEach((f) => f({ changed: true }));
  };

  // Daily streak with one rest day.
  (function touchStreak() {
    const t = todayStr();
    if (s.day.date !== t) s.day = { date: t, visited: [], waves: 0, plans: 0 };
    if (s.streak.last === t) return;
    const gap = s.streak.last ? Math.round((new Date(t) - new Date(s.streak.last)) / 86400000) : null;
    if (gap === 1) s.streak.count += 1;
    else if (gap === 2 && s.streak.rest > 0) { s.streak.rest -= 1; s.streak.count += 1; }
    else s.streak.count = 1;
    if (s.streak.count % 7 === 0) s.streak.rest = Math.min(2, s.streak.rest + 1);
    s.streak.best = Math.max(s.streak.best, s.streak.count);
    s.streak.last = t;
    save();
  })();

  const currentIndex = () => s.chapter.findIndex((m) => !m.done);
  const award = (badge) => {
    if (badge && !s.badges.includes(badge)) {
      s.badges.push(badge);
      toast(`🏅 Badge: ${BADGES.find((b) => b.id === badge)?.label}`, "good");
    }
  };
  const addCoins = (n, why) => {
    s.coins += n; s.earned += n;
    toast(`+₹${n} ${why}`, "good");
    if (s.earned >= 500) award("paisa");
  };
  const first = (id) => {
    if(!missionsEnabled)return;
    if (!s.firsts.includes(id)) {
      s.firsts.push(id);
      toast(`✨ First: ${FIRSTS.find((f) => f.id === id)?.label}`, "good");
    }
  };

  function bump(goalsDef, counts, ev, payload) {
    let changed = false;
    goalsDef.forEach((g, i) => {
      const c = counts[i] || 0;
      const need = g.n || 1;
      if (c >= need) return;
      let add = 0;
      if (g.type === ev) {
        if (ev === "visit" || ev === "night_at") add = payload.place === g.place ? need : 0;
        else if (ev === "buy") add = payload.item === g.item ? 1 : 0;
        else if (ev === "cycle_m") add = payload.m;
        else add = 1;
      }
      if (ev === "wave" && g.type === "wave_ai" && payload.ai) add = 1;
      if (add) { counts[i] = Math.min(need, c + add); changed = true; }
    });
    return changed && goalsDef.every((g, i) => (counts[i] || 0) >= (g.n || 1));
  }

  function track(ev, payload = {}) {
    // Chapter missions (only the current one counts).
    const ci = currentIndex();
    if (missionsEnabled && ci >= 0) {
      const def = CHAPTER.missions[ci];
      if (bump(def.goals, s.chapter[ci].counts, ev, payload)) {
        s.chapter[ci].done = true;
        toast(`✅ Mission done: ${def.title}`, "good");
        addCoins(def.reward, "mission reward");
        award(def.badge);
        if (s.chapter.every((m) => m.done)) award("pakko");
      }
    }
    // Active story mission.
    if (missionsEnabled && s.activeStory && ev === "checkpoint" && payload.story === s.activeStory) {
      const def = STORIES.find((x) => x.id === s.activeStory);
      if(!def)return;
      const st = (s.stories[def.id] ||= { found: [], done: false });
      if (!st.found.includes(payload.index)) {
        st.found.push(payload.index);
        toast(`${def.emoji} ${st.found.length} of ${def.goals[0].n}`, "info");
      }
      if (st.found.length >= def.goals[0].n && !st.done) {
        st.done = true; s.activeStory = null;
        toast(`✅ Story done: ${def.title}`, "good");
        addCoins(def.reward, "story reward");
        award(def.badge);
      }
    }
    // Real-people missions.
    if(missionsEnabled)for (const r of REAL_MISSIONS) if (r.type === ev && !s.real[r.id]) { s.real[r.id] = true; toast(`✅ ${r.title}`, "good"); }
    // Day one, firsts and stamps.
    if (ev === "visit") {
      const hub = hubs().find((h) => h.id === payload.place);
      if (hub && !s.stamps.includes(hub.id)) { s.stamps.push(hub.id); toast(`🎟 Stamp: ${hub.name}`, "info"); }
      if (!s.day.visited.includes(payload.place)) s.day.visited.push(payload.place);
      if (payload.place === "pdpu-bridge") first("bridge");
      if (payload.place === "akshardham") first("temple");
    }
    if (ev === "wave") {
      s.day.waves += 1; s.waves += 1;
      if (s.waves >= 5) first("wave5");
    }
    if (ev === "post_plan" || ev === "join_plan") { s.day.plans += 1; first("plan"); }
    if (ev === "cycle_m") first("cycle");
    if (ev === "bargain_win") first("bargain");
    if (ev === "hour") {
      if (payload.hour >= 20 || payload.hour < 4) first("night");
      if (payload.hour >= 5 && payload.hour < 8) first("morning");
    }
    save();
  }

  return {
    missionsEnabled,
    get state() { return s; },
    track,
    subscribe(fn) { subs.push(fn); },
    current() {
      if(!missionsEnabled)return null;
      const i = currentIndex();
      return i < 0 ? null : { index: i, def: CHAPTER.missions[i], counts: s.chapter[i].counts };
    },
    startStory(id) { if(!missionsEnabled)return;s.activeStory = id; save(); toast(`${STORIES.find((x) => x.id === id).emoji} Story started. Look for the glowing markers.`); },
    gigUnlocked(g) { if(!missionsEnabled)return false;const i = CHAPTER.missions.findIndex((m) => m.id === g.unlockAfter); return s.chapter[i]?.done; },
    finishGig(g, secondsLeft) {
      if(!missionsEnabled)return 0;
      const bonus = Math.round((secondsLeft / g.seconds) * 40);
      addCoins(g.reward + bonus, `${g.title}${bonus ? " + tip" : ""}`);
      s.gigsDone[g.id] = Math.max(s.gigsDone[g.id] || 0, g.reward + bonus);
      award(g.badge);
      save();
      return g.reward + bonus;
    },
    spend(n) { if (s.coins < n) return false; s.coins -= n; save(); return true; },
    dayOne() {
      return DAY_ONE.map((d) => {
        const have = d.id === "visit2" ? s.day.visited.length : d.id === "wave3" ? s.day.waves : s.day.plans;
        return { ...d, have: Math.min(have, d.n), done: have >= d.n };
      });
    },
    setShowCurrent(on) { s.showCurrent = on; save(); },
    reset() { s = fresh(); save(); },
    GIGS,
  };
}
