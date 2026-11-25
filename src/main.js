import * as THREE from "three";
import { CITY } from "./config.js";
import { loadBackend } from "./backend/index.js";
import { createScene } from "./world/scene.js";
import { buildCity, loadMap } from "./world/city.js";
import { createTraffic } from "./world/traffic.js";
import { buildMetro } from "./world/metro.js";
import { buildLandmarks, setLandmarksNight } from "./world/landmarks.js";
import { createPlayer, isTyping } from "./world/player.js";
import { createPeople } from "./world/people.js";
import { preloadAvatarAssets,createAvatar } from './world/avatar.js';
import { MAHATMA, siteToWorld, bridgeHeight } from "./world/mahatma-layout.js";
import { placedPlaces, placePos, placeById, hubs,isLivePlace } from "./data/places.js";
import { createProgress } from "./systems/progress.js";
import { createSound } from "./systems/sound.js";
import { createClock, fmtHour } from "./systems/clock.js";
import { createFestival } from "./systems/festival.js";
import { createHud } from "./ui/hud.js";
import { createMinimap } from "./ui/minimap.js";
import { h, toast, closePanel, panelOpen } from "./ui/dom.js";
import * as social from "./ui/social.js";
import * as prof from "./ui/profile.js";
import * as city from "./ui/city.js";
import * as game from "./ui/game.js";
import {createStreetLife} from './ui/street.js';
import {marketPoint,MARKET,MARKET_SHOPS,shopPoint} from './world/sites/ldrp-market-layout.js';
import {openCamera} from './ui/camera.js';
import {preloadParkedModels,updateParkedVehicles} from './world/parked-models.js';
import {createDrivingSurface} from './world/driving.js';
import {inLdrpArea} from './world/sites/ldrp-market-layout.js';
import {openVehicles} from './ui/vehicles.js';
import {buildMetroGarden} from './world/metro-garden.js';
import {createLiveMap} from './world/live-map.js';
import {alignMetroRoads,roadClearance,roadMedian} from './world/metro-road-clearance.js';
import {createCollisionSystem} from './world/collision.js';
import {createImpactEffects} from './world/impact-effects.js';
import {createVoice} from './systems/voice.js';

const loading = document.getElementById("loading");
const tourMode = new URLSearchParams(location.search).has('tour');
const setLoading = (t) => { if (loading) loading.querySelector("p").textContent = t; };

// ---------- core ----------
const backend = await loadBackend();
const { renderer, scene, camera, setHour, follow, lowEnd } = createScene(document.getElementById("app"));
const humanAssets=preloadAvatarAssets();
setLoading("Loading the map of Gandhinagar…");
const mapData = alignMetroRoads(createLiveMap(await loadMap()));
setLoading("Building landmarks…");
await preloadParkedModels(renderer);
const world = buildLandmarks(scene, mapData);
const metro = buildMetro(scene, mapData, { lowEnd });
const metroOffRoad=roadClearance(mapData),inRoadMedian=roadMedian(mapData);
const metroGarden=buildMetroGarden(scene,metro.piers||[],placePos(placeById('ldrp')),(x,z,r)=>metroOffRoad(x,z,r)&&inRoadMedian(x,z));
world.navigation.zones.push(metroGarden.zone);world.clearings.push(metroGarden.zone.clearing);
world.navigation.addObstacles(metroGarden.obstacles);
setLoading("Laying roads and planting trees…");
const cityObj = await buildCity(scene, world.clearings, mapData, { lowEnd });
world.map = cityObj.map;
const traffic = createTraffic(scene, mapData, { count: lowEnd ? 22 : 45, zones:world.navigation.zones });
world.navigation.addObstacles(metro.obstacles);
world.navigation.zones.push({id:'metro-supports',contains:()=>false,heights:()=>[],forbidsVehicles:(x,z,margin=0)=>world.navigation.obstacleAt(x,z,margin)});
world.cameraObstacles.push(...metro.cameraObstacles);
setLoading('Loading detailed male and female characters…');
await humanAssets;
const anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());
scene.traverse(o=>{for(const m of [].concat(o.material||[]))for(const key of ['map','normalMap','roughnessMap'])if(m[key]?.isTexture){m[key].anisotropy=anisotropy;m[key].needsUpdate=true;}});

const PAD = 300;
const bounds = (() => {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const r of cityObj.map.roads) for (const [x, z] of r.pts) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
  return { minX: minX - PAD, maxX: maxX + PAD, minZ: minZ - PAD, maxZ: maxZ + PAD };
})();

const labelsEl = document.getElementById("labels");
const qaScope=tourMode?new URLSearchParams(location.search).get('qa'):null;
const progress = createProgress(qaScope?`gnr-progress-qa-${qaScope.replace(/[^a-z0-9]/gi,'').slice(0,32)}`:undefined);
const sound = createSound();
const clock = createClock();
setHour(clock.hour(),clock.solar); // live IST, local seasonal sunrise/sunset
const festival = createFestival(scene);
clock.loadWeather().then(updateTicker);
setInterval(() => clock.loadWeather().then(updateTicker), 15 * 60 * 1000);

