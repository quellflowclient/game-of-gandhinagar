import {h,toast} from './dom.js';
import {RIDE_TRACKS} from '../data/ride-tracks.js';

const cache=new Map();let hydrated=false,dbPromise;
function db(){
 if(!dbPromise)dbPromise=new Promise((resolve,reject)=>{
  if(!window.indexedDB)return reject(new Error('Local storage unavailable'));
  const request=indexedDB.open('gog-ride-audio',1);
  request.onupgradeneeded=()=>request.result.createObjectStore('songs',{keyPath:'ride'});
  request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
 });return dbPromise;
}
async function operation(mode,action){const database=await db();return new Promise((resolve,reject)=>{const tx=database.transaction('songs',mode),request=action(tx.objectStore('songs'));tx.oncomplete=()=>resolve(request.result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);});}
const ready=Promise.allSettled([
 operation('readonly',s=>s.getAll()).then(rows=>{for(const row of rows)cache.set(row.ride,{name:row.name,url:URL.createObjectURL(row.blob),device:true});}),
 fetch('/audio/rides/manifest.json').then(r=>r.ok?r.json():{}).then(manifest=>{for(const [ride,url]of Object.entries(manifest)){if(!RIDE_TRACKS[ride]||typeof url!=='string'||!url.startsWith('/audio/rides/'))continue;if(!cache.has(ride))cache.set(ride,{name:RIDE_TRACKS[ride].name,url,device:false});}}),
]).then(()=>{hydrated=true;});

export function localSongControls(){
 const wrap=h('div',{class:'local-song-list'});
 for(const [ride,label]of [['car','Car'],['bike','Bike'],['auto','Rickshaw'],['scooter','Activa'],['cycle','Cycle']]){
  const note=h('small',{},'Checking saved audio…');
  const paint=()=>{const song=cache.get(ride);note.textContent=song?`${song.device?'Saved on this device':'Bundled audio'} · ${song.name}`:'Local file missing · online song available';};
  const input=h('input',{type:'file',accept:'audio/*,.mp3,.m4a,.ogg,.wav',hidden:true,'aria-label':`Choose local song for ${label}`});
  const remove=h('button',{type:'button',class:'btn sm',onclick:async()=>{
   try{const old=cache.get(ride);if(!old?.device)return;await operation('readwrite',s=>s.delete(ride));cache.delete(ride);URL.revokeObjectURL(old.url);paint();toast('Device song removed.');}catch{toast('Saved song could not be removed.','bad');}
  }},'Remove');
  input.addEventListener('change',async()=>{
   const file=input.files?.[0];if(!file)return;
   if(!file.type.startsWith('audio/')&&!/\.(mp3|m4a|ogg|wav|aac|flac)$/i.test(file.name))return toast('Audio file choose karo.','bad');
   if(file.size>50*1024*1024)return toast('50 MB se chhoti audio file choose karo.','bad');
   const old=cache.get(ride),song={name:file.name,url:URL.createObjectURL(file),device:true};cache.set(ride,song);if(old?.device)URL.revokeObjectURL(old.url);paint();
   try{await operation('readwrite',s=>s.put({ride,name:file.name,blob:file}));toast(`${label} song saved. Ride select karoge to automatic bajega.`,'good');}
   catch{toast('Gaana is session mein chalega; browser storage mein save nahi ho paya.','info',6000);}
   input.value='';
  });
  wrap.append(h('div',{class:'local-song-row'},h('div',{},h('b',{},label),note),h('div',{class:'row'},h('button',{type:'button',class:'btn sm',onclick:()=>input.click()},'Choose audio'),remove),input));
  ready.then(paint);
 }
 return h('div',{class:'local-song-settings'},h('h3',{},'Local ride songs'),h('p',{class:'muted small'},'Apni authorised audio choose karo. File isi browser mein save hogi, upload nahi hogi. Local audio bina video ke automatic loop karegi.'),wrap);
}

export function createLocalRideAudio(app){
 const audio=new Audio();audio.loop=true;audio.preload='auto';audio.setAttribute('playsinline','');
 let type='walk',source=null,active=false,needsTap=false,failed=false,pending=false,epoch=0;
 const unlock=h('button',{type:'button',class:'local-audio-unlock',hidden:true,onclick:()=>{needsTap=false;play();}},'♪ Tap to start ride music');document.body.append(unlock);
 function allowed(){return !!source&&app.sound.state.on&&app.sound.state.rideOn&&!document.hidden&&!document.body.classList.contains('landscape-required')&&!document.body.classList.contains('on-landing')&&!app.voice?.active&&!app.voiceRoom?.room;}
 function stop(){audio.pause();app.sound.setRidePlaying(false);unlock.hidden=true;}
 function play(){
  if(pending||!allowed()||failed)return;
  const ticket=epoch;pending=true;
  audio.play().then(()=>{if(ticket===epoch){needsTap=false;unlock.hidden=true;}}).catch(error=>{
   if(ticket!==epoch||error.name==='AbortError')return;
   if(error.name==='NotAllowedError'){needsTap=true;unlock.hidden=false;}
   else{failed=true;toast('Local audio play nahi hui. Sound menu mein supported MP3/M4A choose karo.','bad');}
  }).finally(()=>{if(ticket===epoch)pending=false;});
 }
 audio.addEventListener('playing',()=>{if(!allowed())return stop();app.sound.setRidePlaying(true);});
 audio.addEventListener('pause',()=>app.sound.setRidePlaying(false));
 audio.addEventListener('error',()=>{if(!source||failed)return;failed=true;stop();toast('Local audio file unavailable. Sound menu mein dusri file choose karo.','bad');});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){active=false;stop();}});window.addEventListener('pagehide',stop);
 function select(ride){
  const next=cache.get(ride)||null;
  if(type!==ride||source!==next){epoch++;stop();type=ride;source=next;needsTap=false;failed=false;pending=false;active=false;if(source)audio.src=source.url;else{audio.removeAttribute('src');audio.load();}}
  audio.volume=Math.max(0,Math.min(1,app.sound.state.rideVolume/100));
  const enabled=allowed();if(!enabled){if(active)stop();active=false;unlock.hidden=true;return;}
  if(!active&&!needsTap){active=true;play();}
  unlock.hidden=!needsTap;
 }
 return{select,has:ride=>cache.has(ride),get ready(){return hydrated;},stop};
}
