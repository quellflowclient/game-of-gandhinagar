import * as THREE from "three";
import * as BGU from "three/examples/jsm/utils/BufferGeometryUtils.js";
import * as T from "./textures.js";
import {createSidewalks} from './sidewalks.js';
import {offsetPath} from './road-path.js';
import {roadClearance} from './metro-road-clearance.js';

// Realistic OpenStreetMap city, split into 500 m chunks so off-screen parts are culled
// (for both the main view and shadows). Buildings get real facade textures chosen by
// building type; roads get asphalt with lane markings and paved footpaths; water reflects
// the sky; trees, street lights and night windows bring it to life.

const CHUNK = 500;
const ROAD = {
  motorway: [26, 4], trunk: [22, 4], primary: [18, 4], secondary: [13, 2], tertiary: [10, 2],
  residential: [7, 0], unclassified: [7, 0], living_street: [6, 0], service: [5, 0], pedestrian: [6, -1],
  footway: [2.5, -2], path: [2, -2], cycleway: [3, -3],
};
const MAJOR = new Set(["motorway", "trunk", "primary", "secondary", "tertiary"]);
const STYLE_SLOTS = ["plaster", "peach", "brick", "govt", "glass", "white"]; // 2 x 3 atlas

export async function loadMap() {
  return fetch("/data/gandhinagar-map.json").then((r) => r.json());
}

const key = (x, z) => `${Math.floor(x / CHUNK)},${Math.floor(z / CHUNK)}`;
function bucket(map, k) { if (!map.has(k)) map.set(k, []); return map.get(k); }

function ringToVec2(ring) {
  const pts = ring.map(([x, z]) => new THREE.Vector2(x, z));
  if (THREE.ShapeUtils.isClockWise(pts)) pts.reverse();
  return pts;
}

function pointInRing(x, z, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, zi] = ring[i], [xj, zj] = ring[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Flat polygon with world-space UVs (uvScale metres per texture tile).
function polygonGeo(ring, y, uvScale) {
  const pts = ringToVec2(ring);
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(pts, []); } catch { return null; }
  const pos = [], uv = [];
  for (const [a, b, c] of tris) for (const i of [a, c, b]) { pos.push(pts[i].x, y, pts[i].y); uv.push(pts[i].x / uvScale, pts[i].y / uvScale); }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Ribbon along a polyline. u across (0..1), v along (metres / tileLen).
function ribbonGeo(pts, width, y, tileLen, offset = 0) {
  const pos = [], uv = [];
  const left=offsetPath(pts,offset+width/2),right=offsetPath(pts,offset-width/2);
  let along = 0;
  const w = width / 2;
  for (let i = 0; i < pts.length - 1; i++) {
    const [x1, z1] = pts[i], [x2, z2] = pts[i + 1];
    const dx = x2 - x1, dz = z2 - z1, len = Math.hypot(dx, dz);
    if (len < 0.01) continue;
    const nx = -dz / len, nz = dx / len;
    const ox = nx * offset, oz = nz * offset;
    const a = [left[i][0],y,left[i][1]], b = [right[i][0],y,right[i][1]];
    const c = [left[i+1][0],y,left[i+1][1]], d = [right[i+1][0],y,right[i+1][1]];
    const v0 = along / tileLen, v1 = (along + len) / tileLen;
    pos.push(...a, ...c, ...b, ...b, ...c, ...d);
    uv.push(0, v0, 0, v1, 1, v0, 1, v0, 0, v1, 1, v1);
    along += len;
  }
  if (!pos.length) return null;
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  g.computeVertexNormals();
  return g;
}

// Building walls + roof. Walls carry an aTile attribute: which facade in the atlas.
function buildingGeo(ring, h, slot) {
  const pts = ringToVec2(ring);
  let tris;
  try { tris = THREE.ShapeUtils.triangulateShape(pts, []); } catch { return null; }
  const roofPos = [], roofUv = [];
  for (const [a, b, c] of tris) for (const i of [a, c, b]) { roofPos.push(pts[i].x, h, pts[i].y); roofUv.push(pts[i].x / 18, pts[i].y / 18); }
  const pos = [], uv = [], tile = [];
  const tx = (slot % 2) * 0.5, ty = Math.floor(slot / 2) / 3;
  let per = 0;
  const vTop = h / 25.6;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length];
    const len = p.distanceTo(q);
    const u0 = per / 32, u1 = (per + len) / 32;
    pos.push(p.x, 0, p.y, q.x, h, q.y, q.x, 0, q.y, p.x, 0, p.y, p.x, h, p.y, q.x, h, q.y);
    uv.push(u0, 0, u1, vTop, u1, 0, u0, 0, u0, vTop, u1, vTop);
    for (let k = 0; k < 6; k++) tile.push(tx, ty);
    per += len;
  }
  const walls = new THREE.BufferGeometry();
  walls.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  walls.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  walls.setAttribute("aTile", new THREE.Float32BufferAttribute(tile, 2));
  walls.computeVertexNormals();
  const roof = new THREE.BufferGeometry();
  roof.setAttribute("position", new THREE.Float32BufferAttribute(roofPos, 3));
  roof.setAttribute("uv", new THREE.Float32BufferAttribute(roofUv, 2));
  roof.computeVertexNormals();
  return { walls, roof };
}