// ---------- app context shared with panels ----------
const visitorKey = "v-" + Math.random().toString(36).slice(2, 9);
const app = {
  backend, world, progress, sound, clock,
  session: await backend.getSession(),
  me: null,
  currentPlace: null,
  festival: null,
  open: (name) => openNamed(name),
  setCamera(mode){endTourView();player.setCameraMode(mode);},
  setVehicle(type){const result=player.setVehicle(type);if(!result.error)endTourView();return result;},
  requireSignIn(reason) {
    if (app.session) return true;
    prof.openSignIn(app, reason);
    return false;
  },
  async refreshMe() {
    app.me = app.session ? await backend.getMyProfile() : null;
    hud.setMe(app.me?.name);
    if (app.me) {
      player.setLook(app.me.look || "casual", app.me.skin);
      backend.updatePresence(presenceState());
    }
    return app.me;
  },
  async onSignedIn() {
    app.session = await backend.getSession();
    await app.refreshMe();
    backend.joinPresence(presenceState());
    toast(app.me?.name?"Welcome! You are now visible in the city.":"Email verified. Choose your name and character.", "good");
    if (!app.me?.name) prof.openQuickJoin(app);
  },
  onSignedOut() {
    app.voice?.end();
    app.session = null; app.me = null;
    backend.joinPresence(presenceState());
    toast("Signed out. You can keep walking as a visitor.");
  },
  isOnline: (id) => backend.presenceList().some((p) => p.userId === id),
  presenceMembers: () => backend.presenceList().filter((p) => p.userId && p.userId !== app.session?.userId && p.name),
  visitorCount: () => backend.presenceList().filter((p) => !p.userId).length,
  countsByPlace() {
    const out = {};
    for (const p of hubs()) out[p.id] = 0;
    for (const m of backend.presenceList()) if (m.place) out[m.place] = (out[m.place] || 0) + 1;
    return out;
  },
  clearBadge(which) { unread[which] = 0; hud.setBadge(which, 0); },
  travel(placeId) { travel(placeId); },
  goNear(x, z) { player.teleport(x + 3, z + 3); },
  waveAt(target) { waveAt(target); },
  setFestival(id) { app.festival = id; festival.set(id, player.position); if (id) toast("Festival preview on. Open Utsav to stop it."); },
  showCheckpoints(storyId) { for (const c of world.checkpoints) c.mesh.visible = c.story === storyId; },
  startGig(g) { startGig(g); },
  missionHint(def) {
    const visit = def.goals.find((g) => g.type === "visit" || g.type === "night_at");
    if (visit) toast(`Head to ${placeById(visit.place).name}.`, "info", 5000, { label: "🚌 Take BRTS", fn: () => travel(visit.place) });
    else if (def.goals.some((g) => g.type === "cycle_m")) toast("Press 🚲 (or C) to ride a cycle.");
    else if (def.goals.some((g) => g.type === "wave_ai")) toast("Walk up to someone with an AI tag and press 👋 (or Q).");
    else if (def.goals.some((g) => g.type === "bargain_win")) toast("Walk to any stall and press BHAAV KARO.");
  },
  accessToken: async () => (backend.accessToken ? backend.accessToken() : null),
};

// ---------- world objects ----------
const hud = createHud({ open: (n) => openNamed(n), act: (n) => act(n) });
const ldrpOrigin=placePos(placeById('ldrp'));
const areaContains=(x,z)=>inLdrpArea(ldrpOrigin,x,z,1.5);
const player = createPlayer({ scene, camera, dom: renderer.domElement, joystickEl: hud.joystick, bounds, navigation: world.navigation, cameraObstacles: world.cameraObstacles,playArea:areaContains,driving:createDrivingSurface(mapData.roads,world.navigation.zones,(x,z)=>!player.areaLocked||areaContains(x,z)) });
app.player = player;
app.street=world.markets?.[0]?createStreetLife(app,world.markets[0]):null;
const people = createPeople({ scene, camera, labelsEl, spawns: world.spawns, navigation: world.navigation,lowEnd,furniture:()=>app.street?.seats.all()||[], onTap: (p) => social.openCard(app, p) });
app.voice=createVoice(app);
app.people = people;

// Start at Infocity's welcome sign.
const startSpawn = world.spawns.ldrp;
player.teleport(startSpawn.x, startSpawn.z);

