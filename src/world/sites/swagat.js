import * as THREE from "three";
import * as K from "./kit.js";
import * as T from "../textures.js";

// Swagat Holiday Mall, Sargasan (SG Highway / NH-147).
// Sources: Google Maps pin 23.1891285, 72.6097853 and satellite; developer renders and
// photographs (rainbow hexagon LED facade over two floors of shopfronts). Roads from
// OSM: SG Highway carriageways 379871398 / 1200946267 (NW), frontage road 1255982647,
// Aavkar Road 902515860 (NE), Palm Road 673104029 (SW). OSM has no footprint for the
// mall, so its 64 x 40 m block is measured from the satellite image.
// Local frame: u along the highway (towards the north-east), v away from it (south-east).
export const SWAGAT = {
  yaw: 0.531,
  mall: { u: 0, v: 6, w: 64, d: 40, h: 21 },
  forecourt: [[-40, -24], [40, -24], [40, -14], [-40, -14]],
};

export function buildSwagat(scene, map, origin) {
  const f = K.frame(origin, SWAGAT.yaw);
  const g = new THREE.Group(); g.position.set(origin.x, 0, origin.z); g.rotation.y = SWAGAT.yaw; scene.add(g);
  const solids = [];
  const { u, v, w, d, h } = SWAGAT.mall;
  const front = v - d / 2, back = v + d / 2, left = u - w / 2, right = u + w / 2;
  const ring = [[left, front], [right, front], [right, back], [left, back]];

  // Main block: grey side/back facades with small windows.
  K.building(g, ring, h, K.residentialFacade("#c9c6c0", "#8a8f96"), { roof: 0xa9a59c, parapet: 1.1 });
  solids.push({ poly: ring });
  // Front facade: two floors of shopfronts + signboards, two floors of hexagon LEDs.
  const led = T.hexLed(4, 1);
  const ledMat = new THREE.MeshStandardMaterial({ map: led, emissiveMap: led, emissive: 0xffffff, emissiveIntensity: 0.35, roughness: 0.4 });
  const face = (mat, y0, y1, inset = 0.25) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w - 2, y1 - y0), mat);
    m.position.set(u, (y0 + y1) / 2, front - inset); m.rotation.y = Math.PI; m.userData.keep = true; m.userData.ledFacade = mat === ledMat;
    g.add(m); return m;
  };
  face(ledMat, 10.5, h - 0.5);
  face(K.mat(T.shopfronts(4, 1), { roughness: 0.3 }), 0.4, 10);
  // Corner sign (as on the real building, top west corner) and fascia.
  K.textPlane(g, ["Swagat", "HOLIDAY MALL"], { bg: "#14101f", fg: "#f2c84b", w: 512, h: 256 }, 10, 5, left + 6, h + 3.4, front - 0.6, Math.PI);
  K.box(g, 1, 8, 1, 0x2a2340, left + 1, h, front - 0.6);
  K.box(g, 1, 8, 1, 0x2a2340, left + 11, h, front - 0.6);
  // Glazed central atrium with a cantilevered canopy and steps.
  K.box(g, 12, 19, 1.2, K.mat(0x6f93b2, { roughness: 0.1, metalness: 0.5 }), u, 0.6, front - 0.8);
  K.box(g, 16, 0.5, 6, K.mat(0xdedfe1, { roughness: 0.3, metalness: 0.6 }), u, 7, front - 3.5);
  for (let i = 0; i < 3; i++) K.box(g, 14, 0.2, 1, 0xbfb9ad, u, i * 0.2, front - 1.4 - i);
  // Rooftop: hoarding frames and water tanks.
  for (const du of [-18, 18]) {
    K.box(g, 14, 5, 0.4, K.mat(0xffffff, { roughness: 0.6 }), u + du, h + 1.5, v - 6);
    for (const s of [-6, 6]) K.box(g, 0.3, 6.5, 0.3, 0x555555, u + du + s, h, v - 5.6);
  }
  for (let k = 0; k < 4; k++) K.cyl(g, 1, 1, 1.7, 0x1d1d1d, u + 20 + k * 2.4, h + 0.3, v + 14, 14);

  // Forecourt: paving, curbs along the frontage road, parking, guard cabin, lights.
  K.slab(g, [[left - 6, front - 14], [right + 6, front - 14], [right + 6, front], [left - 6, front]], 0.08, K.mat(K.greyPavers()), 0, 3);
  K.strip(g, [[left - 6, front - 14], [right + 6, front - 14]], 0.3, 0, K.mat(K.curbTex()), { height: 0.25, tile: 0.6 });
  const bikeColors = [0x2f5e9e, 0xc0392b, 0x1a1a1a, 0xdedede, 0x7a7d80];
  for (let i = 0; i < 18; i++) K.scooter(g, left + 2 + i * 1.1, front - 4, Math.PI / 2, bikeColors[i % 5]);
  solids.push({ rect: [left + 11.5, front - 4, 21, 2.2] });
  const carColors = [0xf2f2f2, 0xc0c4c8, 0x1e2a3a, 0xb3261e];
  for (let i = 0; i < 6; i++) { const cu = right - 4 - i * 3, cv = front - 6; K.parkedCar(g, cu, cv, 0, carColors[i % 4]); solids.push({ rect: [cu, cv, 2, 4.4] }); }
  K.securityCabin(g, left - 3, front - 10, 0); solids.push({ rect: [left - 3, front - 10, 2.4, 2.4] });
  for (const lu of [left - 4, u, right + 4]) K.streetLight(g, lu, front - 13, Math.PI, { h: 8 });
  for (const tu of [left - 4, right + 4]) { K.tree(g, tu, front + 6, 1.1); solids.push({ circle: [tu, front + 6, 0.35] }); }

  K.mergeStatic(g);
  const area = [[left - 8, front - 16], [right + 8, front - 16], [right + 8, back + 6], [left - 8, back + 6]];
  const zone = K.createSiteZone({ id: "swagat-mall", f, area, solids, vehicleFree: [ring] });
  const residents = [[-10, -24 + 6], [8, -20], [20, -22], [-25, -20], [0, -18]].map(([a, b]) => ({ ...f.toWorld(a, b + v), r: 5 }));
  const spawn = { ...f.toWorld(u, front - 10), yaw: SWAGAT.yaw + Math.PI, residents };
  return {
    zone, spawn, frame: f,
    update(t) { ledMat.emissiveIntensity = 0.35 + 0.15 * Math.sin(t * 2); led.offset.x = (t * 0.02) % 1; },
  };
}
