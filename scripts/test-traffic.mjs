import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createTrafficSimulation,roadPose,prepareTrafficRoutes,ROAD_WIDTH} from '../src/world/traffic-routes.js';
import {createMahatmaZone} from '../src/world/mahatma-layout.js';
import {placePos,placeById} from '../src/data/places.js';
const map=JSON.parse(fs.readFileSync('public/data/gandhinagar-map.json','utf8'));
const origin=placePos(placeById('dandi')),zone=createMahatmaZone(origin);
let seed=34812;const random=()=>((seed=seed*16807%2147483647)/2147483647);
const simulation=createTrafficSimulation(map,[zone],{count:45,random});
let samples=0,visible=0;
for(let i=0;i<900;i++) {
  simulation.update(0.12,{x:origin.x+150,z:origin.z+100});
  for(const vehicle of simulation.vehicles)if(vehicle.pose) {
    visible++;samples++;
    assert.ok(!zone.forbidsVehicles(vehicle.pose.x,vehicle.pose.z));
    const expected=roadPose(vehicle.route,vehicle.s,vehicle.direction,vehicle,[zone]);
    assert.ok(expected,'Every visible car must retain a road-valid full footprint');
    assert.deepEqual(vehicle.pose,expected);
    if(vehicle.route.oneway)assert.equal(vehicle.direction,vehicle.route.oneway===-1?-1:1);
  }
}
assert.ok(visible>1000,'There should be live traffic on the public roads, not an empty road');
// A tagged road across the museum is excluded even if it is incorrectly major.
const bad=prepareTrafficRoutes({roads:[{kind:'primary',pts:[[origin.x-100,origin.z],[origin.x+100,origin.z]]}]})[0];
assert.equal(roadPose(bad,bad.length/2,1,{width:1.84,length:4.5},[zone]),null);
// Long vehicles must stop being visible before their body leaves an end cap.
const short=prepareTrafficRoutes({roads:[{kind:'tertiary',pts:[[0,0],[0,100]],oneway:1}]})[0];
assert.equal(roadPose(short,2,1,{width:2.45,length:10.8}),null);
console.log(`Traffic passed: ${samples} complete vehicle placements on real road lanes, correct one-way travel, no cars inside either compound, invalid spawns/end caps hidden.`);
