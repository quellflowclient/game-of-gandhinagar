import * as THREE from "three";
import { placedPlaces, placePos } from "../data/places.js";
import { STALLS, STORIES } from "../data/content.js";
import * as T from "./textures.js";
import { buildMahatma } from "./mahatma.js";
import { MAHATMA, createMahatmaZone, siteToWorld, bridgeHeight } from "./mahatma-layout.js";
import { createNavigation } from "./navigation.js";
import { buildLdrp } from "./sites/ldrp.js";
import { buildGift } from "./sites/gift.js";
import { buildSwagat } from "./sites/swagat.js";
import { buildIndroda } from "./sites/indroda.js";
import { allSiteMaterials } from "./sites/kit.js";

// Real-life sites with their own layout, builder and navigation zone.
const SITES = { ldrp: buildLdrp, gift: buildGift, swagat: buildSwagat, indroda: buildIndroda };

// Landmark models based on photos of the real places, so each area is recognisable:
// Akshardham's pink sandstone monument, the GIFT One/Two glass towers, Dandi Kutir's
// salt-mound cone, TCS Garima Park's terracotta drum, Swagat Holiday Mall's hexagon LED
// facade, Indroda's dinosaur gate, Sarita Udyan's A-frame gate, and so on.

const matCache = new Map();
const detailedLandmarks = [];
// Physically based materials so landmarks pick up the sky lighting and reflections.
// Glass-like surfaces (emissive blue towers) get low roughness.
function mat(c, opts = {}) {
  const key = (typeof c === "number" ? c : c.uuid) + JSON.stringify(opts);
  if (!matCache.has(key)) {
    const glassy = opts.emissive !== undefined && typeof c !== "number";
    const base = { roughness: glassy ? 0.18 : 0.78, metalness: glassy ? 0.35 : 0.02, ...opts };
    matCache.set(key, typeof c === "number"
      ? new THREE.MeshStandardMaterial({ color: c, ...base })
      : new THREE.MeshStandardMaterial({ map: c, ...base }));
  }
  return matCache.get(key);
}
function add(g, geo, m, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  g.add(mesh);
  return mesh;
}
// Box standing on y. `m` is a material or a colour.
const box = (g, w, h, d, m, x, y, z, ry = 0) => add(g, new THREE.BoxGeometry(w, h, d), m.isMaterial ? m : mat(m), x, y + h / 2, z, ry);
const cyl = (g, rt, rb, h, m, x, y, z, seg = 12) => add(g, new THREE.CylinderGeometry(rt, rb, h, seg), m.isMaterial ? m : mat(m), x, y + h / 2, z);
const cone = (g, r, h, m, x, y, z, seg = 10) => add(g, new THREE.ConeGeometry(r, h, seg), m.isMaterial ? m : mat(m), x, y + h / 2, z);
function dome(g, r, m, x, y, z, squash = 1) {
  const d = add(g, new THREE.SphereGeometry(r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), m.isMaterial ? m : mat(m), x, y, z);
  d.scale.y = squash;
  return d;
}
function tree(g, x, z, k = 1, color = 0x5d9a45) {
  cyl(g, 0.25 * k, 0.35 * k, 3 * k, 0x6b4a2e, x, 0, z, 5);
  add(g, new THREE.IcosahedronGeometry(2.4 * k, 0), mat(color), x, 4.6 * k, z);
}
function palm(g, x, z) {
  cyl(g, 0.2, 0.3, 7, 0x8a6a45, x, 0, z, 6);
  for (let i = 0; i < 6; i++) {
    const leaf = add(g, new THREE.BoxGeometry(3.2, 0.08, 0.6), mat(0x3f8a3a), x, 7, z, (i / 6) * Math.PI * 2);
    leaf.rotation.z = -0.35;
  }
}
function signBoard(g, lines, opts, w, h, x, y, z, ry = 0) {
  const tex = T.textTexture(lines, opts);
  const plane = add(g, new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }), x, y, z, ry);
  return plane;
}
function hedge(g, w, d, x, z) { box(g, w, 1, d, 0x3f7a35, x, 0, z); }
function flowers(g, w, d, x, z) {
  box(g, w, 0.4, d, 0x6a4a30, x, 0, z);
  const colors = [0xe0402f, 0xf2b84b, 0xd86a9c, 0xffffff];
  for (let i = 0; i < Math.floor(w * d / 3); i++)
    add(g, new THREE.SphereGeometry(0.25, 5, 4), mat(colors[i % 4]), x + (Math.random() - 0.5) * w, 0.55, z + (Math.random() - 0.5) * d);
}

