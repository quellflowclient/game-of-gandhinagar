import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {h} from '../ui/dom.js';
import '../ui/metro-journey.css';

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const JOURNEY_SECONDS=7.8;
export function journeyPose(seconds){
  const progress=Math.max(0,Math.min(1,seconds/JOURNEY_SECONDS));
  const movement=smooth((seconds-1.15)/5.1);
  const doorOpen=seconds<1.15?1-smooth(seconds/1.0):smooth((seconds-6.65)/.85);
  return {progress,distance:movement*240,doorOpen,phase:seconds<1.15?'Doors closing':seconds<2.5?'Departing':seconds<5.6?'Travelling':seconds<6.65?'Arriving':'Doors opening'};
}

// A separate cinematic scene: no invented inter-district track or station is added
// to the real map. All three carriages remain together while the scenery passes.
export function createMetroJourney(renderer,{lowEnd=false,onLock=()=>{},onUnlock=()=>{}}={}){
  let active=false,elapsed=0,started=0,arrive=null,lastFocus=null,view=null,reduced=false;
  const status=h('span',{class:'journey-phase'}),route=h('div',{class:'journey-route'}),bar=h('i',{});
  const skip=h('button',{type:'button',class:'journey-skip',onclick:finish},'Arrive now');
  const overlay=h('section',{class:'metro-journey',hidden:true,role:'dialog','aria-modal':'true','aria-label':'Metro journey'},
    h('div',{class:'journey-heading'},h('span',{class:'journey-mark','aria-hidden':'true'},'M'),h('div',{},h('small',{},'GANDHINAGAR · METRO TRANSFER'),route)),
    h('div',{class:'journey-footer'},h('div',{class:'journey-status',role:'status','aria-live':'polite'},status,h('small',{},'Explore a new neighbourhood')),h('div',{class:'journey-progress',role:'progressbar','aria-label':'Journey progress','aria-valuemin':'0','aria-valuemax':'100'},bar),skip));
  document.body.append(overlay);
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish();}if(e.key==='Tab'){e.preventDefault();skip.focus();}});

  function makeView(){
    const scene=new THREE.Scene();scene.background=new THREE.Color(0xb8ccd9);scene.fog=new THREE.Fog(0xb8ccd9,120,380);
    const camera=new THREE.PerspectiveCamera(45,1,.15,700),doors=[],wheels=[];
    scene.add(new THREE.HemisphereLight(0xe1eefb,0x7c786b,2.3));
    const sunlight=new THREE.DirectionalLight(0xffe5bd,3);sunlight.position.set(-40,80,50);scene.add(sunlight);
    const mat=(color,metalness=0,roughness=.55)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
    const white=mat(0xe8ece9,.38,.32),glass=mat(0x233e52,.6,.18),blue=mat(0x244f92,.2),orange=mat(0xe77d2a),dark=mat(0x202b31),steel=mat(0xacb7bd,.7,.25),warm=mat(0xf1d7a0);
    warm.emissive=new THREE.Color(0xe8b85d);warm.emissiveIntensity=.45;
    const box=(group,w,h,d,m,x,y,z,rounded=false)=>{const mesh=new THREE.Mesh(rounded?new RoundedBoxGeometry(w,h,d,2,.16):new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);group.add(mesh);return mesh;};
    const train=new THREE.Group();scene.add(train);
    for(const cx of [-22.4,0,22.4]){
      box(train,21.5,1.3,2.88,white,cx,1.25,0,true);
      box(train,21.5,.6,2.88,white,cx,3.55,0,true);
      box(train,19,.33,2.2,dark,cx,4.02,0,true);
      box(train,20,.25,2.6,dark,cx,.48,0);
      for(const side of [-1,1]){
        box(train,20.9,.3,.035,blue,cx,1.18,side*1.46);
        box(train,20.9,.08,.04,orange,cx,.96,side*1.47);
        for(const dx of [-8.2,-3.8,3.8,8.2]){
          box(train,2.3,1.3,.04,glass,cx+dx,2.58,side*1.46);
          box(train,.14,1.4,.12,white,cx+dx+1.22,2.58,side*1.45);
          box(train,2.2,.055,.08,warm,cx+dx,3.25,side*1.5);
        }
        for(const dx of [-6,0,6])for(const half of [-1,1]){
          const panel=new THREE.Group();panel.position.set(cx+dx+half*.37,2.05,side*1.5);train.add(panel);
          box(panel,.72,2.25,.08,steel,0,0,0);
          box(panel,.48,.83,.09,glass,0,.48,side*.05);
          box(panel,.035,.25,.05,dark,-half*.21,-.2,side*.06);
          doors.push({panel,base:panel.position.x,half});
        }
      }
      for(const dx of [-7.1,7.1]){
        box(train,2.6,.5,1.9,dark,cx+dx,.52,0);
        for(const xx of [-.85,.85])for(const z of [-1.06,1.06]){
          const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.4,.4,.16,lowEnd?10:18),dark);wheel.rotation.x=Math.PI/2;wheel.position.set(cx+dx+xx,.42,z);train.add(wheel);wheels.push(wheel);
        }
      }
    }
    for(const cx of [-11.2,11.2])box(train,.85,1.9,2.1,dark,cx,2,0);
    for(const side of [-1,1]){
      box(train,.08,1.2,2.35,glass,side*33.2,2.6,0);
      for(const z of [-.9,.9])box(train,.09,.16,.38,warm,side*33.24,1.15,z);
    }
    const scenery=new THREE.Group();scene.add(scenery);
    box(scene,1600,.5,600,mat(0x909b86),0,-5.5,-100);
    box(scene,1400,.8,8.8,mat(0xb7b4aa),0,-.5,0);
    for(const z of [-1.99,-.56,.56,1.99])box(scene,1400,.12,.08,steel,0,.04,z);
    for(let i=-8;i<=20;i++){
      const x=i*25;
      box(scenery,.8,4.4,.8,mat(0xaaa99e),x,-3,0);
      box(scenery,8,.6,2,mat(0xc1beb3),x,-.9,0);
      const height=8+(i*13+123)%43,z=-65-(i*17+250)%60;
      const facade=mat([0x708e9f,0x98a8ad,0x577c8c,0xc1b9a6][((i%4)+4)%4],.28);
      box(scenery,13,height,15,facade,x,height/2-5,z);
      for(let floor=1;floor<height/3;floor++)box(scenery,13.2,.3,15.2,steel,x,floor*3-5,z);
      if(i%2===0){box(scenery,.4,8,.4,mat(0x726443),x+10,-1,-27);const crown=new THREE.Mesh(new THREE.IcosahedronGeometry(3.4,1),mat(0x4b7757));crown.position.set(x+10,4,-27);scenery.add(crown);}
    }
    const platforms=[];
    for(const at of [0,240]){
      const station=new THREE.Group();station.position.x=at;scenery.add(station);platforms.push(station);
      box(station,90,.8,7,mat(0xbbb8ac),0,.25,-6.5);
      box(station,88,.03,.35,mat(0xe5c65e),0,.67,-3.2);
      box(station,94,.35,8,white,0,7,-6.5);
      for(let x=-36;x<=36;x+=12){box(station,.23,6.3,.23,steel,x,3.8,-8.9);box(station,8,.07,.15,warm,x,6.7,-5.5);}
    }
    return {scene,camera,scenery,doors,wheels,platforms,sunlight,resize(){const size=renderer.getSize(new THREE.Vector2());camera.aspect=size.x/size.y;camera.updateProjectionMatrix();}};
  }
  function finish(){
    if(!active)return;
    try{arrive?.();}finally{active=false;arrive=null;overlay.hidden=true;document.body.classList.remove('metro-in-transit');onUnlock();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  }
  return {
    get active(){return active;},
    start({from,to,onArrive,night=false}){
      if(active)return false;
      view??=makeView();view.resize();reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      elapsed=0;started=performance.now();arrive=onArrive;lastFocus=document.activeElement;active=true;
      route.replaceChildren(h('span',{},from||'Gandhinagar'),h('span',{'aria-hidden':'true'},'→'),h('b',{},to));
      status.textContent='Doors closing';bar.style.transform='scaleX(0)';overlay.hidden=false;
      view.scene.background.set(night?0x14283a:0xb8ccd9);view.scene.fog.color.copy(view.scene.background);view.sunlight.intensity=night?.8:3;
      document.body.classList.add('metro-in-transit');onLock();skip.focus({preventScroll:true});return true;
    },
    update(dt){
      if(!active)return false;
      elapsed=Math.max(0,(performance.now()-started)/1000)*(reduced?16:1);
      const p=journeyPose(elapsed),v=view;
      v.scenery.position.x=-p.distance;
      for(const {panel,base,half} of v.doors)panel.position.x=base+half*p.doorOpen*.65;
      for(const wheel of v.wheels)wheel.rotation.z=-p.distance/.4;
      const orbit=reduced?0:Math.sin(p.progress*Math.PI);
      v.resize();const framing=Math.max(1,1.45/v.camera.aspect);
      v.camera.position.set(12+orbit*7,10+orbit*1.5,(65-orbit*3)*framing);v.camera.lookAt(0,2.2,0);
      if(status.textContent!==p.phase)status.textContent=p.phase;
      bar.style.transform=`scaleX(${p.progress})`;bar.parentElement.setAttribute('aria-valuenow',String(Math.round(p.progress*100)));
      renderer.render(v.scene,v.camera);
      if(elapsed>=JOURNEY_SECONDS)finish();
      return true;
    },
    finish,
  };
}
