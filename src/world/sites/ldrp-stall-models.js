import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import * as K from './kit.js';
import * as T from '../textures.js';

// Geometry interpreted from the user's named Street View references. Original
// photographs stay reference-only; the game uses locally generated materials.
export function referenceStall(g,s) {
  const metal=K.mat(0x929b96,{metalness:0.7,roughness:0.44}),wood=K.mat(0x796450),cream=K.mat(0xc9c0a5),rubber=K.mat(0x252a27);
  const tin=K.canvasTex(128,128,(c,w,h)=>{c.fillStyle='#a6a590';c.fillRect(0,0,w,h);for(let x=0;x<w;x+=10){c.fillStyle='#838672';c.fillRect(x,0,2,h);}for(let i=0;i<160;i++){c.fillStyle='rgba(77,63,40,.12)';c.fillRect((i*37)%w,(i*23)%h,2,6);}});
  function table(x,width=2.4,z=0.05){K.box(g,width,0.055,0.8,metal,x,0.86,z);for(const dx of [-width/2+0.1,width/2-0.1])for(const dz of [-0.3,0.3])K.box(g,0.035,0.86,0.035,metal,x+dx,0,z+dz);K.box(g,width-0.12,0.035,0.64,wood,x,0.25,z);}
  function tarp(width,depth,y=2.65,peak=0.35,color=0x32664a){
    const pos=[],uv=[];for(let i=0;i<12;i++){const x=-width/2+width*i/12,nx=-width/2+width*(i+1)/12;const at=(a,z)=>[a,y+peak*(1-Math.abs(a)/(width/2))+Math.sin(a*4)*0.025,z];const p=[at(x,-depth/2),at(x,depth/2),at(nx,-depth/2),at(nx,depth/2)];for(const k of [0,1,2,1,3,2]){pos.push(...p[k]);uv.push(p[k][0],p[k][2]);}}
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();const mesh=new THREE.Mesh(geo,K.mat(color,{roughness:0.94,side:THREE.DoubleSide}));g.add(mesh);
  }
  function frame(width=3.4){for(const x of [-width/2,width/2])for(const z of [-1.4,1.1])K.cyl(g,0.028,0.04,2.55,metal,x,0,z,8);}
  function wheels(x,width,r=0.42){for(const side of [-1,1]){const wheel=new THREE.Group();wheel.position.set(x+side*width/2,r+0.015,-0.8);g.add(wheel);const tire=new THREE.Mesh(new THREE.TorusGeometry(r,0.022,6,30),rubber);wheel.add(tire);const rim=new THREE.Mesh(new THREE.TorusGeometry(r-0.04,0.01,5,30),metal);wheel.add(rim);for(let i=0;i<8;i++){const spoke=K.box(wheel,0.008,r*1.85,0.008,metal,0,-r*0.925,0);spoke.rotation.z=i*Math.PI/8;}}}
  if(s.id==='babu') {
    table(-1.0,3.8);table(2.1,1.1);
    // A modest tin cooking shade at the rear; the customer area is open under trees.
    frame(3.6);K.box(g,3.9,0.055,2.0,K.mat(tin),-0.7,2.55,-0.6);
    K.textPlane(g,[s.name],{bg:'#d3c5a2',fg:'#803c27',font:'700 78px sans-serif',h:180},2.4,0.45,-1,2.2,0.7,0);
    return {width:5.8,back:false,packets:null};
  }
  if(s.id==='patel') {
    // Cream cargo tempo, parked parallel to the road with an open serving hatch.
    K.box(g,4.7,0.28,2.0,0x4a514d,0,0.43,-0.35);
    const cab=new THREE.Mesh(new RoundedBoxGeometry(1.4,1.55,1.9,2,0.13),cream);cab.position.set(1.75,1.4,-0.35);g.add(cab);
    K.box(g,0.05,0.65,1.58,K.mat(0x324b50,{metalness:0.3,roughness:0.22}),2.45,1.45,-0.35);
    K.box(g,1.0,0.6,0.035,0x3e5558,1.65,1.43,0.62);K.box(g,0.28,0.055,0.05,metal,1.72,1.1,0.66);
    K.box(g,2.95,1.82,0.08,cream,-0.65,0.72,-1.37);K.box(g,0.08,1.82,2,cream,-2.15,0.72,-0.35);
    const roof=new THREE.Mesh(new THREE.BoxGeometry(3.1,0.08,2.2),K.mat(0x416a58,{roughness:0.95}));roof.position.set(-0.65,2.58,-0.35);g.add(roof);
    K.box(g,3.0,0.07,0.65,metal,-0.65,1.02,0.75);K.box(g,2.9,0.16,0.12,cream,-0.65,2.31,0.75);
    for(const x of [-1.45,1.6])for(const z of [-1.35,0.66]){const tire=new THREE.Mesh(new THREE.TorusGeometry(0.285,0.06,8,26),rubber);tire.position.set(x,0.35,z);g.add(tire);const hub=new THREE.Mesh(new THREE.CircleGeometry(0.15,16),metal);hub.position.set(x,0.35,z+0.063);g.add(hub);}
    K.box(g,0.3,0.13,0.035,0xe9dba4,2.35,0.78,0.62);K.box(g,0.45,0.12,0.025,0xd5c79a,1.8,0.59,0.7);
    K.textPlane(g,[s.name],{bg:'#d4c9a9',fg:'#304c39',font:'700 72px sans-serif',h:150},2.8,0.4,-0.65,2.29,0.82,0);
    return {width:4.8,tempo:true,packets:{width:2.4,center:-0.7,z:0.62,rows:3}};
  }
  const masi=s.id==='masi',chintu=s.id==='chintu',lari=s.id==='lalbhai',width=masi?2.9:chintu?2.8:lari?3.4:3.8;
  frame(width);
  if(chintu) {
    K.box(g,2.5,0.9,0.95,cream,0,0,0.05);table(-1.05,2.5);table(1.65,1.2);
    K.box(g,3.2,0.065,2.8,K.mat(tin),0,2.6,-0.1);
    for(let i=0;i<3;i++)K.textPlane(g,i===0?[s.name]:i===1?['પાવભાજી · બટર પાવ']:['Garam bhaji · Fresh pav'],{bg:i===0?'#227249':'#e0dec4',fg:i===0?'#f7d17c':i===1?'#913d2e':'#356448',font:'800 72px sans-serif',h:160},2.3,0.45,0.75,2.35-i*0.47,0.65,0);
  } else {
    K.box(g,width,0.7,1.1,masi?0xd3d0b8:wood,0,0.18,0);K.box(g,width+0.12,0.05,1.2,metal,0,0.88,0);
    if(masi){tarp(3.3,2.9,2.62,0.72,0x315c44);wheels(0,2.15,0.48);K.textPlane(g,['Masi ni Cha'],{bg:'#d8d5bd',fg:'#365a62',font:'800 82px sans-serif',h:180},2.8,0.45,0,2.39,1.1,0);K.textPlane(g,['CHAI · MASALA'],{bg:'#d7d4bb',fg:'#405568',font:'700 65px sans-serif',h:150},2.8,0.4,0,0.74,0.62,0);}
    else if(lari){K.box(g,3.8,0.065,3.2,K.mat(tin,{color:0x727e69}),0,2.5,-0.15);K.textPlane(g,[s.name],{bg:'#715c45',fg:'#e6c9a0',font:'700 75px sans-serif',h:160},3.4,0.42,0,2.25,1.0,0);wheels(0,2.7,0.34);}
    else {tarp(width+0.5,3.6,2.47,0.13,s.id==='natu'?0x315d43:0x445f50);K.textPlane(g,[s.name],{bg:s.id==='ajit'?'#46666b':'#857654',fg:'#eee1bd',font:'700 75px sans-serif',h:160},width-0.1,0.4,0,2.16,1.35,0);wheels(0,width-0.6,0.35);}
    K.box(g,width,1.5,0.1,K.mat(tin,{color:0x8b8773}),0,0.7,-1.4);
  }
  return {width,back:true,packets:chintu?null:{width:width-0.3,center:0,z:lari||s.id==='natu'?0.68:-1.0,rows:lari?4:3,opening:lari||s.id==='natu'}};
}

