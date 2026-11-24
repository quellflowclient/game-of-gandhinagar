// Driving uses metres and seconds. Public-road footprint checks prevent grass,
// footpath, median and campus shortcuts, including at maximum speed.
export const VEHICLES={walk:{maxKmh:0},cycle:{maxKmh:36},auto:{maxKmh:35,width:1.45,length:2.7,accel:2.2,brake:7},car:{maxKmh:80,width:1.84,length:4.5,accel:3.6,brake:9}};
export function createDrivingSurface(roads,zones=[],boundary=null){
  const widths={motorway:26,trunk:22,primary:18,secondary:13,tertiary:10,residential:7,unclassified:7,living_street:6,service:5};
  const segments=[];
  for(const road of roads){const width=road.width||widths[road.kind];if(!width||road.bridge)continue;for(let i=1;i<road.pts.length;i++)segments.push({a:road.pts[i-1],b:road.pts[i],width});}
  function height(x,z){let top=null;for(const {a,b,width} of segments){if(x<Math.min(a[0],b[0])-width||x>Math.max(a[0],b[0])+width||z<Math.min(a[1],b[1])-width||z>Math.max(a[1],b[1])+width)continue;const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<width/2-0.12)top=Math.max(top??0,0.2+width*0.004+0.012);}return top;}
  function pose(x,z,yaw,type){const spec=VEHICLES[type];if(!spec.width)return null;const c=Math.cos(yaw),s=Math.sin(yaw);for(const side of [-1,0,1])for(const front of [-1,-.5,0,.5,1]){const px=x+c*side*spec.width/2+s*front*spec.length/2,pz=z-s*side*spec.width/2+c*front*spec.length/2;if(boundary&&!boundary(px,pz))return null;if(height(px,pz)===null||zones.some(q=>q.forbidsVehicles?.(px,pz,0.14)))return null;}return{x,z,y:height(x,z),yaw};}
  return{pose,nearest(x,z,yaw,type,max=14){let best=null,distance=Infinity;for(const seg of segments){const {a,b}=seg,dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1))),px=a[0]+t*dx,pz=a[1]+t*dz,d=Math.hypot(px-x,pz-z);if(d>max||d>=distance)continue;const tangent=Math.atan2(dx,dz),angles=[tangent,tangent+Math.PI].sort((a,b)=>Math.cos(b-yaw)-Math.cos(a-yaw));for(const angle of angles){const p=pose(px,pz,angle,type);if(p){best=p;distance=d;break;}}}return best;}};
}
export function drivingSpeed(speed,throttle,dt,type){const s=VEHICLES[type],target=Math.max(0,throttle)*s.maxKmh/3.6;return Math.max(0,Math.min(s.maxKmh/3.6,speed+Math.max(-s.brake*dt,Math.min(s.accel*dt,target-speed))));}
