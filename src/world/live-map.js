import {placePos,placeById,isLivePlace} from '../data/places.js';
import {marketPoint,LDRP_PLAY_AREA} from './sites/ldrp-market-layout.js';
import {siteToWorld} from './mahatma-layout.js';
const bounds=points=>({minX:Math.min(...points.map(p=>p.x))-100,maxX:Math.max(...points.map(p=>p.x))+100,minZ:Math.min(...points.map(p=>p.z))-100,maxZ:Math.max(...points.map(p=>p.z))+100});
export function liveMapBounds(){const l=placePos(placeById('ldrp')),d=placePos(placeById('dandi')),b=LDRP_PLAY_AREA;return[bounds([[b.minU,b.minV],[b.minU,b.maxV],[b.maxU,b.minV],[b.maxU,b.maxV]].map(p=>marketPoint(l,...p))),bounds([[-160,-120],[160,-120],[-160,730],[160,730]].map(p=>siteToWorld(d,...p)))];}
function clip(a,b,q){const dx=b[0]-a[0],dz=b[1]-a[1];let lo=0,hi=1;for(const [p,r] of [[-dx,a[0]-q.minX],[dx,q.maxX-a[0]],[-dz,a[1]-q.minZ],[dz,q.maxZ-a[1]]]){if(p===0){if(r<0)return null;continue;}const t=r/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}return[[a[0]+dx*lo,a[1]+dz*lo],[a[0]+dx*hi,a[1]+dz*hi]];}
export function createLiveMap(full){
 const boxes=liveMapBounds(),inside=([x,z])=>boxes.some(b=>x>=b.minX&&x<=b.maxX&&z>=b.minZ&&z<=b.maxZ);
 const polylines=items=>items.flatMap(item=>{const runs=[];for(const box of boxes){let run=[];const flush=()=>{if(run.length>1)runs.push({...item,pts:run});run=[];};for(let i=1;i<item.pts.length;i++){const s=clip(item.pts[i-1],item.pts[i],box);if(!s){flush();continue;}if(run.length&&Math.hypot(run.at(-1)[0]-s[0][0],run.at(-1)[1]-s[0][1])>.1)flush();if(!run.length)run.push(s[0]);run.push(s[1]);}flush();}return runs;});
 const intersects=item=>{const pts=item.pts||[];return boxes.some(b=>Math.max(...pts.map(p=>p[0]))>=b.minX&&Math.min(...pts.map(p=>p[0]))<=b.maxX&&Math.max(...pts.map(p=>p[1]))>=b.minZ&&Math.min(...pts.map(p=>p[1]))<=b.maxZ);};
 return{...full,roads:polylines(full.roads),metro:polylines(full.metro||[]),buildings:full.buildings.filter(intersects),water:full.water.filter(intersects),parks:full.parks.filter(intersects),stations:(full.stations||[]).filter(s=>inside(s.pos)),places:(full.places||[]).filter(p=>isLivePlace(p.id))};
}