// Night: landmarks are floodlit. Textured facades glow through their own texture,
// plain surfaces get a soft lift so the silhouettes read against the night sky.
export function setLandmarksNight(on) {
  // Site kit materials: lamp heads glow; textured facades get a soft window glow.
  for (const m of allSiteMaterials()) {
    if (!m.userData.siteDay) m.userData.siteDay = { k: m.emissiveIntensity, map: m.emissiveMap, e: m.emissive.getHex() };
    const d = m.userData.siteDay;
    if (d.e && !m.map) m.emissiveIntensity = on ? 2.5 : d.k;
    else if (m.map && !m.transparent) { m.emissiveMap = on ? m.map : d.map; m.emissive.setHex(on ? 0xffffff : d.e); m.emissiveIntensity = on ? 0.18 : d.k; }
    m.needsUpdate = true;
  }
  for (const m of matCache.values()) {
    if (!m.userData.day) m.userData.day = { emissive: m.emissive.clone(), map: m.emissiveMap, k: m.emissiveIntensity };
    const d = m.userData.day;
    if (!on) { m.emissive.copy(d.emissive); m.emissiveMap = d.map; m.emissiveIntensity = d.k; }
    else if (m.map) { m.emissive.set(0xffffff); m.emissiveMap = d.map || m.map; m.emissiveIntensity = d.map ? 1.6 : 0.42; }
    else { m.emissive.copy(m.color).multiplyScalar(0.22); m.emissiveIntensity = 1; }
    m.needsUpdate = true;
  }
  for (const landmark of detailedLandmarks) landmark.setNight(on);
}

// Bilingual name sign on posts, used at every place.
export function makeSign(en, gu, color = 0xf2b84b, width = 12) {
  const g = new THREE.Group();
  const hex = "#" + color.toString(16).padStart(6, "0");
  const tex = T.textTexture([en.toUpperCase(), gu], { bg: "#0f2a24", fg: "#fff7e0", w: 1024, h: 400 });
  const board = add(g, new THREE.PlaneGeometry(width, width * 0.39), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }), 0, 3.2 + width * 0.2, 0);
  add(g, new THREE.BoxGeometry(width, 0.25, 0.15), mat(new THREE.Color(hex).getHex()), 0, 3.2 + width * 0.4, 0);
  cyl(g, 0.15, 0.15, 3.4 + width * 0.2, 0x333333, -width / 2 + 0.6, 0, -0.1, 6);
  cyl(g, 0.15, 0.15, 3.4 + width * 0.2, 0x333333, width / 2 - 0.6, 0, -0.1, 6);
  board.userData.isSign = true;
  return g;
}

