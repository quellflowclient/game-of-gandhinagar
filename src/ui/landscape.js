import {h} from './dom.js';
import './landscape.css';

// Physical screen orientation is used so a landscape software keyboard cannot
// accidentally trigger the portrait gate. Shared by the game and /admin.
function installLandscape(){
  let required=false,attempted=false,busy=false,restoreFocus=null;
  const inertBefore=new Map();
  const status=h('p',{class:'landscape-status',role:'status','aria-live':'polite'},'Auto-rotate on rakho, phir phone sideways ghumao.');
  const enable=h('button',{type:'button',class:'landscape-enable',onclick:()=>requestLandscape(true)},'Start in landscape →');
  const gate=h('section',{id:'landscape-gate',class:'landscape-gate',hidden:true,role:'dialog','aria-modal':'true','aria-labelledby':'landscape-title'},
    h('div',{class:'landscape-card'},h('div',{class:'landscape-phone','aria-hidden':'true'},h('span',{},'↻')),h('span',{class:'landscape-eyebrow'},'GOG / LANDSCAPE EXPERIENCE'),h('h1',{id:'landscape-title'},'Rotate. Play. Explore.'),h('p',{},'Game, login aur saare pages landscape mein hi chalenge. Phone ko sideways rakho to continue.'),enable,status));
  document.body.append(gate);
  function isPortrait(){
    const touch=matchMedia('(any-pointer: coarse)').matches||navigator.maxTouchPoints>0;
    if(!touch)return false;
    const angle=typeof window.orientation==='number'?Math.abs(window.orientation):null;
    if(angle!==null)return angle!==90;
    if(screen.orientation?.type)return screen.orientation.type.startsWith('portrait');
    return innerHeight>innerWidth;
  }
  function blockBackground(){
    for(const node of document.body.children){if(node===gate||!(node instanceof HTMLElement))continue;if(!inertBefore.has(node))inertBefore.set(node,node.inert);node.inert=true;}
  }
  function refresh(){
    const next=isPortrait();
    gate.hidden=!next;
    if(next!==required){
      required=next;document.body.classList.toggle('landscape-required',required);
      // Keep the legacy class for the game's input-lock observer and HUD styles.
      document.body.classList.toggle('game-rotation-required',required);
      if(required){restoreFocus=document.activeElement;blockBackground();enable.focus({preventScroll:true});}
      else{for(const [node,value]of inertBefore)if(node.isConnected)node.inert=value;inertBefore.clear();if(restoreFocus?.isConnected&&!restoreFocus.closest('#landscape-gate'))restoreFocus.focus({preventScroll:true});restoreFocus=null;}
    }
    if(required)blockBackground();
  }
  async function requestLandscape(showStatus){
    if(busy)return;busy=true;enable.disabled=true;
    try{
      // A browser may require fullscreen before granting orientation lock.
      if(!document.fullscreenElement&&document.documentElement.requestFullscreen){try{await document.documentElement.requestFullscreen();}catch{}}
      try{await screen.orientation?.lock?.('landscape');}catch{}
      refresh();
      if(showStatus&&required)status.textContent='Is browser mein automatic rotation available nahi hai. Auto-rotate on karke phone sideways ghumao.';
    }finally{busy=false;enable.disabled=false;}
  }
  for(const name of ['resize','orientationchange','pageshow','fullscreenchange'])window.addEventListener(name,refresh);
  screen.orientation?.addEventListener?.('change',refresh);
  new MutationObserver(()=>{if(required)blockBackground();}).observe(document.body,{childList:true});
  document.addEventListener('keydown',e=>{if(!required)return;if(e.key==='Tab'){e.preventDefault();enable.focus();}} ,true);
  document.addEventListener('click',e=>{
    if(attempted||required||!e.target.closest?.('.cta,.cta-ghost,.land-signin,.dest-card'))return;
    attempted=true;void requestLandscape(false);
  },true);
  refresh();
  return{get required(){return required;},request:requestLandscape,async toggleFullscreen(){
    if(document.fullscreenElement){try{await document.exitFullscreen();}catch{}}
    else await requestLandscape(true);
    refresh();
  }};
}
export const landscape=installLandscape();
