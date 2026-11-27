import * as THREE from 'three';
import {createAvatar} from '../world/avatar.js';
import {MAHATMA,siteToWorld} from '../world/mahatma-layout.js';
import {districtFrame} from '../world/exploration-areas.js';
import {placePos,placeById} from '../data/places.js';

// The title screen looks into the playable world, with the same geometry,
// materials, animated water and people. It never creates another renderer.
export function createTitleWorld({scene,renderer,follow,world,cityObj,metro,lowEnd,root,pauseButton}){
 const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.3,3200);
 const actors=Array.from({length:lowEnd?2:3},(_,i)=>createAvatar(i===1?'fcasual':'casual',i===1?0xb67d54:0xa86b47));
 actors.forEach(a=>scene.add(a.root));
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduced.matches,selected='dandi',elapsed=0,disposed=false,tx=0,px=0,dirty=true,lastSize='',waveAt=5;
 const currentPosition=new THREE.Vector3(),currentTarget=new THREE.Vector3();let initialized=false;
 const dandi=placePos(placeById('dandi'));
 function vector(origin,[u,y,v],local){const p=local?siteToWorld(origin,u,v):origin.toWorld(u,v);return new THREE.Vector3(p.x,y,p.z);}
 function pose(id){
  if(id==='dandi')return{position:vector(dandi,[18,4,-138],true),target:vector(dandi,[-4,15,0],true),focus:vector(dandi,[0,.2,-100],true)};
  if(id==='ldrp'){const o=placePos(placeById(id));return{position:new THREE.Vector3(o.x+70,18,o.z-110),target:new THREE.Vector3(o.x-15,5,o.z-5),focus:new THREE.Vector3(o.x,0,o.z)};}
  const f=districtFrame(id),poses={gift:[[-520,230,780],[300,55,120]],swagat:[[-72,30,-100],[0,9,3]],swarnim:[[-220,75,-1340],[0,1,-1140]]};
  const [from,to]=poses[id]||poses.gift;return{position:vector(f,from),target:vector(f,to),focus:vector(f,to)};
 }
 function sync(){pauseButton.textContent=paused?'Resume preview':'Pause preview';pauseButton.setAttribute('aria-pressed',String(paused));root.dataset.motion=paused?'paused':'playing';dirty=true;}
 const toggle=()=>{paused=!paused;sync();};pauseButton.addEventListener('click',toggle);sync();
 const preference=()=>{paused=reduced.matches;sync();};reduced.addEventListener('change',preference);
 const pointer=e=>{if(e.pointerType!=='touch'&&!paused)tx=e.clientX/innerWidth*2-1;};const leave=()=>{tx=0;};
 root.addEventListener('pointermove',pointer);root.addEventListener('pointerleave',leave);
 function setPlace(id){if(!placeById(id))return;selected=id;initialized=false;dirty=true;actors.forEach(a=>a.root.visible=id==='dandi');root.dataset.previewArea=id;}
 setPlace(selected);
 return{
  setPlace,
  render(dt){
   if(disposed)return;
   const size=`${innerWidth}:${innerHeight}`;if(size!==lastSize){lastSize=size;camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();if(innerWidth>700)camera.setViewOffset(innerWidth,innerHeight,-innerWidth*.18,0,innerWidth,innerHeight);else camera.clearViewOffset();dirty=true;}
   if(paused&&!dirty)return;
   if(!paused){elapsed+=dt;px+=(tx-px)*Math.min(1,dt*2);}
   const p=pose(selected),sway=paused?0:Math.sin(elapsed*.12);
   p.position.x+=sway*(selected==='gift'?30:2.5)+px*1.6;p.position.z+=Math.cos(elapsed*.1)*(selected==='gift'?20:1.2);
   if(!initialized){currentPosition.copy(p.position);currentTarget.copy(p.target);initialized=true;}
   currentPosition.lerp(p.position,Math.min(1,dt*3));currentTarget.lerp(p.target,Math.min(1,dt*3));
   camera.position.copy(currentPosition);camera.lookAt(currentTarget);follow(p.focus);
   if(!paused){
    world.update(elapsed,p.focus);cityObj.update(elapsed);metro.trains?.update(elapsed,p.focus);
    if(selected==='dandi')actors.forEach((a,i)=>{
     if(i===0){const spawn=world.spawns.dandi;a.root.position.set(spawn.x,world.navigation.surface(spawn.x,spawn.z,0,.38,Infinity)??MAHATMA.ground,spawn.z);a.root.rotation.y=MAHATMA.yaw;}
     else{const angle=Math.PI+Math.sin(elapsed*.05+i)*.25,r=97+(i-1)*3,at=siteToWorld(dandi,Math.sin(angle)*r,Math.cos(angle)*r);a.root.position.set(at.x,world.navigation.surface(at.x,at.z,0,.38,Infinity)??MAHATMA.ground,at.z);a.root.rotation.y=MAHATMA.yaw+angle+(Math.cos(elapsed*.05+i)>0?Math.PI/2:-Math.PI/2);}
     a.update(dt,i===0?0:1);
    });
    if(elapsed>waveAt){actors[0].wave();waveAt=elapsed+15;}
   }
   renderer.render(scene,camera);root.dataset.cameraPosition=`${camera.position.x.toFixed(2)},${camera.position.y.toFixed(2)},${camera.position.z.toFixed(2)}`;dirty=false;
  },
  dispose(){if(disposed)return;disposed=true;pauseButton.removeEventListener('click',toggle);reduced.removeEventListener('change',preference);root.removeEventListener('pointermove',pointer);root.removeEventListener('pointerleave',leave);for(const a of actors){scene.remove(a.root);a.dispose();}camera.clearViewOffset();}
 };
}
