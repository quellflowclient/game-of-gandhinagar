import * as THREE from "three";
import {parkedTwoWheeler} from '../parked-models.js';
import * as BGU from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as T from '../textures.js';

// Shared kit for hand-built real-life sites (LDRP/KSV, GIFT City, Swagat, Indroda).
// Every site works in its own local frame: u = metres to the site's right, v = metres
// "forward" (rotated by yaw from the world). Geometry and collision use the same data.

export function frame(origin, yaw = 0) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return {
    origin, yaw,
    toWorld(u, v) { return { x: origin.x + u * c + v * s, z: origin.z - u * s + v * c }; },
    toLocal(x, z) { const dx = x - origin.x, dz = z - origin.z; return { u: dx * c - dz * s, v: dx * s + dz * c }; },
  };
}

// ---------- geometry helpers ----------
export function pointInPolygon(x, z, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
export function segDist(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1], l = dx * dx + dz * dz;
  const t = l ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l)) : 0;
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export function nearPolygon(x, z, pts, r) {
  if (pointInPolygon(x, z, pts)) return true;
  for (let i = 0; i < pts.length; i++) if (segDist(x, z, pts[i], pts[(i + 1) % pts.length]) < r) return true;
  return false;
}
export function centroid(pts) {
  return pts.reduce((a, p) => [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length], [0, 0]);
}
// Footprint of an OSM building (by id) converted into the site's local frame.
export function osmFootprint(map, id, f) {
  const b = map.buildings.find((x) => x.id === id);
  if (!b) return null;
  const ring = b.pts.slice(0, -1).map(([x, z]) => { const l = f.toLocal(x, z); return [l.u, l.v]; });
  return { ...b, ring };
}

// ---------- materials ----------
const mats = new Map();
export function mat(color, o = {}) {
  const key = (color?.isTexture ? color.uuid : color) + JSON.stringify(o, (k, v) => (v?.isTexture ? v.uuid : v));
  // Double-sided: three.js then lights each face from the side being viewed, so ribbons
  // (paths, hedges, curbs) look right whatever their triangle winding.
  if (!mats.has(key)) mats.set(key, color?.isTexture
    ? new THREE.MeshStandardMaterial({ map: color, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide, ...o })
    : new THREE.MeshStandardMaterial({ color, roughness: 0.8, metalness: 0.02, side: THREE.DoubleSide, ...o }));
  return mats.get(key);
}
export const allSiteMaterials = () => [...mats.values()];

export function canvasTex(w, h, draw, repeat = [1, 1]) {
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 8;
  t.repeat.set(...repeat);
  return t;
}

// ---------- primitives (all cast/receive shadows) ----------
function put(g, geo, m, x, y, z, ry = 0) {
  const mesh = new THREE.Mesh(geo, m.isMaterial ? m : mat(m));
  mesh.position.set(x, y, z); mesh.rotation.y = ry;
  mesh.castShadow = mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}
export const box = (g, w, h, d, m, x, y, z, ry = 0) => put(g, new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, ry);
export const cyl = (g, rt, rb, h, m, x, y, z, seg = 12) => put(g, new THREE.CylinderGeometry(rt, rb, h, seg), m, x, y + h / 2, z);
export const sphere = (g, r, m, x, y, z, seg = 10) => put(g, new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.7)), m, x, y, z);

// Flat polygon (lawn, paving, parking) at height y, world-scaled UVs.
export function slab(g, ring, y, m, thickness = 0, uvScale = 4) {
  const shape = new THREE.Shape(ring.map(([u, v]) => new THREE.Vector2(u, -v)));
  const geo = thickness > 0 ? new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false }) : new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / uvScale, uv.getY(i) / uvScale);
  const mesh = new THREE.Mesh(geo, m.isMaterial ? m : mat(m));
  mesh.position.y = y; mesh.receiveShadow = true;
  g.add(mesh);
  return mesh;
}

