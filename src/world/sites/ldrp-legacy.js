import * as THREE from "three";
import * as K from "./kit.js";
import {buildLdrpMarket} from './ldrp-market.js';
import {ldrpCyclePaths} from './ldrp-paths.js';
import {applyRoad5Profile} from './ldrp-market-layout.js';
import {asphalt} from '../textures.js';

// LDRP-ITR inside the Kadi Sarva Vishwavidyalaya (KSV) campus, Sector 15.
// Sources: Google Maps satellite (Nov 2026), KSV/LDRP campus photographs, and OSM
// footprints 1330899548 (KSV arc), 1330899549, 1330899550, 1330899553 (LDRP block),
// 1330899554 and staff quarters 1330899551/552/555-558. Road No. 5 (OSM 326054220 /
// 386749311) runs along the north-east, KH Road along the west, and the metro viaduct
// curves between them past the campus. Local frame = world axes around the LDRP pin.
export const LDRP = {
  pin: { lat: 23.2389922, lon: 72.6390652 },
  // Compound boundary: inside the Road 5 carriageway (NE), KH Road (W) and the Sector 15
  // street (S). The south-west part is the campus's open ground.
  area: [[-108, -126], [-32, -92], [85, -24], [174, 28], [150, 90], [57, 110], [27, 93], [-24, 76], [-58, 140], [-200, 118], [-172, -32]],
  gardenCentre: [-28, -60],
  gardenRadius: 44,
  hub: [-28, -80],
  gates: [
    { u: -25, v: -87.93, width: 9, name: "Shared entry / exit (Road No. 5)", main: true },
  ],
  university: [1330899548, 1330899549, 1330899550, 1330899553, 1330899554],
  quarters: [1330899551, 1330899552, 1330899555, 1330899556, 1330899557, 1330899558],
};

