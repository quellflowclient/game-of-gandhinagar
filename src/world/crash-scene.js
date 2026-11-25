import * as THREE from 'three';
import {createAvatar} from './avatar.js';
import {createAmbulance} from './ambulance.js';
import {createDrivingSurface} from './driving.js';

// Quick, skippable incident; response is entirely a game animation.
export function createCrashScene({scene,camera,traffic,player,navigation,roads=[],look=()=>({}),say=()=>{},onRecover=()=>{}}){
 let incident=null,cooldownUntil=0;const target=new THREE.Vector3();
 const road=createDrivingSurface(roads.filter(r=>!r.campus),navigation.zones);
 const skip=document.createElement('button');skip.className='accident-skip';skip.textContent='Skip · Continue';skip.hidden=true;skip.onclick=()=>finish();document.body.append(skip);
 const caption=document.createElement('div');caption.className='accident-caption';caption.hidden=true;document.body.append(caption);
 function safe(p){try{return navigation.safePoint(p.x,p.z,p.y||0,.38,3);}catch{return p;}}
 function actor(p,index,medic=false){const avatar=createAvatar(medic?'worker':index%2?'fcasual':'casual',0xa86b47);if(medic)avatar.setClothes(0xdceae4,0x354b5b);const q=safe(p);avatar.root.position.set(q.x,q.y,q.z);scene.add(avatar.root);const a={avatar,from:avatar.root.position.clone(),to:null,index,medic};incident.actors.push(a);return a;}
 function finish(){if(!incident)return;const c=incident;incident=null;
  for(const a of c.actors){scene.remove(a.avatar.root);a.avatar.dispose();}
  if(c.ambulance){scene.remove(c.ambulance.root);c.ambulance.dispose();}
  for(const v of c.vehicles)if(v.trafficId!=null)traffic.recover(v.trafficId);
  document.body.classList.remove("accident-active");skip.hidden=caption.hidden=true;cooldownUntil=performance.now()+15000;
  if(c.hit.player)onRecover(c.hit);
 }
 function response(c){
  const yaw=c.vehicles[0]?.yaw||0,base=road.nearest(c.hit.x,c.hit.z,yaw,'car',75);if(!base)return;
  const forward=new THREE.Vector3(Math.sin(base.yaw),0,Math.cos(base.yaw));let end=null;
  for(const d of [7,10,13,17,21,26]){const p=road.pose(base.x-forward.x*d,base.z-forward.z*d,base.yaw,'car');if(p&&!traffic.vehicles.some(v=>v.pose&&Math.hypot(v.pose.x-p.x,v.pose.z-p.z)<6)){end=p;break;}}
  if(!end)return;
  const path=[new THREE.Vector3(end.x,end.y,end.z)];
  for(let d=1;d<=18;d++){const p=road.pose(end.x-forward.x*d,end.z-forward.z*d,end.yaw,'car');if(!p)break;path.unshift(new THREE.Vector3(p.x,p.y,p.z));}
  c.ambulance=createAmbulance();c.ambulance.root.rotation.y=end.yaw;scene.add(c.ambulance.root);c.responsePath=path;
  const med=actor({x:end.x+Math.cos(end.yaw)*1.7,y:end.y,z:end.z-Math.sin(end.yaw)*1.7},0,true);med.to=new THREE.Vector3(c.hit.x+Math.cos(end.yaw)*2,c.hit.y-.5,c.hit.z-Math.sin(end.yaw)*2);const q=safe(med.to);med.to.set(q.x,q.y,q.z);med.avatar.root.visible=false;
 }
 return{get active(){return !!incident;},get obstacle(){const p=incident?.ambulance?.root.position;return p?{x:p.x,z:p.z,r:3}:null;},get timeScale(){return incident&&incident.t<.65?.45:1;},
  start(hit){
   if(incident){if(!hit.player)return;finish();}
   if(!hit.player&&(performance.now()<cooldownUntil||Math.hypot(player.position.x-hit.x,player.position.z-hit.z)>20))return;
   const vehicles=[hit.a,hit.b].filter(v=>v.motor&&!v.twoWheeler&&!v.passive);
   const medical=!!hit.player&&(hit.speed>=8||[hit.a,hit.b].some(v=>v.player&&(!v.motor||v.twoWheeler)));
   incident={t:0,hit,vehicles,medical,actors:[],original:camera.position.clone(),duration:medical?7:4.2};const c=incident;
   for(const v of vehicles)if(v.trafficId!=null){traffic.hold(v.trafficId,c.duration+1);traffic.damage(v.trafficId,Math.min(1,hit.speed/12));}
   if(hit.player&&vehicles.some(v=>v.player))player.leaveWreck(true);
   if(medical)response(c);
   else if(vehicles.length===2){for(const [i,v]of vehicles.entries()){const a=actor({x:v.x+Math.cos(v.yaw)*2,y:v.y,z:v.z-Math.sin(v.yaw)*2},i);a.to=a.from.clone();}say('Bhai, dhyaan se. Theek hai, chalo.');}
   skip.textContent=medical?'Skip 108 scene · Continue':'Skip · Continue';skip.hidden=false;caption.hidden=false;document.body.classList.add("accident-active");
  },
  update(dt){if(!incident)return;const c=incident;c.t+=dt;
   caption.textContent=c.medical?(c.t<2.6?'108 ambulance aa rahi hai…':c.t<5?'108 team madad kar rahi hai.':'All clear · Safe jagah se continue karo.'):'Chhoti takkar · Sab theek hai, aaraam se chalo.';
   if(c.ambulance){const n=c.responsePath.length-1,p=THREE.MathUtils.clamp(c.t/2.6,0,1)*n,i=Math.floor(p);c.ambulance.root.position.lerpVectors(c.responsePath[i],c.responsePath[Math.min(n,i+1)],p-i);c.ambulance.update(c.t);}
   for(const a of c.actors){a.avatar.root.visible=!a.medic||c.t>2.5;if(!a.avatar.root.visible)continue;
    if(a.to)a.avatar.root.position.lerpVectors(a.from,a.to,a.medic?THREE.MathUtils.clamp((c.t-2.5)/1.4,0,1):0);
    a.avatar.root.rotation.y=Math.atan2(c.hit.x-a.avatar.root.position.x,c.hit.z-a.avatar.root.position.z);
    a.avatar.setActivity(a.medic?'calm':c.t<2.3?'argue':'calm');a.avatar.update(dt,a.medic&&c.t<3.9?1:0);
   }
   if(c.t>=c.duration)finish();
  },
  camera(){if(!incident)return;const c=incident;target.set(c.hit.x,c.hit.y+.65,c.hit.z);if(c.medical&&c.ambulance&&c.t<2.5)target.lerp(c.ambulance.root.position,.5);const angle=Math.atan2(c.original.x-c.hit.x,c.original.z-c.hit.z);const desired=new THREE.Vector3(c.hit.x+Math.sin(angle)*12,c.hit.y+4.5,c.hit.z+Math.cos(angle)*12);camera.position.lerp(desired,.8);camera.lookAt(target);camera.updateMatrixWorld(true);},
  finish,
 };
}
