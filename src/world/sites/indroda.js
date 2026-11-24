import * as THREE from "three";
import * as K from "./kit.js";

// Indroda Nature Park (GEER Foundation) and its Dinosaur & Fossil Park.
// Sources: Google Maps pins (park entrance 23.1956089, 72.6437688; Dinosaur & Fossil Park
// 23.192299, 72.646802), satellite (entrance off NH-147 east of Indroda Circle, park road
// through dense dry deciduous forest past the GEER office and zoo), a 2019 visitor
// photo sphere (bike parking, green/white kerb stones, flowering trees) and photographs of
// the dinosaur-neck arch and statues. Local frame = world axes at the dinosaur park.
export const INDRODA = {
  gate: [-310, -368],
  road: [[-306, -372], [-300, -350], [-288, -318], [-266, -276], [-236, -228], [-198, -175], [-150, -124], [-100, -80], [-55, -46], [-22, -22], [0, -6]],
  geer: [-262, -312],
  zoo: [-214, -246],
  dinoRadius: 58,
  // Forest boundary (the park area this site owns).
  area: [[-360, -392], [-250, -392], [-120, -300], [40, -160], [110, -40], [90, 80], [-40, 90], [-140, -20], [-260, -160], [-372, -300]],
};

// ---------- sculpted dinosaurs (smooth ellipsoids, not boxes) ----------
const ell = (g, rx, ry, rz, m, x, y, z, rot = [0, 0, 0]) => { const s = K.sphere(g, 1, m, x, y, z, 14); s.scale.set(rx, ry, rz); s.rotation.set(...rot); return s; };
const taper = (g, r0, r1, len, m, x, y, z, rot) => { const c = K.cyl(g, r1, r0, len, m, 0, 0, 0, 12); c.geometry.translate(0, 0, 0); c.position.set(x, y, z); c.rotation.set(...rot); return c; };
function legs(g, m, pts, h, r = 0.35) { for (const [x, z] of pts) K.cyl(g, r * 0.8, r, h, m, x, 0, z, 10); }