// ---------- one builder per place (local coordinates, +z is south, the approach) ----------
const B = {
  akshardham(g) {
    // Long garden axis from the south gate to the monument, with fountain and hedges.
    box(g, 130, 0.1, 190, 0x6faa4f, 0, 0, 30);
    box(g, 10, 0.15, 120, 0xd8c3a5, 0, 0, 60);
    box(g, 6, 0.4, 70, 0x5aa6c8, 0, 0, 62);
    for (let z = 32; z < 98; z += 11) { cyl(g, 0.3, 0.4, 2.2, 0xffffff, 0, 0, z, 6); }
    for (const x of [-9, 9]) { hedge(g, 2, 110, x, 60); for (let z = 10; z < 115; z += 14) tree(g, x * 2.2, z, 0.7, 0x4f8a3c); }
    for (const x of [-40, 40]) flowers(g, 22, 40, x, 60);
    // Stepped plinth.
    const ss = T.sandstone(10, 1);
    box(g, 82, 1.2, 52, 0xd9a47e, 0, 0, -10);
    box(g, 78, 1.2, 48, 0xe2ad85, 0, 1.2, -10);
    box(g, 74, 1.2, 44, 0xe7b48c, 0, 2.4, -10);
    // Main body with carved arches, colonnades and a cornice.
    box(g, 70, 15, 40, mat(ss), 0, 3.6, -10);
    box(g, 72, 1.4, 42, 0xf2c9a6, 0, 18.6, -10);
    for (let x = -33; x <= 33; x += 3.3) {
      cyl(g, 0.55, 0.65, 15, 0xe0a982, x, 3.6, 10.6, 8);
      cyl(g, 0.55, 0.65, 15, 0xe0a982, x, 3.6, -30.6, 8);
    }
    for (let z = -28; z <= 8; z += 3.3) { cyl(g, 0.55, 0.65, 15, 0xe0a982, -35.6, 3.6, z, 8); cyl(g, 0.55, 0.65, 15, 0xe0a982, 35.6, 3.6, z, 8); }
    // Front steps up the plinth.
    for (let i = 0; i < 6; i++) box(g, 16, 0.6, 2, 0xf0c3a0, 0, i * 0.6, 14 - i * 0.9);
    // Central tiered shikhar and dome with finial.
    const top = 20;
    box(g, 26, 4, 22, 0xe7b48c, 0, top, -10);
    box(g, 20, 3, 17, 0xeab890, 0, top + 4, -10);
    cyl(g, 7.5, 8.5, 3, 0xedc09a, 0, top + 7, -10, 16);
    dome(g, 7.5, 0xf0c27a, 0, top + 10, -10, 1.15);
    cone(g, 1.6, 6, 0xf2d08a, 0, top + 18, -10, 8);
    add(g, new THREE.SphereGeometry(0.8, 8, 6), mat(0xf6c84b), 0, top + 24.5, -10);
    // Small chhatri domes along the roof edge.
    const chhatri = (x, z) => {
      for (const [dx, dz] of [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]]) cyl(g, 0.2, 0.2, 2.4, 0xe7b48c, x + dx, top, z + dz, 6);
      box(g, 3.4, 0.4, 3.4, 0xf2c9a6, x, top + 2.4, z);
      dome(g, 1.7, 0xf0c27a, x, top + 2.8, z, 1.1);
      cone(g, 0.3, 1.2, 0xf2d08a, x, top + 4.6, z, 6);
    };
    for (const x of [-32, -22, -11, 11, 22, 32]) { chhatri(x, 8); chhatri(x, -28); }
    for (const z of [-19, -1]) { chhatri(-32, z); chhatri(32, z); }
    // Gate at the south end.
    box(g, 3, 9, 3, 0xe2ad85, -8, 0, 124); box(g, 3, 9, 3, 0xe2ad85, 8, 0, 124);
    box(g, 19, 2.5, 3.4, 0xe7b48c, 0, 9, 124);
    dome(g, 2.2, 0xf0c27a, 0, 11.5, 124);
  },

  gift(g) {
    box(g, 110, 0.4, 80, 0xb9c2c8, 0, 0, 0);
    box(g, 70, 6, 34, 0x9fb2c4, 0, 0.4, -6);
    const glass = mat(T.giftGlass(3, 12), { emissive: 0x0a1a2a });
    for (const [x, name] of [[-17, "GIFT ONE"], [17, "GIFT TWO"]]) {
      box(g, 22, 118, 22, glass, x, 6.4, -6);
      // Angled crown.
      const crown = box(g, 22, 6, 22, glass, x, 122, -6);
      crown.rotation.z = x < 0 ? 0.12 : -0.12;
      box(g, 22.6, 1.2, 22.6, 0xdfe7ee, x, 124.4, -6);
      signBoard(g, name, { bg: "#0c2d4f", fg: "#ffffff", w: 512, h: 128 }, 12, 3, x, 112, 5.1);
    }
    const g2 = mat(T.officeBands(2, 10, "#4a8cc6", "#d6dde4"), { emissive: 0x08141f });
    box(g, 16, 70, 16, g2, -48, 0.4, -24);
    box(g, 14, 52, 14, g2, 48, 0.4, -22);
    box(g, 20, 34, 12, g2, 44, 0.4, 24);
    for (let i = 0; i < 8; i++) palm(g, -40 + i * 11, 30);
  },

  infocity(g) {
    const clad = mat(T.officeBands(3, 5));
    for (const [x, z, w, h, d] of [[-26, -24, 22, 22, 16], [0, -30, 18, 26, 16], [26, -24, 22, 20, 16], [-30, 6, 16, 16, 20]]) {
      box(g, w, h, d, clad, x, 0, z);
      box(g, w + 0.6, 0.8, d + 0.6, 0xe8ecf0, x, h, z);
    }
    // Entrance gate: cream pillars, blue "Welcome to Infocity" sign.
    for (const x of [-11, 11]) { box(g, 2.6, 8, 2.6, 0xf0dca8, x, 0, 18); box(g, 3.2, 0.8, 3.2, 0xe0c68a, x, 8, 18); }
    box(g, 24, 3, 0.8, 0x1d4e89, 0, 6.2, 18);
    signBoard(g, ["WELCOME TO INFOCITY", "GLOBAL I.T. HUB"], { bg: "#1d4e89", fg: "#ffffff" }, 22, 2.8, 0, 7.7, 18.45);
    for (let i = -4; i <= 4; i++) { tree(g, i * 9, 28, 0.9); }
  },

  daiict(g) {
    const wall = mat(T.punched("#d9c7a3", "#2f3a52", 6, 4));
    box(g, 40, 14, 14, wall, -6, 0, -18);
    cyl(g, 7, 7, 14, 0xd2bd96, -26, 0, -18, 20);
    cyl(g, 7, 7, 14, 0xd2bd96, 14, 0, -18, 20);
    box(g, 14, 12, 30, wall, 28, 0, 2);
    cyl(g, 4.5, 4.5, 16, 0xcab48c, 0, 0, -8, 18);
    box(g, 12, 6, 6, 0xc9b38b, 0, 0, -6);
    signBoard(g, "DA-IICT", { bg: "#d9c7a3", fg: "#2b3245", w: 512, h: 160 }, 8, 2.4, 0, 7.5, -2.9);
    box(g, 60, 0.1, 30, 0x6faa4f, -4, 0, 18);
    for (let i = 0; i < 7; i++) tree(g, -30 + i * 10, 34, 0.9);
  },

  nift(g) {
    const st = mat(T.stone(5, 3));
    box(g, 30, 12, 14, st, -12, 0, -18);
    box(g, 22, 8, 12, st, -14, 12, -20);
    box(g, 14, 14, 26, st, 18, 0, -8);
    // Curved metal canopy over the courtyard.
    const arc = new THREE.Mesh(new THREE.TorusGeometry(12, 0.25, 6, 30, Math.PI), mat(0x8a8f96));
    arc.position.set(2, 0, -2); arc.rotation.y = Math.PI / 2;
    g.add(arc);
    const roof = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 14, 24, 1, true, -Math.PI / 2, Math.PI), mat(0xc9ced4, { side: THREE.DoubleSide, transparent: true, opacity: 0.55 }));
    roof.rotation.z = Math.PI / 2; roof.position.set(2, 0, -2);
    g.add(roof);
    signBoard(g, "NIFT", { bg: "rgba(0,0,0,0)", fg: "#e0402f", w: 512, h: 200, font: "900 170px Inter, sans-serif" }, 6, 2.4, 2, 1.4, 12);
  },

  tcs(g) {
    // Garima Park: a drum wrapped in terracotta louvres with a vertical slot entrance.
    cyl(g, 20, 20, 26, mat(T.terracotta(14, 10)), 0, 0, -16, 40);
    cyl(g, 20.5, 20.5, 1.4, 0x5a3a2e, 0, 26, -16, 40);
    box(g, 7, 26, 3, 0x1e2a3a, 0, 0, 3.5);
    signBoard(g, ["TATA", "TATA CONSULTANCY SERVICES"], { bg: "#1e2a3a", fg: "#ffffff", w: 512, h: 256 }, 10, 5, 0, 28, 4);
    const gl = mat(T.officeBands(2, 4, "#3b6fb6", "#2b3a4f"), { emissive: 0x08142a });
    box(g, 16, 18, 40, gl, 34, 0, -16);
    box(g, 16, 18, 40, gl, -34, 0, -16);
  },

  pdeu(g) {
    // Sandstone portal gate with the university name on the beam.
    for (const x of [-12, 12]) box(g, 3, 10, 3, 0xb89a74, x, 0, 26);
    box(g, 28, 2.4, 3.2, 0xb89a74, 0, 10, 26);
    signBoard(g, "PANDIT DEENDAYAL ENERGY UNIVERSITY", { bg: "#b89a74", fg: "#3a2a1a", w: 1024, h: 110, font: "800 66px Inter, sans-serif" }, 26, 2, 0, 11.2, 27.65);
    const wall = mat(T.punched("#e9e6df", "#3a4a66", 6, 4));
    box(g, 44, 14, 14, wall, -6, 0, -24);
    box(g, 14, 12, 34, wall, 28, 0, -10);
    box(g, 14, 12, 34, wall, -36, 0, -10);
    for (let i = 0; i < 6; i++) {
      const panel = add(g, new THREE.BoxGeometry(6, 0.2, 3.5), mat(0x1d2e5a), -18 + i * 7, 2, 6);
      panel.rotation.x = -0.5;
      cyl(g, 0.1, 0.1, 1.8, 0x777777, -18 + i * 7, 0, 6.5, 4);
    }
  },

  sarita(g) {
    // The big A-frame lattice entrance gate.
    const pole = mat(0xa8865a);
    for (let i = -10; i <= 10; i++) {
      for (const side of [-1, 1]) {
        const p = add(g, new THREE.CylinderGeometry(0.12, 0.12, 17, 5), pole, i * 0.9, 7, 20 + side * 4.2);
        p.rotation.x = side * 0.52;
      }
    }
    for (let y = 2; y < 14; y += 2.5) box(g, 19, 0.15, 0.15, pole, 0, y, 20 + (1 - y / 15) * 4.2);
    signBoard(g, "સરિતા ઉદ્યાન", { bg: "#3a6a2e", fg: "#fff7e0", w: 512, h: 128 }, 5, 1.3, 0, 3.5, 24.6);
    box(g, 4, 0.1, 50, mat(T.brick(1, 12)), 0, 0.02, 0);
    flowers(g, 14, 8, -12, 6); flowers(g, 14, 8, 12, 6); flowers(g, 10, 6, -12, -10);
    // Deer statues.
    for (const [x, z] of [[-8, -4], [9, -6]]) {
      box(g, 1.6, 0.9, 0.6, 0x8a6a4a, x, 1.1, z);
      box(g, 0.4, 1.0, 0.4, 0x8a6a4a, x + 0.8, 1.7, z);
      for (const [dx, dz] of [[-0.6, -0.2], [-0.6, 0.2], [0.6, -0.2], [0.6, 0.2]]) box(g, 0.15, 1.1, 0.15, 0x7a5a3a, x + dx, 0, z + dz);
    }
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 7) tree(g, Math.cos(a) * 26, Math.sin(a) * 20 - 8, 1.1);
  },

  indroda(g) {
    // Gate: two long-necked dinosaurs whose heads meet over the path.
    const dino = mat(0x7d7a72);
    for (const side of [-1, 1]) {
      box(g, 5, 4, 7, dino, side * 7, 0, 24);
      const neck = box(g, 1.6, 11, 1.6, dino, side * 5, 3, 24);
      neck.rotation.z = side * 0.45;
      const head = box(g, 3.2, 1.6, 1.8, dino, side * 1.6, 12.2, 24);
      head.rotation.z = side * -0.2;
    }
    // T-rex.
    const t = new THREE.Group(); t.position.set(-18, 0, -6); g.add(t);
    box(t, 2, 3.5, 1.4, 0x6f6a5f, 0, 0, 0); box(t, 6, 3, 2.4, 0x6f6a5f, 0, 3.5, 0);
    box(t, 3.2, 2.2, 2, 0x6f6a5f, 3.6, 5.2, 0); box(t, 6, 1, 1, 0x6f6a5f, -5, 4.5, 0);
    // Sauropod.
    const s = new THREE.Group(); s.position.set(16, 0, -10); g.add(s);
    box(s, 10, 4.5, 4, 0x7a8a6a, 0, 3, 0);
    for (const [x, z] of [[-3.5, -1.4], [-3.5, 1.4], [3.5, -1.4], [3.5, 1.4]]) box(s, 1.2, 3, 1.2, 0x6a7a5a, x, 0, z);
    const n = box(s, 1.4, 10, 1.4, 0x7a8a6a, 6.5, 6, 0); n.rotation.z = -0.35;
    box(s, 2.4, 1.2, 1.2, 0x7a8a6a, 9.5, 15.2, 0);
    box(s, 7, 1, 1, 0x7a8a6a, -8, 4.5, 0);
    // Dense forest.
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2, r = 22 + Math.random() * 24;
      tree(g, Math.cos(a) * r, Math.sin(a) * r - 10, 0.9 + Math.random() * 0.6, 0x3f7a35);
    }
  },

  park(g) {
    box(g, 2, 6, 2, 0x8a6a4a, -7, 0, 22); box(g, 2, 6, 2, 0x8a6a4a, 7, 0, 22);
    box(g, 17, 1.5, 2.2, 0x5fae5a, 0, 6, 22);
    cyl(g, 6, 6.5, 1, 0xbfb7a6, 0, 0, 0, 20);
    cyl(g, 5, 5, 0.3, 0x4fa3d1, 0, 1, 0, 20);
    cyl(g, 0.5, 0.7, 3, 0xbfb7a6, 0, 1, 0, 8);
    flowers(g, 10, 5, -14, 10); flowers(g, 10, 5, 14, 10);
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 6) tree(g, Math.cos(a) * 20, Math.sin(a) * 18, 1.1);
  },

  dandi(g) {
    return buildMahatma(g, { mat, signBoard });
  },

  lakegarden(g) { /* built from the OSM lake outline in buildLakeEdge() */ },
  bridge(g) { /* built along the OSM road in buildBridge() */ },

  swagat(g) {
    // Swagat Holiday Mall: shopfronts below, rainbow hexagon LED facade above.
    box(g, 56, 22, 34, 0x2a2340, 0, 0, -18);
    const hex = mat(T.hexLed(4, 1), { emissive: 0x2a1040, emissiveMap: T.hexLed(4, 1) });
    add(g, new THREE.PlaneGeometry(56, 12), hex, 0, 15.5, -0.9);
    add(g, new THREE.PlaneGeometry(56, 8), mat(T.shopfronts(3, 1)), 0, 5, -0.9);
    signBoard(g, ["Swagat", "HOLIDAY MALL"], { bg: "#1b1530", fg: "#f2c84b", w: 512, h: 256 }, 9, 4.5, 22, 24.5, -0.5);
    box(g, 60, 0.3, 12, 0x9a9a9a, 0, 0, 8);
  },

  hangout(g) {
    box(g, 30, 18, 20, mat(T.officeBands(3, 4, "#6f5ab8", "#e4e0ea")), 0, 0, -14);
    signBoard(g, "THE LANDMARK", { bg: "#14182b", fg: "#f2b84b", w: 768, h: 160 }, 14, 3, 0, 20, -3.8);
  },

  hospital(g) {
    const wall = mat(T.punched("#f4f4f2", "#5a7a9a", 8, 5));
    box(g, 50, 20, 20, wall, 0, 0, -16);
    box(g, 20, 14, 30, wall, -32, 0, -10);
    box(g, 2, 8, 0.6, 0xe25c5c, 0, 9, -5.6); box(g, 8, 2, 0.6, 0xe25c5c, 0, 12, -5.6);
    signBoard(g, ["CIVIL HOSPITAL", "GMERS · GANDHINAGAR"], { bg: "#ffffff", fg: "#c43a3a" }, 18, 4.5, 0, 22.5, -5.7);
  },
};

