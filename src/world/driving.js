// Driving uses metres and seconds. Public-road footprint checks prevent grass,
// footpath, median and campus shortcuts, including at maximum speed.
export const VEHICLES={walk:{maxKmh:0},cycle:{maxKmh:36},bike:{maxKmh:45,width:.75,length:2.05,accel:2.8,brake:8},scooter:{maxKmh:35,width:.72,length:1.85,accel:2.5,brake:8},auto:{maxKmh:35,width:1.45,length:2.7,accel:2.2,brake:7},car:{maxKmh:80,width:1.84,length:4.5,accel:3.6,brake:9}};
export function createDrivingSurface(roads,zones=[],boundary=null){
  const widths={motorway:26,trunk:22,primary:18,secondary:13,tertiary:10,residential:7,unclassified:7,living_street:6,service:5};
  const segments=[],grid=new Map(),cell=40;
  for(const road of roads){const width=road.width||widths[road.kind];if(!width||road.bridge)continue;for(let i=1;i<road.pts.length;i++){const seg={a:road.pts[i-1],b:road.pts[i],width,height:road.surfaceHeight};segments.push(seg);for(let x=Math.floor((Math.min(seg.a[0],seg.b[0])-width)/cell);x<=Math.floor((Math.max(seg.a[0],seg.b[0])+width)/cell);x++)for(let z=Math.floor((Math.min(seg.a[1],seg.b[1])-width)/cell);z<=Math.floor((Math.max(seg.a[1],seg.b[1])+width)/cell);z++){const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);}}}
  function height(x,z){let top=null;for(const {a,b,width,height:h} of grid.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[]){if(x<Math.min(a[0],b[0])-width||x>Math.max(a[0],b[0])+width||z<Math.min(a[1],b[1])-width||z>Math.max(a[1],b[1])+width)continue;const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<width/2-0.12)top=Math.max(top??0,(h??(.2+width*.004))+.012);}for(const zone of zones){const h=zone.roadHeight?.(x,z);if(h!=null)top=h+.012;}return top;}
  function pose(x,z,yaw,type){const spec=VEHICLES[type];if(!spec.width)return null;const c=Math.cos(yaw),s=Math.sin(yaw);for(const side of [-1,0,1])for(const front of [-1,-.5,0,.5,1]){const px=x+c*side*spec.width/2+s*front*spec.length/2,pz=z-s*side*spec.width/2+c*front*spec.length/2;if(boundary&&!boundary(px,pz))return null;if(height(px,pz)===null||zones.some(q=>q.forbidsVehicles?.(px,pz,.14,type)))return null;}return{x,z,y:height(x,z),yaw};}
  return{pose,roadHeight:height,nearest(x,z,yaw,type,max=14){
    const here=pose(x,z,yaw,type);if(here)return here;
    let best=null,distance=Infinity;
    for(const seg of segments){
      const {a,b,width}=seg,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.01)continue;
      const t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(len*len)));
      const tangent=Math.atan2(dx,dz),angles=[tangent,tangent+Math.PI].sort((a,b)=>Math.cos(b-yaw)-Math.cos(a-yaw));
      // Divided roads need a lane candidate, not a spawn on the median.
      // Every candidate still passes the entire vehicle-footprint check.
      for(const side of [-.24,.24,0])for(const shift of [0,-3,3]){
        const q=Math.max(0,Math.min(1,t+shift/len)),px=a[0]+q*dx-dz/len*width*side,pz=a[1]+q*dz+dx/len*width*side,d=Math.hypot(px-x,pz-z);
        if(d>max||d>=distance)continue;
        for(const angle of angles){const p=pose(px,pz,angle,type);if(p){best=p;distance=d;break;}}
      }
    }
    return best;
  }};
}
// Signed speed (m/s): forward > 0, reverse < 0. Pulling back while moving
// forward brakes first; once stopped it engages reverse (gentle, capped).
// Releasing the throttle coasts down instead of stopping dead.
export const REVERSE_KMH={bike:6,scooter:6,auto:10,car:14};
export function drivingSpeed(speed,throttle,dt,type){
  const s=VEHICLES[type],max=s.maxKmh/3.6,rev=(REVERSE_KMH[type]||6)/3.6;
  let target,rate;
  if(throttle>0.05){target=speed<-.01?0:throttle*max;rate=speed<-.01?s.brake:speed<target?s.accel:s.brake;}
  else if(throttle<-0.05){if(speed>.01){target=0;rate=s.brake;}else{target=throttle*rev;rate=speed>target?s.accel*.6:s.brake;}}
  else{target=0;rate=s.brake*.35;}
  const next=speed+Math.max(-rate*dt,Math.min(rate*dt,target-speed));
  return Math.abs(next)<.01&&Math.abs(throttle)<=.05?0:Math.max(-rev,Math.min(max,next));
}