function sauropod(parent, x, z, yaw, k = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(k); parent.add(g);
  const m = K.mat(0x8a8f78, { roughness: 0.95 });
  ell(g, 1.6, 1.5, 3.4, m, 0, 3.6, 0);
  legs(g, m, [[-0.9, 1.6], [0.9, 1.6], [-0.9, -1.6], [0.9, -1.6]], 2.8, 0.45);
  taper(g, 0.75, 0.3, 6.5, m, 0, 6.6, 3.6, [0.75, 0, 0]);   // neck rising forward
  ell(g, 0.35, 0.32, 0.75, m, 0, 9.2, 5.9, [0.2, 0, 0]);     // head
  taper(g, 0.8, 0.08, 7, m, 0, 2.6, -5.8, [-1.35, 0, 0]);    // tail down/back
}
function trex(parent, x, z, yaw, k = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(k); parent.add(g);
  const m = K.mat(0x6f6a58, { roughness: 0.9 });
  ell(g, 1.1, 1.3, 2.4, m, 0, 3.6, 0, [-0.35, 0, 0]);
  for (const s of [-1, 1]) { taper(g, 0.45, 0.3, 2.3, m, s * 0.7, 2.2, -0.3, [0.25, 0, 0]); taper(g, 0.3, 0.2, 1.6, m, s * 0.7, 0.8, 0.2, [-0.35, 0, 0]); }
  ell(g, 0.75, 0.75, 1.4, m, 0, 5.3, 2.4, [0.1, 0, 0]);     // head
  ell(g, 0.6, 0.25, 1.2, K.mat(0x4e4a3e), 0, 4.75, 2.7);    // open jaw
  for (const s of [-1, 1]) taper(g, 0.1, 0.06, 0.7, m, s * 0.55, 4.0, 1.5, [1.2, 0, 0]); // tiny arms
  taper(g, 0.7, 0.06, 5, m, 0, 2.9, -3.8, [-1.25, 0, 0]);    // tail
}
function stegosaurus(parent, x, z, yaw, k = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(k); parent.add(g);
  const m = K.mat(0x7a8a5a, { roughness: 0.95 }), plate = K.mat(0xa8603d, { roughness: 0.9 });
  ell(g, 1.1, 1.3, 2.6, m, 0, 2.2, 0);
  legs(g, m, [[-0.7, 1.4], [0.7, 1.4], [-0.7, -1.4], [0.7, -1.4]], 1.4, 0.32);
  for (let i = -3; i <= 3; i++) { const p = K.box(g, 0.12, 1.1 - Math.abs(i) * 0.1, 0.9, plate, 0, 3.1 + Math.cos(i * 0.4) * 0.3, i * 0.6); p.rotation.x = i * 0.08; }
  ell(g, 0.35, 0.35, 0.6, m, 0, 1.6, 2.9);
  taper(g, 0.5, 0.08, 3.2, m, 0, 1.6, -3.6, [-1.3, 0, 0]);
}
function triceratops(parent, x, z, yaw, k = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = yaw; g.scale.setScalar(k); parent.add(g);
  const m = K.mat(0x8c7354, { roughness: 0.95 });
  ell(g, 1.2, 1.1, 2.2, m, 0, 1.9, 0);
  legs(g, m, [[-0.75, 1.2], [0.75, 1.2], [-0.75, -1.2], [0.75, -1.2]], 1.2, 0.36);
  const frill = K.cyl(g, 1.3, 1.3, 0.2, K.mat(0xb08a5a), 0, 0, 0, 18); frill.position.set(0, 2.5, 2.2); frill.rotation.x = Math.PI / 2 - 0.5;
  ell(g, 0.55, 0.5, 0.9, m, 0, 1.8, 2.8);
  for (const s of [-1, 1]) taper(g, 0.1, 0.02, 1.2, K.mat(0xe6dcc4), s * 0.3, 2.3, 3.4, [1.25, 0, 0]);
  taper(g, 0.07, 0.02, 0.6, K.mat(0xe6dcc4), 0, 1.7, 3.6, [1.1, 0, 0]);
}
function pterosaur(parent, x, z) {
  K.cyl(parent, 0.08, 0.1, 7, 0x5a5a5a, x, 0, z, 8);
  const m = K.mat(0x9a6b4a, { roughness: 0.9 });
  const w = K.box(parent, 7, 0.08, 1.4, m, x, 7.2, z); w.rotation.z = 0.12;
  ell(parent, 0.3, 0.3, 1, m, x, 7.4, z);
  taper(parent, 0.15, 0.03, 1.4, m, x, 7.6, z + 1.2, [1.3, 0, 0]);
}

