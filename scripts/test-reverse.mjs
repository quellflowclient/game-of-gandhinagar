import assert from 'node:assert/strict';
import {drivingSpeed,REVERSE_KMH} from '../src/world/driving.js';
// Pull back while moving: brake to a stop first, then reverse up to the cap; release: coast to 0.
for(const type of ['car','bike','scooter','auto']){
  let v=0;for(let i=0;i<200;i++)v=drivingSpeed(v,1,.05,type);assert.ok(v>5,type);
  let steps=0;while(v>0&&steps<400){v=drivingSpeed(v,-1,.05,type);steps++;}assert.ok(v<=0&&steps<400,`${type} brakes`);
  for(let i=0;i<200;i++)v=drivingSpeed(v,-1,.05,type);
  assert.ok(v<0&&Math.abs(Math.abs(v)-REVERSE_KMH[type]/3.6)<.01,`${type} reverse cap ${v}`);
  for(let i=0;i<400;i++)v=drivingSpeed(v,0,.05,type);assert.equal(v,0,`${type} coasts to rest`);
}
console.log(`Reverse passed: brake-then-reverse, caps ${Object.entries(REVERSE_KMH).map(([k,v])=>`${k} ${v} km/h`).join(', ')}, coast to rest.`);
