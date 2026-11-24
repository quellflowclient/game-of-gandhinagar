import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createDrivingSurface,drivingSpeed,VEHICLES} from '../src/world/driving.js';
import {MARKET_SHOPS,marketPoint,inLdrpArea,applyRoad5Profile} from '../src/world/sites/ldrp-market-layout.js';
import {LDRP} from '../src/world/sites/ldrp.js';
const road={kind:'tertiary',width:6.2,pts:[[0,0],[0,400]]},zones=[{forbidsVehicles:(x,z)=>z>190&&z<195}];
const surface=createDrivingSurface([road],zones,(x,z)=>z<380);
for(const type of ['auto','car']){
 let speed=0;for(let i=0;i<2000;i++)speed=drivingSpeed(speed,1,.05,type);
 assert.ok(Math.abs(speed*3.6-VEHICLES[type].maxKmh)<1e-6);
 for(let i=0;i<1000;i++)speed=drivingSpeed(speed,0,.05,type);assert.equal(speed,0);
 assert.ok(surface.pose(0,50,0,type));assert.equal(surface.pose(3,50,0,type),null,'Full width cannot hang over road edge');assert.equal(surface.pose(0,189.5,0,type),null,'Whole vehicle blocks before fence');assert.equal(surface.pose(0,379,0,type),null,'Whole vehicle stops at exploration boundary');
 // 80 km/h frame subdivided into <=15cm steps must not tunnel across fence.
 let z=180,v=VEHICLES[type].maxKmh/3.6;for(let frame=0;frame<40;frame++){const n=Math.ceil(v*.05/.15);for(let i=0;i<n;i++){const next=z+v*.05/n;if(!surface.pose(0,next,0,type)){v=0;break;}z=next;}}assert.ok(z<190-VEHICLES[type].length/2);
}
const o={x:0,z:0};for(const s of MARKET_SHOPS){const p=marketPoint(o,s.u,s.v);assert.ok(inLdrpArea(o,p.x,p.z,1.5));}for(const [x,z] of LDRP.area)assert.ok(inLdrpArea(o,x,z,1.5));
for(const [u,v] of [[-376,0],[213,0],[0,-296],[0,66]]){const p=marketPoint(o,u,v);assert.equal(inLdrpArea(o,p.x,p.z),false);}
const map=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)));applyRoad5Profile(map);const actual=createDrivingSurface(map.roads);
let valid=0;for(const road of map.roads.filter(r=>r.width===6.2))for(let i=1;i<road.pts.length;i++){const [a,b]=[road.pts[i-1],road.pts[i]],x=(a[0]+b[0])/2,z=(a[1]+b[1])/2,yaw=Math.atan2(b[0]-a[0],b[1]-a[1]);for(const type of ['auto','car'])if(actual.pose(x,z,yaw,type))valid++;}assert.ok(valid>40);
console.log(`Driving passed: 35/80 km/h caps, braking, footprint road/zone/boundary checks, no high-speed tunnelling, all campus/stalls inside area, ${valid} actual Road 5 poses.`);