// Strip along a polyline (curbs, paths, medians). u across 0..1, v along per metre / tile.
export function strip(g, path, width, y, m, { offset = 0, height = 0, tile = 4 } = {}) {
  const pos = [], uv = [];
  let along = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const [x1, z1] = path[i], [x2, z2] = path[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.01) continue;
    const nx = -(z2 - z1) / len, nz = (x2 - x1) / len, w = width / 2;
    const ox = nx * offset, oz = nz * offset;
    const P = (x, z, s, t) => { pos.push(x + ox + nx * s, y + t, z + oz + nz * s); };
    const v0 = along / tile, v1 = (along + len) / tile;
    const quad = (s0, t0, s1, t1, u0, u1) => {
      P(x1, z1, s0, t0); P(x2, z2, s0, t0); P(x1, z1, s1, t1);
      P(x1, z1, s1, t1); P(x2, z2, s0, t0); P(x2, z2, s1, t1);
      uv.push(u0, v0, u0, v1, u1, v0, u1, v0, u0, v1, u1, v1);
    };
    quad(-w, height, w, height, 0, 1);
    if (height > 0) { quad(-w, 0, -w, height, 0, 0.2); quad(w, height, w, 0, 0.8, 1); }
    along += len;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, m.isMaterial ? m : mat(m, { side: THREE.DoubleSide }));
  mesh.receiveShadow = true; mesh.castShadow = height > 0.3;
  g.add(mesh);
  return mesh;
}

// Extrude a footprint into a building with a textured facade, roof slab and parapet.
// facade.tex repeats every facade.bay metres wide and facade.floor metres high.
export function building(g, ring, h, facade, { roof = 0xb9b4aa, parapet = 0.9, base = 0, parapetColor } = {}) {
  const pts = ring.map(([u, v]) => new THREE.Vector2(u, v));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  const pos = [], uv = [];
  let per = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], len = p.distanceTo(q);
    const u0 = per / facade.bay, u1 = (per + len) / facade.bay, top = h / facade.floor;
    pos.push(p.x, base, p.y, q.x, h, q.y, q.x, base, q.y, p.x, base, p.y, p.x, h, p.y, q.x, h, q.y);
    uv.push(u0, 0, u1, top, u1, 0, u0, 0, u0, top, u1, top);
    per += len;
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  walls.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  walls.computeVertexNormals();
  const wm = new THREE.Mesh(walls, mat(facade.tex, { roughness: facade.rough ?? 0.75, metalness: facade.metal ?? 0.02, side: THREE.DoubleSide }));
  wm.castShadow = wm.receiveShadow = true; wm.userData.cameraSolid = true;
  g.add(wm);
  const roofRing = pts.map((p) => [p.x, p.y]);
  slab(g, roofRing, h, roof, 0.25, 6).castShadow = true;
  if (parapet > 0) strip(g, [...roofRing, roofRing[0]], 0.3, h + 0.25, parapetColor ?? facade.parapet ?? 0xe8e4da, { height: parapet });
  return wm;
}

