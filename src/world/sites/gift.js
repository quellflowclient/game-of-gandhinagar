import * as THREE from "three";
import * as K from "./kit.js";
import * as T from "../textures.js";
import { toLocal } from "../../data/places.js";

// GIFT City (Gujarat International Finance Tec-City).
// Sources: Google Maps satellite + Street View on Road No. 1C (Aug 2022), recent drone
// photographs, and OSM footprints: GIFT One 386478178, GIFT Two 386478179 (29 floors,
// ~122 m), Pragya Phase 1 922160515 (24 fl), Hiranandani Signature 922160513 (16 fl),
// Brigade Financial Centre 922160514 (14 fl), WTC Tower-A 922077107. Savvy Marina,
// Grand Mercure and the GIFT City Club / Central Park are placed from Google Maps pins
// (footprint sizes estimated from satellite). Local frame = world axes at GIFT One.
const OSM_TOWERS = [
  { id: 386478178, name: "GIFT ONE", h: 122, style: "gift", crown: 1 },
  { id: 386478179, name: "GIFT TWO", h: 122, style: "gift", crown: -1 },
  { id: 922160515, name: "PRAGYA", h: 98, style: "teal" },
  { id: 922160513, name: "HIRANANDANI SIGNATURE", h: 68, style: "white" },
  { id: 922160514, name: "BRIGADE IFC", h: 62, style: "dark" },
  { id: 922077107, name: "WTC GIFT CITY", h: 26, style: "dark" },
];
const PINS = {
  savvyMarina: { lat: 23.1594466, lon: 72.6816351 },
  grandMercure: { lat: 23.1636048, lon: 72.6853533 },
  centralPark: { lat: 23.1611658, lon: 72.6898059 },
};

function rectRing(cu, cv, w, d, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([x, z]) => [cu + x * c + z * s, cv - x * s + z * c]);
}

