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
  const lane=route.oneway?0:width*0.25;
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
const SPECS={sedan:{width:1.84,length:4.5,speed:13},suv:{width:1.94,length:4.6,speed:11},
  hatch:{width:1.76,length:4.0,speed:12},auto:{width:1.45,length:2.7,speed:9},bus:{width:2.45,length:10.8,speed:10}};
export function createTrafficSimulation(map,zones=[],{count=40,random=Math.random}={}) {
  const routes=prepareTrafficRoutes(map);
  const vehicles=Array.from({length:count},(_,i)=>{
    const type=i%12===0?'bus':i%5===0?'auto':['sedan','hatch','suv'][i%3];
    return {id:i,type,...SPECS[type],cruise:SPECS[type].speed*(0.8+random()*0.4),route:null,s:0,direction:1,pose:null};
  });
  let nearby=[],lastCenter={x:Infinity,z:Infinity};
  function spawn(v,center) {
    let best=null,bd=Infinity;
    for(let attempt=0;attempt<48&&nearby.length;attempt++) {
      const route=nearby[Math.floor(random()*nearby.length)],direction=route.directions[Math.floor(random()*route.directions.length)];
      const s=random()*route.length,pose=roadPose(route,s,direction,v,zones);if(!pose)continue;
      const d=Math.hypot(pose.x-center.x,pose.z-center.z);if(d>650||d<18)continue;
      if(vehicles.some(other=>other!==v&&other.pose&&Math.hypot(other.pose.x-pose.x,other.pose.z-pose.z)<(other.length+v.length)/2+5))continue;
      if(d<bd){bd=d;best={route,s,direction,pose};}
    }
    v.pose=null;v.route=null;
    if(best){Object.assign(v,best);v.speed=v.cruise;}
  }
  function update(dt,center) {
    if(Math.hypot(center.x-lastCenter.x,center.z-lastCenter.z)>100) {
      nearby=routes.filter(r=>r.maxX>center.x-650&&r.minX<center.x+650&&r.maxZ>center.z-650&&r.minZ<center.z+650);lastCenter={...center};
    }
    for(const v of vehicles) {
      if(!v.route){spawn(v,center);continue;}
      let speed=v.cruise;
      for(const other of vehicles)if(other!==v&&other.route===v.route&&other.direction===v.direction&&other.pose) {
        const gap=(other.s-v.s)*v.direction-(v.length+other.length)/2;
        if(gap>0&&gap<18)speed=Math.min(speed,Math.max(0,(gap-3)*0.8));
      }
      v.speed=speed;v.s+=speed*dt*v.direction;
      const pose=roadPose(v.route,v.s,v.direction,v,zones);
      if(!pose||Math.hypot(pose.x-center.x,pose.z-center.z)>750)spawn(v,center);
      else v.pose=pose;
    }
  }
  return {vehicles,routes,update};
}
