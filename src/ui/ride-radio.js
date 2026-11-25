import {h,panelOpen} from './dom.js';
import {RIDE_TRACKS,trackUrl} from '../data/ride-tracks.js';
import {createLocalRideAudio} from './local-ride-audio.js';

let apiPromise=null;
function youtube(){
 if(window.YT?.Player)return Promise.resolve(window.YT);
 if(apiPromise)return apiPromise;
 apiPromise=new Promise((resolve,reject)=>{
  const previous=window.onYouTubeIframeAPIReady;
  const timer=setTimeout(()=>{apiPromise=null;reject(new Error('YouTube load nahi hua. Connection check karke retry karo.'));},18000);
  window.onYouTubeIframeAPIReady=()=>{clearTimeout(timer);previous?.();resolve(window.YT);};
  let script=document.querySelector('script[data-ride-youtube]');
  if(script)script.remove();
  script=document.createElement('script');script.src='https://www.youtube.com/iframe_api';script.async=true;script.dataset.rideYoutube='true';
  script.onerror=()=>{clearTimeout(timer);apiPromise=null;reject(new Error('YouTube unavailable. Neeche official song link use karo.'));};
  document.head.append(script);
 });return apiPromise;
}

// The official video remains visible during playback. Closing/hiding the player,
// a voice call, portrait rotation, dismount or master mute always pauses it.
export function createRideRadio(app,{hud}){
 const local=createLocalRideAudio(app);
 let player=null,ready=false,epoch=0,type='walk',visibleEnough=false,wantsPlay=true,suspended=true,wasSuspended=true,lastVolume=-1,nextCheck=0,loading=false,failed=false;
 const title=h('b',{},'Ride radio'),hint=h('span',{class:'ride-radio-state','aria-live':'polite'},'Loading YouTube…');
 const watch=h('a',{class:'ride-radio-source',target:'_blank',rel:'noopener'},'YouTube ↗');
 const mount=h('div',{class:'ride-radio-video'});
 const retry=h('button',{type:'button',class:'ride-radio-retry',hidden:true,onclick:()=>load(type)},'Retry');
 const root=h('section',{class:'ride-radio',hidden:true,'aria-label':'Vehicle music player'},
  h('header',{},h('div',{},h('span',{class:'ride-radio-kicker'},'RIDE RADIO'),title),h('button',{type:'button','aria-label':'Turn ride music off',title:'Turn ride music off',onclick:()=>{app.sound.set('rideOn',false);pause();root.hidden=true;document.body.classList.remove('ride-radio-open');}},'×')),
  mount,h('footer',{},hint,watch,retry));
 document.body.append(root);
 const observer=new IntersectionObserver(entries=>{visibleEnough=entries[0]?.intersectionRatio>=.5;if(!visibleEnough)pause();},{threshold:[0,.5,1]});observer.observe(mount);
 function pause(){if(ready)player?.pauseVideo?.();app.sound.setRidePlaying(false);}
 function allowed(){return !!RIDE_TRACKS[type]&&app.sound.state.on&&app.sound.state.rideOn&&!document.hidden&&!panelOpen()&&!hud.menuOpen&&!document.body.classList.contains('landscape-required')&&!document.body.classList.contains('on-landing')&&!app.voice?.active&&!app.voiceRoom?.room&&innerHeight>=280;}
 async function load(vehicle){
  const track=RIDE_TRACKS[vehicle];if(!track)return;
  const ticket=++epoch;loading=true;failed=false;ready=false;player?.destroy?.();player=null;mount.replaceChildren();
  wantsPlay=true;hint.textContent='Loading YouTube…';retry.hidden=true;title.textContent=track.title;title.title=`${track.name} · ${track.artist} · ${track.language}`;watch.href=trackUrl(track);
  const host=h('div');mount.append(host);
  try{
   const YT=await youtube();if(ticket!==epoch)return;
   player=new YT.Player(host,{width:200,height:200,videoId:track.videoId,host:'https://www.youtube-nocookie.com',
    playerVars:{playsinline:1,controls:1,autoplay:0,rel:0,origin:location.origin},events:{
     onReady:e=>{if(ticket!==epoch)return;ready=true;loading=false;e.target.getIframe().setAttribute('title',`${track.name} · YouTube music player`);e.target.setVolume(app.sound.state.rideVolume);lastVolume=app.sound.state.rideVolume;
      hint.textContent='Play tap karo';if(allowed()&&visibleEnough&&wantsPlay)e.target.playVideo();},
     onStateChange:e=>{if(ticket!==epoch)return;
      if(e.data===1){if(!allowed()||!visibleEnough){pause();return;}wantsPlay=true;app.sound.setRidePlaying(true);hint.textContent=track.language==='Gujarati'?'વાગે છે ♪':'Playing · Hindi';}
      else{app.sound.setRidePlaying(false);if(e.data===2){if(!suspended)wantsPlay=false;hint.textContent='Paused';}
       if(e.data===0&&allowed()&&visibleEnough){e.target.seekTo(0,true);e.target.playVideo();}}
     },
     onAutoplayBlocked:()=>{if(ticket===epoch){wantsPlay=false;hint.textContent='▶ Player par Play tap karo';}},
     onError:()=>{if(ticket===epoch){loading=false;failed=true;wantsPlay=false;app.sound.setRidePlaying(false);hint.textContent='Unavailable · YouTube ↗';retry.hidden=false;}},
    }});
  }catch(error){if(ticket===epoch){loading=false;failed=true;hint.textContent=error.message;retry.hidden=false;}}
 }
 function stop(){epoch++;pause();ready=false;loading=false;failed=false;player?.destroy?.();player=null;mount.replaceChildren();root.hidden=true;document.body.classList.remove('ride-radio-open');}
 document.addEventListener('visibilitychange',()=>{if(document.hidden){suspended=true;pause();}});
 window.addEventListener('pagehide',stop);
 return{get track(){return RIDE_TRACKS[type]||null;},select(vehicle){
  if(vehicle!==type){stop();type=vehicle;wasSuspended=true;wantsPlay=true;}
  if(local.has(vehicle))local.select(vehicle);
 },update(vehicle){
  if(vehicle!==type){stop();type=vehicle;wasSuspended=true;wantsPlay=true;}
  if(local.has(vehicle)){if(player||loading||!root.hidden)stop();local.select(vehicle);return;}
  local.select('walk');
  if(!local.ready)return;
  const current=RIDE_TRACKS[type];
  const now=performance.now();if(now<nextCheck)return;nextCheck=now+150;
  suspended=!allowed();root.hidden=suspended||!current;document.body.classList.toggle('ride-radio-open',!root.hidden);
  if(suspended){if(!wasSuspended)pause();wasSuspended=true;return;}
  if(!player&&!loading&&!failed)void load(type);
  if(ready){
   if(lastVolume!==app.sound.state.rideVolume){lastVolume=app.sound.state.rideVolume;player.setVolume(lastVolume);}
   if(wasSuspended&&wantsPlay&&visibleEnough)player.playVideo();
  }
  wasSuspended=false;
 }};
}
