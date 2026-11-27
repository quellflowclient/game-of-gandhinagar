import assert from 'node:assert/strict';
import './load-parking-test-assets.mjs';
import fs from 'node:fs';
import * as THREE from 'three';
import {buildSwarnim} from '../src/world/sites/swarnim.js';
import {buildSwagat} from '../src/world/sites/swagat.js';
import {buildGift} from '../src/world/sites/gift.js';
import {createNavigation} from '../src/world/navigation.js';
import {DISTRICTS,explorationAreaAt,explorationAreaForPlace,districtFrame} from '../src/world/exploration-areas.js';
import {createLiveMap} from '../src/world/live-map.js';
import {placePos,placeById} from '../src/data/places.js';
const noop=()=>{};
globalThis.document={createElement(){const canvas={width:1,height:1,toDataURL:()=>''};const context=new Proxy({canvas,createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:t=>({width:String(t).length*8}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:noop});canvas.getContext=()=>context;return canvas;}};
const full=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url))),map=createLiveMap(full),scene=new THREE.Scene();
const builders={swarnim:buildSwarnim,swagat:buildSwagat,gift:buildGift};
const sites=Object.fromEntries(Object.entries(builders).map(([id,build])=>[id,build(scene,map,placePos(placeById(id)))]));
const nav=createNavigation(Object.values(sites).map(s=>s.zone),{roads:map.roads,playArea:(x,z,r)=>!!explorationAreaAt(x,z,r)});
for(const [id,site] of Object.entries(sites)){
  const f=site.frame,b=DISTRICTS[id],sp=site.spawn;
  assert.equal(explorationAreaAt(sp.x,sp.z,1.5),explorationAreaForPlace(id),`${id}: arrival stays inside district`);
  assert.notEqual(nav.surface(sp.x,sp.z,0,.38,Infinity),undefined,`${id}: clear arrival`);
  const corrected=nav.safePoint(sp.x,sp.z);assert.ok(Math.hypot(corrected.x-sp.x,corrected.z-sp.z)<.01,`${id}: no hidden spawn correction`);
  // Full-city/combined-corridor path and source coverage have their own test.
  if(id!=='swagat'){console.log(`${id}: clear arrival in ${explorationAreaForPlace(id)}; complete source coverage checked by test:geography.`);continue;}
  // Flood-fill actual collision surfaces. Every NPC home must be reachable from arrival.
  const step=2,cols=Math.floor((b.maxU-b.minU)/step)+1,rows=Math.floor((b.maxV-b.minV)/step)+1;
  const cells=new Uint8Array(cols*rows),parent=new Int32Array(cols*rows).fill(-1),queue=[];
  const at=(i,j)=>f.toWorld(b.minU+i*step,b.minV+j*step);
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const p=at(i,j);if(nav.surface(p.x,p.z,0,.38,Infinity)!==undefined)cells[j*cols+i]=1;
  }
  const index=p=>{const q=f.toLocal(p.x,p.z);return Math.round((q.v-b.minV)/step)*cols+Math.round((q.u-b.minU)/step);};
  const start=index(sp);assert.ok(cells[start],`${id}: arrival grid is walkable`);cells[start]=2;queue.push(start);
  for(let k=0;k<queue.length;k++){
    const n=queue[k],i=n%cols,j=Math.floor(n/cols);
    for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
      const ni=i+dx,nj=j+dz,q=nj*cols+ni;if(ni<0||ni>=cols||nj<0||nj>=rows||cells[q]!==1)continue;
      const from=at(i,j),to=at(ni,nj),mid=f.toLocal((from.x+to.x)/2,(from.z+to.z)/2);
      if(site.zone.blocked(mid.u,mid.v,.38))continue;cells[q]=2;parent[q]=n;queue.push(q);
    }
  }
  const checked=new Set();
  for(const p of sp.residents){const safe=nav.safePoint(p.x,p.z);assert.equal(explorationAreaAt(safe.x,safe.z),id);
    const near=index(safe),candidates=[near,near-1,near+1,near-cols,near+cols,near-cols-1,near-cols+1,near+cols-1,near+cols+1];
    const goal=candidates.find(n=>{if(cells[n]!==2)return false;const from=at(n%cols,Math.floor(n/cols));from.y=nav.surface(from.x,from.z,0,.38,Infinity);return nav.canTravel(from,safe);});
    assert.notEqual(goal,undefined,`${id}: resident route reachable at ${JSON.stringify(f.toLocal(p.x,p.z))}`);
    for(let n=goal;parent[n]!==-1;n=parent[n]){if(checked.has(n))break;checked.add(n);const prev=parent[n],from=at(prev%cols,Math.floor(prev/cols)),to=at(n%cols,Math.floor(n/cols));from.y=nav.surface(from.x,from.z,0,.38,Infinity);assert.ok(nav.canTravel(from,to),`${id}: swept walking along connected route`);}
  }
  for(const [u,v] of [[b.minU-2,b.minV+10],[b.maxU+2,b.maxV-10],[b.minU+10,b.minV-2],[b.maxU-10,b.maxV+2]]){
    const p=f.toWorld(u,v);assert.equal(nav.surface(p.x,p.z,0,.38,Infinity),undefined,`${id}: boundary blocks escape`);
  }
  console.log(`${id}: valid arrival, ${sp.residents.length} reachable resident homes, ${queue.length} connected surface samples, bounded walking.`);
}
for(const id of [386478178,386478179,922160513,922160514,922160515]){
  const b=map.buildings.find(b=>b.id===id);assert.ok(b,`Tower ${id} retained`);
  const p=b.pts.slice(0,-1).reduce((p,q)=>({x:p.x+q[0]/(b.pts.length-1),z:p.z+q[1]/(b.pts.length-1)}),{x:0,z:0});
  assert.equal(nav.surface(p.x,p.z,0,.38,Infinity),undefined,`Cannot walk through tower ${id}`);
}
let meshes=0,vertices=0;scene.updateMatrixWorld(true);scene.traverse(o=>{if(!o.isMesh)return;assert.ok(o.matrixWorld.elements.every(Number.isFinite));for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n));meshes++;vertices+=o.geometry.attributes.position.count;});
// No clipped road segment can stretch between two separated districts.
for(const road of map.roads)for(let i=1;i<road.pts.length;i++)assert.ok(Math.hypot(road.pts[i][0]-road.pts[i-1][0],road.pts[i][1]-road.pts[i-1][1])<1900);
console.log(`Destination geometry passed: ${meshes} finite meshes / ${vertices} vertices; five real tower footprints; independent districts.`);
