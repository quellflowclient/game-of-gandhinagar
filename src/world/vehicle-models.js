import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

// Detailed, metre-scaled vehicles with independent paint, glazing, rubber,
// chrome, lamps and plates. Fixed parts never inherit a car's paint colour.
export function createVehicleModel(type) {
  const paint=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.58,roughness:0.3});
  const glass=new THREE.MeshStandardMaterial({color:0x2c4450,metalness:0.4,roughness:0.12,side:THREE.DoubleSide,transparent:true,opacity:0.42,depthWrite:false});
  const rubber=new THREE.MeshStandardMaterial({color:0x171b1c,roughness:0.92});
  const chrome=new THREE.MeshStandardMaterial({color:0xa7b2b7,metalness:0.9,roughness:0.24});
  const head=new THREE.MeshStandardMaterial({color:0xe4ece8,emissive:0xcde1e3,emissiveIntensity:0.12,roughness:0.2});
  const tail=new THREE.MeshStandardMaterial({color:0x9f1c1c,emissive:0xff2b17,emissiveIntensity:0.15,roughness:0.35});
  const plate=new THREE.MeshStandardMaterial({map:T.textTexture(type==='bus'?['GANDHINAGAR']:['GJ 18 • 2026'],{bg:'#e5e3d6',fg:'#242927',w:256,h:64,font:'700 36px sans-serif'}),roughness:0.85});
  const yellow=new THREE.MeshStandardMaterial({color:0xc7ac3f,metalness:0.2,roughness:0.6});
  const buckets=new Map();
  const emit=(geo,m,x=0,y=0,z=0,ry=0)=>{geo.rotateY(ry);geo.translate(x,y,z);if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));const p=geo.index?geo.toNonIndexed():geo;if(p!==geo)geo.dispose();if(!buckets.has(m))buckets.set(m,[]);buckets.get(m).push(p);};
  const box=(w,h,d,m,x,y,z,r=0)=>emit(new THREE.BoxGeometry(w,h,d),m,x,y,z,r);
  const rounded=(w,h,d,m,x,y,z,r=0.07)=>emit(new RoundedBoxGeometry(w,h,d,2,r),m,x,y,z);
  const beam=(a,b,r,m)=>{const x=new THREE.Vector3(...a),y=new THREE.Vector3(...b),d=y.clone().sub(x);const geo=new THREE.CylinderGeometry(r,r,d.length(),6);geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()));const mid=x.add(y).multiplyScalar(0.5);emit(geo,m,mid.x,mid.y,mid.z);};
  const wheel=(x,z,r=0.31)=>{
    const tyre=new THREE.CylinderGeometry(r,r,0.19,20);tyre.rotateZ(Math.PI/2);emit(tyre,rubber,x,r,z);
    const hub=new THREE.CylinderGeometry(r*0.57,r*0.57,0.205,16);hub.rotateZ(Math.PI/2);emit(hub,chrome,x,r,z);
    for(let k=0;k<5;k++){const a=k*Math.PI*2/5;beam([x+Math.sign(x||1)*0.107,r,z],[x+Math.sign(x||1)*0.107,r+Math.cos(a)*r*0.5,z+Math.sin(a)*r*0.5],0.017,rubber);}
  };
  // Seated occupants (driver, passengers, riders) so no vehicle drives itself.
  const skin=new THREE.MeshStandardMaterial({color:0x8d5a3b,roughness:0.62});
  const hair=new THREE.MeshStandardMaterial({color:0x17120f,roughness:0.78});
  const shirts=[0xd9d4c7,0x3f5f86,0x8a3b35,0x56684a,0xe7e2d6].map(c=>new THREE.MeshStandardMaterial({color:c,roughness:0.86}));
  const pants=new THREE.MeshStandardMaterial({color:0x2b2f38,roughness:0.9});
  const helmetMat=new THREE.MeshStandardMaterial({color:0x1d2124,metalness:0.3,roughness:0.35});
  let who=0;
  const sphere=(r,m,x,y,z,sy=1)=>{const g=new THREE.SphereGeometry(r,14,10);g.scale(1,sy,1);emit(g,m,x,y,z);};
  const person=(x,hip,z,{hands=null,astride=false,feet=null,helmet=false,arms=true}={})=>{
    const shirt=shirts[who++%shirts.length];
    for(const side of [-1,1]){
      const knee=astride?[x+side*0.21,hip-0.08,z+0.36]:[x+side*0.11,hip+0.04,z+0.42];
      const foot=feet?[x+side*feet[0],feet[1],z+feet[2]]:[x+side*0.12,hip-0.44,z+0.5];
      beam([x+side*0.1,hip,z],knee,0.072,pants);beam(knee,foot,0.055,pants);box(0.1,0.07,0.22,hair,foot[0],foot[1]-0.02,foot[2]+0.06);
      if(arms){const sh=[x+side*0.2,hip+0.52,z-0.01],h=hands?[hands[0]*side+(hands[3]?x:0),hands[1],hands[2]]:[x+side*0.24,hip+0.12,z+0.18];
        const el=[(sh[0]+h[0])/2+side*0.05,(sh[1]+h[1])/2-0.08,(sh[2]+h[2])/2-0.05];
        beam(sh,el,0.05,shirt);beam(el,h,0.042,skin);sphere(0.045,skin,...h);}
    }
    rounded(0.38,0.56,0.23,shirt,x,hip+0.31,z-0.02,0.08);
    beam([x,hip+0.58,z],[x,hip+0.66,z+0.01],0.05,skin);
    sphere(0.105,skin,x,hip+0.76,z+0.02,1.12);
    if(helmet)sphere(0.142,helmetMat,x,hip+0.79,z+0.01,1.05);
    else{const cap=new THREE.SphereGeometry(0.112,14,8,0,Math.PI*2,0,Math.PI*0.5);cap.scale(1,1.05,1.05);emit(cap,hair,x,hip+0.79,z);}
  };
  if(['sedan','suv','hatch'].includes(type)) {
    const suv=type==='suv',hatch=type==='hatch',w=suv?1.88:hatch?1.7:1.78,l=hatch?4:4.5,roof=suv?1.69:1.45,base=suv?1.03:0.92;
    rounded(w,0.55,l,paint,0,0.66,0,0.13);
    rounded(w-0.1,0.16,l-0.15,rubber,0,0.38,0,0.06);
    const wb=w*0.46,wt=w*0.39,zback=hatch?-1.5:-1.25,ztback=hatch?-1.0:-0.8;
    const points=[[-wb,base,zback],[wb,base,zback],[-wb,base,1.12],[wb,base,1.12],[-wt,roof,ztback],[wt,roof,ztback],[-wt,roof,0.51],[wt,roof,0.51]];
    const position=[];for(const i of [0,1,4,1,5,4,2,6,3,3,6,7,0,4,2,2,4,6,1,3,5,3,7,5,4,5,6,5,7,6])position.push(...points[i]);
    const cabin=new THREE.BufferGeometry();cabin.setAttribute('position',new THREE.Float32BufferAttribute(position,3));cabin.computeVertexNormals();emit(cabin,glass);
    rounded(wt*2+0.05,0.075,0.51-ztback+0.12,paint,0,roof+0.01,(0.51+ztback)/2,0.035);
    for(const side of [-1,1]) {
      beam([side*wb,base,zback],[side*wt,roof,ztback],0.045,paint);
      beam([side*wb,base,1.12],[side*wt,roof,0.51],0.045,paint);
      beam([side*wb,base,-0.1],[side*wt,roof,-0.15],0.033,rubber);
      for(const z of [-0.8,0.45]) {
        box(0.014,0.43,0.012,rubber,side*(w/2+0.006),0.67,z);
        box(0.025,0.028,0.15,chrome,side*(w/2+0.02),0.91,z+0.12);
      }
      rounded(0.18,0.1,0.18,paint,side*(w/2+0.07),base+0.17,0.65,0.025);
      box(0.07,0.075,0.15,glass,side*(w/2+0.13),base+0.17,0.64);
      wheel(side*(w/2-0.06),-l*0.3,suv?0.34:0.31);wheel(side*(w/2-0.06),l*0.3,suv?0.34:0.31);
      rounded(0.37,0.12,0.06,head,side*w*0.33,0.84,l/2+0.015,0.025);
      rounded(0.35,0.15,0.05,tail,side*w*0.34,0.82,-l/2-0.015,0.025);
    }
    box(w*0.55,0.17,0.04,rubber,0,0.55,l/2+0.03);
    for(const y of [0.5,0.55,0.6])box(w*0.54,0.014,0.046,chrome,0,y,l/2+0.04);
    box(0.37,0.115,0.025,plate,0,0.49,l/2+0.065);
    box(0.37,0.115,0.025,plate,0,0.57,-l/2-0.04,Math.PI);
    if(suv)for(const side of [-1,1])beam([side*0.65,roof+0.09,-0.9],[side*0.65,roof+0.09,0.55],0.025,chrome);
    const hip=base-0.4;
    rounded(0.36,0.05,0.08,rubber,-w*0.22,hip+0.5,0.42,0.02); // steering wheel
    person(-w*0.22,hip,-0.2,{hands:[0.16,hip+0.5,0.38,true]});
    if(type!=='hatch')person(w*0.22,hip,-0.2);
  } else if(type==='bus') {
    rounded(2.43,2.6,10.8,paint,0,1.64,0,0.14);
    rounded(2.26,0.14,10.5,chrome,0,2.98,0,0.06);
    for(const side of [-1,1]) {
      for(let z=-4.1;z<=3.8;z+=1.15)box(0.025,0.88,0.98,glass,side*1.225,2.23,z);
      box(0.03,0.1,10.2,rubber,side*1.229,1.62,0);
      for(const z of [-3.3,3.3])wheel(side*1.09,z,0.47);
      box(0.38,0.17,0.04,head,side*0.8,0.85,5.43);
      box(0.23,0.32,0.04,tail,side*0.92,0.85,-5.43);
    }
    box(2.1,1.13,0.045,glass,0,2.14,5.42);
    box(1.78,0.72,0.04,glass,0,2.17,-5.42);
    box(1.7,0.21,0.05,plate,0,2.85,5.43);
    box(0.04,1.9,0.94,rubber,-1.23,1.38,3.98);
    box(0.046,1.44,0.82,glass,-1.237,1.65,3.98);
    box(0.055,1.5,0.035,chrome,-1.24,1.6,3.98);
    box(1.4,0.3,0.035,rubber,0,0.6,5.43);
    person(-0.72,1.25,4.45,{hands:[0.16,1.75,4.85,true]});
    for(const [x,z] of [[0.7,3],[-0.7,1.6],[0.7,0.2],[0.7,-1.2],[-0.7,-2.6],[0.7,-3.6]])person(x,1.3,z,{arms:false});
  } else if(type==='bike'||type==='scooter') {
    const bike=type==='bike',r=bike?0.31:0.26;
    const wheel2=z=>{const t=new THREE.CylinderGeometry(r,r,0.11,20);t.rotateZ(Math.PI/2);emit(t,rubber,0,r,z);const h=new THREE.CylinderGeometry(r*0.55,r*0.55,0.12,12);h.rotateZ(Math.PI/2);emit(h,chrome,0,r,z);};
    wheel2(0.66);wheel2(-0.64);
    if(bike){
      rounded(0.3,0.22,0.52,paint,0,0.86,0.2,0.08);
      rounded(0.25,0.08,0.62,rubber,0,0.84,-0.28,0.03);
      rounded(0.24,0.3,0.4,chrome,0,0.5,0.05,0.04);
      beam([0.04,0.47,-0.1],[0.12,0.42,-0.75],0.04,chrome);
      rounded(0.22,0.08,0.5,paint,0,0.72,-0.62,0.03);
    } else {
      rounded(0.42,0.72,0.18,paint,0,0.66,0.48,0.08);
      box(0.34,0.06,0.5,rubber,0,0.36,0.12);
      rounded(0.4,0.38,0.78,paint,0,0.58,-0.38,0.12);
      rounded(0.32,0.09,0.68,rubber,0,0.81,-0.3,0.04);
    }
    for(const side of [-1,1])beam([side*0.07,r,0.66],[side*0.09,1.0,0.46],0.022,chrome);
    beam([-0.34,1.02,0.44],[0.34,1.02,0.44],0.018,rubber);
    rounded(0.16,0.13,0.08,head,0,0.98,0.56,0.03);
    box(0.13,0.07,0.04,tail,0,0.78,-0.95);
    box(0.2,0.07,0.02,plate,0,0.62,-0.97,Math.PI);
    person(0,bike?0.86:0.83,-0.22,{astride:bike,hands:[0.3,1.03,0.43],feet:bike?[0.2,0.34,0.08]:[0.12,0.4,0.42],helmet:bike||who%2===0});
  } else {
    rounded(1.35,0.65,2.5,paint,0,0.65,-0.05,0.12);
    rounded(1.42,0.17,2.25,yellow,0,1.69,-0.15,0.08);
    box(1.25,0.67,0.035,glass,0,1.26,0.84);
    for(const side of [-1,1]) {
      beam([side*0.64,0.85,0.9],[side*0.63,1.7,0.75],0.04,yellow);
      box(0.045,0.16,2.3,yellow,side*0.65,1,-0.1);
      wheel(side*0.61,-0.69,0.27);
      box(0.18,0.14,0.04,head,side*0.43,0.73,1.25);
      box(0.12,0.15,0.04,tail,side*0.5,0.71,-1.31);
    }
    wheel(0,0.88,0.27);box(0.32,0.1,0.025,plate,0,0.52,1.27);
    person(0,0.78,0.38,{hands:[0.26,1.12,0.72],feet:[0.12,0.47,0.36]});
    box(1.2,0.32,0.5,rubber,0,0.62,-0.72);
    person(-0.3,0.8,-0.7,{arms:false,feet:[0.12,0.47,0.4]});person(0.3,0.8,-0.7,{arms:false,feet:[0.12,0.47,0.4]});
  }
  const parts=[];
  for(const [material,geometries] of buckets){parts.push({material,geometry:mergeGeometries(geometries,false),paint:material===paint});geometries.forEach(g=>g.dispose());}
  return {parts,setNight(on){head.emissiveIntensity=on?2.3:0.12;tail.emissiveIntensity=on?1.8:0.15;}};
}
