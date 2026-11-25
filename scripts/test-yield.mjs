// Drivers brake for a person standing in their lane, wait, then continue once the road is clear.
import {createTrafficSimulation,trafficDensity} from '../src/world/traffic-routes.js';
const map={roads:[{kind:'primary',pts:[[0,-400],[0,400]],oneway:1}]};
let seed=3;const random=()=>((seed=seed*16807%2147483647)/2147483647);
const sim=createTrafficSimulation(map,[],{count:1,random});
const v=sim.vehicles[0],center={x:0,z:0};
sim.update(.05,center);v.s=330;v.speed=v.cruise;
const person={x:v.direction>0?0:0,z:0,r:.45};
let minGap=Infinity;
for(let i=0;i<600;i++){sim.update(.05,center,{obstacles:[person]});if(v.pose)minGap=Math.min(minGap,Math.abs(v.pose.z-person.z)-v.length/2);}
if(!(v.speed<.05))throw new Error(`vehicle did not stop: speed ${v.speed}`);
if(minGap<1)throw new Error(`stopped too close: ${minGap.toFixed(2)} m`);
const stopped=v.s;
for(let i=0;i<200;i++)sim.update(.05,center,{obstacles:[]});
if(Math.abs(v.s-stopped)<10)throw new Error('vehicle did not move on after the person crossed');
const rush=trafficDensity(9),quiet=trafficDensity(12),night=trafficDensity(2),leave=trafficDensity(15);
if(!(rush===1&&leave===1&&quiet<.5&&night<.15))throw new Error(`density ${rush} ${leave} ${quiet} ${night}`);
console.log(`Yield passed: stopped ${minGap.toFixed(1)} m before the person, resumed afterwards; density 09:00 ${rush}, 12:00 ${quiet.toFixed(2)}, 15:00 ${leave}, 02:00 ${night.toFixed(2)}.`);
