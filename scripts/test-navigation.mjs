import assert from 'node:assert/strict';
import { createNavigation } from '../src/world/navigation.js';
import { MAHATMA as D, CAMPUS_FENCES,CAMPUS_GATES,createMahatmaZone, siteToWorld, worldToSite, bridgeHeight } from '../src/world/mahatma-layout.js';

// Tests exercise playable journeys and the exact failures this reconstruction
// fixes: walking through the cone, over water, onto roofs or off a raised bridge.
const origin = { x: -1410.5, z: -4203.8 };
const nav = createNavigation([createMahatmaZone(origin)]);
const point = (u,v,y=D.ground) => ({ ...siteToWorld(origin,u,v), y });
const step = (p,du,dv,radius) => {
  const delta = siteToWorld({x:0,z:0},du,dv);
  nav.move(p,delta.x,delta.z,radius);
};
const valid = p => assert.notEqual(nav.surface(p.x,p.z,p.y,0.38,0.001),undefined,JSON.stringify(worldToSite(origin,p.x,p.z)));
const close = (a,b,t=0.03) => assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);

// A sealed plot has no invisible gaps: try walking through every fence segment
// from both sides. Only the photographed pedestrian entrances are open.
for(const fence of CAMPUS_FENCES) {
  const dx=fence.b[0]-fence.a[0],dz=fence.b[1]-fence.a[1],len=Math.hypot(dx,dz);
  if(len<2)continue;
  const u=(fence.a[0]+fence.b[0])/2,v=(fence.a[1]+fence.b[1])/2,nx=-dz/len,nz=dx/len;
  for(const side of [-1,1]) {
    const start=point(u+nx*3*side,v+nz*3*side);
    const safe=nav.safePoint(start.x,start.z);step(safe,-nx*6*side,-nz*6*side);
    const end=worldToSite(origin,safe.x,safe.z);
    assert.ok(((end.u-u)*nx+(end.v-v)*nz)*side>0,'Fence must retain pedestrians on their original side');
  }
}
for(const gate of CAMPUS_GATES) {
  const at=point(gate.u,gate.v);
  assert.notEqual(nav.surface(at.x,at.z,D.ground,0.38,0.65),undefined,gate.name);
}

// Full inner and outer promenades, including the passage below the bridge.
for (const radius of [77,97]) {
  let p = point(0,-radius);
  for(let i=1;i<=1800;i++) {
    const a=Math.PI+i*Math.PI*2/1800;
    const dest=point(Math.sin(a)*radius,Math.cos(a)*radius);
    nav.move(p,dest.x-p.x,dest.z-p.z); valid(p);
    assert.ok(Math.hypot(p.x-dest.x,p.z-dest.z)<0.04,'Promenade must remain continuous');
  }
}

// A large movement must not tunnel through a moat or the sloped gallery roof.
let p = point(110/Math.SQRT2,110/Math.SQRT2);
step(p,-180/Math.SQRT2,-180/Math.SQRT2);
assert.ok(Math.hypot(...Object.values(worldToSite(origin,p.x,p.z)))>=D.waterOuter+0.35);
p=point(77/Math.SQRT2,-77/Math.SQRT2);
step(p,-60/Math.SQRT2,60/Math.SQRT2);
assert.ok(Math.hypot(...Object.values(worldToSite(origin,p.x,p.z)))>=D.bermOuter+0.35);
close(p.y,D.ground);

// All four radial public crossings reach the courtyard, then stop at the cone.
for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
  p=point(Math.sin(a)*110,Math.cos(a)*110);
  step(p,-Math.sin(a)*200,-Math.cos(a)*200);
  assert.ok(Math.hypot(...Object.values(worldToSite(origin,p.x,p.z)))>=D.coneRadius+0.35);
  valid(p);
}

// Walk the entire bridge uphill, over the road, and down into the open court.
p=point(0,46.5);
for(let v=46.6;v<=338;v+=0.1) {
  const dest=point(0,v); nav.move(p,dest.x-p.x,dest.z-p.z);
  close(p.y,bridgeHeight(v),0.035); valid(p);
}
close(p.y,D.ground,0.04);
for(let v=337.8;v>=46.5;v-=0.1) {
  const dest=point(0,v);nav.move(p,dest.x-p.x,dest.z-p.z);
  close(p.y,bridgeHeight(v),0.035);valid(p);
}

// A person crossing beneath the bridge stays at ground level.
p=point(-15,170); step(p,30,0); close(p.y,D.ground); close(worldToSite(origin,p.x,p.z).u,15);
// Guardrails retain both walkers and cyclists on the raised deck.
for(const radius of [0.38,0.52]) {
  p=point(0,205,bridgeHeight(205)); step(p,40,0,radius);
  assert.ok(Math.abs(worldToSite(origin,p.x,p.z).u)<=D.bridgeHalfWidth-radius+0.01);
  close(p.y,bridgeHeight(205));
}
// Mounting a wider bicycle beside a railing must keep the player on the deck.
p=point(D.bridgeHalfWidth-0.39,205,bridgeHeight(205));
const cyclingSpawn=nav.safePoint(p.x,p.z,p.y,0.52,0.65);
close(cyclingSpawn.y,bridgeHeight(205),0.1);
assert.ok(Math.abs(worldToSite(origin,cyclingSpawn.x,cyclingSpawn.z).u)<=D.bridgeHalfWidth-0.52);
// Convention centre walls/roofs and unsafe saved positions are never surfaces.
assert.equal(nav.surface(...[point(-60,260).x,point(-60,260).z],15,0.38,Infinity),undefined);
for(const [u,v] of [[0,0],[85/Math.SQRT2,85/Math.SQRT2],[-60,260]]) {
  const target=point(u,v), safe=nav.safePoint(target.x,target.z); valid(safe);
}
// Routes around a closed hall cannot be mistaken for a direct NPC path.
assert.equal(nav.canTravel(point(-143,260),point(0,260)),false);
assert.equal(nav.canTravel(point(0,-110),point(0,-48)),true);

// Long, repeatable random cycling simulation stresses edge sliding and corners.
let seed=9841; const random=()=>((seed=(seed*16807)%2147483647)/2147483647);
for(const start of [[0,-110],[77,0],[0,205]]) {
  p=point(...start,start[1]===205?bridgeHeight(205):D.ground);
  for(let i=0;i<6000;i++) {
    const a=random()*Math.PI*2; step(p,Math.sin(a)*2.5,Math.cos(a)*2.5); valid(p);
    assert.ok(Number.isFinite(p.y));
  }
}
const other={x:2000,y:0,z:2000}; nav.move(other,10,10); close(other.x,2010); close(other.z,2010); close(other.y,0);
console.log('Navigation passed: full promenades, 4 crossings, complete bridge, underpass, railings, walls, spawns, NPC routes and 18,000 random moves.');
