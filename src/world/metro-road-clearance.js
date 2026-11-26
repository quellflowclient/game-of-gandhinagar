import {ROAD5_WAYS,CARRIAGEWAY_WIDTH,ORIGINAL_CARRIAGEWAY_WIDTH} from './sites/ldrp-market-layout.js';
export const CARRIAGEWAY_IDS=[...ROAD5_WAYS,338768422,386749310,386749309,386749314];
const widths={motorway:26,trunk:22,primary:18,secondary:13,tertiary:10,residential:7,unclassified:7,living_street:6,service:5,footway:2.5,path:2,cycleway:3,pedestrian:6};
function nearest(x,z,paths){let best={d:Infinity};for(const path of paths)for(let i=1;i<path.pts.length;i++){const a=path.pts[i-1],b=path.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(len*len||1))),px=a[0]+dx*t,pz=a[1]+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.d)best={d,x:px,z:pz,dx:dx/(len||1),dz:dz/(len||1)};}return best;}
export function alignMetroRoads(map){
 // Use original opposite carriageways to choose the outward normal, never
 // push the asphalt into the existing pillars / fenced median.
 const pairs=new Map([[326054220,386749311],[386749311,326054220],[386751118,903991653],[903991653,386751118]]);
 const originals=map.roads.filter(r=>ROAD5_WAYS.includes(r.id)).map(r=>({...r,pts:r.pts.map(p=>p.slice())}));
 for(const road of map.roads){
  if(ROAD5_WAYS.includes(road.id)){
   if(!road.wideRoad5){const opposite=originals.filter(r=>r.id===pairs.get(road.id)),shift=(CARRIAGEWAY_WIDTH-ORIGINAL_CARRIAGEWAY_WIDTH)/2;
    road.pts=road.pts.map(([x,z])=>{const q=nearest(x,z,opposite),dx=x-q.x,dz=z-q.z,d=Math.hypot(dx,dz);return d>.01?[x+dx/d*shift*Math.min(1,d/4),z+dz/d*shift*Math.min(1,d/4)]:[x,z];});
    road.wideRoad5=true;
   }
   road.width=CARRIAGEWAY_WIDTH;road.sidewalkSides=[-1];road.onewayLanes=2;
  }else if(CARRIAGEWAY_IDS.includes(road.id)){road.width=ORIGINAL_CARRIAGEWAY_WIDTH;road.sidewalkSides=[-1];}
 }
 return map;
}
export function roadClearance(map){const segments=[];for(const r of map.roads){const w=r.width||widths[r.kind];if(!w||r.bridge)continue;for(let i=1;i<r.pts.length;i++)segments.push({a:r.pts[i-1],b:r.pts[i],half:w/2});}const cells=new Map();for(const s of segments)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-s.half-3)/30);x<=Math.floor((Math.max(s.a[0],s.b[0])+s.half+3)/30);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-s.half-3)/30);z<=Math.floor((Math.max(s.a[1],s.b[1])+s.half+3)/30);z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);}
 return(x,z,margin=1.05)=>!(cells.get(`${Math.floor(x/30)},${Math.floor(z/30)}`)||[]).some(({a,b,half})=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<half+margin;});
}
export function medianCenter(map){const roads=map.roads.filter(r=>CARRIAGEWAY_IDS.includes(r.id));return(x,z)=>{const nearby=roads.map(r=>nearest(x,z,[r])).filter(n=>n.d>2.5&&n.d<10);let best=null,gap=Infinity;for(let i=0;i<nearby.length;i++)for(let j=i+1;j<nearby.length;j++){const a=nearby[i],b=nearby[j],dot=a.dx*b.dx+a.dz*b.dz,side=(a.x-x)*(b.x-x)+(a.z-z)*(b.z-z);if(Math.abs(dot)>.85&&side<0&&a.d+b.d<gap){gap=a.d+b.d;best={x:(a.x+b.x)/2,z:(a.z+b.z)/2};}}return best;};}
export function roadMedian(map){const centre=medianCenter(map);return(x,z)=>!!centre(x,z);}
