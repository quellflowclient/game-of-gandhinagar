import * as THREE from 'three';
import * as K from './sites/kit.js';
import {ENTERTAINMENT_ORIGIN,PLAZA,CLUB,ARENA,CONCERT_ZONES,entertainmentPoint} from './entertainment-layout.js';

export function buildEntertainment(scene){
 const group=new THREE.Group();group.name='GIFT game entertainment plaza';group.position.set(ENTERTAINMENT_ORIGIN.x,0,ENTERTAINMENT_ORIGIN.z);scene.add(group);
 const f=K.frame(ENTERTAINMENT_ORIGIN),area=[[PLAZA.minU,PLAZA.minV],[PLAZA.maxU,PLAZA.minV],[PLAZA.maxU,PLAZA.maxV],[PLAZA.minU,PLAZA.maxV]],solids=[],cameraObstacles=[];
 const stone=K.mat(0x9fa79c),dark=K.mat(0x132431),metal=K.mat(0x36434a,{metalness:.6,roughness:.4}),trim=K.mat(0xa9bdc1,{metalness:.5,roughness:.35}),glass=K.mat(0x214b5e,{metalness:.28,roughness:.25});
 const led=col=>new THREE.MeshBasicMaterial({color:col});const purple=led(0xa381f2),cyan=led(0x64d4d7),gold=led(0xe9c779);
 const box=(w,h,d,m,u,y,v,solid=false)=>{const mesh=K.box(group,w,h,d,m,u,y,v);if(solid){solids.push({rect:[u,v,w,d]});mesh.userData.cameraSolid=true;cameraObstacles.push(mesh);}return mesh;};
 K.slab(group,area,.06,stone,.12,6);
 // Club: a usable entrance, open dance floor, bar, seating and an enclosed roof.
 const c=CLUB,left=c.u-c.width/2,right=c.u+c.width/2,back=c.v-c.depth/2,front=c.v+c.depth/2;
 box(c.width,8,.5,dark,c.u,.18,back,true);box(.5,8,c.depth,dark,left,.18,c.v,true);box(.5,8,c.depth,dark,right,.18,c.v,true);
 box((c.width-7)/2,8,.5,glass,left+(c.width-7)/4,.18,front,true);box((c.width-7)/2,8,.5,glass,right-(c.width-7)/4,.18,front,true);
 box(7,2,.5,dark,c.u,6.18,front);const roof=box(c.width+.8,.3,c.depth+.8,dark,c.u,8.2,c.v);roof.userData.cameraSolid=true;cameraObstacles.push(roof);
 for(const u of [left+1,right-1])box(.12,.15,c.depth-2,purple,u,7.6,c.v);
 for(const v of [back+1,front-1])box(c.width-2,.15,.12,cyan,c.u,7.6,v);
 box(10,1.2,2.4,metal,c.u,.18,back+6,true);box(10,.12,2.6,trim,c.u,1.38,back+6);
 for(const u of [left+7,right-7])for(const v of [back+12,front-12]){K.cyl(group,1.15,1.15,.12,trim,u,.88,v,24);K.cyl(group,.12,.25,.7,metal,u,.18,v,12);solids.push({circle:[u,v,1.25]});for(const s of [-1,1]){K.cyl(group,.35,.35,.55,dark,u+s*2,.18,v,12);solids.push({circle:[u+s*2,v,.4]});}}
 K.textPlane(group,['CITY CLUB'],{bg:'#111d2c',fg:'#bda3fa',w:1024,h:256,font:'700 72px Inter, sans-serif'},15,3,c.u,4.4,front+.32);
 K.textPlane(group,['GIFT CITY · GAME VENUE'],{bg:'#132431',fg:'#b8ccd3',w:1024,h:128,font:'600 36px Inter, sans-serif'},15,1.1,c.u,2.5,front+.33);
 const tiles=new THREE.InstancedMesh(new THREE.BoxGeometry(2.1,.05,2.1),new THREE.MeshBasicMaterial({color:0xffffff}),36),matrix=new THREE.Matrix4(),color=new THREE.Color();
 for(let i=0;i<36;i++){matrix.makeTranslation(c.u+(i%6-2.5)*2.2,.22,c.v+6+(Math.floor(i/6)-2.5)*2.2);tiles.setMatrixAt(i,matrix);tiles.setColorAt(i,color.setHSL(i*.073,.5,.3));}group.add(tiles);
 const clubLight=new THREE.PointLight(0xcba4ff,75,35,2);clubLight.position.set(c.u,6,c.v+4);group.add(clubLight);
 // Concert stage, connected runway and T-shaped front extension.
 box(44,1.6,12,dark,ARENA.u,.18,-68,true);box(7,1.6,32,dark,ARENA.u,.18,-46,true);box(28,1.6,6,dark,ARENA.u,.18,-28,true);
 box(44,.08,.16,gold,ARENA.u,1.8,-61.9);for(const u of [ARENA.u-3.5,ARENA.u+3.5])box(.12,.08,32,cyan,u,1.8,-46);
 for(const u of [ARENA.u-24,ARENA.u+24]){box(.5,25,.5,metal,u,.18,-75,true);for(const v of [-64,-58]){box(3,4.6,3,dark,u,.18,v,true);for(let y=1;y<4;y+=1.3){const speaker=K.cyl(group,.65,.65,.08,0x080e13,u,y,v+1.53,24);speaker.rotation.x=Math.PI/2;}}}
 box(49,.5,.5,metal,ARENA.u,25,-75);for(let i=0;i<9;i++)box(1.2,.4,.5,i%2?cyan:purple,ARENA.u-21+i*5.25,24.7,-74.8);
 const screenTexture=K.canvasTex(1024,512,(ctx,w,h)=>{ctx.fillStyle='#0b1524';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#e9cb85';ctx.font='700 84px sans-serif';ctx.fillText('GIFT LIVE',w/2,190);ctx.fillStyle='#9bbac3';ctx.font='32px sans-serif';ctx.fillText('NO SHOW SCHEDULED',w/2,280);});
 const screenMaterial=new THREE.MeshBasicMaterial({map:screenTexture,toneMapped:false}),screen=new THREE.Mesh(new THREE.PlaneGeometry(40,20),screenMaterial);screen.position.set(ARENA.u,13,-75.2);group.add(screen);
 const fence=(u,v,w,d)=>{box(w,1.4,d,metal,u,.18,v,true);};
 fence(ARENA.u-ARENA.width/2,ARENA.v,.25,ARENA.depth);fence(ARENA.u+ARENA.width/2,ARENA.v,.25,ARENA.depth);fence(ARENA.u,-84,ARENA.width,.25);fence(ARENA.u,80,ARENA.width,.25);
 for(const z of CONCERT_ZONES){K.slab(group,[[ARENA.u-46,z.front-2],[ARENA.u+46,z.front-2],[ARENA.u+46,z.back+2],[ARENA.u-46,z.back+2]],.19,K.mat(z.color),0,6);K.textPlane(group,[z.name.toUpperCase()],{bg:'#192d3b',fg:'#e8eadb',w:512,h:128,font:'700 56px sans-serif'},7,1.6,ARENA.u-43,2,z.front-1);}
 for(const v of [9.5,32.5]){box(ARENA.width-.3,.8,.18,trim,ARENA.u,.18,v);solids.push({rect:[ARENA.u,v,ARENA.width-.3,.18]});}
 K.textPlane(group,['GIFT LIVE','CONCERT ENTRY'],{bg:'#162b3a',fg:'#e9cd8d',w:768,h:256,font:'700 66px Inter, sans-serif'},12,4,ARENA.u,2.3,82);
 const stageLight=new THREE.PointLight(0x91b9ef,100,85,2);stageLight.position.set(ARENA.u,15,-40);group.add(stageLight);
 const zone=K.createSiteZone({id:'gift-entertainment',f,area,solids,vehicleFree:[area],groundY:(u,v)=>Math.abs(u-CLUB.u)<6.6&&Math.abs(v-(CLUB.v+6))<6.6?.245:Math.abs(u-ARENA.u)<46&&CONCERT_ZONES.some(z=>v>=z.front-2&&v<=z.back+2)?.19:.18});zone.placeId='gift';
 zone.clearing={contains:(x,z)=>{const p=f.toLocal(x,z);return K.pointInPolygon(p.u,p.v,area);},replacesBuilding:()=>false};
 let live=false,bpm=120;
 return{group,zone,cameraObstacles,club:CLUB,arena:ARENA,
  setLive(on,tempo=120){live=!!on;bpm=Math.max(60,Math.min(200,Number(tempo)||120));},
  setScreen(texture){screenMaterial.map=texture||screenTexture;screenMaterial.needsUpdate=true;},
  setLabel(title,artist,status){const ctx=screenTexture.image.getContext('2d'),w=1024,h=512;ctx.fillStyle='#0b1524';ctx.fillRect(0,0,w,h);ctx.textAlign='center';ctx.fillStyle='#e9cb85';ctx.font='700 56px sans-serif';ctx.fillText(String(title||'GIFT LIVE').slice(0,35),w/2,180);ctx.fillStyle='#bdd0d4';ctx.font='34px sans-serif';ctx.fillText(String(artist||'').slice(0,40),w/2,255);ctx.fillStyle='#7fa2b1';ctx.font='28px sans-serif';ctx.fillText(String(status||'NO SHOW SCHEDULED').slice(0,50),w/2,330);screenTexture.needsUpdate=true;},
  update(t,position){const dx=position.x-ENTERTAINMENT_ORIGIN.x,dz=position.z-ENTERTAINMENT_ORIGIN.z,d=Math.hypot(dx,dz);group.visible=d<1100;clubLight.visible=d<140;stageLight.visible=live&&d<220;if(d>220)return;const beat=.5+.5*Math.sin(t*bpm*Math.PI/30);clubLight.intensity=65+beat*20;stageLight.intensity=live?85+beat*30:0;for(let i=0;i<36;i++)tiles.setColorAt(i,color.setHSL((i*.073+t*.025)%1,.58,.24+beat*.12));tiles.instanceColor.needsUpdate=true;}
 };
}
