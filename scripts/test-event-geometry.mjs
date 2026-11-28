import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildEntertainment} from '../src/world/entertainment.js';
import {createNavigation} from '../src/world/navigation.js';
import {standingSpot,CONCERT_ZONES,EVENT_CAPACITY,entertainmentPoint,clubPoint,CLUB,ARENA,PLAZA,CLUB_PLAZA,CLUB_APPROACH,venueAt} from '../src/world/entertainment-layout.js';
import {pointInRing,insideWithMargin} from '../src/world/geographic-polygons.js';
import geo from '../src/data/destination-geography.json' with {type:'json'};
const noop=()=>{};
globalThis.document={createElement(){const canvas={width:1,height:1};const ctx=new Proxy({canvas,measureText:t=>({width:String(t).length*8}),createLinearGradient:()=>({addColorStop:noop})},{get:(o,k)=>k in o?o[k]:noop});canvas.getContext=()=>ctx;return canvas;}};
const scene=new THREE.Scene(),venue=buildEntertainment(scene),nav=createNavigation([venue.zone]);scene.updateMatrixWorld(true);
let meshes=0;scene.traverse(o=>{if(!o.isMesh)return;meshes++;assert(o.matrixWorld.elements.every(Number.isFinite));for(const a of Object.values(o.geometry.attributes))assert([...a.array].every(Number.isFinite));});
for(const z of CONCERT_ZONES)for(let i=0;i<EVENT_CAPACITY;i++){const spot=standingSpot(z.id,i);assert.equal(nav.surface(spot.x,spot.z,spot.y),spot.y,'Every allocated position has an unobstructed level floor');assert(venue.zone.forbidsVehicles(spot.x,spot.z));}
const at=(u,v)=>({...entertainmentPoint(u,v),y:.18}),walk={...clubPoint(0,27),y:.18};nav.move(walk,0,-25);assert(walk.z<clubPoint(0,4).z,'Club entrance allows a person to walk inside');
const wall={...clubPoint(10,27),y:.18};nav.move(wall,0,-20);assert(wall.z>clubPoint(10,21).z,'Club glazing blocks movement');
const gate=at(ARENA.u,88);nav.move(gate,0,-25);assert(gate.z>entertainmentPoint(ARENA.u,80).z,'Arena entry requires an allocated spot');
assert.equal(nav.surface(...[entertainmentPoint(ARENA.u,-28).x,entertainmentPoint(ARENA.u,-28).z,.18]),undefined,'Stage runway cannot overlap attendees');
const parcels=[[PLAZA,entertainmentPoint],[CLUB_PLAZA,clubPoint]].map(([b,point])=>[[b.minU-7,b.minV-7],[b.maxU+7,b.minV-7],[b.maxU+7,b.maxV+7],[b.minU-7,b.maxV+7]].map(([u,v])=>{const p=point(u,v);return[p.x,p.z];}));
for(const parcel of parcels)assert(parcel.every(p=>insideWithMargin(...p,geo.gift.outline,20)),'Each independent venue remains inside real GIFT boundary');
const edges=p=>p.map((a,i)=>[a,p[(i+1)%p.length]]);
const cross=(a,b,c,d)=>{const side=(p,q,r)=>(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);return side(a,b,c)*side(a,b,d)<=0&&side(c,d,a)*side(c,d,b)<=0&&Math.max(Math.min(a[0],b[0]),Math.min(c[0],d[0]))<=Math.min(Math.max(a[0],b[0]),Math.max(c[0],d[0]))&&Math.max(Math.min(a[1],b[1]),Math.min(c[1],d[1]))<=Math.min(Math.max(a[1],b[1]),Math.max(c[1],d[1]));};
const map=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-live.json',import.meta.url)));
for(const parcel of parcels){for(const b of [...map.buildings,...map.water])assert(!b.pts.some(p=>pointInRing(...p,parcel))&&!parcel.some(p=>pointInRing(...p,b.pts))&&!edges(b.pts).some(([a,b])=>edges(parcel).some(([c,d])=>cross(a,b,c,d))),'No mapped building or water overlaps either venue');for(const r of map.roads)for(let i=1;i<r.pts.length;i++)assert(!pointInRing(...r.pts[i],parcel)&&!edges(parcel).some(([c,d])=>cross(r.pts[i-1],r.pts[i],c,d)),'No existing road is covered');}
const center=clubPoint(0,0),arena=entertainmentPoint(ARENA.u,ARENA.v),separation=Math.hypot(center.x-arena.x,center.z-arena.z);assert(separation>800);assert.equal(venueAt(center.x,center.z),CLUB.id);assert.equal(venueAt(arena.x,arena.z),ARENA.id);assert(!venue.zone.contains((center.x+arena.x)/2,(center.z+arena.z)/2),'The gap between venues stays part of the mapped city');
assert.equal(venue.clubInterior.tables.length,7);assert.equal(venue.clubInterior.chairs.length,23);
let clubDraws=0,clubVertices=0;venue.clubGroup.traverse(o=>{if(o.isMesh&&o.visible){clubDraws++;clubVertices+=o.geometry.attributes.position.count;}});assert(clubDraws<60&&clubVertices<160000,'Furnished club stays within the phone geometry budget');
for(const t of venue.clubInterior.tables){const p=clubPoint(t.u,t.v);assert.equal(nav.surface(p.x,p.z,.18),undefined,'Tables block character movement');}
let from={...clubPoint(0,27),y:.18};for(const [u,v] of [[0,4],[0,-5],[9.8,-3],[0,-5],[-7,0]]){const to={...clubPoint(u,v),y:.18};assert(nav.canTravel(from,to),'Entry, dance floor, juice counter and lounge service aisles are connected');from=to;}
const sql=fs.readFileSync(new URL('../supabase/entertainment.sql',import.meta.url),'utf8'),bounds=/select px between ([\d.]+) and ([\d.]+) and pz between ([\d.]+) and ([\d.]+)/.exec(sql);assert(bounds);assert(center.x>+bounds[1]&&center.x<+bounds[2]&&center.z>+bounds[3]&&center.z<+bounds[4]);assert(Math.abs(+bounds[1]-(center.x-CLUB.width/2-5))<.01&&Math.abs(+bounds[4]-(center.z+CLUB.depth/2+5))<.01,'Server geofence follows the new club footprint');
console.log(`Event geometry passed: ${meshes} finite meshes, 576 standing spots, 7 club tables and 23 chairs, connected lounge/bar/dance aisles, ${Math.round(separation)} m separation, matching server geofence and no mapped road/building/water overlap.`);
