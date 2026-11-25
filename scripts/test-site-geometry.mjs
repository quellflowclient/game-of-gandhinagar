import assert from 'node:assert/strict';
import './load-parking-test-assets.mjs';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildLdrp} from '../src/world/sites/ldrp.js';
import {buildMetro} from '../src/world/metro.js';
import {updateParkedVehicles} from '../src/world/parked-models.js';
import {placePos,placeById} from '../src/data/places.js';
import {buildMetroGarden} from '../src/world/metro-garden.js';
import {alignMetroRoads,roadClearance,roadMedian} from '../src/world/metro-road-clearance.js';
import {createLiveMap} from '../src/world/live-map.js';
import {marketPoint,MARKET_SHOPS,MARKET_GROUND} from '../src/world/sites/ldrp-market-layout.js';
// Canvas drawing is stubbed only for this CPU geometry test. This does not
// substitute for the actual rendered screenshots/browser interaction checks.
const noop=()=>{};
globalThis.document={createElement(){const canvas={width:1,height:1};const context=new Proxy({canvas,createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:t=>({width:String(t).length*8}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:noop});canvas.getContext=()=>context;return canvas;}};
const map=alignMetroRoads(createLiveMap(JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url))))),scene=new THREE.Scene(),origin=placePos(placeById('ldrp'));
const ldrp=buildLdrp(scene,map,origin),metro=buildMetro(scene,map,{lowEnd:true});scene.updateMatrixWorld(true);
const offRoad=roadClearance(map),median=roadMedian(map),pierSnapshot=JSON.stringify(metro.piers),garden=buildMetroGarden(scene,metro.piers,origin,(x,z,r)=>offRoad(x,z,r)&&median(x,z));assert.equal(JSON.stringify(metro.piers),pierSnapshot,'Garden must not move existing columns');
assert.ok(metro.piers.length>3,'Keep visible median supports');
for(const [x,z] of metro.piers)assert.ok(offRoad(x,z),'No circular support footprint on any road');
assert.ok(garden.segments.length>30,'Retain a continuous fenced median');
for(const s of garden.segments)assert.ok(offRoad((s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2,1.09),'No fence/planting strip across asphalt');
for(const s of garden.segments)assert.ok(median((s.a[0]+s.b[0])/2,(s.a[1]+s.b[1])/2),'Iron mesh belongs between carriageways, not between college and road');
updateParkedVehicles(scene,origin);scene.updateMatrixWorld(true);
let meshes=0,vertices=0;
scene.traverse(o=>{if(!o.isMesh)return;assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name);for(const a of Object.values(o.geometry.attributes))assert.ok([...a.array].every(Number.isFinite),`Finite ${o.name} geometry`);meshes++;vertices+=o.geometry.attributes.position.count;});
assert.equal(ldrp.market.shops.length,8);assert.equal(ldrp.market.seats.length,148);for(const shop of MARKET_SHOPS.filter(s=>s.kind!=="food")){const c=new Map();for(const s of ldrp.market.seats.filter(s=>s.shopId===shop.id))c.set(s.circle,(c.get(s.circle)||0)+1);assert.deepEqual([...c.values()],[4,4,4,5,5]);};
for(const shop of MARKET_SHOPS.filter(s=>s.kind!=='food'))assert.equal(ldrp.market.seats.filter(s=>s.shopId===shop.id).length,22);
assert.ok(ldrp.market.seats.every(s=>s.y===MARKET_GROUND));assert.ok(metro.obstacles.length>0&&metro.obstacles.every(p=>p.r===0.85));
for(const s of MARKET_SHOPS){const p=marketPoint(origin,s.u,s.v>0?11:-10);assert.ok(ldrp.market.zone.contains(p.x,p.z),'No unowned grass gap beside the shop row');}
for(const s of garden.segments){const x=(s.a[0]+s.b[0])/2,z=(s.a[1]+s.b[1])/2;assert.ok(garden.zone.contains(x,z));assert.equal(garden.zone.heights(x,z).length,0,'Every rendered median strip blocks walking');assert.ok(garden.zone.forbidsVehicles(x,z));}
for(const s of garden.segments)if(s.tree){const nearest=metro.piers.reduce((d,p)=>Math.min(d,Math.hypot(s.tree[0]-p[0],s.tree[1]-p[1])),Infinity);assert.ok(nearest>7,'Trees go between piers, clear of columns');}
console.log(`Site geometry passed: ${meshes} finite meshes / ${vertices} vertices, 8 shops, 22 seats per tea tapri in circles of 4-5 (148 total), decoded GLB parked vehicles, shoulder and fenced median.`);
