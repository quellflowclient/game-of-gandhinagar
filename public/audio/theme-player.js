// Starts independently of map/model loading. One native audio stream for the
// welcome screen, walking and every vehicle; no iframe or per-ride downloads.
const audio=document.getElementById('gog-theme');
const enable=document.getElementById('music-enable');
let prefs={on:true,rideOn:true,rideVolume:100},vehicle='walk',ducked=false;
try{const saved=JSON.parse(localStorage.getItem('gnr-sound-v1')||'{}');prefs={...prefs,...saved,rideVolume:saved.musicVersion===2?(saved.rideVolume??100):100};}catch{}
let ctx=null,gain=null,source=null,pending=false,blocked=false,lastTarget=-1,fade=0;
const welcome=()=>!document.body.classList.contains('game-started');
function target(){return prefs.on&&prefs.rideOn?(prefs.rideVolume/100)*(ducked?.06:welcome()||vehicle!=='walk'?1:.18):0;}
function volume(value){
 value=Math.max(0,Math.min(1,value));if(value===lastTarget)return;lastTarget=value;
 if(gain&&ctx.state==='running'){
  const t=ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(value,t,.35);
 }else{
  cancelAnimationFrame(fade);const from=audio.volume,start=performance.now();
  const tick=now=>{const p=Math.min(1,(now-start)/1000);audio.volume=from+(value-from)*p;if(p<1)fade=requestAnimationFrame(tick);};fade=requestAnimationFrame(tick);
 }
}
function refresh(){
 if(!audio)return;volume(target());
 if(document.hidden||!prefs.on||!prefs.rideOn){audio.pause();enable.hidden=true;return;}
 if(audio.paused&&!blocked&&!pending)play();
}
function play(){
 if(!audio||pending||document.hidden||!prefs.on||!prefs.rideOn)return;
 pending=true;
 audio.play().then(()=>{blocked=false;enable.hidden=true;}).catch(()=>{blocked=true;enable.hidden=false;}).finally(()=>{pending=false;});
}
function unlock(){
 if(!audio||!prefs.on||!prefs.rideOn)return;
 try{
  if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC){ctx=new AC();gain=ctx.createGain();source=ctx.createMediaElementSource(audio);source.connect(gain);gain.connect(ctx.destination);gain.gain.value=audio.volume;cancelAnimationFrame(fade);audio.volume=1;lastTarget=-1;}}
  if(ctx?.state==='suspended')ctx.resume().then(()=>{lastTarget=-1;refresh();}).catch(()=>{});
 }catch{}
 blocked=false;volume(target());play();
}
if(audio){
 audio.volume=1;
 audio.addEventListener('playing',()=>{enable.hidden=true;});
 audio.addEventListener('error',()=>{enable.hidden=false;enable.textContent='Music unavailable · Retry';});
 enable.addEventListener('click',()=>{if(audio.error)audio.load();unlock();});
 document.addEventListener('pointerdown',unlock,{capture:true,passive:true});
 document.addEventListener('keydown',e=>{if(!e.repeat)unlock();},{capture:true});
 document.addEventListener('visibilitychange',refresh);
 window.addEventListener('pagehide',()=>audio.pause());
 window.addEventListener('pageshow',refresh);
 document.addEventListener('gog-sound-settings',e=>window.gogMusic.preferences(e.detail));
 new MutationObserver(refresh).observe(document.body,{attributes:true,attributeFilter:['class']});
 refresh();
}
window.gogMusic={
 preferences(next){const changed=prefs.on!==next.on||prefs.rideOn!==next.rideOn||prefs.rideVolume!==next.rideVolume;prefs={...prefs,...next};if(changed)refresh();},
 mode(next,quiet=false){if(vehicle===next&&ducked===quiet)return;vehicle=next;ducked=quiet;refresh();},
 unlock,
};