const CLEAR_R = { akshardham: 135, gift: 70, infocity: 50, daiict: 45, nift: 35, tcs: 40, pdeu: 50, sarita: 35, indroda: 50, dandi: 55, swagat: 40, landmark: 30, civil: 45, punitvan: 30, swarnim: 30 };

// Bridge: white arch portals at both ends of the OSM road segment nearest the place.
function buildBridge(scene, map, x, z) {
  let best = null, bd = Infinity;
  for (const r of map.roads) for (let i = 0; i < r.pts.length - 1; i++) {
    const [ax, az] = r.pts[i], [bx, bz] = r.pts[i + 1];
    const mx = (ax + bx) / 2, mz = (az + bz) / 2, d = Math.hypot(mx - x, mz - z);
    if (d < bd && Math.hypot(bx - ax, bz - az) > 20) { bd = d; best = [ax, az, bx, bz]; }
  }
  if (!best) return;
  const [ax, az, bx, bz] = best;
  const ang = Math.atan2(bx - ax, bz - az);
  const len = Math.hypot(bx - ax, bz - az);
  const g = new THREE.Group(); g.position.set((ax + bx) / 2, 0, (az + bz) / 2); g.rotation.y = ang;
  scene.add(g);
  for (const s of [-1, 1]) {
    const arch = new THREE.Mesh(new THREE.TorusGeometry(9, 0.45, 8, 24, Math.PI), mat(0xf4f4f4));
    arch.position.set(0, 0.3, s * (len / 2 - 4));
    g.add(arch);
    for (const side of [-1, 1]) box(g, 0.25, 1.1, len, 0xdedede, side * 7.5, 0.3, 0);
  }
  for (let i = -Math.floor(len / 20); i <= Math.floor(len / 20); i++) {
    cyl(g, 0.12, 0.12, 6, 0x555555, 7.8, 0.3, i * 10, 6);
    add(g, new THREE.SphereGeometry(0.45, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), 7.8, 6.5, i * 10);
  }
}