// One atlas (2 x 3 facades) so every building in a chunk is a single draw call.
function facadeAtlas() {
  const W = 1024, H = 1536;
  const mk = () => { const c = document.createElement("canvas"); c.width = W; c.height = H; return c; };
  const base = mk(), em = mk();
  STYLE_SLOTS.forEach((s, i) => {
    const f = T.facade(s);
    const x = (i % 2) * 512, y = Math.floor(i / 2) * 512;
    base.getContext("2d").drawImage(f.map.image, x, H - y - 512);
    em.getContext("2d").drawImage(f.emissive.image, x, H - y - 512);
  });
  const tex = (c) => {
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    return t;
  };
  return { map: tex(base), emissive: tex(em) };
}

function facadeMaterial() {
  const atlas = facadeAtlas();
  const m = new THREE.MeshStandardMaterial({ map: atlas.map, emissiveMap: atlas.emissive, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.82, metalness: 0.02 });
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader
      .replace("#include <common>", "#include <common>\nattribute vec2 aTile;\nvarying vec2 vTile;")
      .replace("#include <uv_vertex>", "#include <uv_vertex>\nvTile = aTile;");
    const sample = (tex, uv) => `textureGrad(${tex}, vTile + fract(${uv}) * vec2(0.5, 1.0/3.0), dFdx(${uv}) * vec2(0.5, 1.0/3.0), dFdy(${uv}) * vec2(0.5, 1.0/3.0))`;
    sh.fragmentShader = sh.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying vec2 vTile;")
      .replace("#include <map_fragment>", `vec4 sampledDiffuseColor = ${sample("map", "vMapUv")};\ndiffuseColor *= sampledDiffuseColor;`)
      .replace("#include <emissivemap_fragment>", `vec4 emissiveColor = ${sample("emissiveMap", "vEmissiveMapUv")};\ntotalEmissiveRadiance *= emissiveColor.rgb;`);
  };
  return m;
}

function pickStyle(kind, h, r) {
  if (h > 24 || kind === "commercial" || kind === "office") return r < 0.7 ? 4 : 5;
  if (["government", "public", "civic"].includes(kind)) return 3;
  if (["school", "university", "college", "hospital"].includes(kind)) return r < 0.5 ? 2 : 3;
  if (["house", "residential", "apartments", "detached", "terrace"].includes(kind)) return [0, 1, 5, 3][Math.floor(r * 4)];
  return [0, 1, 3, 5, 2, 0][Math.floor(r * 6)];
}

// Tree: trunk plus three crown blobs, merged.
function treeGeometry() {
  const trunk=new THREE.CylinderGeometry(.22,.38,3.2,9);trunk.translate(0,1.6,0);const wood=[trunk.toNonIndexed()],leaves=[];
  for(const [x,y,z,r] of [[0,4.8,0,2.4],[1.1,4.0,.4,1.7],[-.9,4.2,-.5,1.8]]){
    const a=new THREE.Vector3(0,2.6,0),b=new THREE.Vector3(x,y,z),d=b.clone().sub(a),branch=new THREE.CylinderGeometry(.06,.11,d.length(),7);branch.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));const mid=a.add(b).multiplyScalar(.5);branch.translate(mid.x,mid.y,mid.z);wood.push(branch.toNonIndexed());
    for(let i=0;i<5;i++){const leaf=new THREE.PlaneGeometry(r*2,r*1.65);leaf.rotateY(i*Math.PI/5);leaf.translate(x,y,z);leaves.push(leaf.toNonIndexed());}
  }
  return{wood:BGU.mergeGeometries(wood),leaves:BGU.mergeGeometries(leaves)};
}

