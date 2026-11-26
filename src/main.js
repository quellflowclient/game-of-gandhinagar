import {istWeekday} from './data/stall-hours.js';
import * as THREE from "three";
import { CITY } from "./config.js";
import { loadBackend } from "./backend/index.js";
import { createScene } from "./world/scene.js";
import { buildCity, loadMap } from "./world/city.js";
import { createTraffic } from "./world/traffic.js";
import { trafficDensity } from "./world/traffic-routes.js";
import { buildMetro } from "./world/metro.js";
import { buildLandmarks, setLandmarksNight } from "./world/landmarks.js";
import { createPlayer, isTyping } from "./world/player.js";
import { createPeople } from "./world/people.js";
import { preloadAvatarAssets,createAvatar } from './world/avatar.js';
import { MAHATMA, siteToWorld, bridgeHeight } from "./world/mahatma-layout.js";
import { placedPlaces, placePos, placeById, hubs,isLivePlace } from "./data/places.js";
import { createProgress } from "./systems/progress.js";
import { createSound } from "./systems/sound.js";
import { createClock, fmtHour, lightingSchedule } from "./systems/clock.js";
import { createFestival } from "./systems/festival.js";
import { createHud } from "./ui/hud.js";
import {createRideRadio} from "./ui/ride-radio.js";
import {landscape} from "./ui/landscape.js";
import { createGameControls, openControlGuide } from "./ui/game-controls.js";
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
import {createDrivingSurface,VEHICLES} from './world/driving.js';
import {inLdrpArea} from './world/sites/ldrp-market-layout.js';
import {openVehicles,chooseRide} from './ui/vehicles.js';
import {buildMetroGarden} from './world/metro-garden.js';
import {createLiveMap} from './world/live-map.js';
import {alignMetroRoads,roadClearance,roadMedian} from './world/metro-road-clearance.js';
import {createCollisionSystem} from './world/collision.js';
import {createImpactEffects} from './world/impact-effects.js';
import {createVoice} from './systems/voice.js';
import {createVoiceRoom} from './systems/voice-room.js';
import {createCrashScene} from './world/crash-scene.js';
import {createCampusLife} from './systems/campus.js';
import {createCampusWeather} from './world/campus-weather.js';

const loading = document.getElementById("loading");
const tourMode = new URLSearchParams(location.search).has('tour');
// Loader: stage text + a progress bar that never moves backwards.
let loadPct=0;
const setLoading = (t,pct) => { if (!loading) return; if(t)loading.querySelector("p").textContent = t; if(pct!=null){loadPct=Math.max(loadPct,Math.min(100,pct));loading.querySelector(".bar i").style.width=`${Math.max(4,loadPct)}%`;loading.querySelector(".meta b").textContent=`${Math.round(loadPct)}%`;} };
setLoading("Connecting…",3);