// Lake garden: red walking track and stone ghats around the OSM lake outline.
function buildLakeEdge(scene, map, x, z) {
  const lake = map.water.filter((w) => w.closed).map((w) => {
    const cx = w.pts.reduce((s, p) => s + p[0], 0) / w.pts.length, cz = w.pts.reduce((s, p) => s + p[1], 0) / w.pts.length;
    return { w, d: Math.hypot(cx - x, cz - z), cx, cz };
  }).sort((a, b) => a.d - b.d)[0];
  if (!lake || lake.d > 300) return null;
  const g = new THREE.Group(); scene.add(g);
  const track = mat(T.brick(1, 1)), ghat = mat(0xbdb3a0), ghat2 = mat(0xa89d88);
  const pts = lake.w.pts;
  for (let i = 0; i < pts.length - 1; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1];
    const len = Math.hypot(bx - ax, bz - az);
    if (len < 0.5) continue;
    const ang = Math.atan2(bx - ax, bz - az);
    // Outward normal (away from the centre).
    let nx = (bz - az) / len, nz = -(bx - ax) / len;
    const mx = (ax + bx) / 2, mz = (az + bz) / 2;
    if ((mx - lake.cx) * nx + (mz - lake.cz) * nz < 0) { nx = -nx; nz = -nz; }
    add(g, new THREE.BoxGeometry(2.5, 0.5, len + 0.4), ghat2, mx + nx * 1, 0.1, mz + nz * 1, ang);
    add(g, new THREE.BoxGeometry(2.5, 1.0, len + 0.4), ghat, mx + nx * 3, 0.3, mz + nz * 3, ang);
    add(g, new THREE.BoxGeometry(3, 0.15, len + 0.4), track, mx + nx * 6, 0.85, mz + nz * 6, ang);
    if (i % 4 === 0) {
      cyl(g, 0.1, 0.1, 4.5, 0x444444, mx + nx * 8, 0, mz + nz * 8, 6);
      add(g, new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }), mx + nx * 8, 4.8, mz + nz * 8);
    }
  }
  // Arrival point: on the south shore, just outside the walking track.
  const south = pts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return { x: south[0], z: south[1] + 22 };
}

