import * as THREE from 'three';
import {mediaPosition} from './event-schedule.js';

// One audible stream remains owned by the game's music player. The stage's
// video element is always muted and only supplies pixels to its VideoTexture.
export function createVenueMedia({world,clock,onError=()=>{}}){
 let key='',video=null,texture=null,failed=false,lastSeek=0;
 function clearVideo(){if(video){video.pause();video.removeAttribute('src');video.load();video.remove();video=null;}texture?.dispose();texture=null;world.setScreen(null);failed=false;}
 function align(program,force=false){if(!video||!video.readyState)return;const at=mediaPosition(program.startAt,clock.now(),video.duration,program.loop);if(at!=null&&(force||Math.abs(video.currentTime-at)>.75))try{video.currentTime=at;}catch{}}
 function play(program){if(!video)return;align(program,true);video.play().catch(()=>{failed=true;onError('Tap Resume video to continue the stage screen.');});}
 return{
  get videoFailed(){return failed;},
  update(program,{videoVisible=true}={}){
   if(!program){if(key){clearVideo();key='';}window.gogMusic?.setVenue(null);return;}
   window.gogMusic?.setVenue({...program,clock:()=>clock.now()});
   const next=program.videoUrl?`${program.key}:${program.videoUrl}`:'';
   if(next!==key){clearVideo();key=next;
    if(next){const ownKey=key;video=document.createElement('video');video.className='venue-video-source';video.muted=true;video.playsInline=true;video.setAttribute('playsinline','');video.setAttribute('aria-hidden','true');video.crossOrigin='anonymous';video.preload='auto';video.loop=!!program.loop;
     texture=new THREE.VideoTexture(video);texture.colorSpace=THREE.SRGBColorSpace;
     video.addEventListener('loadeddata',()=>{if(key!==ownKey)return;world.setScreen(texture);failed=false;if(videoVisible&&!document.hidden)play(program);});
     video.addEventListener('error',()=>{if(key!==ownKey)return;failed=true;world.setScreen(null);onError('Stage video could not load. You can retry.');});
     document.body.append(video);video.src=program.videoUrl;video.load();
    }
   }
   if(!video)return;
   if(document.hidden||!videoVisible){video.pause();return;}
   if(video.ended&&!program.loop)return;
   if(clock.now()-lastSeek>4000){lastSeek=clock.now();align(program);}
   if(video.paused&&!video.ended&&!failed&&video.readyState>=2)play(program);
  },
  retry(program){if(!program||!video)return;failed=false;if(video.error)video.load();play(program);},
  pause(){video?.pause();},
  dispose(){clearVideo();key='';window.gogMusic?.setVenue(null);}
 };
}
