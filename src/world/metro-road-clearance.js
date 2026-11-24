import {metroCenterlines} from './metro-layout.js';
import {ROAD5_WAYS} from './sites/ldrp-market-layout.js';
export const CARRIAGEWAY_IDS=[...ROAD5_WAYS,338768422,386749310,386749309,386749314];
const widths={motorway:26,trunk:22,primary:18,secondary:13,tertiary:10,residential:7,unclassified:7,living_street:6,service:5,footway:2.5,path:2,cycleway:3,pedestrian:6};
function nearest(x,z,paths){let best={d:Infinity};for(const path of paths)for(let i=1;i<path.pts.length;i++){const a=path.pts[i-1],b=path.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(len*len||1))),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.d)best={d,x:px,z:pz,dx:dx/(len||1),dz:dz/(len||1)};}return best;}
export function alignMetroRoads(map){
 const paths=metroCenterlines(map.metro||[]);
 for(const road of map.roads)if(CARRIAGEWAY_IDS.includes(road.id)){
  road.width=6.2;road.sidewalkSides=[-1];const pts=[];
  for(let i=1;i<road.pts.length;i++){const a=road.pts[i-1],b=road.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),n=Math.max(1,Math.ceil(len/8));for(let k=i===1?0:1;k<=n;k++){let x=a[0]+dx*k/n,z=a[1]+dz*k/n;const p=nearest(x,z,paths),parallel=Math.abs((dx*p.dx+dz*p.dz)/(len||1));if(p.d>.02&&p.d<4.75&&parallel>.94){x=p.x+(x-p.x)/p.d*4.75;z=p.z+(z-p.z)/p.d*4.75;}pts.push([x,z]);}}road.pts=pts;
 }
 return map;
}
export function roadClearance(map){const segments=[];for(const r of map.roads){const w=r.width||widths[r.kind];if(!w||r.bridge)continue;for(let i=1;i<r.pts.length;i++)segments.push({a:r.pts[i-1],b:r.pts[i],half:w/2});}const cells=new Map();for(const s of segments)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-s.half-3)/30);x<=Math.floor((Math.max(s.a[0],s.b[0])+s.half+3)/30);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-s.half-3)/30);z<=Math.floor((Math.max(s.a[1],s.b[1])+s.half+3)/30);z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);}
 return(x,z,margin=1.05)=>!(cells.get(`${Math.floor(x/30)},${Math.floor(z/30)}`)||[]).some(({a,b,half})=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<half+margin;});
}
export function roadMedian(map){const roads=map.roads.filter(r=>CARRIAGEWAY_IDS.includes(r.id));return(x,z)=>{let first=null;for(const road of roads){const n=nearest(x,z,[road]);if(n.d<3.2||n.d>10)continue;if(!first){first=n;continue;}const dot=first.dx*n.dx+first.dz*n.dz,side=(first.x-x)*(n.x-x)+(first.z-z)*(n.z-z);if(Math.abs(dot)>.85&&side<0)return true;}return false;};}
