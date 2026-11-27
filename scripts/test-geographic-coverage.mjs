import assert from 'node:assert/strict';
import './load-parking-test-assets.mjs';
import fs from 'node:fs';
import * as THREE from 'three';
import geography from '../src/data/destination-geography.json' with {type:'json'};
import {buildLandmarks} from '../src/world/landmarks.js';
import {buildGift} from '../src/world/sites/gift.js';
import {buildSwarnim} from '../src/world/sites/swarnim.js';
import {createLiveMap} from '../src/world/live-map.js';
import {explorationAreaAt,explorationAreaForPlace,CIVIC_AREA,districtFrame} from '../src/world/exploration-areas.js';
import {placePos,placeById} from '../src/data/places.js';
import {siteToWorld} from '../src/world/mahatma-layout.js';
const noop=()=>{};globalThis.matchMedia=()=>({matches:false});
globalThis.document={createElement(){const canvas={width:1,height:1,toDataURL:()=>''};const context=new Proxy({canvas,createLinearGradient:()=>({addColorStop:noop}),createRadialGradient:()=>({addColorStop:noop}),measureText:t=>({width:String(t).length*8}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)})},{get:(o,k)=>k in o?o[k]:noop});canvas.getContext=()=>context;return canvas;}};
const full=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url))),map=createLiveMap(full),scene=new THREE.Scene();
const gift=buildGift(scene,map,placePos(placeById('gift'))),park=buildSwarnim(scene,map,placePos(placeById('swarnim')));
assert.equal(gift.inventory.length,geography.gift.buildingIds.length);assert.ok(gift.inventory.length>50,'Full GIFT inventory, not five selected towers');assert.ok(geography.gift.areaM2>3_500_000,'Retain the complete mapped city boundary');
for(const id of geography.gift.buildingIds){const expected=geography.buildings.find(b=>b.id===id),actual=gift.inventory.find(b=>b.id===id),runtime=map.buildings.find(b=>b.id===id);assert.deepEqual(actual.pts,expected.pts,`Building ${id} is not relocated or rescaled`);assert.deepEqual(actual.holes,expected.holes||[],`Building ${id} retains its courtyard geometry`);assert.deepEqual(runtime.pts,expected.pts,`Runtime clipping preserves full ${id} footprint`);}
assert.equal(park.plots.length,4);assert.ok(geography.swarnim.areaM2>330_000);
for(const plot of geography.swarnim.plots)for(const [x,z] of plot.pts)assert.equal(explorationAreaAt(x,z),'dandi','Every park vertex belongs to the combined civic area');
for(const id of ['dandi','swarnim'])assert.equal(explorationAreaForPlace(id),'dandi');
for(const [id,site] of [['gift',gift],['swarnim',park]]){assert.equal(explorationAreaAt(site.spawn.x,site.spawn.z,1),explorationAreaForPlace(id));assert.ok(site.zone.heights(site.spawn.x,site.spawn.z).length,`${id} arrival is clear`);}
const frame=districtFrame('gift');for(const [u,v] of [[-270,-180],[330,395]])assert.equal(explorationAreaAt(...Object.values(frame.toWorld(u,v))),'gift','Old tower-block border is no longer a walking limit');
const civicOrigin=placePos(placeById('dandi'));
for(const [u,v] of [[CIVIC_AREA.minU-1,800],[CIVIC_AREA.maxU+1,800],[0,CIVIC_AREA.maxV+1]]){const p=siteToWorld(civicOrigin,u,v);assert.equal(explorationAreaAt(p.x,p.z),null,'Combined outer boundary is finite');}
// The complete world adds collision to every retained mapped background building.
const world=buildLandmarks(new THREE.Scene(),map),nav=world.navigation;
for(const id of ['dandi','swarnim','gift']){const p=world.spawns[id],safe=nav.safePoint(p.x,p.z);assert.ok(Math.hypot(safe.x-p.x,safe.z-p.z)<.02,`${id}: safe arrival needs no hidden relocation`);}
// A* over the actual pedestrian surfaces, with swept edge checks. Start outside
// the museum and reach each full-length park section without teleporting.
const step=5,b=CIVIC_AREA,cols=Math.floor((b.maxU-b.minU)/step)+1,rows=Math.floor((b.maxV-b.minV)/step)+1;
const node=(i,j)=>siteToWorld(civicOrigin,b.minU+i*step,b.minV+j*step);
const pass=new Int8Array(cols*rows).fill(-1);const point=n=>{const p=node(n%cols,Math.floor(n/cols)),y=nav.surface(p.x,p.z,0,.38,Infinity);return y===undefined?null:{...p,y};};
const walkable=n=>{if(n<0||n>=pass.length)return false;if(pass[n]<0)pass[n]=point(n)?1:0;return !!pass[n];};
const near=(u,v)=>{const i=Math.round((u-b.minU)/step),j=Math.round((v-b.minV)/step);for(let r=0;r<4;r++)for(let dz=-r;dz<=r;dz++)for(let dx=-r;dx<=r;dx++){const n=(j+dz)*cols+i+dx;if(walkable(n))return n;}throw Error('No route endpoint');};
function route(start,goal){
 const g=new Float64Array(cols*rows).fill(Infinity),parent=new Int32Array(cols*rows).fill(-1),done=new Uint8Array(cols*rows),heap=[];
 const heuristic=n=>Math.hypot(n%cols-goal%cols,Math.floor(n/cols)-Math.floor(goal/cols));
 const push=(n,f)=>{heap.push({n,f});let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=f)break;heap[i]=heap[p];i=p;}heap[i]={n,f};};
 const pop=()=>{const top=heap[0],tail=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=tail.f)break;heap[i]=heap[c];i=c;}heap[i]=tail;}return top.n;};
 g[start]=0;push(start,heuristic(start));let visited=0;
 while(heap.length){const n=pop();if(done[n])continue;done[n]=1;visited++;if(n===goal){let count=0;for(let p=n;parent[p]!==-1;p=parent[p])count++;return {count,visited};}
   const i=n%cols,j=Math.floor(n/cols),from=point(n);for(const [dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){const ni=i+dx,nj=j+dz,q=nj*cols+ni;if(ni<0||ni>=cols||nj<0||nj>=rows||done[q]||!walkable(q))continue;const cost=g[n]+Math.hypot(dx,dz);if(cost>=g[q])continue;const to=point(q);if(!nav.canTravel(from,to))continue;g[q]=cost;parent[q]=n;push(q,cost+heuristic(q));}
 }
 throw Error(`No continuous walking route after ${visited} samples`);
}
let start=near(0,-110);for(const [u,v] of [[0,780],[0,1200],[0,2050],[0,2750],[0,2850]]){const goal=near(u,v),result=route(start,goal);console.log(`Connected civic route to ${u},${v}: ${result.count} swept edges / ${result.visited} visited nodes`);start=goal;}
let meshes=0;scene.updateMatrixWorld(true);scene.traverse(o=>{if(!o.isMesh)return;assert.ok(o.matrixWorld.elements.every(Number.isFinite));for(const a of Object.values(o.geometry.attributes))for(const n of a.array)assert.ok(Number.isFinite(n));meshes++;});
console.log(`Geographic coverage passed: ${gift.inventory.length} unscaled GIFT buildings, ${geography.gift.areaM2} m² GIFT outline, four actual park plots, connected Mandir–Swarnim corridor, ${meshes} finite site meshes.`);
