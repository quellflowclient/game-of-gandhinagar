import {timeoutSignal} from './network.js';
// Shared short-lived ICE configuration for direct calls and table voice.
const fallback=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
// Cache per backend session owner and deduplicate concurrent call setup requests.
const states=new WeakMap();
export async function voiceIce(backend){
 let state=states.get(backend);if(!state){state={servers:null,expires:0,pending:null,retryAt:0};states.set(backend,state);}
 if(state.servers&&Date.now()<state.expires)return state.servers;
 if(state.pending)return state.pending;
 if(Date.now()<state.retryAt)return fallback;
 state.pending=(async()=>{
  try{
   const token=await backend.accessToken?.();if(!token)return fallback;
   const endpoint=import.meta.env?.VITE_TURN_ENDPOINT||'/api/turn';
   const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`},signal:timeoutSignal(6000)});
   if(response.ok){const data=await response.json();if(Array.isArray(data.iceServers)&&data.iceServers.length){state.servers=data.iceServers;state.expires=Date.now()+Math.min(600,Number(data.ttl)||600)*1000;return state.servers;}}
   // An unavailable relay must not produce another request for every peer.
   state.retryAt=Date.now()+60000;
  }catch{state.retryAt=Date.now()+60000;}
  return fallback;
 })();
 try{return await state.pending;}finally{state.pending=null;}
}
export const hasTurn=servers=>servers.some(s=>[].concat(s.urls||[]).some(url=>/^turns?:/i.test(url)));
