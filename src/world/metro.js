import * as THREE from "three";
import * as BGU from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { canvasTex,mergeStatic } from "./sites/kit.js";
import {metroCenterlines,singleRowPiers} from './metro-layout.js';
import {roadClearance,medianCenter} from './metro-road-clearance.js';

// Ahmedabad–Gandhinagar metro (OSM railway=subway): elevated viaduct on hammerhead piers
// ~12 m up, running along the real alignment, plus an elevated station at every mapped
// station that lies on the line (GIFT City, PDPU, Infocity, Sector-24 near LDRP, ...).
const DECK_Y = 12, PIER_STEP = 26;

export function pierGeometry() {
  const col = new THREE.CylinderGeometry(0.75,0.85, DECK_Y - 1.6, 28); col.translate(0, (DECK_Y - 1.6) / 2, 0);
  const cap = new THREE.BoxGeometry(8.4, 1.6, 2.2); cap.translate(0, DECK_Y - 0.8, 0);
  return BGU.mergeGeometries([col.toNonIndexed(), cap.toNonIndexed()]);
}

function deckGeometry(path) {
  // U-girder: deck slab + two parapets, as one ribbon set along the path.
  const pos = [];
  const quad = (a, b, c, d) => pos.push(...a, ...b, ...c, ...c, ...b, ...d);
  for (let i = 0; i < path.length - 1; i++) {
    const [x1, z1] = path[i], [x2, z2] = path[i + 1];
    const len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.5) continue;
    const nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
    const P = (x, z, s, y) => [x + nx * s, y, z + nz * s];
    const w = 4.6, top = DECK_Y + 0.9, bot = DECK_Y;
    quad(P(x1, z1, -w, top), P(x2, z2, -w, top), P(x1, z1, w, top), P(x2, z2, w, top));   // deck top
    quad(P(x1, z1, -w, bot), P(x1, z1, w, bot), P(x2, z2, -w, bot), P(x2, z2, w, bot));   // underside
    for (const s of [-w, w]) {
      quad(P(x1, z1, s, bot), P(x2, z2, s, bot), P(x1, z1, s, top + 1.1), P(x2, z2, s, top + 1.1)); // side + parapet
      quad(P(x1, z1, s * 0.94, top), P(x2, z2, s * 0.94, top), P(x1, z1, s * 0.94, top + 1.1), P(x2, z2, s * 0.94, top + 1.1));
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.computeVertexNormals();
  return g;
}

export function buildMetro(scene, map, { lowEnd = false } = {}) {
  const lines = metroCenterlines(map.metro || []);
  if (!lines.length) return { stations: [],obstacles:[],cameraObstacles:[] };
  const group = new THREE.Group();
  const concrete = new THREE.MeshStandardMaterial({ color: 0xbdb8ae, roughness: 0.9 });
  const decks = lines.map((l) => deckGeometry(l.pts)).filter((g) => g.attributes.position.count);
  const deck = new THREE.Mesh(BGU.mergeGeometries(decks), concrete);
  deck.castShadow = deck.receiveShadow = true;
  group.add(deck);
  // Rails on the deck.
  const railMat = new THREE.MeshStandardMaterial({ color: 0x6d6f72, metalness: 0.7, roughness: 0.4 });
  const rails = [];
  for (const l of lines) for (const off of [-2.7, -1.3, 1.3, 2.7]) {
    const pts = l.pts;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, z1] = pts[i], [x2, z2] = pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1); if (len < 0.5) continue;
      const nx = -(z2 - z1) / len, nz = (x2 - x1) / len;
      const r = new THREE.BoxGeometry(0.12, 0.18, len); r.rotateY(Math.atan2(x2 - x1, z2 - z1));
      r.translate((x1 + x2) / 2 + nx * off, DECK_Y + 1.0, (z1 + z2) / 2 + nz * off);
      rails.push(r.toNonIndexed());
    }
  }
  if (!lowEnd && rails.length) group.add(new THREE.Mesh(BGU.mergeGeometries(rails), railMat));

  // Piers every ~26 m (instanced).
  const spots = [];
  for (const l of lines) {
    let acc = 0;
    for (let i = 0; i < l.pts.length - 1; i++) {
      const [x1, z1] = l.pts[i], [x2, z2] = l.pts[i + 1], len = Math.hypot(x2 - x1, z2 - z1);
      for (let d = (PIER_STEP - acc) % PIER_STEP; d < len; d += PIER_STEP) spots.push([x1 + ((x2 - x1) * d) / len, z1 + ((z2 - z1) * d) / len, Math.atan2(x2 - x1, z2 - z1)]);
      acc = (acc + len) % PIER_STEP;
    }
  }
  // Span across junction asphalt. Supports stand in the median, never in lanes.
  const offRoad=roadClearance(map),median=medianCenter(map);
  const centralSpots=singleRowPiers(spots).map(p=>{const m=median(p[0],p[1]);return m&&Math.hypot(m.x-p[0],m.z-p[1])<1.3?[m.x,m.z,p[2]]:p;}).filter(([x,z])=>offRoad(x,z));
  const piers = new THREE.InstancedMesh(pierGeometry(), concrete, centralSpots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  centralSpots.forEach(([x, z, a], i) => { q.setFromAxisAngle(up, a + Math.PI / 2); piers.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0, z), q, one)); });
  piers.castShadow = true; piers.receiveShadow = true; piers.computeBoundingSphere();
  group.add(piers);

  // Stations on the line: an elevated concourse box with a curved roof and stairs.
  const nearestOnLine = (x, z) => {
    let best = null, bd = Infinity;
    for (const l of lines) for (let i = 0; i < l.pts.length - 1; i++) {
      const [x1, z1] = l.pts[i], [x2, z2] = l.pts[i + 1];
      const dx = x2 - x1, dz = z2 - z1, L = dx * dx + dz * dz || 1;
      const t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / L));
      const px = x1 + dx * t, pz = z1 + dz * t, d = Math.hypot(px - x, pz - z);
      if (d < bd) { bd = d; best = { x: px, z: pz, a: Math.atan2(dx, dz), d }; }
    }
    return best;
  };
  const clad = new THREE.MeshStandardMaterial({ color: 0xe9e6df, roughness: 0.6 });
  const roofMat = new THREE.MeshStandardMaterial({ color: 0xd2d6da, roughness: 0.35, metalness: 0.5, side: THREE.DoubleSide });
  const glass = new THREE.MeshStandardMaterial({ color: 0x5b7f9e, roughness: 0.1, metalness: 0.4 });
  const stations = [];
  for (const s of map.stations || []) {
    const p = nearestOnLine(s.pos[0], s.pos[1]);
    if (!p || p.d > 60) continue;
    const st = new THREE.Group(); st.position.set(p.x, 0, p.z); st.rotation.y = p.a; group.add(st);
    const add = (geo, mm, x, y, z) => { const mesh = new THREE.Mesh(geo, mm); mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; st.add(mesh); return mesh; };
    add(new THREE.BoxGeometry(22, 5, 130), clad, 0, 7.5, 0);                // concourse under the platforms
    add(new THREE.BoxGeometry(22.2, 2.4, 128), glass, 0, 7.8, 0);           // glazed band
    add(new THREE.BoxGeometry(20, 0.6, 140), clad, 0, DECK_Y + 1.2, 0);     // platforms
    const roof = add(new THREE.CylinderGeometry(15, 15, 140, 24, 1, true, -0.75, 1.5), roofMat, 0, DECK_Y + 0.6, 0);
    roof.rotation.x = Math.PI / 2; roof.rotation.z = Math.PI / 2; roof.scale.set(1, 1, 0.45);
    for (const zz of [-40, 0, 40]) {add(new THREE.CylinderGeometry(0.9,1.05,12,28),clad,0,6,zz);add(new THREE.BoxGeometry(19,1.1,2.3),clad,0,10.8,zz);}
    for (const side of [-1, 1]) { // stair towers to street level
      const stair = add(new THREE.BoxGeometry(4, 9, 14), clad, side * 15, 4.5, 50);
      stair.userData.cameraSolid = true;
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 2.2), new THREE.MeshBasicMaterial({
      map: canvasTex(512, 80, (c, w, h) => { c.fillStyle = "#2a4b8d"; c.fillRect(0, 0, w, h); c.fillStyle = "#fff"; c.font = "700 44px Inter, sans-serif"; c.textAlign = "center"; c.textBaseline = "middle"; c.fillText(`Ⓜ ${s.name}`, w / 2, h / 2); }) }));
    for (const side of [-1, 1]) { const sg = sign.clone(); sg.position.set(side * 11.2, 9, 0); sg.rotation.y = side * Math.PI / 2; st.add(sg); }
    mergeStatic(st);
    stations.push({ name: s.name, x: p.x, z: p.z, a: p.a });
  }
  scene.add(group);
  return { group, stations,piers:centralSpots, deckY: DECK_Y,pierCount:centralSpots.length,centerlines:lines.length,obstacles:centralSpots.map(([x,z])=>({x,z,r:0.85})),cameraObstacles:[deck,piers] };
}
