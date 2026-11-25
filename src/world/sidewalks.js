import {offsetPath} from './road-path.js';
export const HAS_SIDEWALK=new Set(['motorway','trunk','primary','secondary','tertiary']);
// Shared by the renderer and ground-height sampler. Pavement stops before
// crossing another asphalt lane instead of making raised zigzags through it.
export function createSidewalks(roads,widths){
 const grid=new Map(),cell=40;
 for(const road of roads){if(['footway','path','cycleway','pedestrian'].includes(road.kind))continue;const width=road.width||widths[road.kind];if(!width)continue;for(let i=1;i<road.pts.length;i++){const a=road.pts[i-1],b=road.pts[i],segment={a,b,half:width/2,road};for(let x=Math.floor((Math.min(a[0],b[0])-width-3)/cell);x<=Math.floor((Math.max(a[0],b[0])+width+3)/cell);x++)for(let z=Math.floor((Math.min(a[1],b[1])-width-3)/cell);z<=Math.floor((Math.max(a[1],b[1])+width+3)/cell);z++){const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(segment);}}}
 function clear(x,z,owner){return!(grid.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[]).some(({a,b,half,road})=>{if(road===owner||(owner.id!=null&&road.id===owner.id))return false;const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<half+1.35;});}
 function sections(road,points=road.pts,side=1){
  const runs=[],offset=side*((road.width||widths[road.kind])/2+1.3),path=offsetPath(points,offset);
  let run=[];const flush=()=>{if(run.length>1)runs.push(run);run=[];};
  for(let i=1;i<path.length;i++){
   const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/2));
   for(let k=0;k<n;k++){
    const p=[a[0]+dx*k/n,a[1]+dz*k/n],q=[a[0]+dx*(k+1)/n,a[1]+dz*(k+1)/n];
    if(clear(...p,road)&&clear(...q,road)&&clear((p[0]+q[0])/2,(p[1]+q[1])/2,road)){if(!run.length)run.push(p);run.push(q);}else flush();
   }
  }
  flush();return runs;
 }
 return{sections};
}