function streetLightGeometry() {
  const pole = new THREE.CylinderGeometry(0.08, 0.12, 8, 6); pole.translate(0, 4, 0);
  const arm = new THREE.BoxGeometry(0.1, 0.1, 1.8); arm.translate(0, 7.9, -0.9);
  return BGU.mergeGeometries([pole.toNonIndexed(), arm.toNonIndexed()]);
}

export async function buildCity(scene, clearings = [], mapIn, { lowEnd = false } = {}) {
  const map = mapIn || (await loadMap());
  const group = new THREE.Group();
  scene.add(group);
  const rand = mulberry(42);
  const onClearing = (c, x, z, scale = 1) => c.contains ? c.contains(x, z) : (x-c.x)**2 + (z-c.z)**2 < (c.r*scale)**2;

  // ---------- materials ----------
  const grassTex = T.grass(); grassTex.repeat.set(1, 1);
  const groundMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, color: 0x9a9a80 });
  const parkMat = new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1, color: 0xb4c09a });
  const roadMats = {
    4: new THREE.MeshStandardMaterial({ map: T.asphalt(4), roughness: 0.92 }),
    2: new THREE.MeshStandardMaterial({ map: T.asphalt(2), roughness: 0.92 }),
    0: new THREE.MeshStandardMaterial({ map: T.asphalt(0), roughness: 0.95 }),
    [-1]: new THREE.MeshStandardMaterial({ map: T.pavers(), roughness: 0.9 }),
    [-2]: new THREE.MeshStandardMaterial({ map: T.groundDirt(), roughness: 1 }),
    [-3]: new THREE.MeshStandardMaterial({ map: T.asphalt(0), color: 0xb86a55, roughness: 0.9 }),
  };
  const walkMat = new THREE.MeshStandardMaterial({ map: T.pavers(), roughness: 0.9 });
  const wallMat = facadeMaterial();
  const roofMat = new THREE.MeshStandardMaterial({ map: T.roofConcrete(), roughness: 0.95 });
  const waterN = T.waterNormals();
  waterN.repeat.set(1, 1);
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x2f5f6e, roughness: 0.06, metalness: 0.1, normalMap: waterN, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4 });

  // ---------- ground ----------
  const groundGeo = new THREE.PlaneGeometry(14000, 14000);
  groundGeo.rotateX(-Math.PI / 2);
  const uvs = groundGeo.attributes.uv;
  for (let i = 0; i < uvs.count; i++) uvs.setXY(i, uvs.getX(i) * 14000 / 40, uvs.getY(i) * 14000 / 40);
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.position.y = -0.05;
  ground.receiveShadow = true;
  group.add(ground);

  // ---------- collect geometry per chunk ----------
  const chunks = new Map(); // key -> { parks:[], water:[], roads:{cls:[]}, walks:[], walls:[], roofs:[] }
  const C = (k) => { if (!chunks.has(k)) chunks.set(k, { parks: [], water: [], roads: {}, walks: [], walls: [], roofs: [] }); return chunks.get(k); };

  for (const p of map.parks) {
    if (p.pts.length < 4) continue;
    const g = polygonGeo(p.pts.slice(0, -1), 0.06, 30);
    if (g) C(key(p.pts[0][0], p.pts[0][1])).parks.push(g);
  }
  for (const w of map.water) {
    const g = w.closed && w.pts.length > 3 ? polygonGeo(w.pts.slice(0, -1), 0.12, 60) : ribbonGeo(w.pts, 110, 0.12, 60);
    if (!g) continue;
    // Water UVs in world space for the ripple map.
    const pos = g.attributes.position, uv = g.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 40, pos.getZ(i) / 40);
    C(key(w.pts[0][0], w.pts[0][1])).water.push(g);
  }
  // Authored compounds and KH Road have their own paving. Do not draw old OSM
  // ribbons through lawns, or leave a slab above a still-rendered city road.
  const replaced=(x,z)=>clearings.some(c=>c.replacesRoad?.(x,z));
  const replacementBounds=clearings.filter(c=>c.replacesRoad&&c.roadBounds).map(c=>c.roadBounds);
  const renderRoads=[];
  for(const r of map.roads) {
    let run=[];
    const flush=()=>{if(run.length>1)renderRoads.push({...r,pts:run});run=[];};
    for(let i=1;i<r.pts.length;i++) {
      const a=r.pts[i-1],b=r.pts[i];
      if(!replacementBounds.some(q=>Math.max(a[0],b[0])>=q.minX&&Math.min(a[0],b[0])<=q.maxX&&Math.max(a[1],b[1])>=q.minZ&&Math.min(a[1],b[1])<=q.maxZ)){
        if(!run.length)run.push(a);run.push(b);continue;
      }
      const n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/4));
      for(let j=0;j<n;j++) {
        const p=[a[0]+(b[0]-a[0])*j/n,a[1]+(b[1]-a[1])*j/n],q=[a[0]+(b[0]-a[0])*(j+1)/n,a[1]+(b[1]-a[1])*(j+1)/n];
        if(replaced((p[0]+q[0])/2,(p[1]+q[1])/2))flush();
        else {if(!run.length)run.push(p);run.push(q);}
      }
    }
    flush();
  }
  const sorted = renderRoads.sort((a, b) => (ROAD[a.kind]?.[0] || 6) - (ROAD[b.kind]?.[0] || 6));
  const sidewalk=createSidewalks(sorted,Object.fromEntries(Object.entries(ROAD).map(([kind,[width]])=>[kind,width])));
  const lightSpots = new Map();
  const roadClearanceForLights=roadClearance(map);
  for (const r of sorted) {
    const [defaultWidth, cls] = ROAD[r.kind] || [6, 0];
    const width=r.width||defaultWidth;
    const y = 0.2 + width * 0.004;
    // Split long roads by chunk so culling works.
    let seg = [r.pts[0]], k0 = key(r.pts[0][0], r.pts[0][1]);
    const flush = () => {
      if (seg.length < 2) return;
      const g = ribbonGeo(seg, width, y, 8);
      if (g) (C(k0).roads[cls] ||= []).push(g);
      if (MAJOR.has(r.kind)) {
        for (const side of r.sidewalkSides||[-1, 1])for(const points of sidewalk.sections(r,seg,side)){const s=ribbonGeo(points,2.6,y+.1,4);if(s)C(k0).walks.push(s);}
      }
    };
    for (let i = 1; i < r.pts.length; i++) {
      seg.push(r.pts[i]);
      const k = key(r.pts[i][0], r.pts[i][1]);
      if (k !== k0 || seg.length > 40) { flush(); seg = [r.pts[i]]; k0 = k; }
    }
    flush();
    // Street lights along major roads every ~35 m.
    if (MAJOR.has(r.kind) && !lowEnd && r.id!==386749312) {
      let acc = 0;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const [x1, z1] = r.pts[i], [x2, z2] = r.pts[i + 1];
        const len = Math.hypot(x2 - x1, z2 - z1);
        const nx = -(z2 - z1) / (len || 1), nz = (x2 - x1) / (len || 1);
        for (let d = (35 - acc) % 35; d < len; d += 35) {
          const t = d / len, x = x1 + (x2 - x1) * t + nx * (width / 2 + 0.6), z = z1 + (z2 - z1) * t + nz * (width / 2 + 0.6);
          if(roadClearanceForLights(x,z,.35))bucket(lightSpots, key(x, z)).push([x, z, Math.atan2(nx, nz)]); // arm points over the road
        }
        acc = (acc + len) % 35;
      }
    }
  }

  // Buildings.
  let skipped = 0;
  map.buildings.forEach((b) => {
    const ring = b.pts.slice(0, -1);
    if (ring.length < 3) return;
    const [x0, z0] = ring[0];
    if (clearings.some((c) => ring.some(([x,z]) => onClearing(c,x,z)))) { skipped++; return; }
    const h = Math.max(3.4, b.h);
    const geo = buildingGeo(ring, h, pickStyle(b.kind, h, rand()));
    if (!geo) return;
    const ch = C(key(x0, z0));
    ch.walls.push(geo.walls); ch.roofs.push(geo.roof);
  });

  // ---------- trees ----------
  const lakes = map.water.filter((w) => w.closed && w.pts.length > 3).map((w) => {
    const ring = w.pts.slice(0, -1);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    return { ring, minX, maxX, minZ, maxZ };
  });
  const inLake = (x, z) => lakes.some((l) => x > l.minX && x < l.maxX && z > l.minZ && z < l.maxZ && pointInRing(x, z, l.ring));
  const onSite = (x, z) => clearings.some((c) => onClearing(c, x, z, 0.9));
  // Coarse 5 m grid of every cell a road (plus footpath) covers, so trees stay off roads,
  // including the other half of divided carriageways.
  const G = 5, roadCells = new Set();
  const cell = (x, z) => Math.floor(x / G) * 100003 + Math.floor(z / G);
  for (const r of map.roads) {
    const half = (ROAD[r.kind]?.[0] || 6) / 2 + (MAJOR.has(r.kind) ? 2.6 : 0.5);
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i], [x2, z2] = r.pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1) || 1;
      const nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
      for (let d = 0; d <= len; d += G * 0.8) for (let o = -half; o <= half; o += G * 0.8) {
        const t = d / len;
        roadCells.add(cell(x1 + (x2 - x1) * t + nx * o, z1 + (z2 - z1) * t + nz * o));
      }
    }
  }
  const treeSpots = new Map();
  const offAsphalt=roadClearance(map);
  const addTree = (x, z) => { if (offAsphalt(x,z,.7) && !roadCells.has(cell(x, z)) && !inLake(x, z) && !onSite(x, z)) bucket(treeSpots, key(x, z)).push([x, z]); };
  for (const p of map.parks) {
    const ring = p.pts.slice(0, -1);
    if (ring.length < 3) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of ring) { minX = Math.min(minX, x); maxX = Math.max(maxX, x); minZ = Math.min(minZ, z); maxZ = Math.max(maxZ, z); }
    const n = Math.min(lowEnd ? 50 : 110, Math.floor(((maxX - minX) * (maxZ - minZ)) / 900));
    for (let i = 0; i < n; i++) {
      const x = minX + rand() * (maxX - minX), z = minZ + rand() * (maxZ - minZ);
      if (pointInRing(x, z, ring)) addTree(x, z);
    }
  }
  for (const r of map.roads) {
    if (!["tertiary", "residential", "secondary", "primary", "trunk"].includes(r.kind)) continue;
    const off = (r.width || ROAD[r.kind]?.[0] || 8) / 2 + (MAJOR.has(r.kind) ? 4.5 : 3);
    for (let i = 0; i < r.pts.length - 1; i++) {
      const [x1, z1] = r.pts[i], [x2, z2] = r.pts[i + 1];
      const len = Math.hypot(x2 - x1, z2 - z1);
      for (let d = 0; d < len; d += lowEnd ? 44 : 30) {
        if (rand() < 0.3) continue;
        const t = d / len, x = x1 + (x2 - x1) * t, z = z1 + (z2 - z1) * t;
        const nx = -(z2 - z1) / len, nz = (x2 - x1) / len, side = rand() < 0.5 ? 1 : -1;
        addTree(x + nx * off * side, z + nz * off * side);
      }
    }
  }

  // ---------- emit meshes per chunk ----------
  const treeGeo = treeGeometry();
  const treeMat = new THREE.MeshStandardMaterial({color:0x6f5a42,roughness:1});
  const leafMat = new THREE.MeshStandardMaterial({map:T.foliage(),color:0xc2c8b1,alphaTest:.4,side:THREE.DoubleSide,roughness:1});
  const lightGeo = streetLightGeometry();
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x5a5f66, roughness: 0.5, metalness: 0.6 });
  const lampGeo = new THREE.BoxGeometry(0.5, 0.18, 0.9); lampGeo.translate(0, 7.8, -1.7);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, emissive: 0xffd9a0, emissiveIntensity: 0 });
  // Warm pool of light on the road under each lamp (additive decal, night only).
  const poolCanvas = document.createElement("canvas"); poolCanvas.width = poolCanvas.height = 128;
  const pc = poolCanvas.getContext("2d"), grad = pc.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,210,150,0.85)"); grad.addColorStop(0.45, "rgba(255,190,120,0.35)"); grad.addColorStop(1, "rgba(255,180,110,0)");
  pc.fillStyle = grad; pc.fillRect(0, 0, 128, 128);
  const poolMat = new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(poolCanvas), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: true });
  poolMat.visible = false;
  const poolGeo = new THREE.PlaneGeometry(16, 16); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(0, 0.45, -2.6);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(), v = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const merge = (arr) => (arr.length ? BGU.mergeGeometries(arr, false) : null);
  const addMesh = (geo, mat, cast, receive) => {
    if (!geo) return;
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast; m.receiveShadow = receive;
    group.add(m);
  };
  let treeCount = 0;
  for (const [k, ch] of chunks) {
    addMesh(merge(ch.parks), parkMat, false, true);
    addMesh(merge(ch.water), waterMat, false, false);
    for (const [cls, arr] of Object.entries(ch.roads)) addMesh(merge(arr), roadMats[cls], false, true);
    addMesh(merge(ch.walks), walkMat, false, true);
    addMesh(merge(ch.walls), wallMat, true, true);
    addMesh(merge(ch.roofs), roofMat, true, true);
    for (const g of [...ch.parks, ...ch.water, ...ch.walks, ...ch.walls, ...ch.roofs, ...Object.values(ch.roads).flat()]) g.dispose();
  }
  const allKeys = new Set([...treeSpots.keys(), ...lightSpots.keys()]);
  for (const k of allKeys) {
    const spots = treeSpots.get(k) || [];
    if (spots.length) {
      const inst = new THREE.InstancedMesh(treeGeo.wood, treeMat, spots.length),crown=new THREE.InstancedMesh(treeGeo.leaves,leafMat,spots.length);
      spots.forEach(([x, z], i) => {
        const s = 0.8 + rand() * 0.7;
        q.setFromAxisAngle(up, rand() * Math.PI * 2);
        inst.setMatrixAt(i, m4.compose(v.set(x, 0, z), q, sc.set(s, s * (0.9 + rand() * 0.3), s)));
        crown.setMatrixAt(i,m4);
        inst.setColorAt(i, tint.setHSL(0.24 + rand() * 0.06, 0.25 + rand() * 0.2, 0.75 + rand() * 0.25));
      });
      inst.castShadow = true; inst.receiveShadow = true;
      crown.castShadow=true;crown.receiveShadow=true;crown.computeBoundingSphere();group.add(crown);
      inst.computeBoundingSphere();
      group.add(inst);
      treeCount += spots.length;
    }
    const ls = lightSpots.get(k) || [];
    if (ls.length) {
      const poles = new THREE.InstancedMesh(lightGeo, lightMat, ls.length);
      const lamps = new THREE.InstancedMesh(lampGeo, lampMat, ls.length);
      const pools = new THREE.InstancedMesh(poolGeo, poolMat, ls.length);
      ls.forEach(([x, z, a], i) => {
        q.setFromAxisAngle(up, a);
        m4.compose(v.set(x, 0, z), q, sc.set(1, 1, 1));
        poles.setMatrixAt(i, m4); lamps.setMatrixAt(i, m4); pools.setMatrixAt(i, m4);
      });
      poles.computeBoundingSphere(); lamps.computeBoundingSphere(); pools.computeBoundingSphere();
      poles.castShadow = true;
      group.add(poles, lamps, pools);
    }
  }

  return {
    map,
    group,
    counts: { roads: map.roads.length, buildings: map.buildings.length - skipped, trees: treeCount, chunks: chunks.size },
    setNight(night, dusk) {
      wallMat.emissiveIntensity = night ? 1.1 : dusk ? 0.35 : 0;
      lampMat.emissiveIntensity = night ? 3 : dusk ? 1 : 0;
      poolMat.visible = night || dusk;
      poolMat.opacity = night ? 1 : 0.5;
    },
    update(t) {
      waterN.offset.set(t * 0.01, t * 0.006);
    },
  };
}