export function buildGift(scene, map, origin) {
  const f = K.frame(origin, 0);
  const g = new THREE.Group(); g.position.set(origin.x, 0, origin.z); scene.add(g);
  const solids = [], footprints = [], vehicleFree = [], animated = [];
  const pin = (p) => { const w = toLocal(p.lat, p.lon); const l = f.toLocal(w.x, w.z); return [l.u, l.v]; };
  const pavers = K.mat(K.greyPavers(), { roughness: 0.85 });
  // Satellite: most of GIFT City's open plots are dusty, levelled construction land,
  // not lawn. Lay that ground across the district (roads and lawns draw above it).
  K.slab(g, [[-900, -700], [1100, -700], [1100, 900], [-900, 900]], 0.02, K.mat(K.dryGround(), { roughness: 1 }), 0, 10);
  // Tower cranes on the active construction plots seen in Street View.
  for (const [cu, cv] of [[180, 240], [-260, 180], [430, 60]]) {
    K.box(g, 1.6, 70, 1.6, 0xf2b82a, cu, 0, cv);
    K.box(g, 48, 1.2, 1.2, 0xf2b82a, cu + 14, 70, cv);
    K.box(g, 3, 3, 3, 0xd9d9d9, cu - 8, 68, cv);
  }

  const styles = {
    gift: { bay: 20, floor: 30, tex: T.giftGlass(1, 1), rough: 0.15, metal: 0.45 },
    teal: K.glassFins("#2d5f66", "#d7e0e2"),
    white: K.glassFins("#3d5a74", "#f3f2ee"),
    dark: K.glassFins("#22313f", "#9aa5ae"),
  };

  // ---------- OSM towers ----------
  for (const t of OSM_TOWERS) {
    const fp = K.osmFootprint(map, t.id, f); if (!fp) continue;
    const [cu, cv] = K.centroid(fp.ring);
    // Paved forecourt around each tower.
    const apron = fp.ring.map(([u, v]) => { const dx = u - cu, dv = v - cv, l = Math.hypot(dx, dv) || 1; return [u + (dx / l) * 9, v + (dv / l) * 9]; });
    K.slab(g, apron, 0.08, pavers, 0, 3);
    // Podium (3 floors, darker glass) then the tower shaft.
    K.building(g, fp.ring, 13, K.glassFins("#26394b", "#c9d2da"), { roof: 0x9aa3ab, parapet: 0 });
    const shaft = fp.ring.map(([u, v]) => [cu + (u - cu) * 0.9, cv + (v - cv) * 0.9]);
    K.building(g, shaft, t.h, styles[t.style], { roof: 0xa7b0b7, parapet: 1.4, base: 13, parapetColor: 0xdfe7ee });
    if (t.crown) { // GIFT One / Two: slanted crown fin
      const fin = K.box(g, 3, 14, 18, K.mat(0xdfe7ee, { roughness: 0.3, metalness: 0.6 }), cu, t.h, cv);
      fin.rotation.z = 0.25 * t.crown;
    }
    K.textPlane(g, [t.name], { bg: "rgba(0,0,0,0)", fg: "#ffffff", h: 160, font: "800 110px Inter, sans-serif" }, 14, 2.2, cu, t.h - 6, cv + (K.osmFootprint(map, t.id, f).ring.reduce((m, p) => Math.max(m, p[1] - cv), 0)) * 0.9 + 0.3);
    // Entrance canopy on the south face with palms either side.
    const southV = cv + fp.ring.reduce((m, p) => Math.max(m, p[1] - cv), 0);
    K.box(g, 12, 0.4, 6, K.mat(0xd9dfe4, { roughness: 0.3, metalness: 0.6 }), cu, 5, southV + 3);
    for (const s of [-1, 1]) { K.cyl(g, 0.25, 0.25, 5, 0x9aa3ab, cu + s * 5.5, 0, southV + 5.5, 10); solids.push({ circle: [cu + s * 5.5, southV + 5.5, 0.3] }); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const pu = cu + s * (10 + k * 7), pv = southV + 7; K.palm(g, pu, pv); solids.push({ circle: [pu, pv, 0.3] }); }
    footprints.push(fp.ring); solids.push({ poly: fp.ring }); vehicleFree.push(apron);
  }

  // ---------- Savvy Marina: residential tower (estimated 32 floors) ----------
  {
    const [u, v] = pin(PINS.savvyMarina);
    for (const [du, dv] of [[-14, 0], [14, 0]]) {
      const ring = rectRing(u + du, v + dv, 22, 26);
      K.building(g, ring, 102, K.towerResidential(), { roof: 0xb7aea0, parapet: 1.2 });
      K.box(g, 3, 6, 3, 0xd8cbb5, u + du, 102, v + dv); // lift machine room
      footprints.push(ring); solids.push({ poly: ring });
    }
    K.textPlane(g, ["SAVVY MARINA"], { bg: "#1b2a3a", fg: "#e8d8b0", h: 120, font: "800 80px Inter, sans-serif" }, 12, 1.6, u, 4.5, v + 13.2);
  }

  // ---------- Grand Mercure: stone hotel, porte-cochère, planted island ----------
  {
    const [u, v] = pin(PINS.grandMercure);
    const ring = rectRing(u, v - 8, 64, 20);
    K.building(g, ring, 30, K.stoneHotel(), { roof: 0xb6a890, parapet: 1 });
    footprints.push(ring); solids.push({ poly: ring });
    K.box(g, 14, 0.6, 9, 0x6b5a46, u, 5.2, v + 6.5);                 // porte-cochère roof
    for (const s of [-1, 1]) { K.box(g, 0.8, 5.2, 0.8, 0xd8c7a6, u + s * 6, 0, v + 10.5); solids.push({ circle: [u + s * 6, v + 10.5, 0.6] }); }
    K.textPlane(g, ["GRAND MERCURE"], { bg: "rgba(0,0,0,0)", fg: "#f6efe2", h: 120, font: "700 86px Georgia, serif" }, 16, 2, u, 26, v + 2.1);
    // Curved driveway around a round planting island edged with yellow/black curbs.
    const island = Array.from({ length: 33 }, (_, i) => [u + Math.cos((i / 32) * 6.283) * 6, v + 22 + Math.sin((i / 32) * 6.283) * 6]);
    K.strip(g, island, 0.3, 0, K.mat(K.curbTex()), { height: 0.25, tile: 0.6 });
    K.slab(g, island, 0.25, K.mat(K.lawnTex()), 0, 3);
    K.tree(g, u, v + 22, 1.1); solids.push({ circle: [u, v + 22, 6] });
    K.slab(g, rectRing(u, v + 18, 34, 20), 0.07, K.mat(0x55585c, { roughness: 0.9 }), 0, 4);
    K.parkedCar(g, u + 9, v + 14, 0.3, 0xf2f2f2); solids.push({ rect: [u + 9, v + 14, 2, 4.4, 0.3] });
  }

  // ---------- Central Park + GIFT City Club ----------
  {
    const [u, v] = pin(PINS.centralPark);
    const circle = (r, n = 64) => Array.from({ length: n + 1 }, (_, i) => [u + Math.cos((i / n) * 6.283) * r, v + Math.sin((i / n) * 6.283) * r]);
    K.slab(g, circle(95), 0.06, K.mat(K.lawnTex(), { roughness: 1 }), 0, 5);
    K.strip(g, circle(88), 4, 0.1, pavers, { tile: 3 });                 // jogging loop
    K.strip(g, circle(95), 0.3, 0, K.mat(K.curbTex()), { height: 0.25, tile: 0.6 });
    for (let i = 0; i < 36; i++) { const a = (i / 36) * 6.283, tu = u + Math.cos(a) * 82, tv = v + Math.sin(a) * 82; K.tree(g, tu, tv, 1 + (i % 3) * 0.15); solids.push({ circle: [tu, tv, 0.35] }); }
    for (let i = 0; i < 12; i++) { const a = (i / 12) * 6.283 + 0.13; K.bench(g, u + Math.cos(a) * 85, v + Math.sin(a) * 85, -a + Math.PI / 2); solids.push({ circle: [u + Math.cos(a) * 85, v + Math.sin(a) * 85, 0.9] }); }
    // Club: round 3-storey glass drum with a white roof ring.
    K.cyl(g, 26, 26, 14, K.mat(0x547a96, { roughness: 0.12, metalness: 0.5 }), u, 0, v, 48);
    K.cyl(g, 28, 28, 1.2, 0xf1f0ea, u, 14, v, 48);
    for (let i = 0; i < 24; i++) { const a = (i / 24) * 6.283; K.box(g, 0.5, 14, 0.5, 0xf1f0ea, u + Math.cos(a) * 26.3, 0, v + Math.sin(a) * 26.3); }
    K.textPlane(g, ["GIFT CITY CLUB"], { bg: "rgba(0,0,0,0)", fg: "#ffffff", h: 120, font: "800 80px Inter, sans-serif" }, 16, 2, u, 11, v + 26.4);
    const club = circle(27, 32); footprints.push(club); solids.push({ circle: [u, v, 27] });
    vehicleFree.push(circle(95));
  }

  K.mergeStatic(g);
  // Everywhere in the GIFT core is walkable except buildings, columns, trees, benches.
  const allPts = footprints.flat();
  const area = rectRing((Math.min(...allPts.map((p) => p[0])) + Math.max(...allPts.map((p) => p[0]))) / 2,
    (Math.min(...allPts.map((p) => p[1])) + Math.max(...allPts.map((p) => p[1]))) / 2,
    Math.max(...allPts.map((p) => p[0])) - Math.min(...allPts.map((p) => p[0])) + 200,
    Math.max(...allPts.map((p) => p[1])) - Math.min(...allPts.map((p) => p[1])) + 200);
  const zone = K.createSiteZone({ id: "gift-city", f, area, solids, vehicleFree });
  // Only remove OSM buildings that this site rebuilds (other GIFT plots keep theirs).
  zone.clearing = { contains(x, z) { const { u, v } = f.toLocal(x, z); return footprints.some((p) => K.nearPolygon(u, v, p, 4)) || vehicleFree.some((p) => K.pointInPolygon(u, v, p)); } };

  const residents = [[0, 45], [20, 50], [-25, 40], [60, 60], ...[[0, 0]].map(() => pin(PINS.centralPark)).map(([u, v]) => [u, v + 70]), [-10, 60]]
    .map(([u, v]) => ({ ...f.toWorld(u, v), r: 8 }));
  const spawn = { ...f.toWorld(0, 62), yaw: 0, residents };
  return { zone, spawn, frame: f, update() {} };
}
