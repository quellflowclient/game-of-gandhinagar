import {segDist} from './kit.js';
import {createSidewalks,HAS_SIDEWALK} from '../sidewalks.js';
const widths={motorway:26,trunk:22,primary:18,secondary:13,tertiary:10,residential:7,unclassified:7,living_street:6,service:5,pedestrian:6,footway:2.5,path:2,cycleway:3};
// Match city.js asphalt elevation, including roads through a site's navigation zone.
export function districtGround(map,f,fallback=.008){
  const grid=new Map(),cell=40;
  function add(path,w,h){for(let i=1;i<path.length;i++){
    const a=f.toLocal(...path[i-1]),b=f.toLocal(...path[i]),s={a:[a.u,a.v],b:[b.u,b.v],w,h};
    for(let x=Math.floor((Math.min(a.u,b.u)-w)/cell);x<=Math.floor((Math.max(a.u,b.u)+w)/cell);x++)for(let z=Math.floor((Math.min(a.v,b.v)-w)/cell);z<=Math.floor((Math.max(a.v,b.v)+w)/cell);z++){
      const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(s);
    }
  }}
  const sidewalks=createSidewalks(map.roads,widths);
  for(const r of map.roads){const w=r.width||widths[r.kind];if(!w)continue;add(r.pts,w,.208+w*.004);
    if(HAS_SIDEWALK.has(r.kind))for(const side of r.sidewalkSides||[-1,1])for(const path of sidewalks.sections(r,r.pts,side))add(path,2.6,.308+w*.004);
  }
  return (u,v)=>{let h=fallback;for(const s of grid.get(`${Math.floor(u/cell)},${Math.floor(v/cell)}`)||[])if(segDist(u,v,s.a,s.b)<=s.w/2)h=Math.max(h,s.h);return h;};
}