function stallModel(stall) {
  const g = new THREE.Group();
  box(g, 3.2, 1.1, 1.6, 0x8a5a3a, 0, 0.5, 0);
  for (const x of [-1.5, 1.5]) for (const z of [-0.7, 0.7]) cyl(g, 0.06, 0.06, 2.6, 0x555555, x, 0, z, 4);
  const stripes = T.textTexture(" ", { bg: "#e05a3a", w: 64, h: 16 });
  const canopy = box(g, 3.6, 0.2, 2.2, mat(stripes), 0, 2.6, 0);
  canopy.rotation.x = 0.12;
  for (const x of [-1.6, 1.6]) cyl(g, 0.28, 0.28, 0.5, 0x333333, x, 0.1, 0.8, 10).rotation.z = Math.PI / 2;
  const sign = makeSign(stall.name, stall.emoji, 0xe05a3a, 3.4);
  sign.position.set(0, -0.3, -1);
  sign.scale.setScalar(0.8);
  g.add(sign);
  return g;
}

function stageModel() {
  const g = new THREE.Group();
  box(g, 14, 1.2, 8, 0x3a3f55, 0, 0, 0);
  box(g, 14, 6, 0.4, 0x14182b, 0, 1.2, -3.8);
  cyl(g, 0.05, 0.05, 1.6, 0x222222, 0, 1.2, 0, 6);
  add(g, new THREE.SphereGeometry(0.15, 8, 6), mat(0x999999), 0, 2.9, 0);
  const sign = makeSign("Open mic", "ઓપન માઇક", 0xf2b84b, 8);
  sign.position.set(0, 4.2, -3.6); sign.scale.setScalar(0.7);
  g.add(sign);
  return g;
}

