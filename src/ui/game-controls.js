import {h,panelOpen,openPanel} from './dom.js';
import {landscape} from './landscape.js';

// Touch driving uses independent pointer capture: steer and pedal work together.
export function createGameControls({player,hud}){
  let type='walk',wasLocked=false;
  const active=new Map(),buttons=[];
  const input={steer:0,throttle:0,brake:0,gear:1};
  function send(){input.steer=0;input.throttle=0;input.brake=0;for(const {key,value} of active.values())input[key]+=value;input.steer=Math.max(-1,Math.min(1,input.steer));input.throttle=Math.min(1,input.throttle);input.brake=Math.min(1,input.brake);player.setDriveInput(input);}
  function clear(){active.clear();for(const b of buttons)b.classList.remove('held');send();player.resetInput();}
  function hold(icon,label,key,value,cls=''){
    const button=h('button',{type:'button',class:`drive-key ${cls}`,'aria-label':label},h('span',{},icon),h('small',{},label));buttons.push(button);
    button.addEventListener('pointerdown',e=>{if(wasLocked||active.has(e.pointerId)||e.button>0)return;e.preventDefault();e.stopPropagation();button.setPointerCapture(e.pointerId);active.set(e.pointerId,{key,value,button});button.classList.add('held');send();});
    const end=e=>{if(!active.has(e.pointerId))return;active.delete(e.pointerId);button.classList.toggle('held',[...active.values()].some(p=>p.button===button));send();};
    for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,end);
    return button;
  }
  const steering=h('div',{class:'drive-steering','aria-label':'Steering'},hold('‹','Left','steer',-1),hold('›','Right','steer',1));
  const pedals=h('div',{class:'drive-pedals'},hold('▰','Brake / Reverse','brake',1,'brake'),hold('⇧','Race / Forward','throttle',1,'accelerator'));
  const drive=h('div',{class:'drive-controls',hidden:true},steering,pedals);
  hud.root.append(drive);
  window.addEventListener('blur',clear);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clear();});
  return{get rotationRequired(){return landscape.required;},update(){const locked=panelOpen()||hud.menuOpen||landscape.required||['on-landing','portrait-page-mode','accident-active'].some(c=>document.body.classList.contains(c));if(locked&&!wasLocked)clear();wasLocked=locked;const v=player.vehicle;if(v!==type){type=v;input.gear=1;clear();document.body.dataset.ride=v;}drive.hidden=!['car','auto','bike','scooter'].includes(v)||locked;}};
}

export function openControlGuide(){
  const row=(symbol,title,description)=>h('div',{class:'control-guide-row'},h('span',{class:'control-guide-icon'},symbol),h('div',{},h('b',{},title),h('p',{},description)));
  openPanel('How to play',h('div',{class:'control-guide'},
    row('✥','Walk & run','Left thumb joystick se aage, peeche aur sideways chalo. Outer ring tak push karo to run. Running button se bhi toggle kar sakte ho.'),
    row('◉','Look around','Screen ke empty area par drag karke camera ghumao. Pinch to zoom. Camera button se first-person, follow aur wide views choose karo.'),
    row('⇄','Drive your ride','Left / right hold karke steer karo. Race se aage chalo. Brake / Reverse se pehle ruko; hold rakho to rukne ke baad dheere peeche chalo. Dono pedals saath dabane par gaadi rukti hai. Space sirf brake hai.'),
    row('⌨','Keyboard','WASD / arrows: movement or driving. Shift: run. Space: brake. C: choose ride. E: interact. Esc: close panel.'),
    row('⛶','Landscape play','Phone sideways rakho. Fullscreen button supported browsers mein extra space deta hai. Login, profile aur ID portrait mein bhi khul sakte hain.')));
}