// ---------- panels by name ----------
function openNamed(name) {
  const map = {
    profile: () => prof.openEdit(app), about: () => prof.openAbout(app), twin: () => prof.openTwin(app), card: () => prof.openResidentCard(app),
    find: () => social.openFind(app), online: () => social.openOnline(app), chats: () => social.openChats(app), world: () => social.openWorld(app),
    plans: () => city.openPlans(app), utsav: () => city.openUtsav(app), travel: () => city.openTravel(app), map: () => city.openMap(app),
    time: () => city.openTime(app), sound: () => city.openSound(app),camera:()=>openCamera(app),vehicles:()=>openVehicles(app,hud), suggest: () => city.openSuggest(app), ads: () => city.openAds(app),
    mission: () => game.openMissionBrief(app), missions: () => game.openMissions(app), passport: () => game.openPassport(app),
    dayone: () => game.openDayOne(app), scores: () => game.openScores(app),
  };
  (map[name] || (() => toast("Coming soon")))();
}

// ---------- actions ----------
function act(name) {
  sound.start();
  if(name==='run')return player.toggleRun();
  if (name === "cycle") {
    openVehicles(app,hud);
  } else if (name === "wave") {
    const p = people.nearest(player.position, 10);
    if (p) waveAt(p); else { player.wave(); toast("👋 Nobody close enough. Walk up to someone first."); }
  } else if (name === "nearest") {
    const p = people.nearest(player.position, 12);
    if (p) social.openCard(app, p);
  } else if (name === "interact") {
    if (nearStall) game.openStall(app, nearStall);
    else if (nearStage) toast("🎤 Open mic: live voice is coming soon. For now, say something in 🌍 World chat!", "info", 5000, { label: "World chat", fn: () => openNamed("world") });
  }
}

async function waveAt(target) {
  player.wave();
  if (target.data.ai) {
    people.say(target, "Kem cho! 👋", 3);
    progress.track("wave", { ai: true, place: target.data.place });
    toast(`👋 You waved at ${target.data.name}`, "info", 2500, { label: "Chat", fn: () => social.openAiChat(app, target) });
    return;
  }
  if (!app.requireSignIn("wave at members")) return;
  try {
    await backend.wave(target.data.id);
    progress.track("wave", { ai: false });
    toast(`👋 You waved at ${target.data.name}. They'll see it now.`, "good");
  } catch (e) { toast(e.message, "bad"); }
}

// BRTS travel with a short transition.
const fade = h("div", { id: "fade" }, h("div", {}, h("b", {}, "🚌 BRTS"), h("span", {})));
document.body.append(fade);
function travel(placeId) {
  if(player.sitting||player.carrying)return toast('Pehle table se utho ya carry ki hui table rakh do.');
  if(app.street?.service.meal?.item&&app.street.service.meal.phase!=='paid')return toast('Pehle apna khana aur pending bill complete karo.');
  const p = placeById(placeId);
  if (!p || p.pending || !isLivePlace(placeId)) return;
  const spawn = world.spawns[p.id] || { x: placePos(p).x, z: placePos(p).z + 40 };
  fade.querySelector("span").textContent = `Jaiye chhiye ${p.name}…`;
  fade.classList.add("on");
  player.freeze(true);
  setTimeout(() => {
    player.teleport(spawn.x, spawn.z, spawn.yaw || 0);
    if (app.festival) festival.set(app.festival, player.position);
    sound.say(p.gu);
    setTimeout(() => { fade.classList.remove("on"); player.freeze(false); }, 500);
  }, 700);
}

// ---------- gigs ----------
let gig = null;
const gigBar = h("div", { id: "gig", hidden: true });
document.body.append(gigBar);
function marker(color) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.2, 12, 14, 1, true),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false }));
  scene.add(m);
  return m;
}
function startGig(g) {
  if (gig) endGig(false, "Previous gig cancelled.");
  travel(g.place);
  setTimeout(() => {
    const base = player.position.clone();
    const a1 = Math.random() * Math.PI * 2, a2 = a1 + Math.PI * (0.6 + Math.random() * 0.8);
    const pick = new THREE.Vector3(base.x + Math.cos(a1) * 25, 0, base.z + Math.sin(a1) * 25);
    const drop = new THREE.Vector3(base.x + Math.cos(a2) * 110, 0, base.z + Math.sin(a2) * 110);
    const m1 = marker(0x2fb7a0); m1.position.set(pick.x, 6, pick.z);
    const m2 = marker(0xe0532f); m2.position.set(drop.x, 6, drop.z); m2.visible = false;
    gig = { g, pick, drop, m1, m2, phase: "pickup", left: g.seconds };
    gigBar.hidden = false;
    toast(`${g.emoji} ${g.brief} Follow the green light.`, "info", 5000);
  }, 1300);
}
function endGig(ok, msg) {
  if (!gig) return;
  scene.remove(gig.m1, gig.m2);
  if (ok) {
    const earned = progress.finishGig(gig.g, gig.left);
    backend.submitScore(gig.g.id, earned);
  } else toast(msg || "Gig failed. Try again!", "bad");
  gig = null; gigBar.hidden = true;
}
function updateGig(dt) {
  if (!gig) return;
  const p = player.position;
  if (gig.phase === "pickup") {
    gigBar.textContent = `${gig.g.emoji} Pick up at the green light · ${Math.round(p.distanceTo(gig.pick))} m`;
    if (Math.hypot(p.x - gig.pick.x, p.z - gig.pick.z) < 4) {
      gig.phase = "deliver"; gig.m1.visible = false; gig.m2.visible = true;
      toast("Got it! Deliver to the red light before time runs out.");
    }
  } else {
    gig.left -= dt;
    gigBar.textContent = `${gig.g.emoji} Deliver to the red light · ${Math.round(Math.hypot(p.x - gig.drop.x, p.z - gig.drop.z))} m · ⏱ ${Math.ceil(gig.left)} s`;
    if (Math.hypot(p.x - gig.drop.x, p.z - gig.drop.z) < 4) endGig(true);
    else if (gig.left <= 0) endGig(false, "Too late! The tiffin got cold.");
  }
}