// ---------- facade textures ----------
// White plaster with continuous blue-tinted ribbon windows (KSV / LDRP campus).
export const ksvFacade = () => ({ bay: 6, floor: 3.6, parapet: 0xf3f1ea, tex: canvasTex(256, 256, (c, w, h) => {
  c.fillStyle = "#bec2bf"; c.fillRect(0, 0, w, h);
  const g = c.createLinearGradient(0, h * 0.3, 0, h * 0.72);
  g.addColorStop(0, "#5f8fc0"); g.addColorStop(1, "#2d5f93");
  c.fillStyle = g; c.fillRect(0, h * 0.3, w, h * 0.42);
  c.fillStyle = "rgba(255,255,255,0.35)"; c.fillRect(0, h * 0.3, w, 5);
  c.fillStyle = "#d9d6cd"; for (let x = 0; x < w; x += 64) c.fillRect(x, h * 0.3, 5, h * 0.42); // mullions
  // Road-side panorama: alternating glazed bays and recessed open windows,
  // set into grey concrete rather than a continuous white office facade.
  for(const x of [5,133]) {
    c.fillStyle='#bec2bf';c.fillRect(x,h*0.28,58,h*0.47);
    c.fillStyle='#404a49';c.fillRect(x+14,h*0.32,29,h*0.36);
    c.strokeStyle='#8a9693';c.lineWidth=2;c.strokeRect(x+15,h*0.33,27,h*0.34);
  }
  c.fillStyle = "rgba(0,0,0,0.12)"; c.fillRect(0, h * 0.72, w, 6); // sill shadow
  c.fillStyle = "#c9c5bb"; c.fillRect(0, 0, w, 4);
}) });
// Hostel / apartment blocks: cream plaster, punched windows, small balconies.
export const residentialFacade = (wall = "#e8dcc6", trim = "#c96f45") => ({ bay: 4, floor: 3.1, tex: canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = wall; c.fillRect(0, 0, w, h);
  c.fillStyle = "#f6f2ea"; c.fillRect(w * 0.18, h * 0.22, w * 0.64, h * 0.52);
  c.fillStyle = "#3d4d5e"; c.fillRect(w * 0.24, h * 0.28, w * 0.52, h * 0.4);
  c.fillStyle = trim; c.fillRect(w * 0.12, h * 0.76, w * 0.76, 6);
  c.fillStyle = "rgba(0,0,0,0.1)"; c.fillRect(0, h - 4, w, 4);
}) });
// Tall residential tower: beige with dark glass bands and balcony slabs (GIFT City).
export const towerResidential = (wall = "#d8cbb5") => ({ bay: 7, floor: 3.2, tex: canvasTex(256, 128, (c, w, h) => {
  c.fillStyle = wall; c.fillRect(0, 0, w, h);
  c.fillStyle = "#33424f"; c.fillRect(w * 0.08, h * 0.2, w * 0.5, h * 0.55);
  c.fillStyle = "#506577"; c.fillRect(w * 0.66, h * 0.2, w * 0.26, h * 0.55);
  c.fillStyle = "#f4efe5"; c.fillRect(0, h * 0.78, w, h * 0.12); // balcony slab
  c.fillStyle = "rgba(90,90,90,0.6)"; for (let x = 4; x < w; x += 10) c.fillRect(x, h * 0.62, 2, h * 0.16);
}) });
// Office curtain wall with vertical fins (Brigade / Pragya style).
export const glassFins = (glass = "#2f4f6c", fin = "#c9d2da") => ({ bay: 3, floor: 4, rough: 0.2, metal: 0.4, tex: canvasTex(128, 128, (c, w, h) => {
  const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, glass); g.addColorStop(1, "#5b7fa0");
  c.fillStyle = g; c.fillRect(0, 0, w, h);
  c.fillStyle = fin; c.fillRect(0, 0, 10, h); c.fillRect(0, h - 8, w, 8);
  c.fillStyle = "rgba(255,255,255,0.12)"; c.fillRect(14, 4, w - 20, 10);
}) });
// Hotel: cream stone with tall vertical window strips (Grand Mercure).
export const stoneHotel = () => ({ bay: 3.5, floor: 3.4, tex: canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = "#e6d5b8"; c.fillRect(0, 0, w, h);
  c.fillStyle = "#2f3a44"; c.fillRect(w * 0.3, 0, w * 0.4, h);
  c.fillStyle = "#d5c19f"; c.fillRect(w * 0.3, h * 0.47, w * 0.4, 8);
  c.fillStyle = "rgba(0,0,0,0.06)"; for (let y = 0; y < h; y += 32) c.fillRect(0, y, w, 2);
}) });

