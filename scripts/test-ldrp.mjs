import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as THREE from 'three';
import {LDRP} from '../src/world/sites/ldrp.js';
import * as K from '../src/world/sites/kit.js';
import {placePos,placeById} from '../src/data/places.js';
const map=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)));
const palm=new THREE.Group();K.palm(palm,2,3);palm.updateMatrixWorld(true);
palm.traverse(o=>{if(o.isMesh){assert.ok(o.matrixWorld.elements.every(Number.isFinite));assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));}});
const origin=placePos(placeById('ldrp'));
const f=K.frame(origin),solids=[];
assert.equal(LDRP.gates.length,1,'Only one shared entry/exit');
for(const id of [...LDRP.university,...LDRP.quarters]) {
  const fp=K.osmFootprint(map,id,f);assert.ok(fp,`Missing mapped block ${id}`);solids.push({poly:fp.ring});
}
const gate=LDRP.gates[0],walls=[];
for(let i=0;i<LDRP.area.length;i++) {
  const a=LDRP.area[i],b=LDRP.area[(i+1)%LDRP.area.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
  if(K.segDist(gate.u,gate.v,a,b)>3){walls.push([a,b]);continue;}
  const t=((gate.u-a[0])*dx+(gate.v-a[1])*dz)/len;
  const at=d=>[a[0]+dx/len*d,a[1]+dz/len*d];
  walls.push([a,at(t-gate.width/2)],[at(t+gate.width/2),b]);
}
const localFrame=K.frame({x:0,z:0});
const zone=K.createSiteZone({id:'ldrp',f:localFrame,area:LDRP.area,solids,walls,vehicleFree:[LDRP.area]});
assert.ok(zone.heights(gate.u,gate.v).length,'Gate must allow pedestrians');
for(const {poly} of solids) {
  // A polygon centroid may be an open courtyard. Sample its filled triangles.
  const pts=poly.map(([x,y])=>new THREE.Vector2(x,y));
  for(const tri of THREE.ShapeUtils.triangulateShape(pts,[])) {
    const x=tri.reduce((s,i)=>s+poly[i][0]/3,0),z=tri.reduce((s,i)=>s+poly[i][1]/3,0);
    assert.equal(zone.heights(x,z).length,0,'Building envelopes stay closed');
  }
}
for(const [a,b] of walls)assert.equal(zone.heights((a[0]+b[0])/2,(a[1]+b[1])/2).length,0,'Boundary must block shortcuts');
console.log('LDRP passed: one pedestrian gate, all 11 mapped blocks closed, every perimeter section blocked.');
