import * as THREE from 'three';
import * as K from './sites/kit.js';
import {buildCityClub} from './city-club.js';
import {ENTERTAINMENT_ORIGIN,PLAZA,CLUB,ARENA,CONCERT_ZONES,entertainmentPoint} from './entertainment-layout.js';

export function buildEntertainment(scene){
 const group=new THREE.Group();group.name='GIFT game entertainment plaza';group.position.set(ENTERTAINMENT_ORIGIN.x,0,ENTERTAINMENT_ORIGIN.z);scene.add(group);
 const f=K.frame(ENTERTAINMENT_ORIGIN),area=[[PLAZA.minU,PLAZA.minV],[PLAZA.maxU,PLAZA.minV],[PLAZA.maxU,PLAZA.maxV],[PLAZA.minU,PLAZA.maxV]],solids=[],cameraObstacles=[];
 const stone=K.mat(0x9fa79c),dark=K.mat(0x132431),metal=K.mat(0x36434a,{metalness:.6,roughness:.4}),trim=K.mat(0xa9bdc1,{metalness:.5,roughness:.35}),glass=K.mat(0x214b5e,{metalness:.28,roughness:.25});
 const led=col=>new THREE.MeshBasicMaterial({color:col});const purple=led(0xa381f2),cyan=led(0x64d4d7),gold=led(0xe9c779);
 const box=(w,h,d,m,u,y,v,solid=false)=>{const mesh=K.box(group,w,h,d,m,u,y,v);if(solid){solids.push({rect:[u,v,w,d]});mesh.userData.cameraSolid=true;cameraObstacles.push(mesh);}return mesh;};
 K.slab(group,area,.06,stone,.12,6);
 const club=buildCityClub(scene);
 // Concert stage, connected runway and T-shaped front extension.
 box(44,1.6,12,dark,ARENA.u,.18,-68,true);box(7,1.6,32,dark,ARENA.u,.18,-46,true);box(28,1.6,6,dark,ARENA.u,.18,-28,true);
 box(44,.08,.16,gold,ARENA.u,1.8,-61.9);for(const u of [ARENA.u-3.5,ARENA.u+3.5])box(.12,.08,32,cyan,u,1.8,-46);
 for(const u of [ARENA.u-24,ARENA.u+24]){box(.5,25,.5,metal,u,.18,-75,true);for(const v of [-64,-58]){box(3,4.6,3,dark,u,.18,v,true);for(let y=1;y<4;y+=1.3){const speaker=K.cyl(group,.65,.65,.08,0x080e13,u,y,v+1.53,24);speaker.rotation.x=Math.PI/2;}}}
 box(49,.5,.5,metal,ARENA.u,25,-75);for(let i=0;i<9;i++)box(1.2,.4,.5,i%2?cyan:purple,ARENA.u-21+i*5.25,24.7,-74.8);
 // A framed stage with a real backstage volume, canopy, braced trusses and
 // vertical side lighting. The runway and audience coordinates stay fixed.
 box(52,22,.3,dark,ARENA.u,1.8,-79.5,true);box(54,.3,29,dark,ARENA.u,25.4,-68);
 box(42.5,22,.2,metal,ARENA.u,2,-75.45);box(41,20.6,.1,dark,ARENA.u,2.7,-75.3);
 const beam=(a,b)=>{const av=new THREE.Vector3(...a),bv=new THREE.Vector3(...b),dir=bv.clone().sub(av),geo=new THREE.CylinderGeometry(.07,.07,dir.length(),6);geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),dir.normalize()));const mesh=new THREE.Mesh(geo,trim);mesh.position.copy(av.add(bv).multiplyScalar(.5));group.add(mesh);};
 for(const side of [-1,1]){const u=ARENA.u+side*24;for(let y=1;y<24;y+=3){beam([u-.45,y,-75],[u+.45,y+3,-75]);beam([u+.45,y,-75],[u-.45,y+3,-75]);}for(const v of [-74,-69,-64,-59])box(.45,.14,2.3,gold,u-side*1.2,3,v);box(1.5,14,.12,purple,u-side*1.4,4,-75.1);}
 const screenTexture=K.canvasTex(1024,512,(ctx,w,h)=>{ctx.fillStyle='#0b1524';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#e9cb85';ctx.font='700 84px sans-serif';ctx.fillText('GIFT LIVE',w/2,190);ctx.fillStyle='#9bbac3';ctx.font='32px sans-serif';ctx.fillText('NO SHOW SCHEDULED',w/2,280);});
 const screenMaterial=new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}),screen=new THREE.Mesh(new THREE.PlaneGeometry(40,20),screenMaterial);screen.position.set(ARENA.u,13,-75.2);group.add(screen);
 const fence=(u,v,w,d)=>{box(w,1.4,d,metal,u,.18,v,true);};
 fence(ARENA.u-ARENA.width/2,ARENA.v,.25,ARENA.depth);fence(ARENA.u+ARENA.width/2,ARENA.v,.25,ARENA.depth);fence(ARENA.u,-84,ARENA.width,.25);fence(ARENA.u,80,ARENA.width,.25);
 for(const z of CONCERT_ZONES){K.slab(group,[[ARENA.u-46,z.front-2],[ARENA.u+46,z.front-2],[ARENA.u+46,z.back+2],[ARENA.u-46,z.back+2]],.19,K.mat(0x616c6c),0,6);const edge=led(z.color);for(const v of [z.front-1.9,z.back+1.9])box(92,.018,.12,edge,ARENA.u,.196,v);for(const u of [ARENA.u-45.9,ARENA.u+45.9])box(.12,.018,z.back-z.front+4,edge,u,.196,(z.front+z.back)/2);K.textPlane(group,[z.name.toUpperCase()],{bg:'#192d3b',fg:'#e8eadb',w:512,h:128,font:'700 56px sans-serif'},7,1.6,ARENA.u-43,2,z.front-1);}
 for(const v of [9.5,32.5]){box(ARENA.width-.3,.8,.18,trim,ARENA.u,.18,v);solids.push({rect:[ARENA.u,v,ARENA.width-.3,.18]});}
 for(const u of [ARENA.u-45,ARENA.u+45])box(.45,6,.45,metal,u,.18,84,true);box(90,.5,.5,metal,ARENA.u,6.1,84);
 K.textPlane(group,['GIFT LIVE'],{bg:'#162b3a',fg:'#e9cd8d',w:1024,h:256,font:'700 82px sans-serif'},18,2.5,ARENA.u,7.35,84.2);
 for(const [i,z]of CONCERT_ZONES.entries()){const u=ARENA.u+(i-1)*28;K.textPlane(group,[z.name.toUpperCase(),'ZONE ENTRY'],{bg:'#203641',fg:'#dedac7',w:512,h:256,font:'600 50px sans-serif'},8,2,u,4.3,84.3);for(const side of [-1,1]){box(.08,.9,8,metal,u+side*5,.18,87);for(const v of [83,87,91])box(.12,1,.12,trim,u+side*5,.18,v);}box(4.5,1.2,1.6,dark,u,.18,82.5,true);box(4.7,.08,1.8,trim,u,1.38,82.5);}
 const stageLight=new THREE.PointLight(0x91b9ef,100,85,2);stageLight.position.set(ARENA.u,15,-40);group.add(stageLight);
 const arenaZone=K.createSiteZone({id:'gift-entertainment',f,area,solids,vehicleFree:[area],groundY:(u,v)=>Math.abs(u-ARENA.u)<46&&CONCERT_ZONES.some(z=>v>=z.front-2&&v<=z.back+2)?.19:.18});arenaZone.placeId='gift';
 arenaZone.clearing={contains:(x,z)=>{const p=f.toLocal(x,z);return K.pointInPolygon(p.u,p.v,area);},replacesBuilding:()=>false};
 const subzones=[arenaZone,club.zone],zone={id:'gift-entertainment',placeId:'gift',subzones,contains:(x,z)=>subzones.some(zon=>zon.contains(x,z)),heights(x,z,r){return subzones.find(zon=>zon.contains(x,z))?.heights(x,z,r)||[];},forbidsVehicles:(x,z,r)=>subzones.some(zon=>zon.forbidsVehicles(x,z,r))};
 zone.clearing={contains:(x,z)=>subzones.some(zon=>zon.clearing.contains(x,z)),replacesBuilding:()=>false};
 cameraObstacles.push(...club.cameraObstacles);let live=false,bpm=120,clubBpm=120;
 return{group,clubGroup:club.group,clubInterior:club,zone,cameraObstacles,club:CLUB,arena:ARENA,
  setLive(on,tempo=120,clubTempo=120){live=!!on;bpm=Math.max(60,Math.min(200,Number(tempo)||120));clubBpm=clubTempo;},
  setScreen(texture){screenMaterial.map=texture||screenTexture;screenMaterial.needsUpdate=true;},
  setLabel(title,artist,status){const ctx=screenTexture.image.getContext('2d'),w=1024,h=512;ctx.fillStyle='#0b1524';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#e9cb85';ctx.font='700 56px sans-serif';ctx.fillText(String(title||'GIFT LIVE').slice(0,35),w/2,180);ctx.fillStyle='#bdd0d4';ctx.font='34px sans-serif';ctx.fillText(String(artist||'').slice(0,40),w/2,255);ctx.fillStyle='#7fa2b1';ctx.font='28px sans-serif';ctx.fillText(String(status||'NO SHOW SCHEDULED').slice(0,50),w/2,330);screenTexture.needsUpdate=true;},
  update(t,position){club.update(t,position,clubBpm);const d=Math.hypot(position.x-ENTERTAINMENT_ORIGIN.x,position.z-ENTERTAINMENT_ORIGIN.z);group.visible=d<1100;stageLight.visible=live&&d<220;if(d>220)return;const beat=.5+.5*Math.sin(t*bpm*Math.PI/30);stageLight.intensity=live?85+beat*30:0;}
 };
}