// ---------- props ----------
// Yellow/black painted curb, the standard Gujarat road edge.
export const curbTex = () => canvasTex(64, 16, (c, w, h) => { c.fillStyle = "#f2c230"; c.fillRect(0, 0, w / 2, h); c.fillStyle = "#1c1c1c"; c.fillRect(w / 2, 0, w / 2, h); });
// Green/white kerb stones (Indroda park roads).
export const parkCurbTex = () => canvasTex(64, 16, (c, w, h) => { c.fillStyle = "#2f8f4e"; c.fillRect(0, 0, w / 2, h); c.fillStyle = "#f2f2ea"; c.fillRect(w / 2, 0, w / 2, h); });
export const brickPaving = () => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = "#a8503a"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(60,25,15,0.45)"; c.lineWidth = 2;
  for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? 0 : 16; x < w; x += 32) c.strokeRect(x, y, 32, 16);
});
export const greyPavers = () => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = "#b9b3a8"; c.fillRect(0, 0, w, h);
  c.strokeStyle = "rgba(80,70,60,0.35)"; c.lineWidth = 2;
  for (let y = 0; y < h; y += 32) for (let x = (y / 32) % 2 ? 16 : 0; x < w; x += 32) c.strokeRect(x, y, 32, 32);
});
export const lawnTex = () => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = "#6f9a45"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) { c.fillStyle = Math.random() < 0.5 ? "#5f8a3a" : "#82ab55"; c.fillRect(Math.random() * w, Math.random() * h, 2, 3); }
});
export const dryGround = () => canvasTex(128, 128, (c, w, h) => {
  c.fillStyle = "#b8a07a"; c.fillRect(0, 0, w, h);
  for (let i = 0; i < 1200; i++) { c.fillStyle = ["#a38a64", "#c7b08a", "#8f7b57", "#9aa063"][i % 4]; c.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});

const leafColors = [0x4f7f34, 0x5b8c3c, 0x46722e, 0x6b9a45];
export function tree(g, x, z, k = 1, { color, dry = false } = {}) {
  cyl(g, 0.16 * k, 0.28 * k, 4.5 * k, 0x665442, x, 0, z, 9);
  const c = color ?? (dry ? [0x8a8a4a, 0x7a7f45, 0x99914f][Math.floor(Math.abs(x * 7 + z) % 3)] : leafColors[Math.floor(Math.abs(x * 3 + z * 7) % 4)]);
  for (const [dx, dy, dz, r] of [[0, 4.8, 0, 2.4], [1.1, 4.0, 0.7, 1.8], [-1.0, 4.2, -0.6, 1.9]]) {
    const a=new THREE.Vector3(x,2.7*k,z),b=new THREE.Vector3(x+dx*k,dy*k,z+dz*k),delta=b.clone().sub(a);
    const branch=new THREE.Mesh(new THREE.CylinderGeometry(0.06*k,0.11*k,delta.length(),7),mat(0x665442));branch.position.copy(a.add(b).multiplyScalar(0.5));branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());g.add(branch);
    for(let i=0;i<5;i++) {
      const leaf=put(g,new THREE.PlaneGeometry(r*2*k,r*1.65*k),mat(T.foliage(),{color:new THREE.Color(c).lerp(new THREE.Color(0xffffff),.62),alphaTest:0.42,side:THREE.DoubleSide,roughness:1}),x+dx*k,dy*k,z+dz*k,i*Math.PI/5);
      leaf.rotation.z=Math.sin(i+x)*0.18;
    }
  }
}
export function palm(g, x, z, k = 1) {
  const trunk = cyl(g, 0.17 * k, 0.24 * k, 7 * k, 0x8b7355, x, 0, z, 7);
  trunk.rotation.z = 0.04;
  const positions=[];
  for(let i=0;i<10;i++) {
    const a=i*Math.PI/5,dx=Math.cos(a),dz=Math.sin(a);
    const at=t=>[x+dx*t*3.8*k,7*k+Math.sin(t*Math.PI)*0.65*k-t*t*1.6*k,z+dz*t*3.8*k];
    for(let j=1;j<13;j++) {
      const t=j/13,p=at(t),prev=at(t-1/13),span=Math.sin(t*Math.PI)*0.72*k;
      for(const side of [-1,1])positions.push(...prev,...p,p[0]+dz*span*side-dx*0.16*k,p[1]-0.17*k,p[2]-dx*span*side-dz*0.16*k);
    }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();put(g,geo,mat(0x526f3b,{side:THREE.DoubleSide}),0,0,0);
}
export function hedge(g, path, width = 0.8, height = 0.9) {
  const material=mat(lawnTex(),{color:0x66844d,roughness:1});
  for(let i=1;i<path.length;i++) {
    const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    box(g,width,height,len,material,(a[0]+b[0])/2,0.12,(a[1]+b[1])/2,Math.atan2(dx,dz));
  }
}
export function flowerBed(g, ring) {
  slab(g, ring, 0.05, 0x5a3e28, 0.18, 2);
  const [cx, cz] = centroid(ring);
  const colors = [0xe0402f, 0xf2b84b, 0xd86a9c, 0xffffff, 0xff7a1a];
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.random();
    const x = cx + Math.cos(a) * r * 3, z = cz + Math.sin(a) * r * 2;
    if (pointInPolygon(x, z, ring)) sphere(g, 0.18, colors[i % 5], x, 0.38, z, 5);
  }
}
export function bench(g, x, z, yaw) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = yaw; g.add(b);
  box(b, 1.8, 0.08, 0.45, 0x7a5233, 0, 0.42, 0);
  box(b, 1.8, 0.4, 0.06, 0x7a5233, 0, 0.5, -0.2);
  for (const s of [-0.75, 0.75]) box(b, 0.08, 0.42, 0.4, 0x333333, s, 0, 0);
}
export function streetLight(g, x, z, yaw = 0, { double = false, h = 9 } = {}) {
  const l = new THREE.Group(); l.position.set(x, 0, z); l.rotation.y = yaw; g.add(l);
  cyl(l, 0.08, 0.14, h, 0x6d737a, 0, 0, 0, 8);
  for (const s of double ? [-1, 1] : [1]) {
    box(l, 0.08, 0.08, 1.6, 0x6d737a, 0, h - 0.1, 0.8 * s);
    const head = box(l, 0.35, 0.12, 0.7, mat(0xe8e8e8, { emissive: 0xffd9a0, emissiveIntensity: 0 }), 0, h - 0.25, 1.5 * s);
    head.userData.lamp = true;
  }
  return l;
}
export function flagPole(g, x, z, colors = ["#ff9933", "#ffffff", "#138808"]) {
  cyl(g, 0.05, 0.07, 9, 0xdddddd, x, 0, z, 8);
  const tex = canvasTex(96, 64, (c, w, h) => { colors.forEach((col, i) => { c.fillStyle = col; c.fillRect(0, (i * h) / 3, w, h / 3); }); if (colors.length === 3) { c.strokeStyle = "#000080"; c.lineWidth = 2; c.beginPath(); c.arc(w / 2, h / 2, 8, 0, 7); c.stroke(); } });
  const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.2, 8, 1), new THREE.MeshStandardMaterial({ map: tex, side: THREE.DoubleSide }));
  flag.position.set(x + 0.95, 8.3, z); flag.userData.flag = true;
  g.add(flag);
  return flag;
}
export function securityCabin(g, x, z, yaw = 0) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = yaw; g.add(c);
  box(c, 2.2, 2.6, 2.2, 0xe8e2d4, 0, 0, 0);
  box(c, 2.6, 0.15, 2.6, 0x7a2e2e, 0, 2.6, 0);
  box(c, 1.6, 0.9, 0.05, mat(0x5c84a8, { roughness: 0.2 }), 0, 1.1, 1.11);
}
export function boomBarrier(g, x, z, yaw = 0, len = 5) {
  const b = new THREE.Group(); b.position.set(x, 0, z); b.rotation.y = yaw; g.add(b);
  box(b, 0.4, 1, 0.4, 0xd8d0c0, 0, 0, 0);
  const tex = canvasTex(64, 8, (c, w, h) => { for (let i = 0; i < 8; i++) { c.fillStyle = i % 2 ? "#d42b2b" : "#ffffff"; c.fillRect((i * w) / 8, 0, w / 8, h); } });
  const arm = box(b, len, 0.1, 0.1, mat(tex), len / 2, 0.95, 0);
  return arm;
}
// A parked two-wheeler (Activa / Splendor silhouette).
export function scooter(g, x, z, yaw, color = 0x2f5e9e) {
  return parkedTwoWheeler(g,x,z,yaw,color);
}
// A parked car (simple but proportioned; real traffic uses vehicle-models.js).
export function parkedCar(g, x, z, yaw, color) {
  const c = new THREE.Group(); c.position.set(x, 0, z); c.rotation.y = yaw; g.add(c);
  box(c, 1.75, 0.7, 4.1, mat(color, { roughness: 0.35, metalness: 0.5 }), 0, 0.3, 0);
  box(c, 1.55, 0.55, 2.1, mat(0x24303a, { roughness: 0.15, metalness: 0.3 }), 0, 1.0, -0.2);
  for (const [dx, dz] of [[-0.8, 1.3], [0.8, 1.3], [-0.8, -1.3], [0.8, -1.3]]) cyl(c, 0.32, 0.32, 0.22, 0x151515, dx, 0.23, dz, 10).rotation.z = Math.PI / 2;
}
// Text sign (Gujarati + English welcome arches, shop fascias).
export function textPlane(g, lines, { bg = "#1d4e89", fg = "#ffffff", w = 1024, h = 256, font = "800 92px 'Baloo Bhai 2', Inter, sans-serif" }, pw, ph, x, y, z, ry = 0) {
  const tex = canvasTex(w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    c.fillStyle = fg; c.textAlign = "center"; c.textBaseline = "middle";
    lines.forEach((line, i) => { c.font = i ? font.replace(/\d+px/, (m) => Math.round(parseInt(m) * 0.55) + "px") : font; c.fillText(line, w / 2, (h / (lines.length + 1)) * (i + 1), w - 30); });
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true }));
  mesh.position.set(x, y, z); mesh.rotation.y = ry;
  g.add(mesh);
  return mesh;
}

