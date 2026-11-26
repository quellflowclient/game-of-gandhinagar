// Traffic has no free-roaming movement: every visible vehicle is an arc-length
// sample of an OSM road lane, checked with its entire footprint before rendering.
export const ROAD_WIDTH = {trunk:22,primary:18,secondary:13,tertiary:10};
export function prepareTrafficRoutes(map) {
  return map.roads.filter(r=>ROAD_WIDTH[r.kind]&&r.pts.length>1&&!r.bridge).map((r,index)=>{
    let length=0;const cumulative=[0];
    for(let i=1;i<r.pts.length;i++){length+=Math.hypot(r.pts[i][0]-r.pts[i-1][0],r.pts[i][1]-r.pts[i-1][1]);cumulative.push(length);}
    return {...r,index,length,cumulative,minX:Math.min(...r.pts.map(p=>p[0])),maxX:Math.max(...r.pts.map(p=>p[0])),
      minZ:Math.min(...r.pts.map(p=>p[1])),maxZ:Math.max(...r.pts.map(p=>p[1])),
      directions:r.oneway===-1?[-1]:r.oneway?[1]:[-1,1]};
  }).filter(r=>r.length>30);
}
export function centerAt(route,distance) {
  const s=Math.max(0,Math.min(route.length,distance));let i=1;
  while(i<route.cumulative.length-1&&route.cumulative[i]<s)i++;
  const a=route.pts[i-1],b=route.pts[i],t=(s-route.cumulative[i-1])/(route.cumulative[i]-route.cumulative[i-1]||1);
  return {x:a[0]+(b[0]-a[0])*t,z:a[1]+(b[1]-a[1])*t};
}
function distanceToRoad(x,z,route) {
  let best=Infinity;
  for(let i=1;i<route.pts.length;i++) {
    const a=route.pts[i-1],b=route.pts[i],dx=b[0]-a[0],dz=b[1]-a[1];
    const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));
    best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));
  }
  return best;
}
export function roadPose(route,s,direction,vehicle,zones=[]) {
  const width=route.width||ROAD_WIDTH[route.kind];
  const center=centerAt(route,s),a=centerAt(route,s-2),b=centerAt(route,s+2);
  const len=Math.hypot(b.x-a.x,b.z-a.z)||1,fx=(b.x-a.x)/len*direction,fz=(b.z-a.z)/len*direction;
  // Oneway OSM ways already describe separate carriageways; do not invent a
  // second opposite lane on those. Bidirectional ways use left-hand traffic.
  const lane=route.oneway?(route.onewayLanes===2?width*(['bike','scooter'].includes(vehicle.type)?.38:(vehicle.id||0)%2===0?-.22:.16):0):width*.25;
  const x=center.x+fz*lane,z=center.z-fx*lane;
  const halfW=vehicle.width/2+0.12,halfL=vehicle.length/2+0.2;
  if(s<halfL+1||s>route.length-halfL-1)return null;
  // Edges and centre are sampled as well as corners, including fence setbacks.
  for(const u of [-halfW,0,halfW])for(const v of [-halfL,0,halfL]) {
    const px=x+fz*u+fx*v,pz=z-fx*u+fz*v;
    if(distanceToRoad(px,pz,route)>width/2-0.1)return null;
    if(zones.some(zone=>zone.forbidsVehicles?.(px,pz,0.3)))return null;
  }
  let y=0.2+width*0.004;
  for(const zone of zones){const h=zone.roadHeight?.(x,z);if(h!=null)y=h;}
  return {x,y,z,yaw:Math.atan2(fx,fz)};
}
// Share of the traffic fleet on the road by IST hour. Gandhinagar college
// roads are busy 08:30-10:00 (arrival) and 14:00-16:00 (leaving), quiet otherwise.
export function trafficDensity(h) {
  const keys=[[0,0.08],[5.5,0.08],[7,0.22],[8,0.45],[8.5,1],[10,1],[10.75,0.38],[13.25,0.38],[14,1],[16,1],[16.75,0.42],[19.5,0.42],[21,0.22],[23,0.1],[24,0.08]];
  h=((h%24)+24)%24;
  for(let i=1;i<keys.length;i++)if(h<=keys[i][0]){const[a,va]=keys[i-1],[b,vb]=keys[i];return va+(vb-va)*(h-a)/(b-a||1);}
  return 0.08;
}
const SPECS={sedan:{width:1.84,length:4.5,speed:13},suv:{width:1.94,length:4.6,speed:11},
  hatch:{width:1.76,length:4.0,speed:12},bike:{width:0.8,length:2.05,speed:12},scooter:{width:0.76,length:1.9,speed:10},auto:{width:1.45,length:2.7,speed:9},bus:{width:2.45,length:10.8,speed:10}};
