// One consented audio stream, available before the 3D game initializes.
(() => {
 const audio=document.getElementById('gog-theme'),dialog=document.getElementById('music-choice');
 const toggle=document.getElementById('music-mute'),retry=document.getElementById('music-enable');
 const files={general:'/audio/gog-theme.mp3',campus:'/audio/ldrp-campus.mp3',gift:'/audio/gift-city-entry.mp3'};
 const positions={general:0,campus:0,gift:0};
 let settings={welcomeVolume:1,walkingVolume:.25,vehicleVolume:1,campusVolume:1};
 const needsGain=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
 const sourceUrl=name=>files[name].startsWith('/audio/')?files[name]+'?v=20261126-volume2':files[name];
 let dialogueDucked=false;
 let choice=null,muted=false,master=true,entered=false,inside=false,vehicle='walk',place=null,giftEntryPending=false;
 let track='general',desired='general',switchTimer=0,pending=false,ticket=0,blocked=false;
 let context=null,gain=null,source=null,lastVolume=-1,resolveReady;
 const ready=new Promise(resolve=>{resolveReady=resolve;});
 const baseVolume=()=>!master||muted||choice!==true?0:!entered||track==='gift'?settings.welcomeVolume:inside?settings.campusVolume:vehicle!=='walk'?settings.vehicleVolume:settings.walkingVolume;
 const volume=()=>baseVolume()*(dialogueDucked?.2:1);
 function setVolume(value){
  if(value===lastVolume)return;lastVolume=value;
  if(gain){const now=context.currentTime;gain.gain.cancelScheduledValues(now);gain.gain.setTargetAtTime(value,now,.22);}
  else audio.volume=value;
  audio.dataset.musicVolume=String(value);audio.dataset.musicContext=context?.state||'native';audio.dataset.musicTrack=track;
 }
 function play(){
  if(choice!==true||muted||!master||document.hidden||pending)return;
  pending=true;const current=ticket;
  audio.play().then(()=>{if(current===ticket){blocked=!!context&&context.state!=='running';retry.hidden=!blocked;}}).catch(()=>{
   if(current===ticket){blocked=true;retry.hidden=choice!==true||muted||!master;}
  }).finally(()=>{if(current===ticket)pending=false;});
 }
 function refresh(){
  const next=entered&&place==='gift'&&giftEntryPending?'gift':entered&&inside?'campus':'general';
  if(next!==desired){desired=next;clearTimeout(switchTimer);switchTimer=0;}
  const enabled=choice===true&&!muted&&master;
  toggle.hidden=choice===null;toggle.textContent=enabled?(blocked?'♫ Resume':'♫ On'):'♫ Off';
  toggle.setAttribute('aria-label',enabled?(blocked?'Resume music':'Mute music'):'Play music');toggle.setAttribute('aria-pressed',String(enabled));
  retry.textContent=desired==='gift'?'♪ Tap to hear GIFT City audio':'♪ Tap to resume music';
  if(!enabled||document.hidden){clearTimeout(switchTimer);switchTimer=0;audio.pause();retry.hidden=true;return;}
  if(track!==desired){
   if(!switchTimer){
    setVolume(0);
    switchTimer=setTimeout(()=>{
     switchTimer=0;
     positions[track]=Number.isFinite(audio.currentTime)?audio.currentTime:0;
     audio.pause();ticket++;pending=false;blocked=false;track=desired;
     audio.loop=track!=='gift';
     audio.src=sourceUrl(track);audio.load();lastVolume=-1;refresh();
    },220);
   }
   return;
  }
  setVolume(volume());if(blocked)retry.hidden=false;else if(audio.paused)play();
 }
 function unlock(event){
  if(choice!==true||muted||!master)return;
  if(event?.isTrusted||navigator.userActivation?.isActive){
   // Create/resume only inside the user's activation, especially on iOS.
   try{
    // Native media playback avoids a second suspended audio graph on Android/desktop.
    // iOS needs a gain node because its HTML audio volume is not adjustable.
    if(needsGain&&!context){const AC=window.AudioContext||window.webkitAudioContext;if(AC){context=new AC();gain=context.createGain();source=context.createMediaElementSource(audio);source.connect(gain);gain.connect(context.destination);gain.gain.value=volume();audio.volume=1;lastVolume=-1;context.addEventListener('statechange',()=>{blocked=context.state!=='running';lastVolume=-1;refresh();});}}
    if(context&&context.state!=='running'&&context.state!=='closed')context.resume().then(()=>{blocked=false;lastVolume=-1;refresh();}).catch(()=>{blocked=true;refresh();});
   }catch{/* Native HTML audio remains the fallback. */}
  }
  blocked=false;refresh();
 }
 function choose(on,event){
  const first=choice===null;choice=on;muted=!on;if(on){master=true;audio.preload='auto';}else{ticket++;pending=false;}
  if(dialog.open)dialog.close();
  if(on)unlock(event);else refresh();
  if(first){resolveReady();document.dispatchEvent(new Event('gog-music-choice'));}
 }
 audio.addEventListener('loadedmetadata',()=>{const saved=positions[track];if(saved>0&&saved<audio.duration)audio.currentTime=saved;});
 // The supplied recording plays once per visit, then the regular soundtrack resumes.
 audio.addEventListener('ended',()=>{if(track==='gift'){giftEntryPending=false;positions.gift=0;refresh();}});
 audio.addEventListener('playing',()=>{blocked=!!context&&context.state!=='running';retry.hidden=!blocked;});
 audio.addEventListener('error',()=>{blocked=true;refresh();});
 document.getElementById('music-yes').addEventListener('click',event=>choose(true,event));
 document.getElementById('music-no').addEventListener('click',event=>choose(false,event));
 dialog.addEventListener('cancel',event=>{event.preventDefault();choose(false,event);});
 toggle.addEventListener('click',event=>{if(blocked&&choice===true&&!muted&&master){if(audio.error)audio.load();unlock(event);}else choose(!(choice===true&&!muted&&master),event);});
 retry.addEventListener('click',event=>{if(audio.error)audio.load();unlock(event);});
 for(const event of ['pointerup','touchend','click','keydown'])document.addEventListener(event,e=>{if(!e.repeat&&blocked)unlock(e);},{capture:true,passive:true});
 document.addEventListener('visibilitychange',()=>{if(document.hidden){ticket++;pending=false;}else if(!context){blocked=false;}else if(context.state!=='running'){blocked=true;}refresh();});
 window.addEventListener('focus',()=>{if(!context&&!audio.error)blocked=false;refresh();});
 window.addEventListener('pagehide',()=>audio.pause());window.addEventListener('pageshow',refresh);
 window.gogMusic={ready,duck(on){if(dialogueDucked===on)return;dialogueDucked=on;refresh();},configure(config){settings={...settings,...config};files.general=config.general;files.campus=config.campus;audio.src=sourceUrl('general');document.getElementById('music-title').textContent=config.prompt;document.getElementById('music-description').textContent=config.description;document.getElementById('music-yes').textContent=config.yes;document.getElementById('music-no').textContent=config.no;if(choice===null&&!dialog.open)dialog.showModal();},update(state){
  const nextEntered=!!state.entered,nextInside=!!state.inside,nextVehicle=state.vehicle||'walk',nextPlace=state.place||null;
  if(entered===nextEntered&&inside===nextInside&&vehicle===nextVehicle&&place===nextPlace)return;
  if(nextEntered&&nextPlace==='gift'&&(!entered||place!=='gift')){
   giftEntryPending=true;positions.gift=0;
   if(track==='gift')audio.currentTime=0;
  }else if(!nextEntered||nextPlace!=='gift')giftEntryPending=false;
  entered=nextEntered;inside=nextInside;vehicle=nextVehicle;place=nextPlace;refresh();
 },setMaster(on){master=on;refresh();},get enabled(){return choice===true&&!muted&&master;}};
 refresh();
})();
