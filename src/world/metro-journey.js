import * as THREE from 'three';
import {buildJourneyScene} from './metro-journey-scene.js';
import {h} from '../ui/dom.js';
import '../ui/metro-journey.css';

const smooth=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};
export const JOURNEY_SECONDS=13.8;
export const JOURNEY_DISTANCE=420;
export function journeyPose(seconds){
  const progress=Math.max(0,Math.min(1,seconds/JOURNEY_SECONDS));
  const movement=smooth((seconds-1.5)/10.5);
  const doorOpen=seconds<1.5?1-smooth(seconds/1.4):smooth((seconds-12)/1.5);
  return {progress,distance:movement*JOURNEY_DISTANCE,doorOpen,phase:seconds<1.5?'Doors closing':seconds<3.5?'Departing':seconds<10?'Travelling':seconds<12?'Arriving':'Doors opening'};
}

// A separate cinematic scene: no invented inter-district track or station is added
// to the real map. All three carriages remain together while the scenery passes.
export function createMetroJourney(renderer,{lowEnd=false,onLock=()=>{},onUnlock=()=>{}}={}){
  let active=false,elapsed=0,started=0,arrive=null,lastFocus=null,view=null,reduced=false,mode='inside';
  const status=h('span',{class:'journey-phase'}),route=h('div',{class:'journey-route'}),bar=h('i',{});
  const skip=h('button',{type:'button',class:'journey-skip',onclick:finish},'Arrive now');
  const inside=h('button',{type:'button',class:'journey-view-button','aria-pressed':'true',onclick:()=>setMode('inside')},'Inside coach');
  const outside=h('button',{type:'button',class:'journey-view-button','aria-pressed':'false',onclick:()=>setMode('outside')},'Outside view');
  const overlay=h('section',{class:'metro-journey',hidden:true,role:'dialog','aria-modal':'true','aria-label':'Metro journey'},
    h('div',{class:'journey-heading'},h('span',{class:'journey-mark','aria-hidden':'true'},'M'),h('div',{},h('small',{},'GANDHINAGAR · METRO TRANSFER'),route)),
    h('div',{class:'journey-view-controls',role:'group','aria-label':'Metro camera'},inside,outside),
    h('div',{class:'journey-footer'},h('div',{class:'journey-status',role:'status','aria-live':'polite'},status,h('small',{},'A window seat to your next neighbourhood')),h('div',{class:'journey-progress',role:'progressbar','aria-label':'Journey progress','aria-valuemin':'0','aria-valuemax':'100'},bar),skip));
  document.body.append(overlay);
  overlay.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();finish();}if(e.key==='Tab'){const buttons=[inside,outside,skip],index=buttons.indexOf(document.activeElement);e.preventDefault();buttons[(index+(e.shiftKey?-1:1)+buttons.length)%buttons.length].focus();}});

  function setMode(next){mode=next;inside.setAttribute('aria-pressed',String(mode==='inside'));outside.setAttribute('aria-pressed',String(mode==='outside'));overlay.dataset.view=mode;}
  function resize(){const size=renderer.getSize(new THREE.Vector2());view.camera.aspect=size.x/size.y;}
  function makeView(){return buildJourneyScene({lowEnd});}
  function finish(){
    if(!active)return;
    try{arrive?.();}finally{active=false;arrive=null;overlay.hidden=true;document.body.classList.remove('metro-in-transit');onUnlock();if(lastFocus?.isConnected)lastFocus.focus({preventScroll:true});}
  }
  return {
    get active(){return active;},
    start({from,to,onArrive,night=false}){
      if(active)return false;
      view??=makeView();resize();setMode('inside');view.setRoute(to);reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
      elapsed=0;started=performance.now();arrive=onArrive;lastFocus=document.activeElement;active=true;
      route.replaceChildren(h('span',{},from||'Gandhinagar'),h('span',{'aria-hidden':'true'},'→'),h('b',{},to));
      status.textContent='Doors closing';bar.style.transform='scaleX(0)';overlay.hidden=false;
      view.setNight(night);
      document.body.classList.add('metro-in-transit');onLock();skip.focus({preventScroll:true});return true;
    },
    update(dt){
      if(!active)return false;
      elapsed=Math.max(0,(performance.now()-started)/1000)*(reduced?16:1);
      const p=journeyPose(elapsed),v=view;
      v.scenery.position.x=-p.distance;
      for(const {panel,base,half} of v.doors)panel.position.x=base+half*p.doorOpen*.65;
      for(const wheel of v.wheels)wheel.rotation.z=-p.distance/.4;
      resize();v.pose(mode,p.progress,reduced);
      overlay.dataset.progress=p.progress.toFixed(3);
      if(status.textContent!==p.phase)status.textContent=p.phase;
      bar.style.transform=`scaleX(${p.progress})`;bar.parentElement.setAttribute('aria-valuenow',String(Math.round(p.progress*100)));
      renderer.render(v.scene,v.camera);
      if(elapsed>=JOURNEY_SECONDS)finish();
      return true;
    },
    finish,
  };
}