// ---------- core ----------
const backendReady = loadBackend();
const { renderer, scene, camera, setHour, follow, lowEnd } = createScene(document.getElementById("app"));
let humanProgress=0,waitingHumans=false;
const humanAssets=preloadAvatarAssets(f=>{humanProgress=f;setLoading(waitingHumans?'Bringing people to the streets…':null,waitingHumans?70+f*28:null);});
const parkedAssets=preloadParkedModels(renderer);
setLoading("Loading the map of Gandhinagar…",10);
const mapData = alignMetroRoads(createLiveMap(await loadMap()));
setLoading("Building LDRP campus and Mahatma Mandir…",22);
await parkedAssets;
const world = buildLandmarks(scene, mapData);
const metro = buildMetro(scene, mapData, { lowEnd });
const metroOffRoad=roadClearance(mapData),inRoadMedian=roadMedian(mapData);
const metroGarden=buildMetroGarden(scene,metro.piers||[],placePos(placeById('ldrp')),(x,z,r)=>metroOffRoad(x,z,r)&&inRoadMedian(x,z));
world.navigation.zones.push(metroGarden.zone);world.clearings.push(metroGarden.zone.clearing);
world.navigation.addObstacles(metroGarden.obstacles);
setLoading("Laying roads and planting trees…",45);
const cityObj = await buildCity(scene, world.clearings, mapData, { lowEnd });
setLoading("Lighting the city…",66);
world.map = cityObj.map;
const traffic = createTraffic(scene, mapData, { count: lowEnd ? 12 : 30, zones:world.navigation.zones });
world.navigation.addObstacles(metro.obstacles);
world.navigation.zones.push({id:'metro-supports',contains:()=>false,heights:()=>[],forbidsVehicles:(x,z,margin=0)=>world.navigation.obstacleAt(x,z,margin)});
world.cameraObstacles.push(...metro.cameraObstacles);
waitingHumans=true;setLoading('Bringing people to the streets…',70+humanProgress*28);
await humanAssets;
const anisotropy=Math.min(lowEnd?2:4,renderer.capabilities.getMaxAnisotropy());
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
const backend=await backendReady;
const visitorKey = "v-" + Math.random().toString(36).slice(2, 9);
const app = {
  backend, world, progress, sound, clock,camera,
  session: await backend.getSession(),
  me: null,
  currentPlace: null,
  festival: null,
  open: (name) => openNamed(name),
  setCamera(mode){endTourView();player.setCameraMode(mode);},
  setVehicle(type){const result=player.setVehicle(type);if(!result.error){endTourView();sound.start();app.radio?.select(type);}return result;},
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
app.campus=world.campuses?.[0]?createCampusLife(app,world.campuses[0],{scene,renderer,lowEnd}):null;
const campusWeather=world.campuses?.[0]?createCampusWeather(scene,world.campuses[0],{lowEnd}):null;
const people = createPeople({ scene, camera, labelsEl, spawns: world.spawns, navigation: world.navigation,lowEnd,furniture:()=>app.street?.seats.all()||[], onTap: (p) => social.openCard(app, p) });
app.voice=createVoice(app);
app.voiceRoom=createVoiceRoom(app);
app.people = people;

// Start at Infocity's welcome sign.
const startSpawn = world.spawns.ldrp;
player.teleport(startSpawn.x, startSpawn.z);

// ---------- panels by name ----------
function openNamed(name) {
  const map = {
    profile: () => prof.openAccount(app), about: () => prof.openAbout(app), twin: () => prof.openTwin(app), card: () => prof.openResidentCard(app),
    find: () => social.openFind(app), online: () => social.openOnline(app), chats: () => social.openChats(app), world: () => social.openWorld(app),
    plans: () => city.openPlans(app), utsav: () => city.openUtsav(app), travel: () => city.openTravel(app), map: () => city.openMap(app),
    time: () => city.openTime(app), sound: () => city.openSound(app),camera:()=>openCamera(app),controls:()=>openControlGuide(),fullscreen:()=>landscape.toggleFullscreen(),vehicles:()=>openVehicles(app,hud),campus:()=>app.campus?.inventory(), suggest: () => city.openSuggest(app), ads: () => city.openAds(app),
    mission: () => game.openMissionBrief(app), missions: () => game.openMissions(app), passport: () => game.openPassport(app),
    dayone: () => game.openDayOne(app), scores: () => game.openScores(app),
  };
  (map[name] || (() => toast("Coming soon")))();
}

// ---------- actions ----------
function act(name) {
  sound.start();
  if(name.startsWith('ride:'))return chooseRide(app,hud,name.slice(5));
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
    setTimeout(() => { fade.classList.remove("on"); syncInputLock(); }, 500);
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
        look: me.look, skin: me.skin, x: Math.round(p.x*10)/10, y: p.y, z: Math.round(p.z*10)/10, heading:player.heading, vehicle:['bike','scooter'].includes(player.vehicle)?'cycle':player.vehicle, place: app.currentPlace?.id, placeName: app.currentPlace?.name }
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
  if(!session){app.voice?.end();app.voiceRoom?.leave(true);}
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
const controls=createGameControls({player,hud});
app.radio=createRideRadio(app,{hud});
const syncInputLock=()=>player.freeze(panelOpen()||hud.menuOpen||controls.rotationRequired||document.body.classList.contains("portrait-page-mode")||document.body.classList.contains("accident-active")||document.body.classList.contains("on-landing"));
const panelObserver = new MutationObserver(syncInputLock);
panelObserver.observe(document.body, { childList: true,attributes:true,attributeFilter:["class"] });
syncInputLock();

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
  if (el) el.textContent = w.loaded ? `${w.temp}°C · ${clock.aqiText()}` : "Gandhinagar · live";
}