export function buildIndroda(scene, map, origin) {
  const f = K.frame(origin, 0);
  const g = new THREE.Group(); g.position.set(origin.x, 0, origin.z); scene.add(g);
  const solids = [], walls = [];
  const dryM = K.mat(K.dryGround(), { roughness: 1 });

  // ---------- forest floor and the park road ----------
  K.slab(g, INDRODA.area, 0.03, dryM, 0, 8);
  const tar = K.mat(0x4b4c4f, { roughness: 0.95 });
  K.strip(g, INDRODA.road, 6, 0.1, tar, { tile: 6 });
  const kerb = K.mat(K.parkCurbTex());
  for (const s of [-1, 1]) K.strip(g, INDRODA.road, 0.3, 0.1, kerb, { offset: s * 3.15, height: 0.22, tile: 0.9 });
  for (const s of [-1, 1]) K.strip(g, INDRODA.road, 1.6, 0.06, K.mat(0xbca98a), { offset: s * 4.1, tile: 3 }); // dusty walking edge

  // ---------- main entrance on NH-147 ----------
  const [gu, gv] = INDRODA.gate;
  K.slab(g, [[gu - 22, gv - 8], [gu + 22, gv - 8], [gu + 22, gv + 22], [gu - 22, gv + 22]], 0.08, K.mat(K.greyPavers()), 0, 3);
  for (const s of [-1, 1]) {
    K.box(g, 2.2, 7, 2.2, 0x9c7a55, gu + s * 6, 0, gv); solids.push({ rect: [gu + s * 6, gv, 2.4, 2.4] });
    K.box(g, 2.6, 0.6, 2.6, 0x7f5f3f, gu + s * 6, 7, gv);
  }
  K.box(g, 14.4, 1.4, 1.6, 0x8e6b48, gu, 7.6, gv);
  K.textPlane(g, ["ઇન્દ્રોડા પ્રકૃતિ ઉદ્યાન", "INDRODA NATURE PARK · GEER FOUNDATION"], { bg: "#3e5a2f", fg: "#f6efd8" }, 12.6, 1.3, gu, 8.3, gv - 0.82, Math.PI);
  // Ticket window, bike parking under the trees, entry notice board.
  K.box(g, 5, 3, 3, 0xd9cdb2, gu + 12, 0, gv + 6); K.box(g, 5.6, 0.25, 3.6, 0x7a2e2e, gu + 12, 3, gv + 6); solids.push({ rect: [gu + 12, gv + 6, 5.2, 3.2] });
  K.textPlane(g, ["TICKETS · ટિકિટ"], { bg: "#7a2e2e", fg: "#ffffff", h: 110, font: "800 64px Inter, sans-serif" }, 3.6, 0.7, gu + 12, 2.4, gv + 4.48, Math.PI);
  const bikeColors = [0x1a1a1a, 0xc0392b, 0x2f5e9e, 0x7a7d80, 0xdedede];
  for (let i = 0; i < 16; i++) K.scooter(g, gu - 20 + i * 1.1, gv + 14, Math.PI / 2, bikeColors[i % 5]);
  solids.push({ rect: [gu - 11.7, gv + 14, 18.5, 2.2] });
  K.textPlane(g, ["Plastic-free zone · Keep the forest clean", "Timings 7:00 – 18:00 · Monday closed"], { bg: "#1f4d2b", fg: "#ffffff", h: 200 }, 3.2, 1.6, gu - 9, 1.8, gv + 2, Math.PI);
  K.box(g, 0.15, 1.2, 0.15, 0x5a4a3a, gu - 10.4, 0, gv + 2); K.box(g, 0.15, 1.2, 0.15, 0x5a4a3a, gu - 7.6, 0, gv + 2);

  // ---------- GEER Foundation office and the zoo enclosures ----------
  const [ou, ov] = INDRODA.geer;
  const office = [[ou + 8, ov - 6], [ou + 30, ov - 6], [ou + 30, ov + 10], [ou + 8, ov + 10]];
  K.building(g, office, 7, K.residentialFacade("#c98a63", "#7a4a33"), { roof: 0x9a8a78 });
  solids.push({ poly: office });
  K.textPlane(g, ["GEER FOUNDATION"], { bg: "#2f5a2f", fg: "#fff", h: 110, font: "800 70px Inter, sans-serif" }, 8, 1, ou + 19, 5.6, ov - 6.3, Math.PI);
  const [zu, zv] = INDRODA.zoo;
  for (let i = 0; i < 3; i++) {
    const pen = [[zu - 46 + i * 16, zv - 10], [zu - 32 + i * 16, zv - 10], [zu - 32 + i * 16, zv + 10], [zu - 46 + i * 16, zv + 10]];
    walls.push(...K.compoundWall(g, pen, [], { height: 2.4 }));
    K.box(g, 4, 2.6, 3, 0x9a7a55, zu - 39 + i * 16, 0, zv + 6);
    solids.push({ poly: pen });
  }
  K.textPlane(g, ["INDRODA ZOO · ઇન્દ્રોડા પ્રાણી સંગ્રહાલય"], { bg: "#3e5a2f", fg: "#fff", h: 120, font: "800 56px Inter, sans-serif" }, 9, 1.2, zu - 22, 2.4, zv - 12, Math.PI);

  // ---------- Dinosaur & Fossil Park ----------
  const R = INDRODA.dinoRadius;
  const circle = (r, n = 48, cu = 0, cv = 0) => Array.from({ length: n + 1 }, (_, i) => [cu + Math.cos((i / n) * 6.283) * r, cv + Math.sin((i / n) * 6.283) * r]);
  K.slab(g, circle(R), 0.06, K.mat(K.lawnTex(), { roughness: 1, color: 0xd8cfa0 }), 0, 4);
  const loop = circle(R - 10, 64);
  K.strip(g, loop, 3, 0.1, K.mat(K.brickPaving()), { tile: 2 });
  for (const s of [-1, 1]) K.strip(g, loop, 0.25, 0.1, kerb, { offset: s * 1.6, height: 0.2, tile: 0.9 });
  // Arch gate: two long-necked dinosaurs whose heads meet over the path (photographs).
  const archV = -R + 2;
  const neckM = K.mat(0x7d7a6a, { roughness: 0.95 });
  for (const s of [-1, 1]) {
    ell(g, 1.6, 1.4, 2.8, neckM, s * 6.5, 2.4, archV, [0, s * 1.57, 0]);
    taper(g, 0.7, 0.32, 9, neckM, s * 3.6, 6.4, archV, [0, 0, s * 0.62]);
    ell(g, 0.5, 0.45, 1.1, neckM, s * 0.8, 10, archV, [0, s * 1.57, 0.2 * s]);
    solids.push({ circle: [s * 6.5, archV, 2.6] });
  }
  K.textPlane(g, ["DINOSAUR & FOSSIL PARK", "ડાયનોસોર અને ફોસિલ પાર્ક"], { bg: "#5a3e24", fg: "#f6e7c8" }, 9, 2, 0, 3.6, archV - 2.5, Math.PI);
  K.box(g, 0.2, 3, 0.2, 0x4a3a2a, -3.5, 0, archV - 2.4); K.box(g, 0.2, 3, 0.2, 0x4a3a2a, 3.5, 0, archV - 2.4);
  solids.push({ circle: [-3.5, archV - 2.4, 0.3] }, { circle: [3.5, archV - 2.4, 0.3] });
  // Statues around the loop, each on a low plinth with a fence-free stand-off.
  const statues = [
    [sauropod, -26, -18, 0.8, 1.2], [trex, 24, -22, -0.9, 1.1], [stegosaurus, 30, 10, -1.6, 1.1],
    [triceratops, -30, 16, 1.2, 1.1], [sauropod, 4, 28, 3.1, 1], [trex, -10, 4, 0.4, 0.9],
  ];
  for (const [fn, su, sv, yaw, k] of statues) {
    K.slab(g, circle(5 * k, 20, su, sv), 0.06, K.mat(0x9a8a6a), 0.3, 2);
    fn(g, su, sv, yaw, k);
    solids.push({ circle: [su, sv, 5 * k] });
  }
  pterosaur(g, 14, -6); solids.push({ circle: [14, -6, 0.3] });
  // Egg nest and a fossil gallery shed with info boards.
  K.slab(g, circle(2.4, 18, -14, 26), 0.06, K.mat(0x7a6a4a), 0.3, 2);
  for (let i = 0; i < 5; i++) { const e = ell(g, 0.45, 0.6, 0.45, K.mat(0xe9e1cf), -14 + Math.cos(i * 1.3) * 1.1, 0.95, 26 + Math.sin(i * 1.3) * 1.1); e.rotation.z = i * 0.2; }
  solids.push({ circle: [-14, 26, 2.4] });
  const shed = [[36, 26], [52, 26], [52, 36], [36, 36]];
  K.building(g, shed, 4, K.residentialFacade("#d8c7a0", "#6b4a2a"), { roof: 0x6b4a2a, parapet: 0 });
  solids.push({ poly: shed });
  K.textPlane(g, ["FOSSIL GALLERY · Dinosaur fossils of Balasinor (Raiyoli)"], { bg: "#5a3e24", fg: "#fff", h: 120, font: "700 48px Inter, sans-serif" }, 10, 1.1, 44, 3.2, 25.7, Math.PI);
  for (let i = 0; i < 8; i++) { const a = (i / 8) * 6.283 + 0.2; K.bench(g, Math.cos(a) * (R - 14), Math.sin(a) * (R - 14), -a + Math.PI / 2); solids.push({ circle: [Math.cos(a) * (R - 14), Math.sin(a) * (R - 14), 0.9] }); }

  // ---------- dense dry deciduous forest (khakhra, neem, babul) ----------
  const corridor = (u, v, r = 0) => INDRODA.road.some((p, i) => i && K.segDist(u, v, INDRODA.road[i - 1], p) < 5.2 - r);
  const clearings = [[0, 0, R + 2], [gu, gv + 7, 24], [ou + 19, ov + 2, 20], [zu - 22, zv, 32]];
  const inClearing = (u, v, r = 0) => clearings.some(([cu, cv, cr]) => Math.hypot(u - cu, v - cv) < cr - r);
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  // Dense along the road (what visitors actually see), lighter fill elsewhere.
  let placed = 0;
  const plant = (u, v) => {
    if (!K.pointInPolygon(u, v, INDRODA.area) || corridor(u, v, -3) || inClearing(u, v, -4)) return;
    K.tree(g, u, v, 0.75 + rnd() * 0.75, { dry: rnd() < 0.55 });
    if (rnd() < 0.6) K.sphere(g, 0.8 + rnd() * 0.6, K.mat(rnd() < 0.5 ? 0x6f7f3c : 0x8a8a4a, { flatShading: true }), u + 2 + rnd() * 2, 0.5, v + rnd() * 2, 5); // undergrowth
    placed++;
  };
  for (let i = 0; i < 1400; i++) {
    const k = 1 + Math.floor(rnd() * (INDRODA.road.length - 1));
    const [au, av] = INDRODA.road[k - 1], [bu, bv] = INDRODA.road[k];
    const t = rnd(), len = Math.hypot(bu - au, bv - av) || 1;
    const side = rnd() < 0.5 ? -1 : 1, off = 6.5 + rnd() * 55;
    plant(au + (bu - au) * t - ((bv - av) / len) * off * side, av + (bv - av) * t + ((bu - au) / len) * off * side);
  }
  for (let i = 0; i < 700; i++) plant(-380 + rnd() * 500, -400 + rnd() * 500);
  // Flowering trees by the road (bougainvillea / gulmohar, as in the photo sphere).
  for (let i = 1; i < INDRODA.road.length - 1; i += 2) {
    const [u, v] = INDRODA.road[i];
    K.tree(g, u + 7, v, 1, { color: 0xd8508a });
  }

  K.mergeStatic(g);
  const walkable = (u, v, r) => corridor(u, v, r) || inClearing(u, v, r);
  const zone = K.createSiteZone({ id: "indroda-park", f, area: INDRODA.area, solids, walls, vehicleFree: [INDRODA.area], walkable });
  const local = [[0, -40], [-12, -30], [18, -30], [-34, 0], [32, -8], [8, 30], [gu + 4, gv + 10], [gu - 6, gv + 16], [ou + 19, ov + 14]];
  const residents = local.map(([u, v]) => ({ ...f.toWorld(u, v), r: 4 }));
  // Travellers arrive just inside the main gate, looking down the park road.
  const spawn = { ...f.toWorld(gu, gv + 12), yaw: Math.PI, residents };
  return { zone, spawn, frame: f, update() {} };
}