export function buildLdrp(scene, map, origin) {
  applyRoad5Profile(map);
  const f = K.frame(origin, 0);
  const g = new THREE.Group(); g.position.set(origin.x, 0, origin.z); scene.add(g);
  const solids = [], trees = [], animated = [];
  const cyclePaths=ldrpCyclePaths(LDRP,map,f);
  g.name='LDRP campus exterior';

  // ---------- ground: open ground, garden lawn, paving ----------
  K.slab(g, LDRP.area, 0.03, K.mat(K.dryGround(), { roughness: 1 }), 0, 6);
  const [gu, gv] = LDRP.gardenCentre;
  const disc = (r, n = 48, a0 = 0, a1 = Math.PI * 2) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + ((a1 - a0) * i) / n; return [gu + Math.cos(a) * r, gv + Math.sin(a) * r]; });
  K.slab(g, disc(LDRP.gardenRadius + 6), 0.06, K.mat(K.greyPavers(), { roughness: 0.9 }), 0, 3);   // ring walk along the arc
  K.slab(g, disc(LDRP.gardenRadius), 0.09, K.mat(K.lawnTex(), { roughness: 1 }), 0, 5);
  // Radial red-brick paths from the gate hub, as seen from above.
  const brick = K.mat(K.brickPaving(), { roughness: 0.95 });
  const campusAsphalt=K.mat(asphalt(0),{color:0xadb0a8,roughness:.96});
  // Actual mapped campus drives remain outside the closed building envelopes.
  for(const path of cyclePaths.paths.filter(p=>p.kind==='drive')) {
    const [a,b]=path.points,n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/2));
    for(let i=0;i<n;i++){const p=[a[0]+(b[0]-a[0])*i/n,a[1]+(b[1]-a[1])*i/n],q=[a[0]+(b[0]-a[0])*(i+1)/n,a[1]+(b[1]-a[1])*(i+1)/n];if(K.pointInPolygon((p[0]+q[0])/2,(p[1]+q[1])/2,LDRP.area)){K.strip(g,[p,q],path.width,path.height,campusAsphalt);for(const side of [-1,1])K.strip(g,[p,q],.075,path.height+.006,0xcac7b7,{offset:side*(path.width/2-.12)});}}
  }
  const [hu, hv] = LDRP.hub;
  for (let i = 0; i <= 6; i++) {
    const a = Math.PI * 0.08 + (Math.PI * 0.84 * i) / 6;
    const end = [gu + Math.cos(a) * LDRP.gardenRadius, gv + Math.sin(a) * LDRP.gardenRadius];
    K.strip(g, [[hu, hv], end], 2.6, 0.12, brick, { tile: 2 });
    // Hedges and palms beside each path.
    for (const s of [-1, 1]) K.hedge(g, [[hu + (end[0] - hu) * 0.25, hv + (end[1] - hv) * 0.25], end].map(([x, z]) => [x + Math.sin(a) * 1.9 * s, z - Math.cos(a) * 1.9 * s]), 0.6, 0.7);
    for (const t of [0.45, 0.8]) {
      const pu = hu + (end[0] - hu) * t + Math.sin(a) * 3.2, pv = hv + (end[1] - hv) * t - Math.cos(a) * 3.2;
      K.palm(g, pu, pv, 0.9); trees.push([pu, pv, 0.35]);
    }
  }
  // Circular hub with a flagpole and a ring of flower beds.
  K.slab(g, Array.from({ length: 25 }, (_, i) => [hu + Math.cos((i / 24) * 6.283) * 7, hv + Math.sin((i / 24) * 6.283) * 7]), 0.13, brick, 0, 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2, cu = hu + Math.cos(a) * 4.5, cv = hv + Math.sin(a) * 4.5;
    const ring = Array.from({ length: 9 }, (_, k) => [cu + Math.cos((k / 8) * 6.283) * 1.1, cv + Math.sin((k / 8) * 6.283) * 1.1]);
    K.flowerBed(g, ring); solids.push({ circle: [cu, cv, 1.1] });
  }

  // ---------- buildings from OSM footprints ----------
  const ksv = K.ksvFacade();
  for (const id of LDRP.university) {
    const fp = K.osmFootprint(map, id, f); if (!fp) continue;
    K.building(g, fp.ring, Math.max(12.8, fp.h) + 1.2, ksv, { roof: 0xc9c4b8 });
    solids.push({ poly: fp.ring });
    // Rooftop life: black water tanks, AC units; flags on the arc.
    const [cu, cv] = K.centroid(fp.ring);
    const h = Math.max(12.8, fp.h) + 1.45;
    for (let k = 0; k < 3; k++) K.cyl(g, 1.0, 1.0, 1.6, 0x1d1d1d, cu + (k - 1) * 3, h, cv + 2, 14);
    if (id === 1330899553) for (let r = 0; r < 4; r++) for (let c = 0; c < 6; c++) {
      const p = K.box(g, 2, 0.08, 1.2, K.mat(0x1d2e5a, { roughness: 0.25, metalness: 0.5 }), cu - 6 + c * 2.3, h + 0.4, cv - 4 + r * 1.8);
      p.rotation.x = -0.35;
    }
  }
  const arc = K.osmFootprint(map, 1330899548, f);
  if (arc) {
    // Flags above the main block facing the garden, the university name on its face.
    K.textPlane(g, ["KADI SARVA VISHWAVIDYALAYA", "કડી સર્વ વિશ્વવિદ્યાલય"], { bg: "rgba(0,0,0,0)", fg: "#1f3f78" }, 26, 4, -30, 11.6, -13.9, Math.PI);
    // Entrance portico with grey columns and canopy (KSV front photo).
    K.box(g, 16, 0.5, 6, 0xcfd3d6, -30, 8, -19);
    for (const u of [-37, -32, -28, -23]) K.cyl(g, 0.45, 0.45, 8, 0x8e959b, u, 0, -21.5, 12);
    for (const u of [-37, -32, -28, -23]) solids.push({ circle: [u, -21.5, 0.45] });
  }
  K.textPlane(g, ["L.D.R.P. INSTITUTE OF TECHNOLOGY & RESEARCH"], { bg: "#ffffff", fg: "#1f3f78", h: 140, font: "800 64px Inter, sans-serif" }, 30, 2.4, 76, 12, 0.6, Math.PI - 0.52);
  const quarters = K.residentialFacade();
  for (const id of LDRP.quarters) {
    const fp = K.osmFootprint(map, id, f); if (!fp) continue;
    K.building(g, fp.ring, fp.h, quarters, { roof: 0xb7aea0 });
    solids.push({ poly: fp.ring });
  }
  // The long southern wing is labelled Hostel D Block in the satellite map.
  const hostel=K.osmFootprint(map,1330899550,f);
  if(hostel) {
    const [u,v]=K.centroid(hostel.ring);
    K.textPlane(g,['LDRP HOSTEL · D BLOCK'],{bg:'#e4e0d5',fg:'#30475b'},19,1.4,u,3,v+8,0);
    K.strip(g,[[u-24,v+13],[u+26,v+13]],3,0.16,brick);
    cyclePaths.paths.push({points:[[u-24,v+13],[u+26,v+13]],width:3,height:0.16,kind:'garden'});
  }
  // Garden detail visible in the supplied panorama: low stone kerbs, clipped
  // topiary, a three-tier centre plinth and dense palms beside the road fork.
  for(const [u,v] of [[gu-15,gv-5],[gu+14,gv-6],[gu-20,gv+13],[gu+22,gv+12]]) {
    K.cyl(g,0.17,0.22,2,0x6b5846,u,0,v,10);
    const crown=K.sphere(g,2.3,0x547343,u,2.8,v,16);crown.scale.set(1,1.25,1);
    solids.push({circle:[u,v,0.3]});
  }
  for(let tier=0;tier<3;tier++)K.cyl(g,2.2-tier*0.55,2.2-tier*0.55,0.22,0x999c91,gu,0.14+tier*0.22,gv,32);
  animated.push(K.flagPole(g,gu,gv,undefined,{height:25,width:4.5}));solids.push({circle:[gu,gv,2.2]});

  // ---------- compound wall, gates, security ----------
  // Low masonry boundary: no iron fence between the college and public road.
  const walls = K.compoundWall(g, LDRP.area, LDRP.gates, { height: 1.85,railing:false });
  const main = LDRP.gates[0];
  const gate=new THREE.Group();gate.position.set(main.u,0,main.v);gate.rotation.y=-Math.atan2(68,117);g.add(gate);
  for (const s of [-1, 1]) {
    K.box(gate,1.85,.3,1.9,0x777e7d,s*5.6,0,0);
    K.box(gate,1.5,5.9,1.55,0xb0b2a9,s*5.6,.3,0);
    K.box(gate,1.85,.23,1.9,0x929c97,s*5.6,6.2,0);
    // Open metal leaves stay folded inside the boundary, clear of the shared entrance.
    for(const y of [.45,1.3,2.05])K.box(gate,.065,.055,3.9,0x44534d,s*4.7,y,2.2);
    for(let z=.3;z<4.2;z+=.2)K.box(gate,.05,1.8,.035,0x59685f,s*4.7,.35,z);
    solids.push({circle:[main.u+s*4.84,main.v+s*2.81,1]});
  }
  K.box(gate,12.8,.8,1.9,0xa5aaa0,0,5.55,0);
  K.box(gate,13.15,.18,2.05,0x7f8983,0,6.35,0);
  K.textPlane(gate,["કડી સર્વ વિશ્વવિદ્યાલય","LDRP INSTITUTE OF TECHNOLOGY & RESEARCH"],{bg:'#a5aaa0',fg:'#243b53',h:300},11.9,.76,0,5.96,-.96,Math.PI);
  K.securityCabin(g, main.u + 8.5, main.v + 3, Math.PI); solids.push({ rect: [main.u + 8.5, main.v + 3, 2.4, 2.4] });
  const boom = K.boomBarrier(g, main.u + 4.2, main.v + 1.5, Math.PI, 4.2);
  for (const gt of LDRP.gates.slice(1)) K.securityCabin(g, gt.u + gt.width / 2 + 2, gt.v + 2.5);

  // ---------- trees along the wall, parking, lights ----------
  for (let i = 0; i < LDRP.area.length; i++) {
    const a = LDRP.area[i], b = LDRP.area[(i + 1) % LDRP.area.length];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const nx = -(b[1] - a[1]) / len, nz = (b[0] - a[0]) / len; // inward for this winding
    for (let d = 6; d < len - 4; d += 11) {
      const u = a[0] + ((b[0] - a[0]) * d) / len + nx * 4, v = a[1] + ((b[1] - a[1]) * d) / len + nz * 4;
      if (!K.pointInPolygon(u, v, LDRP.area) || LDRP.gates.some((gt) => Math.hypot(u - gt.u, v - gt.v) < 8)) continue;
      if (Math.hypot(u - hu, v - hv) < 14 || Math.hypot(u - gu, v - gv) < LDRP.gardenRadius + 8) continue; // keep the garden open
      if (solids.some((s) => s.poly && K.nearPolygon(u, v, s.poly, 3))) continue;
      K.tree(g, u, v, 0.9 + ((d * 7) % 5) / 10); trees.push([u, v, 0.32]);
    }
  }
  // Students' two-wheeler parking under the trees beside the LDRP block.
  const bikeColors = [0x2f5e9e, 0xc0392b, 0x1a1a1a, 0xdedede, 0x7a7d80, 0x8e44ad];
  for (let r = 0; r < 3; r++) for (let i = 0; i < 14; i++) K.scooter(g, 28 + i * 1.1, -6 + r * 3.2, Math.PI / 2, bikeColors[(i + r) % 6]);
  solids.push({ rect: [35.5, -2.8, 16, 9.5] });
  const carColors = [0xf2f2f2, 0xc0c4c8, 0x1e2a3a, 0xb3261e, 0x7a7d80];
  for (let i = 0; i < 6; i++) { K.parkedCar(g, 112 + i * 3, 8, 0.52, carColors[i % 5]); solids.push({ rect: [112 + i * 3, 8, 2, 4.4, 0.52] }); }
  const loop = map.roads.find((r) => r.id === 904358807);
  if (loop) {
    const pts = loop.pts.map(([x, z]) => { const l = f.toLocal(x, z); return [l.u, l.v]; });
    for (let i = 0; i < pts.length - 1; i += 2) K.streetLight(g, pts[i][0] + 4, pts[i][1], 0, { h: 7 });
  }
  for (const [u, v, r] of trees) solids.push({ circle: [u, v, r] });

  K.mergeStatic(g);
  const zone = K.createSiteZone({ id: "ldrp-campus", f, area: LDRP.area, solids, walls, vehicleFree: [LDRP.area],walkable:cyclePaths.allowed,groundY:cyclePaths.height,replaceRoads:true });
  zone.contains=(x,z)=>{const p=f.toLocal(x,z);return K.nearPolygon(p.u,p.v,LDRP.area,0.8);};
  const market=buildLdrpMarket(scene,origin);

  // Residents: students in the garden and by the LDRP block, a guard at the gate.
  const local = [[-28, -64], [-12, -50], [-44, -48], [-28, -36], [70, -12], [48, 0], [-30, -86], [20, -40], [-60, -30]];
  const residents = local.map(([u, v]) => ({ ...f.toWorld(u, v), r: 6 }));
  const spawn = { ...f.toWorld(main.u+7, main.v-12), yaw: -0.526, residents };
  return {
    zone, spawn, frame: f,market,extraZones:[market.zone],
    update(t,playerPos) { for (const fl of animated) if (fl.geometry) { fl.rotation.y = Math.sin(t * 1.7 + fl.position.x) * 0.25; } boom.rotation.z = 0;market.update(t,playerPos); },
  };
}
