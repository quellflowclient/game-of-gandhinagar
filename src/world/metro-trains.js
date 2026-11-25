import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Gandhinagar metro trains: 3-car sets on both tracks of the viaduct. Each set
// accelerates, cruises at ~70 km/h, brakes into every station, dwells 20 s and
// leaves again; a new set departs every few minutes in each direction. Only
// sets near the player are drawn, so the cost is a handful of meshes.
const CAR=21.5,GAP=.9,CARS=3,WIDTH=2.88,HEIGHT=3.7,TRACK=2.0,CRUISE=19.5,ACCEL=1.0,DWELL=20,HEADWAY=210;

function carGeometry(cab){
  // Body shell, window band, blue/orange livery stripes, roof equipment, cab nose.
  const parts={body:[],glass:[],blue:[],orange:[],dark:[],door:[]};
  const add=(k,geo,x,y,z)=>{geo.translate(x,y,z);parts[k].push(geo.index?geo.toNonIndexed():geo);};
  add('body',new RoundedBoxGeometry(WIDTH,HEIGHT-.5,CAR-(cab?1.4:0),3,.28),0,.5+(HEIGHT-.5)/2,cab?-.7:0);
  for(const s of [-1,1]){
    add('glass',new THREE.BoxGeometry(.03,.95,CAR-3.2),s*(WIDTH/2+.005),2.55,0);
    add('blue',new THREE.BoxGeometry(.03,.36,CAR-.6),s*(WIDTH/2+.01),1.32,0);
    add('orange',new THREE.BoxGeometry(.03,.08,CAR-.6),s*(WIDTH/2+.012),1.08,0);
    for(const z of [-CAR*.3,0,CAR*.3]){add('door',new THREE.BoxGeometry(.035,1.95,1.3),s*(WIDTH/2+.015),1.55,z);add('glass',new THREE.BoxGeometry(.04,.7,.42),s*(WIDTH/2+.02),2.15,z-.3);add('glass',new THREE.BoxGeometry(.04,.7,.42),s*(WIDTH/2+.02),2.15,z+.3);}
  }
  add('dark',new THREE.BoxGeometry(WIDTH*.8,.35,CAR*.55),0,HEIGHT+.05,0);
  for(const z of [-CAR*.33,CAR*.33]){add('dark',new THREE.BoxGeometry(1.9,.7,2.6),0,.35,z);for(const x of [-.72,.72])for(const dz of [-.85,.85]){const w=new THREE.CylinderGeometry(.42,.42,.16,14);w.rotateZ(Math.PI/2);add('dark',w,x,.42,z+dz);}}
  if(cab){
    const nose=new RoundedBoxGeometry(WIDTH,HEIGHT-.7,1.8,3,.45);nose.scale(1,1,1);add('body',nose,0,.5+(HEIGHT-.7)/2,CAR/2-1.05);
    add('glass',new THREE.BoxGeometry(WIDTH*.82,1.15,.05),0,2.5,CAR/2-.12);
    add('blue',new THREE.BoxGeometry(WIDTH*.9,.36,.05),0,1.32,CAR/2-.1);
    for(const x of [-.95,.95])add('orange',new THREE.BoxGeometry(.38,.16,.05),x,1.0,CAR/2-.08);
  }
  return parts;
}
export function createMetroTrains(scene,lines,stations,{deckTop=12.9}={}){
  const mats={body:new THREE.MeshStandardMaterial({color:0xf2f3f1,metalness:.35,roughness:.32}),
    glass:new THREE.MeshStandardMaterial({color:0x1d2b38,metalness:.6,roughness:.12,emissive:0xfff2c8,emissiveIntensity:0}),
    blue:new THREE.MeshStandardMaterial({color:0x1f4f9c,roughness:.45}),orange:new THREE.MeshStandardMaterial({color:0xe8771f,roughness:.45}),
    dark:new THREE.MeshStandardMaterial({color:0x2b2f33,roughness:.7}),door:new THREE.MeshStandardMaterial({color:0xb7bec3,metalness:.55,roughness:.3})};
  const proto={cab:carGeometry(true),mid:carGeometry(false)};
  const merged={};for(const [k,parts]of Object.entries(proto)){merged[k]=Object.fromEntries(Object.entries(parts).filter(([,a])=>a.length).map(([m,a])=>[m,mergeGeometries(a)]));}
  const makeCar=kind=>{const g=new THREE.Group();for(const [m,geo]of Object.entries(merged[kind])){const mesh=new THREE.Mesh(geo,mats[m]);mesh.castShadow=m==='body';mesh.receiveShadow=true;g.add(mesh);}g.visible=false;scene.add(g);return g;};
  const routes=lines.filter(l=>l.pts.length>1).map(l=>{
    const pts=l.pts,cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
    const L=cum.at(-1),at=s=>{s=Math.max(0,Math.min(L,s));let i=1;while(i<cum.length-1&&cum[i]<s)i++;const a=pts[i-1],b=pts[i],t=(s-cum[i-1])/((cum[i]-cum[i-1])||1),dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz)||1;return{x:a[0]+dx*t,z:a[1]+dz*t,dx:dx/len,dz:dz/len};};
    // station stops as arc length along this line
    const stops=[];for(const st of stations){let best=Infinity,bs=0;for(let s=0;s<=L;s+=4){const p=at(s),d=Math.hypot(p.x-st.x,p.z-st.z);if(d<best){best=d;bs=s;}}if(best<25)stops.push(bs);}
    stops.sort((a,b)=>a-b);
    // timetable: list of [startTime, s0, s1, kind] pieces for a full run 0 -> L
    const run=[];let time=0,s=0;const brakeDist=CRUISE*CRUISE/(2*ACCEL);
    const legTo=end=>{const d=end-s;if(d<=0)return;const accelD=Math.min(brakeDist,d/2),cruiseD=Math.max(0,d-2*accelD),v=Math.sqrt(2*ACCEL*accelD);
      const tA=v/ACCEL,tC=cruiseD/(v||1);run.push({t:time,dur:tA*2+tC,s0:s,d,accelD,v,tA,tC});time+=tA*2+tC;s=end;};
    for(const stop of stops){legTo(stop);run.push({t:time,dur:DWELL,s0:s,d:0,dwell:true});time+=DWELL;}
    legTo(L);
    const sAt=t=>{if(t<0||t>time)return null;for(const p of run){if(t>p.t+p.dur)continue;const u=t-p.t;if(p.dwell)return p.s0;if(u<p.tA)return p.s0+.5*ACCEL*u*u;if(u<p.tA+p.tC)return p.s0+p.accelD+p.v*(u-p.tA);const r=u-p.tA-p.tC;return p.s0+p.accelD+p.v*p.tC+p.v*r-.5*ACCEL*r*r;}return L;};
    return{at,L,sAt,runTime:time};
  });
  const sets=[];
  for(const [ri,route]of routes.entries())for(const dir of [1,-1]){
    const count=Math.max(1,Math.ceil((route.runTime+CAR*CARS)/HEADWAY));
    for(let k=0;k<count;k++)sets.push({route,dir,offset:k*HEADWAY+(dir<0?HEADWAY/2:0)+ri*37,cars:[makeCar('cab'),makeCar('mid'),makeCar('cab')]});
  }
  const cycle=r=>Math.ceil((r.runTime+30)/HEADWAY)*HEADWAY;
  const tmp=new THREE.Vector3();
  function update(t,center){
    for(const set of sets){
      const r=set.route,local=(t+set.offset)%cycle(r),s=r.sAt(local);
      const near=s!=null&&(()=>{const p=r.at(set.dir>0?s:r.L-s);return Math.hypot(p.x-center.x,p.z-center.z)<1400;})();
      set.cars.forEach((car,i)=>{
        if(!near){car.visible=false;return;}
        const head=set.dir>0?s:r.L-s,sc=head-set.dir*(i*(CAR+GAP)+CAR/2);
        if(sc<0||sc>r.L){car.visible=false;return;}
        const p=r.at(sc),side=set.dir>0?TRACK:-TRACK;
        car.position.set(p.x+p.dz*side,deckTop,p.z-p.dx*side);
        car.rotation.y=Math.atan2(p.dx*set.dir,p.dz*set.dir)+(i===CARS-1?Math.PI:0);
        car.visible=true;
      });
    }
  }
  return{update,setNight(on){mats.glass.emissiveIntensity=on?.9:0;},get sets(){return sets;}};
}
