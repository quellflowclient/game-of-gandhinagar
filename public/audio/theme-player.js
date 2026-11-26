// Starts independently of map/model loading. One native audio stream for the
// welcome screen, walking and every vehicle; no iframe or per-ride downloads.
const audio=document.getElementById('gog-theme');
const enable=document.getElementById('music-enable');
const mute=document.getElementById('music-mute');
let prefs={on:true,rideOn:true,rideVolume:100},vehicle='walk',ducked=false;
try{const saved=JSON.parse(localStorage.getItem('gnr-sound-v1')||'{}');prefs={...prefs,...saved,rideVolume:saved.musicVersion===2?(saved.rideVolume??100):100};}catch{}
let ctx=null,gain=null,source=null,pending=false,blocked=false,lastTarget=-1,fade=0;
let campus=false,track='general',desired='general',switchTimer=0,epoch=0;
const positions={general:0,campus:0},files={general:'/audio/gog-theme.mp3',campus:'/audio/ldrp-campus.mp3'};
const welcome=()=>!document.body.classList.contains('game-started');
function target(){return prefs.on&&prefs.rideOn?(prefs.rideVolume/100)*(ducked?.06:welcome()||campus||vehicle!=='walk'?1:.18):0;}
function volume(value){
 value=Math.max(0,Math.min(1,value));if(value===lastTarget)return;lastTarget=value;
 if(gain&&ctx.state==='running'){
  const t=ctx.currentTime;gain.gain.cancelScheduledValues(t);gain.gain.setTargetAtTime(value,t,.35);
 }else{
  cancelAnimationFrame(fade);const from=audio.volume,start=performance.now();
  const tick=now=>{const p=Math.min(1,(now-start)/1000);audio.volume=from+(value-from)*p;if(p<1)fade=requestAnimationFrame(tick);};fade=requestAnimationFrame(tick);
 }
}
function route(){
 const next=!welcome()&&campus?'campus':'general';if(next===desired)return;
 desired=next;clearTimeout(switchTimer);
 if(track===desired){lastTarget=-1;refresh();return;}
 volume(0);
 switchTimer=setTimeout(()=>{
  positions[track]=Number.isFinite(audio.currentTime)?audio.currentTime:0;
  audio.pause();epoch++;pending=false;track=desired;audio.src=files[track];audio.load();
  // Keep a single decoder and resume each track where it was left.
  lastTarget=-1;refresh();
 },350);
}
function refresh(){
 if(!audio)return;
 mute.setAttribute('aria-pressed',String(!prefs.rideOn));mute.setAttribute('aria-label',prefs.rideOn?'Mute music':'Unmute music');mute.textContent=prefs.rideOn?'♫ On':'♫ Off';
 route();if(track===desired)volume(target());
 if(document.hidden||!prefs.on||!prefs.rideOn){audio.pause();enable.hidden=true;return;}
 if(audio.paused&&!blocked&&!pending)play();
}
function play(){
 if(!audio||pending||document.hidden||!prefs.on||!prefs.rideOn)return;
 pending=true;const ticket=epoch;
 audio.play().then(()=>{if(ticket!==epoch)return;blocked=false;enable.hidden=true;}).catch(()=>{if(ticket!==epoch)return;blocked=true;enable.hidden=true;}).finally(()=>{if(ticket===epoch)pending=false;});
}
function unlock(){
 if(!audio||!prefs.on||!prefs.rideOn)return;
 try{
  if(!ctx){const AC=window.AudioContext||window.webkitAudioContext;if(AC){ctx=new AC();gain=ctx.createGain();source=ctx.createMediaElementSource(audio);source.connect(gain);gain.connect(ctx.destination);gain.gain.value=audio.volume;cancelAnimationFrame(fade);audio.volume=1;lastTarget=-1;}}
  if(ctx?.state==='suspended')ctx.resume().then(()=>{lastTarget=-1;refresh();}).catch(()=>{});
 }catch{}
 blocked=false;if(track===desired)volume(target());play();
}
if(audio){
 audio.volume=1;
 audio.addEventListener('loadedmetadata',()=>{const t=positions[track];if(t>0&&t<audio.duration)audio.currentTime=t;});
 audio.addEventListener('playing',()=>{enable.hidden=true;});
 audio.addEventListener('error',()=>{enable.hidden=false;enable.textContent='Music unavailable · Retry';});
 mute.addEventListener('click',()=>{
  prefs.rideOn=!prefs.rideOn;
  try{const saved=JSON.parse(localStorage.getItem('gnr-sound-v1')||'{}');localStorage.setItem('gnr-sound-v1',JSON.stringify({...saved,rideOn:prefs.rideOn}));}catch{}
  document.dispatchEvent(new CustomEvent('gog-music-toggle',{detail:prefs.rideOn}));refresh();if(prefs.rideOn)unlock();
 });
 enable.addEventListener('click' ,()=>{if(audio.error)audio.load();unlock();});
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
 mode(next,quiet=false,inside=false){if(vehicle===next&&ducked===quiet&&campus===inside)return;vehicle=next;ducked=quiet;campus=inside;refresh();},
 unlock,
};
