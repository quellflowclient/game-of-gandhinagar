// Fetch and decode only spoken clips, with a small LRU cache and one active voice.
export function createDialogueAudio({context,enabled,volume,duck}){
 const cache=new Map(),failed=new Map();let active=null,version=0;
 function stop(){version++;if(active){clearTimeout(active.timer);active.controller.abort();try{active.source?.stop();active.source?.disconnect();active.gain?.disconnect();}catch{}active=null;}duck(false);}
 function setVolume(){if(active?.gain)active.gain.gain.setTargetAtTime(volume(),context().ctx.currentTime,.025);}
 function play(url,fallback){
  const audioContext=context();if(!audioContext?.ctx||audioContext.ctx.state==='closed'||(failed.get(url)||0)>Date.now())return false;
  let parsed;try{parsed=new URL(url,location.href);if(!['https:','http:'].includes(parsed.protocol))return false;}catch{return false;}
  stop();const ticket=version,controller=new AbortController(),state={controller,source:null,gain:null,timer:setTimeout(()=>controller.abort(),8000)};active=state;
  (async()=>{
   try{
    let buffer=cache.get(url);
    if(buffer){cache.delete(url);cache.set(url,buffer);}else{
     const response=await fetch(parsed.href,{signal:controller.signal,credentials:'same-origin'});if(!response.ok)throw Error('Voice clip unavailable');
     if(Number(response.headers.get('content-length'))>2000000)throw Error('Voice clip exceeds 2 MB');
     const reader=response.body.getReader(),chunks=[];let size=0;
     while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>2000000){controller.abort();throw Error('Voice clip exceeds 2 MB');}chunks.push(part.value);}
     const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
     buffer=await audioContext.ctx.decodeAudioData(bytes.buffer);if(buffer.duration>45)throw Error('Voice clip exceeds 45 seconds');
     if(ticket!==version)return;cache.set(url,buffer);while(cache.size>8)cache.delete(cache.keys().next().value);
    }
    if(ticket!==version||!enabled()){if(ticket===version)stop();return;}
    if(audioContext.ctx.state!=='running')await audioContext.ctx.resume();
    if(ticket!==version)return;
    clearTimeout(state.timer);state.source=audioContext.ctx.createBufferSource();state.source.buffer=buffer;state.gain=audioContext.ctx.createGain();state.gain.gain.value=volume();
    state.source.connect(state.gain);state.gain.connect(audioContext.output);state.source.onended=()=>{if(ticket===version){active=null;state.source.disconnect();state.gain.disconnect();duck(false);}};
    duck(true);state.source.start();
   }catch{if(ticket!==version)return;failed.set(url,Date.now()+60000);stop();if(enabled())fallback();}
  })();return true;
 }
 document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
 return{play,stop,setVolume,get speaking(){return !!active;}};
}