// Compound wall with gate gaps: masonry pillars, low plinth, metal railings.
// Returns the wall segments (local coords) for collision.
export function compoundWall(g, ring, gates = [], { height = 1.9, railing = true } = {}) {
  const segs = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i], b = ring[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const dirx = (b[0] - a[0]) / len, dirz = (b[1] - a[1]) / len;
    // Split around gates lying on this edge.
    let cuts = [[0, len]];
    for (const gt of gates) {
      if (segDist(gt.u, gt.v, a, b) > 3) continue;
      const t = (gt.u - a[0]) * dirx + (gt.v - a[1]) * dirz;
      cuts = cuts.flatMap(([s, e]) => (t + gt.width / 2 < s || t - gt.width / 2 > e) ? [[s, e]] : [[s, t - gt.width / 2], [t + gt.width / 2, e]].filter(([p, q]) => q - p > 0.3));
    }
    for (const [s, e] of cuts) {
      const p = [a[0] + dirx * s, a[1] + dirz * s], q = [a[0] + dirx * e, a[1] + dirz * e];
      segs.push([p, q]);
      strip(g, [p, q], 0.3, 0, 0xd4cdbd, { height: 0.55 });
      if (railing) {
        strip(g, [p, q], 0.06, 0.55, 0x3a3f44, { height: 0.04 });
        strip(g, [p, q], 0.06, height - 0.1, 0x3a3f44, { height: 0.06 });
      } else strip(g, [p, q], 0.25, 0.55, 0xe2dccd, { height: height - 0.55 });
      const L = e - s;
      for (let d = 0; d <= L; d += 3) {
        const x = p[0] + dirx * d, z = p[1] + dirz * d;
        box(g, 0.45, height + 0.1, 0.45, 0xcfc6b2, x, 0, z);
        if (railing && d + 3 <= L) for (let k = 0.3; k < 3; k += 0.3) box(g, 0.03, height - 0.6, 0.03, 0x3a3f44, x + dirx * k, 0.55, z + dirz * k);
      }
    }
  }
  return segs;
}

