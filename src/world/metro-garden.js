import * as THREE from 'three';
import * as K from './sites/kit.js';
import {inLdrpArea,toMarket} from './sites/ldrp-market-layout.js';
const distance=(x,z,a,b)=>K.segDist(x,z,a,b);
export function metroGardenLayout(piers,origin,offRoad=()=>true){
 const segments=[];
 for(let i=1;i<piers.length;i++){
   const a=piers[i-1],b=piers[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
   if(len<16||len>62||!inLdrpArea(origin,(a[0]+b[0])/2,(a[1]+b[1])/2))continue;
   const dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len,nx=dz,nz=-dx;
   const tree=[(a[0]+b[0])/2,(a[1]+b[1])/2];
   // A pedestrian opening stays aligned to the single college entrance.
   const opening=(x,z)=>{const p=toMarket(origin,x,z);return p.u>-116&&p.u<-105&&p.v>-4&&p.v<5;};
   for(let d=0;d<len;d+=1){const end=Math.min(len,d+1),x=a[0]+dx*(d+end)/2,z=a[1]+dz*(d+end)/2;if(opening(x,z)||!offRoad(x,z,1.45))continue;segments.push({a:[a[0]+dx*d,a[1]+dz*d],b:[a[0]+dx*end,a[1]+dz*end],nx,nz});}
   segments[segments.length-1]&&(segments[segments.length-1].tree=opening(...tree)||!offRoad(...tree,1.45)?null:tree);
 }
 return segments;
}
export function buildMetroGarden(scene,piers,origin,offRoad){
 const segments=metroGardenLayout(piers,origin,offRoad),root=new THREE.Group();root.name='Fences only in planted metro median';scene.add(root);
 const metal=K.mat(0x425c4b,{metalness:.45,roughness:.66}),kerb=K.mat(0xb5ad8f),grass=K.mat(K.lawnTex(),{color:0x7c8057}),soil=K.mat(K.dryGround(),{color:0x9b8d6b,roughness:1});
 const grid=K.canvasTex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);c.strokeStyle='#536b54';c.lineWidth=1.8;for(let n=-64;n<=128;n+=16){c.beginPath();c.moveTo(n,0);c.lineTo(n+64,h);c.stroke();c.beginPath();c.moveTo(n,0);c.lineTo(n-64,h);c.stroke();}});grid.wrapS=grid.wrapT=THREE.RepeatWrapping;
 const wire=K.mat(grid,{transparent:true,alphaTest:.35,side:THREE.DoubleSide,roughness:.65});
 for(const [i,s] of segments.entries()){
  const {a,b,nx,nz}=s,dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),yaw=-Math.atan2(dz,dx),x=(a[0]+b[0])/2,z=(a[1]+b[1])/2;
  K.box(root,len,.16,2.65,kerb,x,.19,z,yaw);K.box(root,len,.025,2.4,i%7<2?soil:grass,x,.35,z,yaw);
  for(const side of [-1,1])K.box(root,len,.12,.13,i%2?0xc1a24f:0x3e423a,x+nx*side*1.32,.2,z+nz*side*1.32,yaw);
  for(const side of [-1,1]){
   const fx=x+nx*side*1.22,fz=z+nz*side*1.22;
   for(const y of [.44,1.22])K.box(root,len,.025,.025,metal,fx,y,fz,yaw);
   if(i%2===0)K.cyl(root,.025,.025,.94,metal,a[0]+nx*side*1.22,.35,a[1]+nz*side*1.22,6);
   const geo=new THREE.PlaneGeometry(len,.78);const uv=geo.attributes.uv;for(let n=0;n<uv.count;n++)uv.setXY(n,uv.getX(n)*len/.6,uv.getY(n)*1.3);
   const fence=new THREE.Mesh(geo,wire);fence.position.set(fx,.83,fz);fence.rotation.y=yaw;root.add(fence);
  }
  if(s.tree)K.tree(root,...s.tree,.33);
 }
 K.mergeStatic(root);
 const cells=new Map();for(const s of segments)for(let x=Math.floor((Math.min(s.a[0],s.b[0])-5)/20);x<=Math.floor((Math.max(s.a[0],s.b[0])+5)/20);x++)for(let z=Math.floor((Math.min(s.a[1],s.b[1])-5)/20);z<=Math.floor((Math.max(s.a[1],s.b[1])+5)/20);z++){const key=`${x},${z}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);}
 const at=(x,z,r=0)=>(cells.get(`${Math.floor(x/20)},${Math.floor(z/20)}`)||[]).some(s=>distance(x,z,s.a,s.b)<1.4+r);
 const zone={id:'metro-planted-median',contains:at,heights:()=>[],forbidsVehicles:at,clearing:{contains:at}};
 return{root,zone,segments,obstacles:segments.filter((_,i)=>i%2===0).map(s=>({x:(s.a[0]+s.b[0])/2,z:(s.a[1]+s.b[1])/2,r:1.45}))};
}
