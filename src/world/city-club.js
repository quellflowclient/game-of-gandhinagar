import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as K from './sites/kit.js';
import * as T from './textures.js';
import {CLUB,CLUB_PLAZA,CLUB_APPROACH,clubLocal} from './entertainment-layout.js';

export const CLUB_DANCE={u:0,v:-5,width:10.5,depth:12};

export function buildCityClub(scene){
 const group=new THREE.Group();group.name='City Club · juice lounge';group.position.set(CLUB.origin.x,0,CLUB.origin.z);scene.add(group);
 const batches=new Map(),solids=[],cameraObstacles=[],tables=[],chairs=[];
 const materialCache=new Map();
 const material=(color,options={})=>{const key=color+'|'+JSON.stringify(options,(k,v)=>v?.isTexture?v.uuid:v);if(!materialCache.has(key))materialCache.set(key,new THREE.MeshStandardMaterial({color,roughness:.75,...options}));return materialCache.get(key);};
 const plaster=material(0x707569),ceiling=material(0x2c3431),stone=material(0x4b5751),dark=material(0x202b2a),bronze=material(0x99774d,{metalness:.62,roughness:.38}),steel=material(0x9da6a4,{metalness:.65,roughness:.32}),leather=material(0x38554b,{roughness:.9}),velvet=material(0x8a6750,{roughness:.95}),ceramic=material(0xe4dfcd),rubber=material(0x151e20),leaf=material(0x4f6a4a);
 const glass=material(0xd4e9e6,{transparent:true,opacity:.19,depthWrite:false,roughness:.16,side:THREE.DoubleSide});
 const warm=new THREE.MeshBasicMaterial({color:0xffdfaa}),accent=new THREE.MeshBasicMaterial({color:0x8ea7a0}),violet=new THREE.MeshBasicMaterial({color:0x8478a4});
 const woodTexture=K.canvasTex(256,256,(c,w,h)=>{c.fillStyle='#655044';c.fillRect(0,0,w,h);for(let i=0;i<64;i++){const x=i*4;c.strokeStyle=i%4?'#715b4c':'#4d4038';c.lineWidth=i%4?1:2;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+3,65,x-3,175,x+1,h);c.stroke();}for(let y=0;y<h;y+=64){c.fillStyle='#2c29234a';c.fillRect(0,y,w,1);}});
 const terrazzoTexture=K.canvasTex(256,256,(c,w,h)=>{c.fillStyle='#697168';c.fillRect(0,0,w,h);for(let i=0;i<750;i++){const r=n=>{const v=Math.sin(n*127.1)*43758.5;return v-Math.floor(v);};c.fillStyle=['#8e9381','#515d54','#6a7160','#a2a18c'][i%4];c.fillRect(r(i+1)*w,r(i+805)*h,.7+r(i+36)*2,.6+r(i+42)*2);}});
 const timber=material(0xffffff,{map:woodTexture}),floor=material(0xffffff,{map:terrazzoTexture,roughness:.64});
 const emit=(geo,m,u=0,y=0,v=0,yaw=0)=>{geo.rotateY(yaw);geo.translate(u,y,v);if(!batches.has(m))batches.set(m,[]);batches.get(m).push(geo);};
 const obstacle=(u,v,w,d,h=1.3,y=.18,yaw=0)=>{solids.push({rect:[u,v,w,d,yaw]});const proxy=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),dark);proxy.position.set(u,y+h/2,v);proxy.rotation.y=yaw;proxy.visible=false;group.add(proxy);cameraObstacles.push(proxy);};
 const box=(w,h,d,m,u,y,v,{round=false,yaw=0,solid=false}={})=>{const geo=round?new RoundedBoxGeometry(w,h,d,1,Math.min(.075,w/5,h/5,d/5)):new THREE.BoxGeometry(w,h,d);if(m.map){const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/2,Math.abs(n.getY(i))>.5?p.getZ(i)/2:p.getY(i)/2);}emit(geo,m,u,y+h/2,v,yaw);if(solid)obstacle(u,v,w,d,h,y,yaw);};
 const cyl=(rt,rb,h,m,u,y,v,n=16)=>emit(new THREE.CylinderGeometry(rt,rb,h,n),m,u,y+h/2,v);
 const sphere=(r,m,u,y,v,sx=1,sy=1,sz=1)=>{const geo=new THREE.SphereGeometry(r,10,7);geo.scale(sx,sy,sz);emit(geo,m,u,y,v);};
 const sign=(lines,w,h,u,y,v,yaw=0,options={})=>K.textPlane(group,lines,{bg:'#20332f',fg:'#e6ddc3',w:1024,h:256,font:'600 58px sans-serif',...options},w,h,u,y,v,yaw);
 const rect=b=>[[b.minU,b.minV],[b.maxU,b.minV],[b.maxU,b.maxV],[b.minU,b.maxV]],plaza=rect(CLUB_PLAZA);
 K.slab(group,plaza,.06,stone,.12,4);K.strip(group,CLUB_APPROACH,3.4,.18,floor,{tile:3});
 // Five millimetres above the forecourt surface prevents coplanar floor flicker.
 box(CLUB.width,.125,CLUB.depth,floor,0,.06,0);
 const left=-CLUB.width/2,right=CLUB.width/2,back=-CLUB.depth/2,front=CLUB.depth/2,height=5.1;
 box(.35,height,CLUB.depth,plaster,left,.18,0,{solid:true});box(.35,height,CLUB.depth,plaster,right,.18,0,{solid:true});box(CLUB.width,height,.35,plaster,0,.18,back,{solid:true});
 for(const u of [left+.21,right-.21]){box(.06,1.08,41.5,timber,u,.18,0);box(.07,.025,41.5,bronze,u,1.26,0);}box(37.5,1.08,.06,timber,0,.18,back+.21);
 // Full-height frontage has real glass panels and a six-metre clear entrance.
 for(const side of [-1,1]){const mid=side*11;box(16,.8,.25,timber,mid,.18,front,{solid:true});box(16,.65,.25,plaster,mid,4.63,front);box(15.8,3.65,.035,glass,mid,.98,front);for(const u of [side*3,side*7,side*11,side*15,side*19])box(.09,3.65,.12,bronze,u,.98,front);obstacle(mid,front,16,.25,height);}
 box(6,.65,.25,plaster,0,4.63,front);box(CLUB.width+.6,.25,CLUB.depth+.6,ceiling,0,5.28,0);const roofProxy=new THREE.Mesh(new THREE.BoxGeometry(CLUB.width+.6,.25,CLUB.depth+.6),dark);roofProxy.position.set(0,5.4,0);roofProxy.visible=false;group.add(roofProxy);cameraObstacles.push(roofProxy);
 // Slatted acoustic ceiling, warm coves, visible ducts and suspended pendants.
 for(let u=-16;u<=16;u+=2)box(.055,.16,38,timber,u,5.08,0);
 for(const u of [-17.9,17.9])box(.07,.055,39,warm,u,4.84,0);
 for(const v of [-18,18])box(35,.055,.07,warm,0,4.84,v);
 for(const u of [-11,11]){box(.95,.18,35,steel,u,4.86,-1);for(let v=-14;v<16;v+=6)box(.76,.025,.5,dark,u,4.835,v);}
 function pendant(u,v){cyl(.012,.012,.65,bronze,u,4.25,v,8);cyl(.39,.55,.16,bronze,u,4.09,v,20);cyl(.43,.43,.025,warm,u,4.065,v,20);}
 for(const u of [-5.7,5.7])for(const v of [9.3,15.5])pendant(u,v);
 sign(['CITY CLUB'],8.2,1.25,0,3.5,front+.18,0,{bg:'#33463f',fg:'#e4cfaa',font:'600 88px sans-serif'});
 sign(['JUICE · MUSIC · GOOD COMPANY'],8.2,.48,0,2.46,front+.2,0,{bg:'#33463f',fg:'#d1d9c7',font:'500 39px sans-serif'});
 sign(['EXIT'],1.6,.48,0,3.75,front-.2,Math.PI,{bg:'#285448',fg:'#f1f2d9'});
 // Entrance canopy and landscaped forecourt are separate from the dance room.
 box(10,.18,4,bronze,0,4.75,23);for(const u of [-4.7,4.7])box(.14,4.55,.14,bronze,u,.18,24.5,{solid:true});
 function plant(u,v,scale=1){cyl(.39*scale,.31*scale,.65*scale,ceramic,u,.18,v,18);cyl(.035,.05,1.4*scale,timber,u,.78*scale,v,7);for(let i=0;i<7;i++){const a=i*2.4;const geo=new THREE.SphereGeometry(.36*scale,8,5);geo.scale(1.8,.22,.65);geo.rotateZ((i%2?.6:-.6));emit(geo,leaf,u+Math.cos(a)*.38*scale,1.15*scale+i*.14*scale,v+Math.sin(a)*.38*scale,a);}solids.push({circle:[u,v,.48*scale]});}
 for(const u of [-11,11])plant(u,26,1.5);for(const v of [-24,15])for(const u of [-23,23])plant(u,v,1.65);
 for(const u of [-23,23]){box(1.5,.45,5,timber,u,.18,2,{round:true,solid:true});box(.17,.65,5,leather,u+(u<0?-.65:.65),.55,2,{round:true});}
 // Central dance floor is flush timber, with restrained edge lighting.
 const d=CLUB_DANCE;box(d.width,.012,d.depth,timber,d.u,.18,d.v);for(const u of [-d.width/2,d.width/2])box(.035,.016,d.depth,accent,u,.193,d.v);for(const v of [d.v-d.depth/2,d.v+d.depth/2])box(d.width,.016,.035,violet,0,.193,v);
 // DJ console and paired full-range speakers, all outside the walking aisles.
 box(8,.35,2.8,dark,0,.18,-18,{solid:true});box(4.2,.9,1.15,timber,0,.53,-18);box(4.35,.08,1.3,stone,0,1.43,-18);
 for(const u of [-1.2,1.2]){cyl(.36,.36,.04,rubber,u,1.51,-18,28);cyl(.2,.2,.015,steel,u,1.55,-18,20);}box(.75,.045,.85,dark,0,1.51,-18);for(let i=0;i<6;i++)cyl(.024,.024,.035,bronze,-.25+i*.1,1.555,-18,8);
 for(const u of [-5.8,5.8]){box(1.3,2.5,1.05,dark,u,.18,-18.4,{solid:true});for(const y of [.8,1.8]){const geo=new THREE.CylinderGeometry(.42,.42,.04,24);geo.rotateX(Math.PI/2);emit(geo,rubber,u,y,-17.85);}box(1.1,.025,.05,accent,u,2.25,-17.86);}
 for(let u=-8;u<=8;u+=.4)box(.08,3.6,.14,timber,u,1.0,back+.23);
 sign(['CITY CLUB','GIFT CITY'],6.8,1.65,0,3.4,back+.37,0,{bg:'#343d38',fg:'#c7b88f'});
 function juice(u,v,y,color=0xe3a348){const drink=material(color,{roughness:.4});cyl(.085,.065,.19,glass,u,y,v,16);cyl(.073,.057,.135,drink,u,y+.01,v,16);cyl(.006,.006,.23,ceramic,u+.03,y+.09,v,6);}
 function chair(u,v,yaw=0){const p=(x,z)=>({u:u+x*Math.cos(yaw)+z*Math.sin(yaw),v:v-x*Math.sin(yaw)+z*Math.cos(yaw)});const b=p(0,-.24);box(.58,.14,.6,velvet,u,.58,v,{round:true,yaw});box(.62,.61,.14,leather,b.u,.72,b.v,{round:true,yaw});for(const x of [-.22,.22])for(const z of [-.22,.22]){const at=p(x,z);cyl(.025,.035,.4,bronze,at.u,.18,at.v,7);}solids.push({circle:[u,v,.46]});chairs.push({u,v,r:.46});}
 function table(u,v,r=1.05){cyl(r,r,.07,stone,u,.94,v,32);cyl(.09,.16,.66,bronze,u,.28,v,14);cyl(.47,.54,.09,bronze,u,.18,v,22);solids.push({circle:[u,v,r+.05]});tables.push({u,v,r:r+.05});for(const [du,dv,color]of [[-.38,.35,0xe9ab48],[.38,-.35,0x90b36d]]){juice(u+du,v+dv,1.01,color);box(.24,.006,.21,ceramic,u+du+.17,1.012,v+dv);}cyl(.08,.11,.18,ceramic,u,1.01,v,12);sphere(.13,leaf,u,1.27,v,1.5,.7,1);}
 for(const u of [-5.7,5.7])for(const v of [9.3,15.5]){table(u,v);for(let i=0;i<4;i++){const a=i*Math.PI/2;chair(u+Math.sin(a)*2.05,v+Math.cos(a)*2.05,a+Math.PI);}}
 // Three upholstered lounge booths with coffee tables and an open service aisle.
 for(const v of [-10,0,10]){box(2.3,.45,4.3,leather,-16.5,.18,v,{round:true,solid:true});box(.3,.75,4.45,leather,-17.55,.63,v,{round:true});for(const end of [-2.12,2.12])box(2.3,.45,.22,leather,-16.5,.63,v+end,{round:true});for(const z of [-1.15,1.15])box(1.55,.16,1.75,velvet,-16.2,.63,v+z,{round:true});table(-12.1,v,.83);chair(-9.7,v,Math.PI/2);pendant(-12.1,v);}
 // Juice centre: stone service counter, illuminated bottle shelves, glass-front
 // fridge, fruit bowls, juicers, sinks and four proper bar stools.
 box(2.3,1.06,18,timber,14.6,.18,-3,{solid:true});box(2.5,.1,18.2,stone,14.6,1.24,-3);box(.035,.06,17.8,warm,13.42,1.04,-3);
 box(1.2,.9,17.5,plaster,17.9,.18,-3,{solid:true});box(1.3,.07,17.6,stone,17.9,1.08,-3);
 for(const y of [2,2.8,3.6]){box(.55,.07,13.5,timber,18.55,y,-3);box(.48,.02,13.2,warm,18.49,y-.025,-3);for(let i=0;i<14;i++){const v=-9.1+i*.94;cyl(.085,.085,.24,[ceramic,leather,bronze][i%3],18.48,y+.07,v,10);cyl(.035,.035,.1,bronze,18.48,y+.31,v,8);}}
 const fruits=[material(0xdc963e),material(0x8aa958),material(0xc77759)];
 for(const v of [-7,-3.5,0]){cyl(.4,.27,.13,ceramic,14.6,1.34,v,22);for(let i=0;i<5;i++)sphere(.12,fruits[(i+3)%3],14.6+Math.sin(i*2.4)*.21,1.51+(i===4?.14:0),v+Math.cos(i*2.4)*.21);}
 for(const v of [-9.5,3.2]){box(.46,.17,.5,steel,17.9,1.15,v,{round:true});cyl(.13,.1,.39,glass,17.9,1.32,v,16);cyl(.14,.14,.045,dark,17.9,1.71,v,16);}
 box(.12,2.3,2.5,steel,18.42,.18,8);for(const v of [6.75,9.25])box(1.15,2.3,.08,steel,17.9,.18,v);for(const y of [.18,2.42])box(1.15,.06,2.5,steel,17.9,y,8);obstacle(17.9,8,1.15,2.5,2.3);box(.025,1.94,2.18,glass,17.3,.42,8);for(const v of [7.45,8.55])box(.035,.55,.03,bronze,17.25,1.25,v);for(const y of [.55,1.1,1.65,2.2]){box(.95,.035,2.1,ceramic,17.9,y,8);for(const v of [7.3,7.8,8.3,8.8])cyl(.065,.065,.26,fruits[Math.floor(v*10)%3],17.6,y+.035,v,9);}
 box(.8,.025,1.0,steel,17.9,1.155,-12);cyl(.025,.025,.35,steel,18.1,1.18,-12,8);
 sign(['FRESH JUICE','ORANGE · LIME · WATERMELON'],6.4,1.4,18.73,3.27,-6,-Math.PI/2,{bg:'#284338',fg:'#f0dcb7',font:'600 52px sans-serif'});
 for(const v of [-9,-4,1,6]){cyl(.35,.35,.12,leather,11.7,.94,v,22);cyl(.045,.08,.7,bronze,11.7,.24,v,12);cyl(.27,.34,.06,bronze,11.7,.18,v,16);const foot=new THREE.TorusGeometry(.22,.017,5,16);foot.rotateX(Math.PI/2);emit(foot,bronze,11.7,.54,v);solids.push({circle:[11.7,v,.42]});chairs.push({u:11.7,v,r:.42});}
 // Reception cabinet, lounge art and small finishing details at human scale.
 box(4.3,1.0,1.0,timber,-13,.18,17.8,{round:true,solid:true});box(4.45,.08,1.12,stone,-13,1.18,17.8);sign(['WELCOME'],2.1,.45,-13,1.7,17.2,Math.PI,{bg:'#3d4a3f',fg:'#ddc89f'});
 for(const v of [-6,6]){box(.06,2.3,2.8,bronze,left+.21,1.3,v);const texture=K.canvasTex(512,512,(c,w,h)=>{c.fillStyle='#c2b69b';c.fillRect(0,0,w,h);c.strokeStyle='#5c6e5c';c.lineWidth=36;for(let i=0;i<4;i++){c.beginPath();c.arc(w*.46,h*.75,90+i*52,Math.PI,Math.PI*2);c.stroke();}c.fillStyle='#997b4e';c.beginPath();c.arc(w*.72,h*.26,47,0,Math.PI*2);c.fill();});const painting=new THREE.Mesh(new THREE.PlaneGeometry(2.56,2.08),new THREE.MeshBasicMaterial({map:texture}));painting.position.set(left+.25,2.46,v);painting.rotation.y=Math.PI/2;group.add(painting);}
 for(const [u,v]of [[-17,-18],[8.5,-17],[8.8,17.8]])plant(u,v,.85);
 const light=new THREE.PointLight(0xffca91,72,34,2);light.position.set(-4,3.9,4);group.add(light);
 const danceLight=new THREE.PointLight(0x9d9fda,38,19,2);danceLight.position.set(1.5,4.1,-6);group.add(danceLight);
 const bounds=CLUB_PLAZA,f=K.frame(CLUB.origin),pathContains=(u,v)=>CLUB_APPROACH.some((b,i)=>i&&K.segDist(u,v,CLUB_APPROACH[i-1],b)<1.8),insidePlot=(u,v)=>u>bounds.minU&&u<bounds.maxU&&v>bounds.minV&&v<bounds.maxV;
 const zone=K.createSiteZone({id:'gift-city-club',f,area:plaza,solids,vehicleFree:[plaza],groundY:(u,v)=>Math.abs(u-d.u)<d.width/2&&Math.abs(v-d.v)<d.depth/2?.192:.18});
 const baseContains=zone.contains;zone.contains=(x,z)=>{const p=f.toLocal(x,z);return baseContains(x,z)||pathContains(p.u,p.v);};
 const baseVehicle=zone.forbidsVehicles;zone.forbidsVehicles=(x,z,r)=>{const p=f.toLocal(x,z);return baseVehicle(x,z,r)||pathContains(p.u,p.v);};
 zone.clearing={contains:(x,z)=>{const p=f.toLocal(x,z);return insidePlot(p.u,p.v)||pathContains(p.u,p.v);},replacesBuilding:()=>false};
 for(const [m,geometries]of batches){for(const indexed of [true,false]){const parts=geometries.filter(g=>!!g.index===indexed);if(!parts.length)continue;const geo=mergeGeometries(parts,false),mesh=new THREE.Mesh(geo,m);mesh.name='Club architecture and furnishings';mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}geometries.forEach(g=>g.dispose());}
 return{group,zone,cameraObstacles,tables,chairs,solids,dance:d,
  update(t,position,bpm=120){const p=clubLocal(position.x,position.z),distance=Math.hypot(p.u,p.v);group.visible=distance<600;light.visible=danceLight.visible=distance<55;if(distance>65)return;const beat=.5+.5*Math.sin(t*Math.max(60,Math.min(200,bpm))*Math.PI/30);danceLight.intensity=31+beat*9;}
 };
}
