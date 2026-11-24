import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PLACES,placedPlaces,hubs,isLivePlace,placeById,placePos} from '../src/data/places.js';
import {CHAPTER,STORIES,GIGS} from '../src/data/live-content.js';
import * as archive from '../src/data/content.js';
import {createLiveMap,liveMapBounds} from '../src/world/live-map.js';
import {hdPixelRatio} from '../src/world/render-quality.js';
assert.deepEqual(placedPlaces().map(p=>p.id).sort(),['dandi','ldrp']);assert.equal(hubs().length,2);assert.ok(PLACES.length>15&&placeById('gift'));
assert.ok(archive.GIGS.length>GIGS.length&&archive.STORIES.length>STORIES.length,'Full catalogue stays in source');
for(const m of CHAPTER.missions)for(const g of m.goals)if(g.place)assert.ok(isLivePlace(g.place));for(const x of [...STORIES,...GIGS])assert.ok(isLivePlace(x.place));
const full=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url))),saved=JSON.stringify(full),live=createLiveMap(full);assert.equal(JSON.stringify(full),saved,'Map source is preserved');assert.ok(live.buildings.length<full.buildings.length/2);
const boxes=liveMapBounds(),inside=([x,z])=>boxes.some(b=>x>=b.minX-.001&&x<=b.maxX+.001&&z>=b.minZ-.001&&z<=b.maxZ+.001);
assert.ok(live.roads.length);for(const road of live.roads)for(const p of road.pts)assert.ok(inside(p),'Only active-region road geometry is exposed');
for(const [w,h,dpr] of [[390,844,1],[360,800,3],[1280,720,1],[1920,1080,1],[2560,1440,2]]){const ratio=hdPixelRatio(w,h,dpr);assert.ok(Math.min(w,h)*ratio>=1079);assert.ok(w*h*ratio**2<=8_000_001);}
console.log(`Live release passed: exactly two destinations, all archived locations retained, supported mission goals, ${full.buildings.length} → ${live.buildings.length} background buildings, clipped roads, phone/desktop HD buffers.`);
