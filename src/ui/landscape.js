import {h} from './dom.js';
import './landscape.css';

// Physical screen orientation is used so a landscape software keyboard cannot
// accidentally trigger the portrait gate. Shared by the game and /admin.
function installLandscape(){
  let required=false,attempted=false,busy=false,restoreFocus=null,wasPageMode=false;
  const inertBefore=new Map();
  const status=h('p',{class:'landscape-status',role:'status','aria-live':'polite'},'Auto-rotate on rakho, phir phone sideways ghumao.');
  const enable=h('button',{type:'button',class:'landscape-enable',onclick:()=>requestLandscape(true)},'Start in landscape →');
  const gate=h('section',{id:'landscape-gate',class:'landscape-gate',hidden:true,role:'dialog','aria-modal':'true','aria-labelledby':'landscape-title'},
    h('div',{class:'landscape-card'},h('div',{class:'landscape-phone','aria-hidden':'true'},h('span',{},'↻')),h('span',{class:'landscape-eyebrow'},'GOG / LANDSCAPE EXPERIENCE'),h('h1',{id:'landscape-title'},'Rotate. Play. Explore.'),h('p',{},'Game khelne ke liye phone sideways rakho. Login, profile aur menu portrait mein bhi use kar sakte ho.'),enable,h('button',{type:'button',class:'landscape-menu',onclick:()=>{document.body.classList.add('game-menu-open');refresh();document.dispatchEvent(new Event('game-open-hub'));}},'Open menu / account'),status));
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
    const pageMode=location.pathname.startsWith('/admin')||!document.body.classList.contains('game-started')||['game-panel-open','game-menu-open','voice-ui-open'].some(c=>document.body.classList.contains(c));
    const portraitPages=isPortrait()&&pageMode;if(document.body.classList.contains('portrait-page-mode')!==portraitPages)document.body.classList.toggle('portrait-page-mode',portraitPages);
    if(pageMode&&!wasPageMode)try{screen.orientation?.unlock?.();}catch{}
    wasPageMode=pageMode;
    const next=isPortrait()&&!pageMode;
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
  new MutationObserver(refresh).observe(document.body,{childList:true,attributes:true,attributeFilter:['class']});
  document.addEventListener('keydown',e=>{if(!required)return;if(e.key==='Tab'){e.preventDefault();enable.focus();}} ,true);
  document.addEventListener('click',e=>{
    if(attempted||required||!e.target.closest?.('.cta,.dest-card'))return;
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