export function buildLandmarks(scene, map) {
  const clearings = [], stalls = [], checkpoints = [], spawns = {};
  const navigationZones = [], cameraObstacles = [], animations = [],markets=[];
  let stage = null;

  for (const p of placedPlaces()) {
    const { x, z } = placePos(p);
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    if (SITES[p.id]) {
      const site = SITES[p.id](scene, map, { x, z });
      navigationZones.push(site.zone); clearings.push(site.zone.clearing);
      for(const zone of site.extraZones||[]){navigationZones.push(zone);clearings.push(zone.clearing);}
      if(site.market){markets.push(site.market);stalls.push(...site.market.shops);}
      spawns[p.id] = site.spawn; animations.push(site);
      continue;
    }
    const builder = B[p.id] || B[p.kind] || B.hangout;
    const detail = builder(g, p);
    if (detail) { detailedLandmarks.push(detail); animations.push(detail); }
    g.traverse((o) => {
      if (o.isMesh && !o.material.isMeshBasicMaterial && !o.userData.noShadow) { o.castShadow = true; o.receiveShadow = true; }
      if (o.userData.cameraSolid) cameraObstacles.push(o);
    });
    scene.add(g);

    if (p.id === "pdpu-bridge") buildBridge(scene, map, x, z);
    const shore = p.id === "lakegarden" ? buildLakeEdge(scene, map, x, z) : null;

    // Name sign out front (Akshardham's sits at its long garden gate).
    const sign = makeSign(p.name, p.gu, p.color, 12);
    const signZ = p.id === "akshardham" ? 132 : p.id === "dandi" ? 62 : 40;
    sign.position.set(p.id === "akshardham" ? 16 : 0, 0, signZ);
    if (p.id !== "dandi") g.add(sign);

    const r = CLEAR_R[p.id] ?? 0;
    if (p.id === "dandi") {
      const zone = createMahatmaZone({ x, z });
      navigationZones.push(zone); clearings.push(zone.clearing);
    } else if (r) clearings.push({ x, z, r });
    spawns[p.id] = shore || { x, z: z + (p.id === "akshardham" ? 140 : p.id === "dandi" ? 72 : p.id === "gift" ? 60 : 50) };
    if (p.id === "dandi") {
      const residents = [];
      for (let i = 0; i < 6; i++) {
        const a = (i+0.5)*Math.PI/3, radius = i%2 ? 77 : 97;
        residents.push({ ...siteToWorld({ x, z }, Math.sin(a)*radius, Math.cos(a)*radius), r: 5 });
      }
      const bridgeRoute=[60,110,205,300,338,300,205,110].map(v=>({...siteToWorld({x,z},0,v),y:bridgeHeight(v)}));
      for (const v of [110, 205, 300]) residents.push({ ...siteToWorld({ x, z }, 0, v), y: bridgeHeight(v), r: 2.5, route:bridgeRoute, routeIndex:bridgeRoute.findIndex(p=>Math.hypot(p.x-siteToWorld({x,z},0,v).x,p.z-siteToWorld({x,z},0,v).z)<0.1) });
      spawns[p.id] = { ...siteToWorld({ x, z }, 0, -110), yaw: MAHATMA.yaw + Math.PI, residents };
    }
    if (shore) { sign.position.set(shore.x - x, 0, shore.z - z - 6); }

    (STALLS[p.id] || []).forEach((s, i) => {
      const sp = spawns[p.id];
      const sx = sp.x - 14 + i * 9, sz = sp.z + 8;
      const m = stallModel(s);
      m.position.set(sx, 0, sz); // faces south, toward arriving players
      scene.add(m);
      stalls.push({ ...s, place: p.id, x: sx, z: sz });
    });

    if (p.id === "lakegarden") {
      stage = stageModel();
      stage.position.set(spawns[p.id].x + 24, 0, spawns[p.id].z + 6);
      scene.add(stage);
    }
  }

  const navigation = createNavigation(navigationZones,{roads:map.roads,parks:map.parks});
  for (const s of STORIES) {
    const p = placedPlaces().find((q) => q.id === s.place);
    if (!p) continue;
    const sp = spawns[p.id];
    const n = s.goals[0].n;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + 0.4;
      const target = p.id === "dandi"
        ? siteToWorld(placePos(p), Math.sin(a) * 97, Math.cos(a) * 97)
        : { x: sp.x + Math.cos(a) * 30, z: sp.z - 10 + Math.sin(a) * 26 };
      const { x: cx, y: cy, z: cz } = navigation.safePoint(target.x, target.z);
      const marker = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 3, 10),
        new THREE.MeshBasicMaterial({ color: 0xf2b84b, transparent: true, opacity: 0.85 }));
      marker.position.set(cx, cy + 1.5, cz);
      marker.visible = false;
      scene.add(marker);
      checkpoints.push({ story: s.id, index: i, x: cx, z: cz, mesh: marker });
    }
  }

  scene.updateMatrixWorld(true);
  return { clearings, stalls, checkpoints, spawns, navigation, cameraObstacles,markets,
    update(time,playerPos) { for (const detail of animations) detail.update(time,playerPos); },
    stage: stage ? { x: stage.position.x, z: stage.position.z } : null };
}