// Merge every mesh in a group that shares a material, to keep draw calls low.
export function mergeStatic(g) {
  const byMat = new Map();
  g.updateMatrixWorld(true);
  const keep = [];
  g.traverse((o) => {
    if(o.userData.parking){keep.push(o);return;}
    if (!o.isMesh || o.userData.flag || o.userData.lamp || o.userData.keep || o.material.isMeshBasicMaterial) { if (o.isMesh) keep.push(o); return; }
    const geo = o.geometry.clone();
    // Quantized GLBs store normalized integers. Convert before world transforms
    // so translations do not clamp their vertices into the integer [-1,1] range.
    for(const [name,attr] of Object.entries(geo.attributes))if(attr.normalized||attr.isInterleavedBufferAttribute){const data=new Float32Array(attr.count*attr.itemSize);for(let i=0;i<attr.count;i++)for(let j=0;j<attr.itemSize;j++)data[i*attr.itemSize+j]=attr.getComponent(i,j);geo.setAttribute(name,new THREE.BufferAttribute(data,attr.itemSize));}
    geo.applyMatrix4(o.matrixWorld);
    if (geo.index) { const ni = geo.toNonIndexed(); geo.dispose(); byMat.has(o.material) || byMat.set(o.material, []); byMat.get(o.material).push(ni); }
    else { byMat.has(o.material) || byMat.set(o.material, []); byMat.get(o.material).push(geo); }
  });
  const out = new THREE.Group();
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert();
  for (const [m, geos] of byMat) {
    const clean = geos.map((x) => { for (const k of Object.keys(x.attributes)) if (!["position", "normal", "uv"].includes(k)) x.deleteAttribute(k); if (!x.attributes.uv) x.setAttribute("uv", new THREE.Float32BufferAttribute(new Float32Array(x.attributes.position.count * 2), 2)); if (!x.attributes.normal) x.computeVertexNormals(); return x; });
    const merged = BGU.mergeGeometries(clean, false);
    if (!merged) continue;
    merged.applyMatrix4(inv);
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = mesh.receiveShadow = true;
    mesh.userData.cameraSolid = true;
    out.add(mesh);
  }
  // Kept meshes (lamps, flags, signs) may sit inside nested groups: re-express their
  // transform relative to the site group before re-parenting them.
  for (const k of keep) {
    const rel = new THREE.Matrix4().multiplyMatrices(inv, k.matrixWorld);
    rel.decompose(k.position, k.quaternion, k.scale);
    k.removeFromParent();
  }
  g.clear();
  g.add(out, ...keep);
  return g;
}

