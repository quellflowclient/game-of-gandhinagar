import {isLivePlace} from '../data/places.js';
import {explorationCorners} from './exploration-areas.js';
import {smoothRoundabout} from './road-path.js';
import geography from '../data/destination-geography.json' with {type:'json'};
const bounds=points=>({minX:Math.min(...points.map(p=>p.x))-100,maxX:Math.max(...points.map(p=>p.x))+100,minZ:Math.min(...points.map(p=>p.z))-100,maxZ:Math.max(...points.map(p=>p.z))+100});
export function liveMapBounds(){return explorationCorners().map(bounds);}
function clip(a,b,q){const dx=b[0]-a[0],dz=b[1]-a[1];let lo=0,hi=1;for(const [p,r] of [[-dx,a[0]-q.minX],[dx,q.maxX-a[0]],[-dz,a[1]-q.minZ],[dz,q.maxZ-a[1]]]){if(p===0){if(r<0)return null;continue;}const t=r/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}return[[a[0]+dx*lo,a[1]+dz*lo],[a[0]+dx*hi,a[1]+dz*hi]];}
export function createLiveMap(full){
 // The same complete, georeferenced inventory is applied to both the full source
 // and the pre-clipped runtime map. Re-clipping never drops distant GIFT buildings.
 const buildings=new Map(full.buildings.map(b=>[b.id,b]));for(const b of geography.buildings)buildings.set(b.id,b);
 const roads=full.roads.filter(r=>!geography.roads.some(g=>g.id===r.id));roads.push(...geography.roads);
 const parks=[...full.parks];for(const p of geography.swarnim.plots)if(!parks.some(q=>q.id===p.id||q.pts.length===p.pts.length&&Math.hypot(q.pts[0][0]-p.pts[0][0],q.pts[0][1]-p.pts[0][1])<.2))parks.push({id:p.id,kind:'park',pts:p.pts});
 full={...full,buildings:[...buildings.values()],roads,parks};
 // Idempotent: the pre-clipped live file already carries the smoothed ring.
 full={...full,roads:full.roads.map(r=>r.id===386749312&&!r.smoothed?{...r,pts:smoothRoundabout(r.pts),smoothed:true}:r)};
 const boxes=liveMapBounds(),inside=([x,z])=>boxes.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ);
 const polylines=items=>items.flatMap(item=>{
   const runs=[];let run=[];
   const flush=()=>{if(run.length>1)runs.push({...item,pts:run});run=[];};
   for(let i=1;i<item.pts.length;i++){
     const a=item.pts[i-1],b=item.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],length2=dx*dx+dz*dz;
     if(length2<1e-8)continue;
     // Union clip intervals first: overlapping neighbourhood bounds must not
     // draw a road/rail segment twice or create duplicate traffic lanes.
     const intervals=boxes.map(box=>clip(a,b,box)).filter(Boolean).map(s=>s.map(p=>((p[0]-a[0])*dx+(p[1]-a[1])*dz)/length2)).sort((x,y)=>x[0]-y[0]);
     const union=[];for(const interval of intervals){const previous=union.at(-1);if(previous&&interval[0]<=previous[1]+1e-8)previous[1]=Math.max(previous[1],interval[1]);else union.push([...interval]);}
     if(!union.length){flush();continue;}
     for(const [lo,hi] of union){if(hi-lo<1e-8)continue;const start=[a[0]+dx*lo,a[1]+dz*lo],end=[a[0]+dx*hi,a[1]+dz*hi];
       if(run.length&&Math.hypot(run.at(-1)[0]-start[0],run.at(-1)[1]-start[1])>.1)flush();
       if(!run.length)run.push(start);run.push(end);
     }
   }
   flush();return runs;
 });
 const intersects=item=>{const pts=item.pts||[];return boxes.some(b=>Math.max(...pts.map(p=>p[0]))>=b.minX&&Math.min(...pts.map(p=>p[0]))<=b.maxX&&Math.max(...pts.map(p=>p[1]))>=b.minZ&&Math.min(...pts.map(p=>p[1]))<=b.maxZ);};
 return{...full,roads:polylines(full.roads),metro:polylines(full.metro||[]),buildings:full.buildings.filter(intersects),water:full.water.filter(intersects),parks:full.parks.filter(intersects),stations:(full.stations||[]).filter(s=>inside(s.pos)),places:(full.places||[]).filter(p=>isLivePlace(p.id))};
}