// ---------- presence and realtime ----------
function presenceState() {
  const p = player.position;
  const me = app.me;
  return app.session && me?.name && me.visible !== false
    ? { key: app.session.userId, userId: app.session.userId, name: me.name, role: me.role, openTo: me.openTo, oneLiner: me.oneLiner,
        look: me.look, skin: me.skin, x: Math.round(p.x*10)/10, y: p.y, z: Math.round(p.z*10)/10, heading:player.heading, vehicle:player.vehicle, place: app.currentPlace?.id, placeName: app.currentPlace?.name }
    : { key: visitorKey, x: null, z: null, place: app.currentPlace?.id };
}
backend.onPresence((list) => {
  const members = list.filter((m) => m.userId && m.name).map((m) => ({ ...m, id: m.userId, firstName: m.name.split(" ")[0] }));
  const before = new Set(people.all().filter((p) => !p.data.ai).map((p) => p.id));
  people.syncMembers(members, app.session?.userId);
  for (const m of members) {
    if (m.id !== app.session?.userId && !before.has(m.id) && !seenArrivals.has(m.id)) {
      seenArrivals.add(m.id);
      hud.activity(`${m.name} just moved to Digital Gandhinagar`, { label: "👋 Say hi", fn: () => social.openCard(app, m) });
    }
  }
  hud.setOnline(app.presenceMembers().length);
});
const seenArrivals = new Set();
const unread = { chats: 0, world: 0 };
backend.onMessage?.((m) => {
  if (!app.session || m.from === app.session.userId) return;
  if (m.to && m.to !== app.session.userId) return; // local demo broadcasts every message
  if (app.openThreadKey && (app.openThreadKey === m.thread || app.openThreadKey.includes(m.from))) return app.reloadThread?.();
  unread.chats++; hud.setBadge("chats", unread.chats);
  toast("💬 New message", "info", 4000, { label: "Open", fn: () => social.openChats(app) });
});
backend.onWorld?.((m) => {
  if (app.worldOpen) return app.reloadWorld?.();
  if (m.from === app.session?.userId) return;
  unread.world++; hud.setBadge("world", unread.world);
});
backend.onWave?.((w) => {
  if (!app.session || w.to !== app.session.userId) return;
  backend.getProfile(w.from).then((p) => toast(`👋 ${p?.name || "Someone"} waved at you!`, "good", 6000,
    p ? { label: "View", fn: () => social.openCard(app, p) } : undefined));
});
backend.onPlans?.(() => {});
backend.onAuth?.(async session => {
  if(session?.userId === app.session?.userId) return;
  if(!session)app.voice?.end();
  app.session=session;
  try {await app.refreshMe();await backend.joinPresence(presenceState());}
  catch(e){toast(e.message,'bad');}
});

progress.subscribe((e) => { if (e.toast) toast(e.toast, e.kind); refreshMissionLine(); });
function refreshMissionLine() {
  const cur = progress.current();
  const done = progress.state.chapter.filter((m) => m.done).length;
  hud.setMission(cur ? cur.index + 1 : 6, cur ? `${cur.def.emoji} ${cur.def.title}` : "🏅 Chapter done!", done, 6, progress.state.showCurrent);
  const d = progress.dayOne();
  hud.setMoreBadge("dayone", `${d.filter((t) => t.done).length}/${d.length}`);
  hud.setMoreBadge("missions", `${done}/6`);
}
refreshMissionLine();

// ---------- keyboard ----------
window.addEventListener("keydown", (e) => {
  if (isTyping(e)) return;
  if (e.key === "Escape") { if (panelOpen()) closePanel(); else hud.toggleMore(false); return; }
  if (panelOpen()) return;
  if (e.code === "KeyQ") act("wave");
  if (e.code === "KeyC") act("cycle");
  if (e.code === "KeyE" || e.code === "Enter") act(nearStall || nearStage ? "interact" : "nearest");
  if (e.code === "KeyL") openNamed("map");
  if (e.code === "KeyM") openNamed("missions");
});
// Freeze walking while a panel is open so typing does not move you.
const panelObserver = new MutationObserver(() => player.freeze(panelOpen()));
panelObserver.observe(document.body, { childList: true });

