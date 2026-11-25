import assert from 'node:assert/strict';
import {createSidewalks} from '../src/world/sidewalks.js';
import {createNavigation} from '../src/world/navigation.js';
const roads=[{id:1,kind:'tertiary',width:4.8,pts:[[-50,0],[50,0]]},{id:2,kind:'secondary',width:6.2,pts:[[0,-50],[0,50]]}],saved=JSON.stringify(roads),widths={tertiary:10,secondary:13},walks=createSidewalks(roads,widths);
for(const side of [-1,1])for(const path of walks.sections(roads[0],roads[0].pts,side))for(const [x] of path)assert.ok(Math.abs(x)>4.4,'No pavement crossing the perpendicular asphalt lane');
assert.equal(JSON.stringify(roads),saved,'Pavement trimming cannot bend roads');
const nav=createNavigation([],{roads});assert.ok(Math.abs(nav.surface(0,3.7,0)-(.2+6.2*.004+.008))<1e-7,'Intersection stays at asphalt height');assert.ok(Math.abs(nav.surface(12,3.7,0)-(.3+4.8*.004+.008))<1e-7,'Real footpath keeps its raised surface');
console.log('Sidewalks passed: no raised diagonal pavement across junctions, straight road geometry retained, matching road/footpath ground heights.');
