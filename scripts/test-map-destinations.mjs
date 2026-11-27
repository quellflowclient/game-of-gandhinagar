import assert from 'node:assert/strict';
import './load-parking-test-assets.mjs';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildLandmarks} from '../src/world/landmarks.js';
import {buildEntertainment} from '../src/world/entertainment.js';
import {createLiveMap} from '../src/world/live-map.js';
import {mapDestinations,safeMapArrival} from '../src/systems/map-destinations.js';
import {MAHATMA_AUTHORED_BUILDINGS,mahatmaReplacesBuilding,siteToWorld,worldToSite} from '../src/world/mahatma-layout.js';
import {placePos,placeById} from '../src/data/places.js';
const noop=()=>{};globalThis.matchMedia=()=>({matches:false});
globalThis.document={createElement(){const canvas={width:1,height:1,toDataURL:()=>''};const ctx=new Proxy({canvas,createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:t=>({width:String(t).length*8}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:noop});canvas.getContext=()=>ctx;return canvas;}};
const map=createLiveMap(JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)))),scene=new THREE.Scene(),world=buildLandmarks(scene,map),venues=buildEntertainment(scene);world.navigation.zones.unshift(venues.zone);
const destinations=mapDestinations(world);assert.equal(new Set(destinations.map(p=>p.id)).size,destinations.length,'Market shops appear once');
for(const id of ['gift','swarnim','dandi','swagat','ldrp','city-club','gift-live'])assert(destinations.some(p=>p.id===id));
assert.equal(destinations.filter(p=>p.id.startsWith('shop:ldrp:')).length,8,'All market shops have a direct target');
for(const target of destinations){const safe=safeMapArrival(target,world);assert(Math.hypot(safe.x-target.x,safe.z-target.z)<7,`${target.name} arrives at its own entrance`);assert.notEqual(world.navigation.surface(safe.x,safe.z,safe.y),undefined);}
assert.throws(()=>safeMapArrival({...destinations[0],area:'ldrp'},world),/safe arrival/);assert.throws(()=>safeMapArrival({area:'gift',x:NaN,z:0},world),/unavailable/);
const origin=placePos(placeById('dandi')),clearing=world.clearings.find(c=>c.replacesBuilding&&c.replacesBuilding(map.buildings.find(b=>b.id===338769675)));
for(const id of MAHATMA_AUTHORED_BUILDINGS){const building=map.buildings.find(b=>b.id===id);assert(building,`Mapped authored building ${id} exists`);assert(mahatmaReplacesBuilding(origin,building));assert(clearing.replacesBuilding(building),'Render and collision both skip duplicate museum/gallery geometry');}
const retained=map.buildings.filter(b=>!mahatmaReplacesBuilding(origin,b));assert(retained.length>map.buildings.length-10,'Surrounding real buildings remain');
// With the actual retained map obstacles installed, both museum promenades and
// the radial passages must remain walkable instead of hitting duplicate boxes.
for(const radius of [77,97])for(let i=0;i<360;i++){const a=i*Math.PI/180,p=siteToWorld(origin,Math.sin(a)*radius,Math.cos(a)*radius);assert.notEqual(world.navigation.surface(p.x,p.z,.18,.38,.65),undefined,`Museum promenade ${radius}/${i}`);}
console.log(`Map destinations passed: ${destinations.length} unique clickable places/venues/shops, safe real-world arrivals, all 6 authored Mahatma footprints replace duplicates, surrounding buildings retained and 720 promenade samples remain clear.`);