export function createTrafficSimulation(map,zones=[],{count=40,random=Math.random}={}) {
  const routes=prepareTrafficRoutes(map);
  const vehicles=Array.from({length:count},(_,i)=>{
    const type=i%15===7?'bus':i%5===0?'auto':i%4===1?'bike':i%4===3?'scooter':['sedan','hatch','suv'][i%3];
    return {id:i,type,...SPECS[type],cruise:SPECS[type].speed*(0.8+random()*0.4),route:null,s:0,direction:1,pose:null};
  });
  let nearby=[],lastCenter={x:Infinity,z:Infinity};
  function spawn(v,center) {
    let best=null,bd=Infinity;
    for(let attempt=0;attempt<48&&nearby.length;attempt++) {
      const route=nearby[Math.floor(random()*nearby.length)],direction=route.directions[Math.floor(random()*route.directions.length)];
      const s=random()*route.length,pose=roadPose(route,s,direction,v,zones);if(!pose)continue;
      const d=Math.hypot(pose.x-center.x,pose.z-center.z);if(d>650||d<(v.recoverySpawn?65:25))continue;
      if(vehicles.some(other=>other!==v&&other.pose&&Math.hypot(other.pose.x-pose.x,other.pose.z-pose.z)<(other.length+v.length)/2+5))continue;
      if(d<bd){bd=d;best={route,s,direction,pose};}
    }
    v.pose=null;v.route=null;
    if(best){Object.assign(v,best);v.speed=v.cruise*0.8;v.waiting=0;v.distracted=0;v.recoverySpawn=false;}
  }
  // Drivers brake for anything in their lane corridor: people crossing,
  // cyclists, the player and other vehicles (including at junctions).
  // When two vehicles see each other the lower id has priority, so nobody
  // deadlocks. Accidents therefore only happen through the player's own
  // driving or a rare "distracted driver" event.
  let distractTimer=(25+random()*20)*60;
  function corridorGap(v,x,z,r) {
    const fx=Math.sin(v.pose.yaw),fz=Math.cos(v.pose.yaw),dx=x-v.pose.x,dz=z-v.pose.z;
    const along=dx*fx+dz*fz,lateral=Math.abs(dx*fz-dz*fx),look=12+v.speed*2.5+v.speed*v.speed/20+v.length/2;
    if(along<=0||along>look||lateral>v.width/2+r+0.85)return Infinity;
    return along-v.length/2-r;
  }
  function update(dt,center,{obstacles=[],density=1}={}) {
    if(Math.hypot(center.x-lastCenter.x,center.z-lastCenter.z)>100) {
      nearby=routes.filter(r=>r.maxX>center.x-650&&r.minX<center.x+650&&r.maxZ>center.z-650&&r.minZ<center.z+650);lastCenter={...center};
    }
    const active=Math.max(2,Math.round(vehicles.length*Math.max(0,Math.min(1,density))));
    // Ambient drivers remain attentive; accidents are caused by actual contact.
    const sees=new Map();
    for(const v of vehicles){if(!v.pose||v.crashTime>0)continue;const list=[];for(const o of vehicles)if(o!==v&&o.pose){const g=corridorGap(v,o.pose.x,o.pose.z,o.width/2);if(g<Infinity)list.push([o,g]);}sees.set(v,list);}
    for(const v of vehicles) {
      if(v.crashTime>0){
        v.crashTime=Math.max(0,v.crashTime-dt);v.speed=0;
        if(v.crashMotion){const m=v.crashMotion;m.t+=dt;const p=Math.min(1,m.t/.65),e=1-(1-p)**3;v.pose={...m.from,x:m.from.x+(m.to.x-m.from.x)*e,z:m.from.z+(m.to.z-m.from.z)*e,y:m.from.y+(m.to.y-m.from.y)*e,yaw:m.from.yaw+Math.atan2(Math.sin(m.to.yaw-m.from.yaw),Math.cos(m.to.yaw-m.from.yaw))*e};}
        if(v.crashTime===0){v.departure={from:{...v.pose},t:0};v.crashMotion=null;v.departureSlow=3;v.resumeOnExpiry=false;}
        continue;
      }
      if(v.id>=active&&(!v.pose||Math.hypot(v.pose.x-center.x,v.pose.z-center.z)>140)){v.pose=null;v.route=null;continue;}
      if(!v.route){spawn(v,center);continue;}
      v.departureSlow=Math.max(0,(v.departureSlow||0)-dt);
      if(v.distracted>0)v.distracted-=dt;
      let target=v.cruise*(v.departureSlow>0?.3:v.id>=active?1.1:1),gap=Infinity;
      for(const[o,g]of sees.get(v)||[]) {
        if(v.distracted>0)continue;
        const mutual=(sees.get(o)||[]).some(([w])=>w===v);
        if(mutual&&v.id<o.id&&g>1.2&&o.route!==v.route)continue;
        gap=Math.min(gap,g);
      }
      for(const p of obstacles)gap=Math.min(gap,corridorGap(v,p.x,p.z,p.r||0.4));
      if(gap<Infinity)target=Math.min(target,Math.max(0,(gap-3.8)*0.7));
      v.waiting=target<0.3?(v.waiting||0)+dt:0;
      const accel=target>v.speed?2.1:10;
      v.speed=v.speed+Math.max(-accel*dt,Math.min(accel*dt,target-v.speed));
      if(v.speed<0.02&&target===0)v.speed=0;
      v.s+=v.speed*dt*v.direction;
      const pose=roadPose(v.route,v.s,v.direction,v,zones);
      if(!pose&&v.damageRoot&&v.pose&&Math.hypot(v.pose.x-center.x,v.pose.z-center.z)<140){
        // A damaged vehicle at a route end stays parked in view; only normal
        // distance culling may recycle it once the player has moved away.
        v.s-=v.speed*dt*v.direction;v.speed=0;continue;
      }
      if(!pose||Math.hypot(pose.x-center.x,pose.z-center.z)>750){if(v.id<active)spawn(v,center);else{v.pose=null;v.route=null;}}
      else if(v.departure){const m=v.departure;m.t+=dt;const e=Math.min(1,m.t/1.4),k=e*e*(3-2*e);v.pose={...pose,x:m.from.x+(pose.x-m.from.x)*k,z:m.from.z+(pose.z-m.from.z)*k,yaw:m.from.yaw+Math.atan2(Math.sin(pose.yaw-m.from.yaw),Math.cos(pose.yaw-m.from.yaw))*k};if(e===1)v.departure=null;}
      else v.pose=pose;
    }
  }
  return {vehicles,routes,update};
}