// ---------- navigation zone ----------
// area: local polygon the site owns. solids: [{poly}|{circle:[u,v,r]}|{rect:[u,v,w,d,yaw]}]
// walls: [[a,b]] segments. vehicleFree: polygons where cars may never be.
export function createSiteZone({ id, f, area, solids = [], walls = [], vehicleFree = [], groundY = 0, replaceRoads = false, walkable = null }) {
  const blocked = (u, v, r) => {
    // Optional: inside the site only these corridors/clearings are walkable (forest parks).
    if (walkable && !walkable(u, v, r)) return true;
    for (const s of solids) {
      if (s.poly && nearPolygon(u, v, s.poly, r)) return true;
      if (s.circle && Math.hypot(u - s.circle[0], v - s.circle[1]) < s.circle[2] + r) return true;
      if (s.rect) {
        const [cu, cv, w, d, yaw = 0] = s.rect, c = Math.cos(yaw), sn = Math.sin(yaw);
        const du = u - cu, dv = v - cv;
        if (Math.abs(du * c - dv * sn) < w / 2 + r && Math.abs(du * sn + dv * c) < d / 2 + r) return true;
      }
    }
    for (const [a, b] of walls) if (segDist(u, v, a, b) < 0.25 + r) return true;
    return false;
  };
  const worldArea = area.map(([u, v]) => f.toWorld(u, v));
  const bounds = { minX: Math.min(...worldArea.map((p) => p.x)), maxX: Math.max(...worldArea.map((p) => p.x)), minZ: Math.min(...worldArea.map((p) => p.z)), maxZ: Math.max(...worldArea.map((p) => p.z)) };
  return {
    id,
    contains(x, z) { const { u, v } = f.toLocal(x, z); return pointInPolygon(u, v, area); },
    heights(x, z, radius = 0.38) { const { u, v } = f.toLocal(x, z); return blocked(u, v, radius) ? [] : [typeof groundY==='function'?groundY(u,v):groundY]; },
    forbidsVehicles(x, z, margin = 0) { const { u, v } = f.toLocal(x, z); return vehicleFree.some((p) => nearPolygon(u, v, p, margin)); },
    roadHeight() { return null; },
    clearing: {
      roadBounds: replaceRoads ? bounds : undefined,
      contains(x, z) { const { u, v } = f.toLocal(x, z); return pointInPolygon(u, v, area); },
      replacesRoad: replaceRoads ? (x, z) => { const { u, v } = f.toLocal(x, z); return pointInPolygon(u, v, area); } : undefined,
    },
    blocked,
  };
}
