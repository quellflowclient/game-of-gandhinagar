// One consented audio stream, available before the 3D game initializes.
(() => {
 const audio=document.getElementById('gog-theme'),dialog=document.getElementById('music-choice');
 const toggle=document.getElementById('music-mute'),retry=document.getElementById('music-enable');
 const files={general:'/audio/gog-theme.mp3',campus:'/audio/ldrp-campus.mp3'};
 const positions={general:0,campus:0};
 let settings={welcomeVolume:1,walkingVolume:.18,vehicleVolume:1,campusVolume:1};
 let dialogueDucked=false;
 let choice=null,muted=false,master=true,entered=false,inside=false,vehicle='walk';
 let track='general',desired='general',switchTimer=0,pending=false,ticket=0,blocked=false;
 let context=null,gain=null,lastVolume=-1,resolveReady;
 const ready=new Promise(resolve=>{resolveReady=resolve;});
 const baseVolume=()=>!master||muted||choice!==true?0:!entered?settings.welcomeVolume:inside?settings.campusVolume:vehicle!=='walk'?settings.vehicleVolume:settings.walkingVolume;
 const volume=()=>baseVolume()*(dialogueDucked?.2:1);
 function setVolume(value){
  if(value===lastVolume)return;lastVolume=value;
  if(gain){const now=context.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(value,now,.22);}
  else audio.volume=value;
 }
 function play(){
  if(choice!==true||muted||!master||document.hidden||pending)return;
  pending=true;const current=ticket;
  audio.play().then(()=>{if(current===ticket){blocked=false;retry.hidden=true;}}).catch(()=>{
   if(current===ticket){blocked=true;retry.hidden=choice!==true||muted||!master;}
  }).finally(()=>{if(current===ticket)pending=false;});
 }
 function refresh(){
  const enabled=choice===true&&!muted&&master;
  toggle.hidden=choice===null;toggle.textContent=enabled?'♫ On':'♫ Off';
  toggle.setAttribute('aria-label',enabled?'Mute music':'Play music');toggle.setAttribute('aria-pressed',String(!enabled));
  if(!enabled||document.hidden){audio.pause();retry.hidden=true;return;}
  const next=entered&&inside?'campus':'general';
  if(next!==desired){
   desired=next;clearTimeout(switchTimer);
   if(track!==desired){
    setVolume(0);
    switchTimer=setTimeout(()=>{
     positions[track]=Number.isFinite(audio.currentTime)?audio.currentTime:0;
     audio.pause();ticket++;pending=false;blocked=false;track=desired;
     audio.src=files[track];audio.load();lastVolume=-1;refresh();
    },220);
   }
  }
  if(track!==desired)return;
  setVolume(volume());if(audio.paused&&!blocked)play();
 }
 function unlock(event){
  if(choice!==true||muted||!master)return;
  if(event?.isTrusted||navigator.userActivation?.isActive){
   // Create/resume only inside the user's activation, especially on iOS.
   try{
    if(!context){const AC=window.AudioContext||window.webkitAudioContext;if(AC){context=new AC();gain=context.createGain();const source=context.createMediaElementSource(audio);source.connect(gain);gain.connect(context.destination);gain.gain.value=volume();audio.volume=1;lastVolume=-1;}}
    if(context?.state==='suspended')context.resume().then(()=>{lastVolume=-1;refresh();}).catch(()=>{});
   }catch{/* Native HTML audio remains the fallback. */}
  }
  blocked=false;refresh();
 }
 function choose(on,event){
  const first=choice===null;choice=on;muted=!on;if(on){master=true;audio.preload='auto';}
  if(dialog.open)dialog.close();
  if(on)unlock(event);else refresh();
  if(first){resolveReady();document.dispatchEvent(new Event('gog-music-choice'));}
 }
 audio.addEventListener('loadedmetadata',()=>{const saved=positions[track];if(saved>0&&saved<audio.duration)audio.currentTime=saved;});
 audio.addEventListener('playing',()=>{blocked=false;retry.hidden=true;});
 audio.addEventListener('error',()=>{retry.hidden=choice!==true||muted||!master;});
 document.getElementById('music-yes').addEventListener('click',event=>choose(true,event));
 document.getElementById('music-no').addEventListener('click',event=>choose(false,event));
 dialog.addEventListener('cancel',event=>{event.preventDefault();choose(false,event);});
 toggle.addEventListener('click',event=>choose(!(choice===true&&!muted&&master),event));
 retry.addEventListener('click',event=>{if(audio.error)audio.load();unlock(event);});
 for(const event of ['pointerup','touchend','click','keydown'])document.addEventListener(event,e=>{if(!e.repeat&&blocked)unlock(e);},{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{if(!document.hidden&&context?.state==='suspended')blocked=true;refresh();if(blocked&&choice===true&&!muted&&master&&!document.hidden)retry.hidden=false;});
 window.addEventListener('pagehide',()=>audio.pause());window.addEventListener('pageshow',refresh);
 window.gogMusic={ready,duck(on){if(dialogueDucked===on)return;dialogueDucked=on;refresh();},configure(config){settings={...settings,...config};files.general=config.general;files.campus=config.campus;audio.src=files.general;document.getElementById('music-title').textContent=config.prompt;document.getElementById('music-description').textContent=config.description;document.getElementById('music-yes').textContent=config.yes;document.getElementById('music-no').textContent=config.no;if(choice===null&&!dialog.open)dialog.showModal();},update(state){const nextEntered=!!state.entered,nextInside=!!state.inside,nextVehicle=state.vehicle||'walk';if(entered===nextEntered&&inside===nextInside&&vehicle===nextVehicle)return;entered=nextEntered;inside=nextInside;vehicle=nextVehicle;refresh();},setMaster(on){master=on;refresh();},get enabled(){return choice===true&&!muted&&master;}};
 refresh();
})();