// ---------- landing ----------
const LEAF_SVG='<svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19c8 0 14-5 14-14-7 0-13 4-13 11" stroke="#fff" stroke-width="2" stroke-linecap="round"/><path d="M5 19c2-5 5-8 9-10" stroke="#cdeee0" stroke-width="2" stroke-linecap="round"/></svg>';
const brandMark=()=>{const m=h("span",{class:"brand-mark"});m.innerHTML=LEAF_SVG;return m;};
const landSignIn=h("button",{type:"button",class:"land-signin",onclick:()=>{skipVisitorToast=true;enter();setTimeout(()=>prof.openSignIn(app),350);}},app.session?"My account":"Sign in");
const landing = h("div", { id: "landing" },
  h("div",{class:"land-scrim"}),
  h("header", { class: "land-top" },
    h("div", { class: "brand" }, brandMark(), h("b", {}, "People of Gandhinagar")),
    h("div",{class:"land-top-r"},
      h("span", { class: "chip-live" }, h("i", { class: "pulse" }), h("span", { class: "ticker" }, "Gandhinagar · live")),
      landSignIn)),
  h("main", { class: "land-main" },
    h("p", { class: "eyebrow" }, "Live 3D city · Gujarat"),
    h("h1", {}, "Gandhinagar", h("span", { class: "gu" }, "ગાંધીનગર")),
    h("p", { class: "lede" }, "Walk the LDRP campus and Mahatma Mandir. Ride, stop for chai at the KH-5 tapris and meet real people, live."),
    h("div",{class:"land-actions"},
      h("button", { type: "button", class: "cta", onclick: () => enter() }, h("span",{},"Enter the city"), h("span", { class: "arrow" }, "→")),
      !app.session?h("button",{type:"button",class:"cta-ghost",onclick:()=>{skipVisitorToast=true;enter();setTimeout(()=>prof.openSignIn(app),350);}},"Sign in with email"):null),
    h("div", { class: "land-dests" }, h("span", { class: "dl" }, "Start at"),
      hubs().map((p) => h("button", { type: "button", class: "dest-card", style: { "--pc": "#" + p.color.toString(16).padStart(6, "0") },
        onclick: () => { enter(); setTimeout(() => travel(p.id), 300); } }, h("i", {}), h("span",{},h("b",{},p.name),h("small",{},p.blurb||p.gu||""))))),
    backend.mode === "demo" ? h("p", { class: "demo-line" }, "Demo mode: data stays in this browser.") : null),
  h("footer", {}, h("span", {}, "© People of Gandhinagar"),
    h("a", { href: "/terms.html" }, "Terms"), h("a", { href: "/privacy.html" }, "Privacy"),
    h("span", {}, "Map data © OpenStreetMap contributors")));
document.body.append(landing);
document.body.classList.add("on-landing");
updateTicker();

