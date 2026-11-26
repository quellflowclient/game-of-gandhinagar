import {stallAvailability} from '../../data/stall-hours.js';
import * as THREE from 'three';
import * as K from './kit.js';
import {createAvatar} from '../avatar.js';
import {ROAD5_OUTER_EXPANSION,MARKET,MARKET_GROUND,MARKET_SHOPS,LDRP_PLAY_AREA,marketPoint,toMarket,shopYaw,shopPoint,shopPlot} from './ldrp-market-layout.js';
import {referenceStall,referenceBackdrop,parkedReferenceVan} from './ldrp-stall-models.js';
import {createVehicleModel} from '../vehicle-models.js';
import {buildKh5Sculpture} from '../kh5-sculpture.js';

const idFor=(s,n)=>`${s.id}-seat-${n}`;
export function buildLdrpMarket(scene,origin) {
  const phone=matchMedia("(pointer: coarse)").matches;
  const worldOrigin=marketPoint(origin,0,0),f=K.frame(worldOrigin,MARKET.yaw);
  const root=new THREE.Group();root.name='KH-5 street life';root.position.set(worldOrigin.x,0,worldOrigin.z);root.rotation.y=MARKET.yaw;scene.add(root);
  const solids=[],plots=MARKET_SHOPS.map(shopPlot),seats=[],actors=[],shops=[],smoke=[];
  const rect=(a,b,c,d)=>[[a,c],[b,c],[b,d],[a,d]];
  const extra=ROAD5_OUTER_EXPANSION,shoulders=[rect(-175,-24,9.5+extra,25.65+extra),rect(23,185,9.5+extra,25.65+extra),rect(20,185,-24-extra,-8-extra),rect(-117.5,-108.5,-13-extra,-7.9-extra)],walkAreas=[...plots,...shoulders];
  // The shared metro-garden builder owns the surveyed median and both mesh fences.
  // Do not add a second guessed strip beside the college carriageway.
  const medianSections=[],medianAreas=[];
  const steel=K.mat(0xaab3b1,{metalness:0.8,roughness:0.32}),dark=K.mat(0x202725),wood=K.mat(0x82705a),cream=K.mat(0xe5ddc9);
  const roofTex=K.canvasTex(128,128,(c,w,h)=>{c.fillStyle='#bcb9a7';c.fillRect(0,0,w,h);for(let x=0;x<w;x+=12){c.fillStyle='rgba(0,0,0,.14)';c.fillRect(x,0,2,h);c.fillStyle='rgba(255,255,255,.2)';c.fillRect(x+3,0,2,h);}});
  const ground=K.mat(K.greyPavers(),{color:0xb7b1a2,roughness:1});
  function bowl(g,x,y,z,r=0.19,color=0xc1c6c1){K.cyl(g,r,r*0.72,0.12,color,x,y,z,18);}
  function cup(g,x,y,z){K.cyl(g,0.043,0.03,0.075,0xece2cd,x,y,z,12);K.cyl(g,0.038,0.038,0.004,0x91633a,x,y+0.075,z,12);}
  function plate(g,x,y,z,food='bhaji') {
    K.cyl(g,0.2,0.2,0.018,steel,x,y,z,22);
    K.cyl(g,0.085,0.08,0.035,food==='chhole'?0x956535:0x9b4829,x-0.07,y+0.02,z,14);
    for(let i=0;i<2;i++){const p=K.sphere(g,0.06,0xd6a869,x+0.08,y+0.06,z+(i-0.5)*0.11,10);p.scale.set(1.15,0.65,0.9);}
  }
  function chair(g,x,z,yaw=0) {const c=new THREE.Group();c.position.set(x,0,z);c.rotation.y=yaw;g.add(c);K.box(c,0.55,0.06,0.5,wood,0,0.43,0);for(const dx of [-0.22,0.22])for(const dz of [-0.2,0.2])K.box(c,0.045,0.43,0.045,steel,dx,0,dz);K.box(c,0.55,0.42,0.045,wood,0,0.49,-0.23);}
  const packetLabels=new Map();
  function packets(g,options={}) {
    const {width=3,center=0,z=-1.35,rows=3,opening=false}=options;
    for(let row=0;row<rows;row++)for(let i=0;i<7;i++) {
      if(opening&&i>=2&&i<=4)continue;
      const x=center-width/2+i*width/6,y=1.23+row*0.29;
      K.box(g,0.28,0.25,0.07,[0xa93827,0xd1a329,0x3d7d3e][(i+row)%3],x,y,z);
      const brand=i%2?'GOPAL':'BALAJI';
      if(!packetLabels.has(brand)){const tex=K.canvasTex(256,100,(c,w,h)=>{c.fillStyle='#fff6d7';c.font='700 38px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(brand,w/2,h/2,w-12);});packetLabels.set(brand,K.mat(tex,{transparent:true,alphaTest:0.1,side:THREE.FrontSide}));}
      const label=new THREE.Mesh(new THREE.PlaneGeometry(0.26,0.1),packetLabels.get(brand));label.position.set(x,y+0.15,z+0.045);g.add(label);
    }
  }
  function smallTable(id,s,x,z,occupant=null,group=null,allowBorrow=true,relativeYaw=0,circle=null) {
    const [u,v]=shopPoint(s,x,z),p=f.toWorld(u,v);
    seats.push({id,shopId:s.id,x:p.x,y:MARKET_GROUND,z:p.z,yaw:MARKET.yaw+shopYaw(s)+relativeYaw,occupant,group,allowBorrow,local:[u,v],circle:circle||group});
  }
  function actor(s,name,role,x,z,options={}) {
    actors.push({shopId:s.id,name,role,x,z,home:[x,z],yaw:0,phase:name.length*0.8,options,avatar:null,position:new THREE.Vector2(x,z)});
  }
  // Existing OSM carriageways remain intact. The green island sits inside the
  // mapped KH-5 roundabout, never underneath moving traffic lanes.
  // 15.8 m OSM ring centreline minus its 6.5 m half-road = 9.3 m island.
  // Build the photo's broad red/cream pavement and raised planted interior.
  const paving=K.canvasTex(256,256,(c,w,h)=>{c.fillStyle='#ddd4b9';c.fillRect(0,0,w,h);for(let y=0;y<h;y+=16)for(let x=-32;x<w;x+=64){c.fillStyle='#ae7665';c.fillRect(x+(y%32?32:0),y,30,14);}});paving.wrapS=paving.wrapT=THREE.RepeatWrapping;paving.repeat.set(10,10);
  K.cyl(root,9.12,9.12,0.24,K.mat(paving,{roughness:1}),0,0,0,96);
  K.cyl(root,7.35,7.35,0.45,cream,0,0.24,0,96);K.cyl(root,7.2,7.2,0.03,K.mat(K.lawnTex(),{color:0x788658}),0,0.69,0,96);
  const circleArt=buildKh5Sculpture(root);
  for(const radius of [7.38])for(const y of [1.06,1.48]){const rail=new THREE.Mesh(new THREE.TorusGeometry(radius,0.025,6,100),steel);rail.rotation.x=Math.PI/2;rail.position.y=y;root.add(rail);}
  for(let i=0;i<48;i++){const a=i*Math.PI/24;K.cyl(root,0.025,0.025,0.85,steel,Math.cos(a)*7.38,0.69,Math.sin(a)*7.38,6);if(i%2===0){const hoop=new THREE.Mesh(new THREE.TorusGeometry(.15,.014,5,16),steel);hoop.position.set(Math.cos(a)*7.38,1.24,Math.sin(a)*7.38);hoop.rotation.y=Math.PI/2-a;root.add(hoop);}}
  for(let i=0;i<12;i++){const a=i*Math.PI/6,shrub=K.sphere(root,0.78,K.mat(K.lawnTex(),{color:0x58714b}),Math.cos(a)*5.6,0.65,Math.sin(a)*5.6,12);shrub.scale.y=0.85;}
  // Red/cream paving and black/yellow curb follow the reference roundabout edge.
  for(let i=0;i<72;i++){const a=i*Math.PI/36;K.box(root,0.79,0.16,0.23,i%2?0xc3a44a:0x343b39,Math.cos(a)*9.1,0.08,Math.sin(a)*9.1,-a);}
  solids.push({circle:[0,0,9.25]});
  const nightLamps=[],lightPositions=[...circleArt.lampPositions];
  for(const shop of MARKET_SHOPS){
    const u=shop.u+8,v=shop.v>0?11:-10.8;
    K.streetLight(root,u,v,0,{h:7,double:true});lightPositions.push([u,7,v]);solids.push({circle:[u,v,.14]});
  }
  // Shared warm pools are cheap on phones; only the three nearest real lights
  // illuminate people/materials. No shadow maps per lamp.
  const glowTex=K.canvasTex(64,64,(c,w,h)=>{const r=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,213,137,.38)');r.addColorStop(1,'rgba(255,213,137,0)');c.fillStyle=r;c.fillRect(0,0,w,h);});
  const poolMat=new THREE.MeshBasicMaterial({map:glowTex,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending});poolMat.visible=false;
  for(const [u,y,v] of lightPositions){const pool=new THREE.Mesh(new THREE.PlaneGeometry(13,13),poolMat);pool.rotation.x=-Math.PI/2;pool.position.set(u,MARKET_GROUND+.03,v);pool.userData.keep=true;root.add(pool);}
  const nightLights=Array.from({length:3},()=>{const l=new THREE.PointLight(0xffd69b,0,22,2);scene.add(l);return l;});
  // Road exits show a physical end marker while the movement boundary includes
  // the complete college compound, circle and all stalls.
  const b=LDRP_PLAY_AREA;
  for(const [u,v,yaw] of [[b.minU+1,0,Math.PI/2],[b.maxU-1,0,Math.PI/2],[0,b.minV+1,0],[0,b.maxV-1,0]]){
    const gate=new THREE.Group();gate.position.set(u,0,v);gate.rotation.y=yaw;root.add(gate);
    for(const x of [-10,-5,0,5,10]){K.box(gate,2.4,.65,.5,x%10?0xc5ad55:0x645d48,x,.2,0);K.cyl(gate,.035,.035,1.8,steel,x,.85,0,8);}
    K.textPlane(gate,['LDRP / KH-5 AREA','Exploration ends here'],{bg:'#384b40',fg:'#fff0c9'},5,1,0,2.2,0);
  }
  const soil=K.mat(K.dryGround(),{color:0xc5b691,roughness:1}),wallStone=K.mat(0xb0a58b,{roughness:1});
  // The 4th shoulder sits in front of the LDRP gate: still walkable, but drawn as
  // plain road (no separate sand patch) so the gate floor is one surface.
  for(const plot of shoulders.slice(0,3))K.slab(root,plot,MARKET_GROUND-0.012,soil,0,5);
  for(const [a,b,v] of [[-175,-24,25.6+extra],[23,185,25.6+extra],[20,185,-23.9-extra]]) {
    K.box(root,b-a,1.8,0.24,wallStone,(a+b)/2,MARKET_GROUND,v);
    for(let u=a;u<=b;u+=3.5){K.box(root,0.25,2.3,0.3,wallStone,u,MARKET_GROUND,v);for(let d=0.3;d<3.3&&u+d<b;d+=0.4)K.box(root,0.02,0.5,0.02,0x3e624a,u+d,MARKET_GROUND+1.8,v);}
    K.box(root,b-a,0.025,0.025,0x3e624a,(a+b)/2,MARKET_GROUND+2.28,v);solids.push({rect:[(a+b)/2,v,b-a,0.3,0]});
  }
  // One planted centre median, fenced on both sides; public drives remain
  // separate carriageways. Leave pedestrian crossing gaps aligned to the gate.
  for(const [a,b] of medianSections) {
    K.box(root,b-a,0.16,1.65,cream,(a+b)/2,0.22,0.85);K.slab(root,rect(a,b,0.13,1.57),0.385,K.mat(K.lawnTex(),{color:0x6f8355}),0,3);
    for(const v of [0.08,1.63]){
      for(const h of [0.48,1.15])K.box(root,b-a,0.022,0.022,0x536158,(a+b)/2,h,v);
      for(let u=a;u<b;u+=1.5){K.box(root,0.035,0.85,0.035,0x536158,u,0.35,v);for(let k=0.17;k<1.5&&u+k<b;k+=0.17)K.box(root,0.012,0.72,0.012,0x66756a,u+k,0.42,v);}
    }
    for(let u=a+5;u<b-3;u+=12)K.tree(root,u,0.85,0.24);
    solids.push({rect:[(a+b)/2,0.85,b-a,1.7,0]});
  }
  for(const s of MARKET_SHOPS) {
    const g=new THREE.Group();g.name=s.name;g.position.set(s.u,MARKET_GROUND,s.v);g.rotation.y=shopYaw(s);root.add(g);s.group3d=g;
    const at=(x,z)=>shopPoint(s,x,z);
    referenceBackdrop(g,s);
    const style=referenceStall(g,s);
    if(style.tempo)solids.push({rect:[...at(0,-0.35),4.9,2.3,shopYaw(s)]});
    else {solids.push({rect:[...at(0,0),s.kind==='food'?6.0:style.width+0.2,1.2,shopYaw(s)]});if(style.back)solids.push({rect:[...at(0,-1.65),style.width+0.2,0.25,shopYaw(s)]});}
    solids.push({rect:[...at(0,-10.1),14,0.3,shopYaw(s)]});
    for(const x of [-5.9,5.9])solids.push({circle:[...at(x,-8.8),0.55]});
    if(s.id==='babu'){solids.push({circle:[...at(-4.9,1.4),0.6]});parkedReferenceVan(g,5.0,-2.4,Math.PI/2);solids.push({rect:[...at(5,-2.4),4.4,1.9,shopYaw(s)]});}
    if(s.id==='chintu'){parkedReferenceVan(g,4.8,-2.7,Math.PI/2);solids.push({rect:[...at(4.8,-2.7),4.4,1.9,shopYaw(s)]});}
    if(style.packets)packets(g,style.packets);
    for(let i=0;i<2;i++){const x=-5.2+i*1.05,z=2.8+i*0.55;K.scooter(g,x,z,0.35+i*0.15,i?0x6e7472:0x293e41);solids.push({rect:[...at(x,z),0.85,1.8,shopYaw(s)+0.4]});}
    if(s.id==='lalbhai'||s.id==='masi'){
      const auto=new THREE.Group(),x=s.id==='masi'?-4.8:4.9;auto.position.set(x,0.01,-2.3);auto.rotation.y=0.15;g.add(auto);
      const model=createVehicleModel('auto');for(const part of model.parts){const material=part.paint?part.material.clone():part.material;if(part.paint)material.color.setHex(0x39745a);const mesh=new THREE.Mesh(part.geometry,material);auto.add(mesh);}
      solids.push({rect:[...at(x,-2.3),1.8,2.9,shopYaw(s)+0.15]});
    }
    K.textPlane(g,s.items.map(([n,p])=>`${n}  ${p}`),{bg:'#252d29',fg:'#e9ddbc',font:'500 55px sans-serif',h:340},1.25,1.15,3.0,1.55,0.66,0);
    K.cyl(g,0.05,0.05,0.5,dark,0,2,1.4,8);K.sphere(g,0.085,K.mat(0xffdf9f,{emissive:0xb48b40,emissiveIntensity:0.35}),0,1.98,1.4,10);
    const serveX=s.kind==='tempo'?-0.6:-1.1;
    K.cyl(g,0.39,0.39,0.045,dark,serveX,0.96,0.05,24);
    if(s.kind==='food') {
      K.cyl(g,0.27,0.24,0.32,steel,-2.2,0.95,-0.1,20);bowl(g,0,0.97,0);plate(g,0.6,0.94,0.22,s.id==='babu'?'chhole':'bhaji');
      for(let i=0;i<5;i++)K.cyl(g,0.19,0.19,0.014,steel,1.3,0.94+i*0.018,-0.2,20);
    } else {
      K.cyl(g,0.19,0.19,0.23,steel,serveX,0.96,0.05,18);K.cyl(g,0.15,0.22,0.09,steel,serveX,1.19,0.05,18);
      for(let i=0;i<7;i++)cup(g,0.2+(i%4)*0.14,0.94,0.15-Math.floor(i/4)*0.2);
    }
    K.cyl(g,0.21,0.22,0.62,0xb15e3f,-2.75,0,-1.0,16);K.cyl(g,0.08,0.08,0.12,dark,-2.75,0.62,-1,10);
    K.box(g,0.55,0.16,0.34,0x6e6451,2.1,0.94,0.1);K.box(g,0.22,0.012,0.12,0xc9ba92,2.1,1.1,0.1);
    K.cyl(g,0.23,0.2,0.55,0x476b6b,4.3,0,-1.1,16);
    const seatCount=s.kind==='food'?2:0;
    for(let n=0;n<seatCount;n++) {
      const x=seatCount===2?(n?2.5:-2.5):0,z=-6.2;
      K.box(g,1.5,0.055,1.05,steel,x,0.74,z);for(const dx of [-0.6,0.6])for(const dz of [-0.38,0.38])K.box(g,0.035,0.74,0.035,dark,x+dx,0,z+dz);
      solids.push({rect:[...at(x,z),1.6,1.15,shopYaw(s)]});
      const group=`${s.id}-friends-${n}`;
      for(let k=0;k<4;k++)smallTable(idFor(s,n*4+k),s,x+(k===2?1.25:k===3?-1.25:0),z+(k===0?-1:k===1?1:0),k<2?`${s.id}-guest-${n}-${k}`:null,group,k!==3,k===1?Math.PI:k===2?-Math.PI/2:k===3?Math.PI/2:0);
      if(s.kind==='food')plate(g,x,0.8,z,s.id==='babu'?'chhole':'bhaji');else cup(g,x,0.8,z);
      for(let guest=0;guest<2;guest++)actor(s,`${s.id==='babu'?'Jay':s.id==='chintu'?'Meet':'Guest'} ${n*2+guest+1}`,'eat',x,z+(guest?1:-1),{seatId:idFor(s,n*4+guest),customer:true,group,female:guest===1&&n===1});
    }
    if(s.kind!=='food'){
      // Tea tapris: friends sit in circles of 4-5 low seats around one shared
      // chai table, so a group can talk together (and join one voice room).
      const circles=[[-2.8,-3.3,4,Math.PI/4],[0,-3.3,4,Math.PI/4],[2.8,-3.3,4,Math.PI/4],[-1.6,-6.9,5,0],[1.6,-6.9,5,0]];
      let n=0;
      circles.forEach(([cx,cz,count,turn],c)=>{
        const circle=`${s.id}-circle-${c}`,group=c===0?`${s.id}-friends-0`:null,r=count===4?1.0:1.1;
        K.cyl(g,0.36,0.36,0.04,K.mat(0x9a7656,{roughness:0.8}),cx,0.62,cz,20);K.cyl(g,0.04,0.05,0.62,dark,cx,0,cz,8);K.cyl(g,0.22,0.22,0.03,dark,cx,0,cz,14);
        cup(g,cx-0.08,0.66,cz);cup(g,cx+0.1,0.66,cz+0.06);
        solids.push({rect:[...at(cx,cz),0.75,0.75,shopYaw(s)]});
        for(let k=0;k<count;k++){
          const a=turn+k*Math.PI*2/count,ox=Math.sin(a)*r,oz=-Math.cos(a)*r;
          smallTable(idFor(s,n),s,cx+ox,cz+oz,c===0&&k<2?`${s.id}-guest-0-${k}`:null,group,!(c===0&&k===3),Math.atan2(-ox,-oz),circle);
          if(c===0&&k<2)actor(s,`Guest ${k+1}`,'eat',cx+ox,cz+oz,{seatId:idFor(s,n),customer:true,group,female:k===1});
          n++;
        }
      });
    }
    if(s.id==='babu') {
      actor(s,'Saras','cook',-1.1,-0.65,{prop:'spatula',apron:true});actor(s,'Masi','cash',2.1,-0.55,{female:true,older:true});chair(g,2.1,-0.55);actor(s,'Babu','serve',4.9,1,{server:true,prop:'plate'});
    } else if(s.id==='chintu') {
      actor(s,'Chintu','cook',-1.1,-0.65,{server:true,prop:'spatula',apron:true});actor(s,'Kaka','cook',1.35,-0.65,{older:true,prop:'spatula'});
    } else if(s.id==='lalbhai') {
      actor(s,'Lalbhai','sell',0,-0.55,{older:true,server:true});chair(g,0,-0.55);
      actor(s,'Adult customer','smoke',4.8,2,{prop:'cigarette'});actor(s,'Adult customer','rub',-4.7,2,{prop:'packet'});
      // Neutral display stock; these adult ambient actions are not an order menu.
      for(let i=0;i<5;i++)K.box(g,0.1,0.18,0.045,0xd6cdb9,2.3+i*0.12,1.2,-0.9);
    } else if(s.id==='natu'){actor(s,'Natu','sell',0,-0.55,{server:true});chair(g,0,-0.55);}
    else if(s.id==='masi'){actor(s,'Masi','tea',-1.1,-0.65,{female:true,older:true,server:true,prop:'kettle'});actor(s,'Kaka','tea',1.25,-0.65,{older:true});}
    else if(s.id==='sarpanch')actor(s,'Sarpanch','tea',-1.1,-0.65,{server:true,prop:'kettle'});
    else if(s.id==='patel')actor(s,'Patel','tea',0.3,0.8,{server:true,prop:'kettle'});
    else {actor(s,'Ajit','tea',-1.1,-0.65,{server:true,prop:'kettle'});actor(s,'Bapu','stern',2.1,-0.55,{older:true,occasional:true});chair(g,2.1,-0.55);}
    const [cu,cv]=at(0,3.3),counterWorld=f.toWorld(cu,cv);
    shops.push({...s,group3d:g,...counterWorld,place:'ldrp',street:true,caller:({babu:'Babu',chintu:'Chintu',lalbhai:'Lalbhai',natu:'Natu',masi:'Masi',sarpanch:'Sarpanch',patel:'Patel',ajit:'Ajit'})[s.id]});
    for(let i=0;i<5;i++)smoke.push({shop:s,g,seed:i*1.7,kind:'steam',x:serveX,y:1.3,z:0.05});
  }
  K.mergeStatic(root);
  root.traverse(o=>{if(o.userData.lamp)nightLamps.push(o.material);});
  // Static geometry is baked into root. Restore empty local anchors for the
  // animated staff and steam after the batching pass detaches nested groups.
  for(const s of shops){s.group3d.clear();root.add(s.group3d);}
  // Sitting tables are separate dynamic objects: never baked into static mesh.
  const tableModel=new THREE.Group();
  K.box(tableModel,0.46,0.06,0.46,K.mat(0x8c6951,{roughness:0.85}),0,0.43,0);
  for(const x of [-0.18,0.18])for(const z of [-0.18,0.18])K.box(tableModel,0.045,0.43,0.045,dark,x,0,z);
  K.mergeStatic(tableModel);
  const tableBatches=[];
  tableModel.traverse(part=>{if(!part.isMesh)return;const batch=new THREE.InstancedMesh(part.geometry,part.material,seats.length);batch.name='Movable small sitting tables';batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);batch.castShadow=batch.receiveShadow=true;batch.frustumCulled=false;scene.add(batch);tableBatches.push(batch);});
  const tableTransform=new THREE.Object3D(),tableHidden=new THREE.Matrix4().makeScale(0,0,0);
  for(const [index,seat] of seats.entries()){seat.instance=index;seat.mesh=new THREE.Object3D();seat.mesh.position.set(seat.x,MARKET_GROUND,seat.z);seat.mesh.rotation.y=seat.yaw;tableTransform.position.copy(seat.mesh.position);tableTransform.rotation.y=seat.yaw;tableTransform.updateMatrix();for(const batch of tableBatches)batch.setMatrixAt(index,tableTransform.matrix);}
  // Soft, animated steam and occasional adult cigarette smoke.
  const mistTex=K.canvasTex(64,64,(c,w,h)=>{const r=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);r.addColorStop(0,'rgba(255,255,255,.4)');r.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=r;c.fillRect(0,0,w,h);});
  for(const puff of smoke){const mat=new THREE.SpriteMaterial({map:mistTex,transparent:true,opacity:0.25,depthWrite:false});puff.sprite=new THREE.Sprite(mat);root.add(puff.sprite);}
  const worldPlots=[...walkAreas,...medianAreas].map(p=>p.map(([u,v])=>{const w=f.toWorld(u,v);return[w.x,w.z];}));
  const zone={id:'kh5-market',contains:(x,z)=>{const {u,v}=f.toLocal(x,z);return Math.hypot(u,v)<9.4||[...walkAreas,...medianAreas].some(p=>K.nearPolygon(u,v,p,0.15));},
    heights(x,z,r=0.38){const {u,v}=f.toLocal(x,z);for(const s of solids){if(s.circle&&Math.hypot(u-s.circle[0],v-s.circle[1])<s.circle[2]+r)return[];if(s.rect){const [a,b,w,d,yaw]=s.rect,dx=u-a,dz=v-b,c=Math.cos(yaw),sn=Math.sin(yaw);if(Math.abs(dx*c-dz*sn)<w/2+r&&Math.abs(dx*sn+dz*c)<d/2+r)return[];}}for(const seat of seatState?.all()||seats)if(!seat.carriedBy&&Math.hypot(x-seat.x,z-seat.z)<0.38+r)return[];return[MARKET_GROUND];},
    forbidsVehicles(x,z,margin=0){return worldPlots.some(p=>K.nearPolygon(x,z,p,margin));},roadHeight:()=>null,
    clearing:{contains:(x,z)=>{const {u,v}=f.toLocal(x,z);return Math.hypot(u,v)<8.8||[...walkAreas,...medianAreas].some(p=>K.pointInPolygon(u,v,p));}}};
  let lastTime=0,service=null,seatState=null;
  function footRoute(shop,from,goal,ownSeat=null) {
    const spacing=0.4,minX=-6,minZ=-8.6,nx=31,nz=33;
    const rects=solids.filter(s=>s.rect&&Math.hypot(s.rect[0]-shop.u,s.rect[1]-shop.v)<18).map(s=>s.rect);
    const seatCircles=(seatState?.all()||[]).filter(s=>s.shopId===shop.id&&s.id!==ownSeat&&!s.carriedBy).map(s=>{const p=shop.group3d.worldToLocal(new THREE.Vector3(s.x,0,s.z));return[p.x,p.z];});
    const point=(x,z)=>new THREE.Vector2(minX+x*spacing,minZ+z*spacing);
    const open=(x,z)=>{
      const p=point(x,z),[u,v]=shopPoint(shop,p.x,p.y);
      for(const rect of rects){const [a,b,w,d,yaw]=rect,dx=u-a,dz=v-b,c=Math.cos(yaw),sn=Math.sin(yaw);if(Math.abs(dx*c-dz*sn)<w/2+0.12&&Math.abs(dx*sn+dz*c)<d/2+0.12)return false;}
      for(const [x,z] of seatCircles)if(Math.hypot(p.x-x,p.y-z)<0.52)return false;
      return true;
    };
    const nearest=p=>{let best=null,d=Infinity;for(let z=0;z<nz;z++)for(let x=0;x<nx;x++){const q=point(x,z),v=q.distanceToSquared(p);if(v<d&&open(x,z)){d=v;best=z*nx+x;}}return best;};
    const start=nearest(from),end=nearest(goal);if(start===null||end===null)return[];
    const parent=new Int32Array(nx*nz).fill(-1),queue=[start];parent[start]=start;
    for(let i=0;i<queue.length&&parent[end]<0;i++) {
      const node=queue[i],x=node%nx,z=Math.floor(node/nx);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){const a=x+dx,b=z+dz,key=b*nx+a;if(a<0||b<0||a>=nx||b>=nz||parent[key]>=0||!open(a,b))continue;parent[key]=node;queue.push(key);}
    }
    if(parent[end]<0)return[];const path=[];for(let k=end;k!==start;k=parent[k])path.unshift(point(k%nx,Math.floor(k/nx)));
    return path;
  }
  function label(text) {
    const tex=K.canvasTex(512,96,(c,w,h)=>{c.fillStyle='rgba(32,38,32,.8)';c.roundRect(0,0,w,h,22);c.fill();c.fillStyle='#fff2d5';c.textAlign='center';c.textBaseline='middle';c.font='500 38px sans-serif';c.fillText(text,w/2,h/2,w-25);});
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:true,transparent:true}));sprite.scale.set(1.6,0.3,1);return sprite;
  }
  function instantiate(a) {
    const s=shops.find(s=>s.id===a.shopId),look=a.options.female?'fcasual':a.options.older?'worker':a.name==='Chintu'?'tshirt':'casual';
    a.avatar=createAvatar(look,0xb98158);if(a.options.older)a.avatar.setOlder();s.group3d.add(a.avatar.root);
    const colors={Saras:0xddd3b8,Babu:0x789b7c,Chintu:0xc7a04e,Kaka:0x9b9788,Lalbhai:0xd3c7af,Natu:0x9b6a51,Masi:0xa96f7c,Patel:0xa4b2ae,Ajit:0x658a93,Bapu:0x858c78,Sarpanch:0x9d906c};
    if(colors[a.name])a.avatar.setClothes(colors[a.name]);
    a.tag=label(a.name);a.avatar.root.add(a.tag);a.tag.position.y=1.98;
    const prop=new THREE.Group();a.avatar.root.add(prop);a.prop=prop;
    if(a.options.prop==='spatula'){K.box(prop,0.025,0.025,0.25,steel,0,0,0.08);K.box(prop,0.08,0.012,0.09,steel,0,-0.02,0.24);}
    if(a.options.prop==='plate')plate(prop,0,0,0);
    if(a.options.prop==='kettle'){K.cyl(prop,0.11,0.12,0.16,steel,0,-0.06,0,14);K.box(prop,0.05,0.04,0.16,steel,0,0,0.12);}
    if(a.options.prop==='cigarette'){K.cyl(prop,0.005,0.005,0.075,0xe5dcc2,0,-0.02,0,6);K.sphere(prop,0.006,K.mat(0xc96c39,{emissive:0xb44c11,emissiveIntensity:0.3}),0,0.055,0,6);}
    if(a.options.prop==='packet')K.box(prop,0.075,0.004,0.09,K.mat(0xd0c5a4,{transparent:true,opacity:0.75}),0,0,0);
    if(a.options.server){a.tray=new THREE.Group();a.avatar.root.add(a.tray);if(s.kind==='food')plate(a.tray,0,0,0,s.id==='babu'?'chhole':'bhaji');else cup(a.tray,0,0,0);}
    if(a.role==='smoke'){a.exhale=new THREE.Sprite(new THREE.SpriteMaterial({map:mistTex,transparent:true,opacity:0.15,depthWrite:false}));a.avatar.root.add(a.exhale);}
    if(a.options.apron){const apron=K.box(a.avatar.root,0.38,0.42,0.025,0xddd5bb,0,0.7,0.14);a.apron=apron;}
  }
  // Dynamic covers are added after static batching so each stall can close.
  for(const s of shops){const cover=new THREE.Group();cover.position.set(s.u,MARKET_GROUND,s.v);cover.rotation.y=shopYaw(s);root.add(cover);
    K.box(cover,s.kind==='food'?5.7:2.9,1.1,.035,K.mat(0x797d75,{roughness:1}),0,.35,.68);
    K.textPlane(cover,['BANDH · CLOSED'],{bg:'#2d3933',fg:'#f5e7c3',w:512,h:128,font:'700 47px sans-serif'},1.7,.4,0,1.4,.72);
    cover.visible=false;s.closedCover=cover;s.isOpen=true;
  }
  const market={shops,seats,zone,origin:worldOrigin,frame:f,root,actors,
    setBusinessTime(hour,weekday){for(const s of shops){const status=stallAvailability(s,hour,weekday);s.isOpen=status.open;s.businessStatus=status.text;s.hoursText=status.hours;s.closedCover.visible=!status.open;}},
    setNight(on,playerPos){for(const m of nightLamps)m.emissiveIntensity=on?3:0;poolMat.visible=on;const nearest=lightPositions.map(([u,y,v])=>({...f.toWorld(u,v),y})).sort((a,b)=>Math.hypot(a.x-playerPos.x,a.z-playerPos.z)-Math.hypot(b.x-playerPos.x,b.z-playerPos.z));nightLights.forEach((l,i)=>{const p=nearest[i];l.position.set(p.x,p.y,p.z);l.intensity=on?90:0;});},
    furnitureChanged(){for(const a of actors)a.routeKey=null;},
    canDrop(x,z){const {u,v}=f.toLocal(x,z);return plots.some(p=>K.pointInPolygon(u,v,p))&&zone.heights(x,z,0.52).length>0;},
    renderSeats(ledger,player,me,remote=[]){for(const s of ledger.all()){const original=seats.find(q=>q.id===s.id);if(!original)continue;const mesh=original.mesh,carrier=s.carriedBy===me?{...player.position,heading:player.heading}:remote.find(p=>p.userId===s.carriedBy);if(s.carriedBy&&carrier){mesh.visible=Math.hypot(carrier.x-player.position.x,carrier.z-player.position.z)<65;mesh.position.set(carrier.x+Math.sin(carrier.heading||0)*0.6,(carrier.y||0)+0.5,carrier.z+Math.cos(carrier.heading||0)*0.6);mesh.rotation.y=carrier.heading||0;}else{mesh.position.set(s.x,MARKET_GROUND,s.z);mesh.rotation.y=s.yaw;mesh.visible=!s.carriedBy&&Math.hypot(s.x-player.position.x,s.z-player.position.z)<65;}mesh.updateMatrix();for(const batch of tableBatches)batch.setMatrixAt(original.instance,mesh.visible?mesh.matrix:tableHidden);}for(const batch of tableBatches)batch.instanceMatrix.needsUpdate=true;},
    react(shopId,yes){for(const a of actors.filter(a=>a.shopId===shopId&&a.options.customer))a.avatar?.gesture(yes?'yes':'no');},
    bind(serviceState,seatLedger){service=serviceState;seatState=seatLedger;},
    staffDistance(){const meal=service?.meal;if(!meal)return Infinity;const a=actors.find(a=>a.shopId===meal.shop.id&&a.options.server);if(!a?.avatar)return Infinity;return a.avatar.root.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(meal.customer.x,meal.customer.y??MARKET_GROUND,meal.customer.z));},
    update(t,playerPos) {
      if(!playerPos)return;const dt=Math.min(0.05,Math.max(0,t-lastTime));lastTime=t;
      for(const a of actors) {
        const s=shops.find(s=>s.id===a.shopId),shopDistance=Math.hypot(playerPos.x-s.x,playerPos.z-s.z);
        const active=(s.isOpen||service?.meal?.shop.id===s.id&&service.meal.phase!=='paid')&&shopDistance<(a.options.customer?(phone?22:32):(phone?36:50))&&(!a.options.occasional||Math.floor(t/55)%4===0);
        if(active&&!a.avatar)instantiate(a);
        if(!a.avatar)continue;a.avatar.root.visible=active;if(!active)continue;
        a.avatar.setShadow(shopDistance<24);a.tag.visible=shopDistance<18;
        let target=new THREE.Vector2(...a.home),role=a.role;
        const meal=service?.meal,isServer=a.options.server&&meal?.shop.id===s.id;
        const ambient=(t+shops.indexOf(s)*7)%74;
        if(isServer&&['approaching','taking-order','delivering','eating','bill-due'].includes(meal.phase)) {
          const p=s.group3d.worldToLocal(new THREE.Vector3(meal.customer.x,0,meal.customer.z));
          target.set(THREE.MathUtils.clamp(p.x+1.0,-5.8,5.8),THREE.MathUtils.clamp(p.z,-8.5,3.8));
          role=meal.phase==='delivering'?'serve':'stand';
        }
        let ambientDelivery=false;
        if(a.options.server&&(!isServer||meal.phase==='paid')&&((ambient>12&&ambient<20)||(ambient>28&&ambient<37))) {
          const guest=actors.find(x=>x.shopId===s.id&&x.options.customer),seat=seatState?.get(guest?.options.seatId);
          const native=market.seats.find(x=>x.id===guest?.options.seatId)?.occupant;
          if(guest&&seat?.occupant===native){target.set(guest.home[0]+1.4,guest.home[1]-0.2);role=ambient>28?'serve':'stand';ambientDelivery=ambient>28;}
        }
        if(a.options.customer) {
          const seat=seatState?.get(a.options.seatId),npcId=market.seats.find(x=>x.id===a.options.seatId)?.occupant;
          if(ambient>53){if(seat?.occupant===npcId)seatState.stand(seat.id,npcId);target.set(4.9,ambient<62?1.7:4.2);role=ambient<58?'pay':'stand';if(ambient>70)a.avatar.root.visible=false;}
          else if(seat) {
            if(!seat.occupant&&!seat.carriedBy&&seat.group===a.options.group)seatState.sit(seat.id,npcId);
            if(seat.occupant===npcId){const p=s.group3d.worldToLocal(new THREE.Vector3(seat.x,0,seat.z));target.set(p.x,p.z);role=ambient>36?'eat':'sit';if(ambient>9&&ambient<12&&a.lastWave!==Math.floor(t/74)){a.avatar.wave();a.lastWave=Math.floor(t/74);}}
            else{target.set(4.9,2.7);role='stand';}
          }
        }
        const routeKey=`${Math.round(target.x/0.4)},${Math.round(target.y/0.4)}`;
        if(routeKey!==a.routeKey){a.routeKey=routeKey;a.route=a.position.distanceTo(target)<0.1?[]:footRoute(s,a.position,target,a.options.seatId);}
        while(a.route?.length&&a.position.distanceTo(a.route[0])<0.1)a.route.shift();
        const waypoint=a.route?.[0]||target,delta=waypoint.clone().sub(a.position),distance=delta.length();
        // Once a reachable route is exhausted, the last small step lands exactly
        // at its work/seat anchor. Failed routes stay put rather than clip solids.
        const canFinish=a.route?.length||a.position.distanceTo(target)<0.55;
        const speed=canFinish&&distance>0.08?Math.min(1.25,distance/Math.max(dt,0.001)):0;
        if(speed){a.position.addScaledVector(delta.normalize(),speed*dt);a.yaw=Math.atan2(delta.x,delta.y);}
        else if(isServer&&meal){const p=s.group3d.worldToLocal(new THREE.Vector3(meal.customer.x,0,meal.customer.z));a.yaw=Math.atan2(p.x-a.position.x,p.z-a.position.y);}
        else a.yaw=a.options.customer&&role!=='stand'?(seatState?.get(a.options.seatId)?.yaw||0)-MARKET.yaw-shopYaw(s):0;
        a.avatar.root.position.set(a.position.x,0,a.position.y);a.avatar.root.rotation.y=a.yaw;
        a.avatar.setActivity(speed?null:role==='stand'?null:role);a.avatar.update(dt,speed);
        a.tag.position.y=['eat','sell','cash'].includes(role)&&!speed?1.45:1.98;
        if(a.prop){a.prop.position.copy(a.avatar.socket(a.options.prop==='packet'?'LeftHand':'RightHand'));a.prop.visible=!!a.options.prop&&(!speed||role==='serve');}
        if(a.tray){a.tray.visible=(isServer&&meal.phase==='delivering')||ambientDelivery;a.tray.position.copy(a.avatar.socket('LeftHand'));if(a.tray.visible&&a.prop)a.prop.visible=false;}
        if(a.exhale){const age=(t+a.phase)%9;a.exhale.visible=age>3&&age<5;a.exhale.position.set(-0.05,1.53+(age-3)*0.18,0.2+(age-3)*0.2);a.exhale.scale.setScalar(0.18+Math.max(0,age-3)*0.14);a.exhale.material.opacity=Math.max(0,0.12-(age-3)*0.06);}
      }
      for(const p of smoke){const shop=shops.find(s=>s.id===p.shop.id),visible=shop.isOpen&&Math.hypot(playerPos.x-shop.x,playerPos.z-shop.z)<65;p.sprite.visible=visible;if(!visible)continue;const age=(t*0.3+p.seed)%1;const local=new THREE.Vector3(p.x+Math.sin(t+p.seed)*age*0.12,p.y+age*1.1,p.z);const world=p.g.localToWorld(local);root.worldToLocal(world);p.sprite.position.copy(world);p.sprite.scale.setScalar(0.12+age*0.6);p.sprite.material.opacity=(1-age)*0.18;}
    },
  };
  return market;
}