// ---------- place detection, hours, proximity ----------
let nearStall = null, nearStage = false, lastPresence = 0, lastHourTick = -2, lastPlaceCheck = 0;
function checkPlace() {
  const p = player.position;
  let best = null, bd = Infinity;
  for (const pl of placedPlaces()) {
    if ((pl.id === 'dandi' && world.navigation.zones.some(zone => zone.id === 'mahatma-mandir' && zone.contains(p.x,p.z))) || (pl.id==='ldrp'&&player.areaLocked)) {
      best = pl; break;
    }
    const { x, z } = placePos(pl);
    const d = Math.hypot(p.x - x, p.z - z - 30);
    const r = pl.kind === "bridge" ? 70 : pl.hub ? 170 : 120;
    if (d < r && d < bd) { bd = d; best = pl; }
  }
  if (best?.id !== app.currentPlace?.id) {
    app.currentPlace = best;
    hud.setPlace(best);
    if (best) {
      if (entered) hud.arrive(best);
      progress.track("visit", { place: best.id });
      sound.setMood(best.kind === "temple" ? "temple" : best.kind);
    }
    backend.updatePresence(presenceState());
  }
  // Evening/night at a place (mission 6) and first morning/night.
  const hr = clock.hour();
  if (best && (hr >= 18 || hr < 5)) progress.track("night_at", { place: best.id });
}

function proximity() {
  const p = player.position;
  nearStall = world.stalls.find((s) => Math.hypot(p.x - s.x, p.z - s.z) < 5) || null;
  nearStage = !!world.stage && Math.hypot(p.x - world.stage.x, p.z - world.stage.z) < 9;
  hud.setInteract(nearStall ? nearStall.street?null:`${nearStall.emoji} ${nearStall.name} · Order (E)` : nearStage ? "🎤 Open mic stage (E)" : null);
  const n = people.nearest(p, 6);
  hud.setNearest(nearStall || nearStage ? null : n);
  // Story checkpoints.
  const active = progress.state.activeStory;
  if (active) for (const c of world.checkpoints) {
    if (c.story === active && c.mesh.visible && Math.hypot(p.x - c.x, p.z - c.z) < 3.5) {
      c.mesh.visible = false;
      progress.track("checkpoint", { story: c.story, index: c.index });
    }
  }
}

// ---------- AQI ticker on the landing page ----------
function updateTicker() {
  const el = document.querySelector(".ticker");
  const w = clock.weather;
  if (el) el.textContent = w.loaded ? `Gandhinagar now · ${w.temp}°C · ${clock.aqiText()}` : "Gandhinagar · live";
}

// ---------- landing ----------
const landing = h("div", { id: "landing" },
  h("header", { class: "land-top" },
    h("div", { class: "brand" }, h("span", { class: "leaf" }, "🌿"), h("b", {}, "People of Gandhinagar")),
    h("span", { class: "chip-live" }, h("i", { class: "pulse" }), h("span", { class: "ticker" }, "Checking the weather…")),
    h("span", { class: "chip-demo" }, "Early demo")),
  h("main", { class: "land-card glass" },
    h("div", { class: "kicker" }, "ગાંધીનગરના લોકો · THE GREEN CITY, IN 3D"),
    h("h1", {}, "Gandhinagar", h("span", { class: "gu" }, "ગાંધીનગર")),
    h("p", { class: "tagline" }, "Explore LDRP, the KH-5 stalls and Mahatma Mandir. Walk, ride, meet people and stop for chai."),
    h("div", { class: "pills" },
      h("span", {}, "🛕 ", h("b", {}, String(hubs().length)), " places to explore"),
      h("span", {}, "🤖 AI residents"), h("span", {}, "🪞 Your AI twin"), h("span", {}, "🎯 Missions & gigs")),
    h("button", { type: "button", class: "cta", onclick: () => enter() }, "Chalo, Gandhinagar", h("span", { class: "arrow" }, "→")),
    h("div", { class: "start-at" }, h("span", { class: "muted small" }, "or start at"),
      h("div", { class: "place-strip" }, hubs().map((p) => h("button", { type: "button", class: "pchip", style: { "--pc": "#" + p.color.toString(16).padStart(6, "0") },
        onclick: () => { enter(); setTimeout(() => travel(p.id), 300); } }, h("i", {}), p.name)))),
    h("button", { type: "button", class: "ad-link", onclick: () => { enter(); openNamed("ads"); } }, "📣 Advertise your startup, store or cafe →"),
    backend.mode === "demo" ? h("p", { class: "demo-line" }, "Demo mode: data stays in this browser. Open a second tab to meet yourself.") : null),
  h("footer", {}, h("span", {}, "Made with AI and chai in Gandhinagar"),
    h("a", { href: "/terms.html" }, "Terms"), h("a", { href: "/privacy.html" }, "Privacy"),
    h("span", {}, "Map data © OpenStreetMap contributors")));