let entered = false,skipVisitorToast=false;
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
  document.body.classList.add("game-started");
  landing.classList.add("gone");
  setTimeout(() => landing.remove(), 600);
  sound.start();
  sound.say("કેમ છો! ગાંધીનગરમાં તમારું સ્વાગત છે.");
  if (app.session) await app.refreshMe();
  backend.joinPresence(presenceState());
  if (!app.session && !skipVisitorToast) toast("You are walking as a visitor. Sign in to wave, chat and be seen.", "info", 6000, { label: "Sign in", fn: () => prof.openSignIn(app) });
  else if (!app.me?.name) prof.openQuickJoin(app);
  if (!location.search.includes("tour")) setTimeout(() => { if (!panelOpen() && progress.current()?.index === 0) game.openMissionBrief(app); }, 2500);
}

// ---------- loop ----------
const clockT = new THREE.Clock();
const impactEffects=createImpactEffects(scene,camera);
let recoveryUntil=0;
const recoveryRoad=createDrivingSurface(mapData.roads.filter(r=>!r.campus),[]);
function recoverPlayer(){
 const p=player.position;let safe=null,best=Infinity;
 for(let r=3;r<=25;r+=2)for(let i=0;i<24;i++){
  const a=i*Math.PI/12,x=p.x+Math.cos(a)*r,z=p.z+Math.sin(a)*r;
  if(player.areaLocked&&!areaContains(x,z))continue;
  const y=world.navigation.surface(x,z,p.y,.38,.65);if(y===undefined)continue;
  if([[0,0],[.8,0],[-.8,0],[0,.8],[0,-.8]].some(([dx,dz])=>recoveryRoad.roadHeight(x+dx,z+dz)!==null))continue;
  if(traffic.vehicles.some(v=>v.pose&&Math.hypot(v.pose.x-x,v.pose.z-z)<v.length/2+3))continue;
  const score=r+(y<.25?6:0);if(score<best){safe={x,y,z};best=score;}
 }
 if(!safe){try{safe=world.navigation.safePoint(p.x,p.z,p.y,.38,8);}catch{safe={x:p.x,y:p.y,z:p.z};}}
 player.recoverAt(safe);recoveryUntil=performance.now()+12000;toast('Sab theek hai. Safe jagah se aaraam se continue karo.','good');
}
const crashScene=createCrashScene({scene,camera,traffic,player,navigation:world.navigation,roads:mapData.roads,look:()=>app.me||{},say:text=>sound.say(text,'hi-IN'),onRecover:recoverPlayer});
const recoverButton=h('button',{class:'accident-recover',hidden:true,onclick:async()=>{
  if(crashScene.active)crashScene.finish();else{player.getUp();recoveryUntil=performance.now()+12000;}
}},'Khade ho · Get up');
document.body.append(recoverButton);
const collisions=createCollisionSystem(hit=>{impactEffects.burst(hit);if(hit.player||!hit.a.passive&&!hit.b.passive){endTourView();crashScene.start(hit);}if(hit.player)sound.impact();});
function collisionEntities(){
  const entities=traffic.vehicles.filter(v=>v.pose).map(v=>({id:`traffic-${v.id}`,trafficId:v.id,...v.pose,width:v.width,length:v.length,motor:true,twoWheeler:['bike','scooter'].includes(v.type),
    stop:p=>traffic.stop(v.id,p)}));
  if(entered){const p=player.position,spec=VEHICLES[player.vehicle],motor=!!spec.width;if(!player.crashed)entities.push({id:'player',x:p.x,y:p.y,z:p.z,yaw:player.heading,
    width:spec.width||.55,length:spec.length||(player.cycling?1.8:.55),twoWheeler:['bike','scooter'].includes(player.vehicle),
    motor,player:true,recovering:performance.now()<recoveryUntil,stop:p=>player.stopAt(p),hit:info=>{if(player.carrying)app.street?.releaseCarried();player.hit(info);}});
    if(player.crashed&&motor)entities.push({id:'stopped-player-car',x:p.x,y:p.y,z:p.z,yaw:player.heading,width:player.vehicle==='car'?1.84:1.45,length:player.vehicle==='car'?4.5:2.7,motor:true,passive:true,stop:()=>{}});
    if(player.fallen)entities.push({id:'fallen-player',x:p.x+Math.sin(player.heading)*.65,y:p.y,z:p.z+Math.cos(player.heading)*.65,yaw:player.heading,width:.65,length:1.7,passive:true,stop:()=>{}});
    const wreck=player.wreck;if(wreck)entities.push({id:'player-wreck',...wreck,width:wreck.type==='car'?1.84:1.45,length:wreck.type==='car'?4.5:2.7,motor:true,passive:true,stop:()=>{}});
    for(const a of app.campus?.actors||[])if(a.avatar.root.visible){const q=a.avatar.root.position;entities.push({id:`campus-${a.index}`,x:q.x,y:q.y,z:q.z,width:.5,length:.5,stop:()=>{},hit:()=>{if(!a.fall)a.fall={t:0};}});}
    for(const p of people.all())if(p.data.ai&&Math.hypot(p.x-player.position.x,p.z-player.position.z)<90)entities.push({id:`ai-${p.id}`,x:p.x,y:p.y,z:p.z,width:.5,length:.5,
      stop:q=>{p.x=q.x;p.z=q.z;p.tx=q.x;p.tz=q.z;p.wait=5;p.avatar.root.position.set(p.x,p.y,p.z);},hit:info=>{if(!p.fall){p.fall={t:0,dx:info.direction.x*Math.min(3,info.speed*.2),dz:info.direction.z*Math.min(3,info.speed*.2)};p.avatar.root.rotation.y=Math.atan2(info.direction.x,info.direction.z);}}});
  }
  return entities;
}
// Everything drivers must brake for: the player, residents, students and other visitors.
function trafficObstacles(){
  const list=[],c=entered?player.position:showcase;
  if(entered){const p=player.position,spec=VEHICLES[player.vehicle];list.push({x:p.x,z:p.z,r:spec.length?spec.length/2:player.cycling?.9:.45});if(player.wreck)list.push({x:player.wreck.x,z:player.wreck.z,r:2.3});}
  for(const p of people.all())if(Math.abs(p.x-c.x)<220&&Math.abs(p.z-c.z)<220)list.push({x:p.x,z:p.z,r:.45});
  for(const a of app.campus?.actors||[])if(a.avatar.root.visible){const q=a.avatar.root.position;list.push({x:q.x,z:q.z,r:.45});}
  if(crashScene.obstacle)list.push(crashScene.obstacle);
  return list;
}
// Standing next to another real player: one tap to call or chat them directly.
const nearChip=h('div',{class:'near-player',hidden:true});document.body.append(nearChip);
let nearKey='',nearCheck=0;
function nearPlayerChip(){
  const now=performance.now();if(now-nearCheck<400)return;nearCheck=now;
  const me=app.session?.userId,p=player.position;
  const other=entered&&me&&!app.voice?.active?backend.presenceList().filter(m=>m.userId&&m.userId!==me&&m.x!=null&&m.name).map(m=>({m,d:Math.hypot(m.x-p.x,m.z-p.z)})).filter(o=>o.d<7).sort((a,b)=>a.d-b.d)[0]?.m:null;
  const key=other?other.userId:'';if(key===nearKey)return;nearKey=key;nearChip.hidden=!other;
  if(other){const target={...other,id:other.userId};nearChip.replaceChildren(h('span',{},`${other.name.split(' ')[0]} paas mein hai`),
    h('button',{type:'button',onclick:()=>app.voice?.start(target)},'🎙 Call'),h('button',{type:'button',onclick:()=>social.openCard(app,target)},'💬 Chat'));}
}
let t = 0,honkAt=0,lastFrameAt=0,lastPeopleManage=-1,lastBusinessMinute=-1;
function frame(stamp=performance.now()) {
  requestAnimationFrame(frame);
  if(document.hidden){clockT.getDelta();return;}
  const pagePaused=panelOpen()||hud.menuOpen||landscape.required||document.body.classList.contains('portrait-page-mode');
  const fps=pagePaused?5:!entered?12:lowEnd?24:30,interval=1000/fps;
  if(stamp-lastFrameAt<interval)return;
  lastFrameAt=stamp-(stamp-lastFrameAt)%interval;
  const realDt=Math.min(clockT.getDelta(),.05),dt=realDt*crashScene.timeScale;
  t += dt;
  controls.update();
  app.radio.update(entered&&!player.crashed?player.vehicle:"walk");
  // Account/menu pages do not need a running 3D simulation. Keep calls and
  // presence alive, without animating hidden crowds, traffic or campus effects.
  if(pagePaused){
    app.voice?.updateDistance?.();
    if(t-lastPresence>1&&app.session&&app.me?.name){lastPresence=t;backend.updatePresence(presenceState());}
    return;
  }
  player.update(dt);
  const businessMinute=istWeekday()*1440+Math.floor(clock.hour()*60);
  if(businessMinute!==lastBusinessMinute){lastBusinessMinute=businessMinute;for(const market of world.markets)market.setBusinessTime?.(clock.hour(),istWeekday());}
  app.street?.update(dt);
  app.campus?.update(dt);
  if (player.cycling) { cycAcc += player.speed * dt; if (cycAcc >= 25) { progress.track("cycle_m", { m: cycAcc }); cycAcc = 0; } }
  if(t-lastPeopleManage>=.5){lastPeopleManage=t;people.manage(player.position);}
  people.update(dt, player.position);
  for(const subject of tourSubjects)subject.update(dt,0);
  festival.update(dt, t);
  cityObj.update(t);
  world.update(t,player.position);
  metro.trains?.update(t, entered ? player.position : showcase);
  traffic.update(dt, entered ? player.position : showcase, {obstacles:trafficObstacles(),density:trafficDensity(clock.hour())});
  if(entered&&t>honkAt){const p=player.position;if(traffic.vehicles.some(v=>v.pose&&v.waiting>3&&Math.hypot(v.pose.x-p.x,v.pose.z-p.z)<12)){sound.honk?.();honkAt=t+9;}}
  if(entered){collisions.update(dt,collisionEntities());traffic.render();}
  crashScene.update(realDt);
  recoverButton.hidden=crashScene.active||!player.canGetUp;
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
    hud.setVehicle(player.vehicle);hud.setDrive(player.vehicle,player.speedKmh,player.areaLocked,player.driveDirection);
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
    const { night, dusk,lightsOn } = setHour(hr,clock.solar);
    cityObj.setNight(lightsOn, false);
    traffic.setNight(lightsOn);
    metro.trains?.setNight(lightsOn);
    player.setNight(lightsOn);
    for(const market of world.markets)market.setNight(lightsOn,player.position);
    if (lightsOn !== wasNight) { wasNight = lightsOn; setLandmarksNight(lightsOn); }
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
  const weatherState=campusWeather?.update(dt,player.position,clock.weather);
  sound.setCampus?.({near:app.currentPlace?.id==='ldrp',night:lightingSchedule(clock.hour()).night,rain:weatherState?.rain});
  app.voice?.updateDistance?.();
  nearPlayerChip();
  crashScene.camera();
  if(!pagePaused)renderer.render(scene, camera);
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

setLoading('Ready',100);if(loading){setTimeout(()=>{loading.classList.add('done');setTimeout(()=>loading.remove(),650);},180);}

// Handy for debugging in the browser console. `?tour` skips the landing and popups and
// adds shot(placeId) to frame a landmark from the south.
window.__gnr = { app, world, cityObj, camera, renderer, scene, traffic, counts: cityObj.counts, view:(p,t)=>{tourCamera={position:new THREE.Vector3(...p),target:new THREE.Vector3(...t)};} };
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
