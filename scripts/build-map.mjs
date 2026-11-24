// Converts the OpenStreetMap Overpass dump into a compact local-metre map
// that the Three.js scene loads. Run: node scripts/build-map.mjs
// OSM data is © OpenStreetMap contributors, licensed ODbL. Keep attribution in the app.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
import { existsSync } from "node:fs";
// Main dump plus optional extras: the strip north of 23.2395 (LDRP / Sector 15) and the
// metro network (rail.json). Elements are de-duplicated by OSM type + id.
const readOsm = (name) => { const p = join(root, "data", name); return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")).elements : []; };
const seen = new Set();
const raw = { elements: [...readOsm("osm_gandhinagar.json"), ...readOsm("extra.json"), ...readOsm("rail.json")]
  .filter((e) => { const k = e.type + e.id; if (seen.has(k)) return false; seen.add(k); return true; }) };

// Centre of the map (roughly Gandhinagar city centre). Everything is metres from here.
const ORIGIN = { lat: 23.195, lon: 72.645 };
const R = 6371000;
const toXY = (lat, lon) => [
  +((lon - ORIGIN.lon) * (Math.PI / 180) * R * Math.cos((ORIGIN.lat * Math.PI) / 180)).toFixed(1),
  +(-(lat - ORIGIN.lat) * (Math.PI / 180) * R).toFixed(1), // z axis: north is negative
];

const roads = [];
const buildings = [];
const water = [];
const parks = [];
const metro = [];
const stations = [];

for (const el of raw.elements) {
  if (el.type === "node" && el.tags?.railway === "station") { stations.push({ name: el.tags.name || "", id: el.id, pos: toXY(el.lat, el.lon) }); continue; }
  if (el.type !== "way" || !el.geometry || el.geometry.length < 2) continue;
  const pts = el.geometry.map((g) => toXY(g.lat, g.lon));
  const tags = el.tags || {};

  if (tags.railway === "subway") {
    // Ahmedabad–Gandhinagar metro: elevated viaduct (layer 1) unless tagged otherwise.
    metro.push({ id: el.id, name: tags.name || "", elevated: tags.layer !== "-1" && tags.tunnel !== "yes", pts });
  } else if (tags.railway) {
    // Mainline rail is not rendered yet.
  } else if (tags.highway) {
    roads.push({ kind: tags.highway, id: el.id, oneway: tags.oneway==='-1'?-1:tags.oneway==='yes'||tags.junction==='roundabout'?1:0, bridge: tags.bridge==='yes', pts });
  } else if (tags.building) {
    // Height: explicit height tag, else levels * 3.2 m, else a default of 7 m.
    let h = 7;
    if (tags.height) h = parseFloat(tags.height) || h;
    else if (tags["building:levels"]) h = (parseFloat(tags["building:levels"]) || 2) * 3.2;
    buildings.push({ id: el.id, name: tags.name || undefined, h: Math.min(h, 120), kind: tags.building, pts });
  } else if (tags.natural === "water" || tags.waterway === "river") {
    water.push({ pts, closed: pts.length > 2 && el.geometry[0].lat === el.geometry.at(-1).lat });
  } else if (tags.leisure) {
    parks.push({ kind: tags.leisure, pts });
  }
}

// Named places from the user's list. LDRP and Sector 1 Lake Garden are not resolved yet.
const PLACES = [
  { name: "DAIICT", lat: 23.188408, lon: 72.6279691, type: "education" },
  { name: "NIFT", lat: 23.1914478, lon: 72.6291597, type: "education" },
  { name: "TCS", lat: 23.192776, lon: 72.6282751, type: "office" },
  { name: "Infocity", lat: 23.1933118, lon: 72.6348905, type: "business" },
  { name: "Punit Van", lat: 23.2169187, lon: 72.6676339, type: "park" },
  { name: "Swarnim Park", lat: 23.2221505, lon: 72.6519822, type: "park" },
  { name: "Akshardham Mandir", lat: 23.2294005, lon: 72.6740775, type: "temple" },
  { name: "Sarita Udyan", lat: 23.2026285, lon: 72.6598164, type: "park" },
  { name: "Indroda Park", lat: 23.1931507, lon: 72.6503345, type: "park" },
  { name: "Dandi Kutir", lat: 23.2328055, lon: 72.631196, type: "landmark" },
  { name: "GIFT City", lat: 23.1629053, lon: 72.688695, type: "business" },
  { name: "PDPU", lat: 23.1549205, lon: 72.6612326, type: "education" },
  { name: "Swagat Mall", lat: 23.1602531, lon: 72.587376, type: "shopping" },
].map((p) => ({ ...p, pos: toXY(p.lat, p.lon) }));

const map = {
  origin: ORIGIN,
  attribution: "© OpenStreetMap contributors (ODbL)",
  bounds: { south: 23.15, north: 23.25, west: 72.6, east: 72.7 },
  roads,
  buildings,
  water,
  parks,
  metro,
  stations,
  places: PLACES,
};

const outDir = join(root, "public", "data");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "gandhinagar-map.json"), JSON.stringify(map));
console.log(
  `roads ${roads.length}, buildings ${buildings.length}, water ${water.length}, parks ${parks.length}, metro ${metro.length}, stations ${stations.length}`
);