document.body.append(landing);
document.body.classList.add("on-landing");
updateTicker();

let entered = false;
let tourCamera = null;
const tourSubjects=[];
const endTourView = () => { tourCamera = null; for(const subject of tourSubjects){scene.remove(subject.root);subject.dispose();}tourSubjects.length=0; };
renderer.domElement.addEventListener('pointerdown', endTourView);
window.addEventListener('keydown', endTourView);
hud.joystick.addEventListener('pointerdown',endTourView);
async function enter() {
  if (entered) return;
  entered = true;
  document.body.classList.remove("on-landing");
  landing.classList.add("gone");
  setTimeout(() => landing.remove(), 600);
  sound.start();
  sound.say("કેમ છો! ગાંધીનગરમાં તમારું સ્વાગત છે.");
  if (app.session) await app.refreshMe();
  backend.joinPresence(presenceState());
  if (!app.session) toast("You are walking as a visitor. Sign in to wave, chat and be seen.", "info", 6000, { label: "Sign in", fn: () => prof.openSignIn(app) });
  else if (!app.me?.name) prof.openQuickJoin(app);
  if (!location.search.includes("tour")) setTimeout(() => { if (!panelOpen() && progress.current()?.index === 0) game.openMissionBrief(app); }, 2500);
}

// ---------- loop ----------
const clockT = new THREE.Clock();
const impactEffects=createImpactEffects(scene,camera);
const recoverButton=h('button',{class:'accident-recover',hidden:true,onclick:async()=>{
  if(player.carrying&&!(await app.street?.releaseCarried()))return;
  player.stand();
  const spawn=world.spawns[app.currentPlace?.id||'ldrp'];
  if(spawn){player.teleport(spawn.x,spawn.z,0,spawn.y||0);recoverButton.hidden=true;}
}},'Accident · Safe jagah wapas jao');
document.body.append(recoverButton);
const collisions=createCollisionSystem(hit=>{impactEffects.burst(hit);if(hit.player){sound.impact();recoverButton.hidden=false;}});
function collisionEntities(){
  const entities=traffic.vehicles.filter(v=>v.pose).map(v=>({id:`traffic-${v.id}`,...v.pose,width:v.width,length:v.length,motor:true,
    stop:p=>traffic.stop(v.id,p)}));
  if(entered){const p=player.position,motor=['car','auto'].includes(player.vehicle);entities.push({id:'player',x:p.x,y:p.y,z:p.z,yaw:player.heading,
    width:motor?(player.vehicle==='car'?1.84:1.45):.55,length:motor?(player.vehicle==='car'?4.5:2.7):player.cycling?1.8:.55,
    motor,player:true,stop:p=>player.stopAt(p),hit:()=>player.hit()});
    for(const p of people.all())if(p.data.ai&&Math.hypot(p.x-player.position.x,p.z-player.position.z)<90)entities.push({id:`ai-${p.id}`,x:p.x,y:p.y,z:p.z,width:.5,length:.5,
      stop:q=>{p.x=q.x;p.z=q.z;p.tx=q.x;p.tz=q.z;p.wait=5;p.avatar.root.position.set(p.x,p.y,p.z);},hit:()=>p.avatar.hit()});
  }
  return entities;
}
let t = 0;
function frame() {
  const dt = Math.min(clockT.getDelta(), 0.05);
  t += dt;
  player.update(dt);
  app.street?.update(dt);
  if (player.cycling) { cycAcc += player.speed * dt; if (cycAcc >= 25) { progress.track("cycle_m", { m: cycAcc }); cycAcc = 0; } }
  people.manage(player.position);
  people.update(dt, player.position);
  for(const subject of tourSubjects)subject.update(dt,0);
  festival.update(dt, t);
  cityObj.update(t);
  world.update(t,player.position);
  traffic.update(dt, entered ? player.position : showcase, t);
  if(entered){collisions.update(dt,collisionEntities());traffic.render();}
  if(!player.crashed)recoverButton.hidden=true;
  updateGig(dt);
  if (!entered) {
    // Landing: slow cinematic orbit around Akshardham.
    const a = t * 0.06;
    camera.position.set(showcase.x + Math.sin(a) * 170, 55, showcase.z + Math.cos(a) * 170);
    camera.lookAt(showcase.x, 14, showcase.z);
    follow(camera.position);
  } else follow(player.position);
  if (tourCamera) {
    camera.position.copy(tourCamera.position);
    camera.lookAt(tourCamera.target);
    follow(tourCamera.target);
  }

  if (t - lastPlaceCheck > 0.5) { lastPlaceCheck = t; checkPlace(); proximity(); }
  if (t - lastMini > 0.2) {
    lastMini = t;
    updateParkedVehicles(scene,player.position,{lowEnd});
    hud.setVehicle(player.vehicle);hud.setDrive(player.vehicle,player.speedKmh,player.areaLocked);
    const dots = people.all().map((p) => ({ x: p.x, z: p.z, real: !p.data.ai }));
    minimap.draw(player.position, player.heading, dots);
    if (tourMode) {
      renderer.domElement.dataset.playerPosition = JSON.stringify({ x: player.position.x, y: player.position.y, z: player.position.z });
      renderer.domElement.dataset.trafficSummary=JSON.stringify(traffic.stats);
      renderer.domElement.dataset.trafficPositions=JSON.stringify(traffic.vehicles.filter(v=>v.pose).map(v=>({id:v.id,type:v.type,...v.pose})));
      renderer.domElement.dataset.humanAssets='male,female';
      renderer.domElement.dataset.soleHeight=String(player.soleHeight);
      renderer.domElement.dataset.driving=JSON.stringify({vehicle:player.vehicle,kmh:player.speedKmh,areaLocked:player.areaLocked});
      renderer.domElement.dataset.accidents=JSON.stringify({count:collisions.impacts,player:player.crashed});
      renderer.domElement.dataset.renderStats=JSON.stringify({calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,pixelRatio:renderer.getPixelRatio(),width:renderer.domElement.width,height:renderer.domElement.height});
    }
  }
  if (t - lastHourTick > 1) {
    lastHourTick = t;
    const hr = clock.hour();
    const { night, dusk } = setHour(hr,clock.solar);
    cityObj.setNight(night, dusk);
    traffic.setNight(night || dusk);
    player.setNight(night||dusk);
    for(const market of world.markets)market.setNight(night||dusk,player.position);
    if (night !== wasNight) { wasNight = night; setLandmarksNight(night); }
    const w = clock.weather;
    hud.setTime(`${fmtHour(hr)} ${clock.mode==='live'?'IST':'PREVIEW'}`, night, w.loaded ? `${w.temp}°C${w.stale?' (last update)':''}` : 'Weather unavailable');
    progress.track("hour", { hour: hr });
  }
  if (t - lastPresence > 0.25 && app.session && app.me?.name) {
    lastPresence = t;
    backend.updatePresence(presenceState());
  }
  sound.update({ near: { road: true, water: app.currentPlace?.kind === "park" || app.currentPlace?.id === "lakegarden" }, speed: player.speed });
  impactEffects.update(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
let cycAcc = 0;
let lastMini = 0;
let wasNight = null;
const showcase = placePos(placeById("ldrp"));
const minimap = createMinimap(hud.miniCanvas, cityObj.map);
// Hour tracking every second would spam saves; throttle "hour" events to place changes and minutes.
const origTrack = progress.track;
let lastHourSaved = -1;
progress.track = (ev, payload) => {
  if (ev === "hour") { const hh = Math.floor(payload.hour); if (hh === lastHourSaved) return; lastHourSaved = hh; }
  if (ev === "night_at") { const k = payload.place + Math.floor(clock.hour()); if (k === lastNightKey) return; lastNightKey = k; }
  return origTrack(ev, payload);
};
let lastNightKey = "";

loading?.remove();

// Handy for debugging in the browser console. `?tour` skips the landing and popups and
// adds shot(placeId) to frame a landmark from the south.
window.__gnr = { app, world, cityObj, camera, renderer, counts: cityObj.counts };
if (new URLSearchParams(location.search).has("tour")) {
  enter();
  window.__gnr.shot = async (id, back = 45, dist = 60, pitch = 0.3, side = 0) => {
    document.querySelectorAll(".sheet-back,.toast,.hint").forEach((e) => e.remove());
    const p = placePos(placeById(id));
    player.teleport(p.x + side, p.z + back, 0);
    player.setView(dist, pitch);
    await new Promise((r) => setTimeout(r, 1300));
    document.querySelectorAll(".sheet-back,.toast").forEach((e) => e.remove());
    return app.currentPlace?.name;
  };
  // Reproducible reference views for visual QA. Any key/drag returns to walking.
  const params = new URLSearchParams(location.search);
  if(params.get('place')==='ldrp') {
    if(params.get('night')==='1')clock.setPreset('Night');else if(params.get('day')==='1')clock.setPreset('Day');
    const at=placePos(placeById('ldrp')),spawn=world.spawns.ldrp;
    player.teleport(spawn.x,spawn.z,spawn.yaw);player.setView(8,0.22);
    const garden=params.get('view')==='garden';
    tourCamera={position:new THREE.Vector3(at.x+(garden?-25:140),garden?2.2:140,at.z+(garden?-76:-180)),target:new THREE.Vector3(at.x-28,garden?3:0,at.z-20)};
    const view=params.get('view');
    if(['metro','circle','market','babu','chintu','seats','tea-seats','lalbhai','masi','patel','sarpanch','natu','ajit'].includes(view)) {
      const s=MARKET_SHOPS.find(s=>s.id===(view==='tea-seats'?'masi':view))||MARKET_SHOPS[0],seating=['seats','tea-seats'].includes(view);
      const spawnPoint=shopPoint(s,seating?-4.8:0,seating?-6:3.5),sp=marketPoint(at,...spawnPoint);
      player.teleport(sp.x,sp.z,MARKET.yaw+(s.v>0?0:Math.PI));player.setView(5,0.12);
      if(view==='metro'){const sp=marketPoint(at,-165,-3.2);player.teleport(sp.x,sp.z,MARKET.yaw);const cam=marketPoint(at,-174,-3.6),target=marketPoint(at,-132,1.1);tourCamera={position:new THREE.Vector3(cam.x,3.3,cam.z),target:new THREE.Vector3(target.x,2.5,target.z)};}
      else if(view==='circle'){const sp=marketPoint(at,-22,12);player.teleport(sp.x,sp.z,MARKET.yaw);const cam=marketPoint(at,-26,26),target=marketPoint(at,0,0);tourCamera={position:new THREE.Vector3(cam.x,7,cam.z),target:new THREE.Vector3(target.x,2,target.z)};}
      else if(view==='market') {const cam=marketPoint(at,-20,205),target=marketPoint(at,-10,0);tourCamera={position:new THREE.Vector3(cam.x,145,cam.z),target:new THREE.Vector3(target.x,0,target.z)};}
      else {const cp=shopPoint(s,seating?-4.8:5.7,seating?-7:9),tp=shopPoint(s,0,seating?-6:0);const cam=marketPoint(at,...cp),target=marketPoint(at,...tp);tourCamera={position:new THREE.Vector3(cam.x,seating?2.1:2.5,cam.z),target:new THREE.Vector3(target.x,1.1,target.z)};}
    }
  }
  if (params.get('place') === 'dandi') {
    clock.setPreset(params.get('night') === '1' ? 'Night' : 'Day');
    const origin = placePos(placeById('dandi'));
    const view = params.get('view') || 'entrance';
    const poses = {
      overview: { camera: [-195, 185, -200], target: [0, 15, 160], spawn: [0, -110] },
      aerial: { camera: [-285, 360, 65], target: [0, 0, 230], spawn: [0, -110] },
      bridge: { camera: [55, 32, 145], target: [0, 42, 215], spawn: [0, 205] },
      waterside: { camera: [-46, 2.1, 62], target: [-15, 1.8, 76], spawn: [-46, 62] },
      courtyard: { camera: [0, 2.2, -50], target: [0, 18, 0], spawn: [0, -50] },
      entrance: { camera: [0, 19, -155], target: [0, 15, 15], spawn: [0, -110] },
      boundary: { camera: [147, 2.0, 35], target: [118, 1.0, 16], spawn:[124,0] },
      road: { camera: [-22, 3.5, 156], target: [40, 1, 154], spawn:[0,162] },
      people: { camera:[0,1.25,-93.8],target:[0,0.95,-98.5],spawn:[8,-98] },
      'cycle-front': { camera:[0,1.1,-94.1],target:[0,1,-98.5],spawn:[8,-98] },
      'cycle-side': { camera:[4.1,1.2,-98.5],target:[0,1,-98.5],spawn:[8,-98] },
      paving: { camera:[114,12,-38],target:[93,0,12],spawn:[8,-98] },
    };
    const pose = poses[view] || poses.entrance;
    const sp = siteToWorld(origin, ...pose.spawn);
    player.teleport(sp.x, sp.z, MAHATMA.yaw + Math.PI, view === 'bridge' ? bridgeHeight(pose.spawn[1]) : 0);
    player.setView(7, 0.3);
    const p = siteToWorld(origin, pose.camera[0], pose.camera[2]);
    const target = siteToWorld(origin, pose.target[0], pose.target[2]);
    tourCamera = { position: new THREE.Vector3(p.x, pose.camera[1], p.z), target: new THREE.Vector3(target.x, pose.target[1], target.z) };
    if(view==='people') for(const [u,look] of [[-0.65,'casual'],[0.65,'fcasual']]) {
      const sample=createAvatar(look,0xc58c63),at=siteToWorld(origin,u,-98.5);
      sample.root.position.set(at.x,MAHATMA.ground,at.z);sample.root.rotation.y=MAHATMA.yaw;
      sample.update(0,0);scene.add(sample.root);tourSubjects.push(sample);
    }
    if(view.startsWith('cycle-')) {
      const sample=createAvatar(params.get('gender')==='female'?'fcasual':'casual',0xc58c63),at=siteToWorld(origin,0,-98.5);
      sample.root.position.set(at.x,MAHATMA.ground,at.z);sample.root.rotation.y=MAHATMA.yaw;
      sample.setCycling(true);sample.update(0,0);scene.add(sample.root);tourSubjects.push(sample);
    }
  }
}
frame();