export function referenceBackdrop(g,s) {
  const concrete=K.mat(T.boundaryStone(),{color:0x9c967e,roughness:1}),iron=K.mat(0x385d42,{metalness:0.35,roughness:0.8});
  for(const [x,z,k] of [[-5.9,-8.8,1.65],[5.9,-8.8,1.8]])K.tree(g,x,z,k);
  if(s.id==='babu'){K.tree(g,-4.9,1.4,1.85);K.cyl(g,0.52,0.58,0.65,0xb5703e,-4.9,0,1.4,10);K.cyl(g,0.5,0.5,0.4,0xddd9c6,-4.9,0.65,1.4,10);}
  // A narrow paved walk and worn, irregular soil shoulder, not an isolated slab.
  K.strip(g,[[-7,3.9],[7,3.9]],1.5,0.005,K.mat(K.greyPavers(),{color:0xa69d88}),{tile:2.5});
  for(let i=0;i<3;i++)K.box(g,0.7,0.4,0.5,[0x8f6441,0xa5763f,0x3c7168][i],-3.8,0.05+i*0.4,-1.8);
}

export function parkedReferenceVan(g,x,z,yaw=0) {
  const van=new THREE.Group();van.position.set(x,0,z);van.rotation.y=yaw;g.add(van);
  const metal=K.mat(0x566360,{metalness:0.5,roughness:0.45}),glass=K.mat(0x283e3d,{metalness:0.3,roughness:0.18}),rubber=K.mat(0x202521);
  const body=new THREE.Mesh(new RoundedBoxGeometry(1.75,1.4,4.1,2,0.14),metal);body.position.y=1.0;van.add(body);
  for(const side of [-1,1]) {
    for(const zz of [-1.15,-0.2,0.8])K.box(van,0.02,0.6,0.75,glass,side*0.89,1.07,zz);
    for(const zz of [-1.25,1.2]){const wheel=new THREE.Mesh(new THREE.TorusGeometry(0.29,0.055,8,24),rubber);wheel.rotation.y=Math.PI/2;wheel.position.set(side*0.87,0.35,zz);van.add(wheel);}
    K.box(van,0.05,0.035,0.18,0xa6afaa,side*0.9,0.99,0.3);
  }
  K.box(van,1.4,0.61,0.025,glass,0,1.09,2.065);K.box(van,1.3,0.55,0.025,glass,0,1.13,-2.065);
  for(const xx of [-0.62,0.62])K.box(van,0.22,0.15,0.03,0xdedbc0,xx,0.65,2.08);
  K.box(van,0.4,0.11,0.025,0xd6cdad,0,0.49,2.08);return van;
}
