// Writes public/data/gandhinagar-live.json: the full map clipped to the live
// destinations (five separate neighbourhoods). The game loads this small file first.
import fs from 'node:fs';
import {createLiveMap} from '../src/world/live-map.js';
const full=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)));
const live=createLiveMap(full);
// Only coordinate arrays (pts / pos / rings) are rounded to centimetres.
const coords=v=>Array.isArray(v)?v.map(coords):typeof v==='number'?Math.round(v*100)/100:v;
const round=v=>Array.isArray(v)?v.map(round):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,['pts','pos','ring','rings','outer','holes'].includes(k)?coords(x):round(x)])):v;
const out=JSON.stringify(round(live));
fs.writeFileSync(new URL('../public/data/gandhinagar-live.json',import.meta.url),out);
console.log(`Live map: ${(out.length/1024).toFixed(0)} KB (full ${(fs.statSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)).size/1024).toFixed(0)} KB), ${live.buildings.length} buildings, ${live.roads.length} roads.`);
