import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './textures.js';

// Detailed, metre-scaled vehicles with independent paint, glazing, rubber,
// chrome, lamps and plates. Fixed parts never inherit a car's paint colour.
export function createVehicleModel(type) {
  const paint=new THREE.MeshStandardMaterial({color:0xffffff,metalness:0.58,roughness:0.3});
  const glass=new THREE.MeshStandardMaterial({color:0x263d49,metalness:0.42,roughness:0.16,side:THREE.DoubleSide});
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
  } else {
    rounded(1.35,0.65,2.5,paint,0,0.65,-0.05,0.12);
    rounded(1.42,0.17,2.25,rubber,0,1.69,-0.15,0.08);
    box(1.25,0.67,0.035,glass,0,1.26,0.84);
    for(const side of [-1,1]) {
      beam([side*0.64,0.85,0.9],[side*0.63,1.7,0.75],0.04,yellow);
      box(0.045,0.16,2.3,yellow,side*0.65,1,-0.1);
      wheel(side*0.61,-0.69,0.27);
      box(0.18,0.14,0.04,head,side*0.43,0.73,1.25);
      box(0.12,0.15,0.04,tail,side*0.5,0.71,-1.31);
    }
    wheel(0,0.88,0.27);box(0.32,0.1,0.025,plate,0,0.52,1.27);
  }
  const parts=[];
  for(const [material,geometries] of buckets){parts.push({material,geometry:mergeGeometries(geometries,false),paint:material===paint});geometries.forEach(g=>g.dispose());}
  return {parts,setNight(on){head.emissiveIntensity=on?2.3:0.12;tail.emissiveIntensity=on?1.8:0.15;}};
}
