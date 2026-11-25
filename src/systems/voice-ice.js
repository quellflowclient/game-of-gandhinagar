// Shared short-lived ICE configuration for direct calls and table voice.
let cached=null,expires=0;
export async function voiceIce(backend){
 if(cached&&Date.now()<expires)return cached;
 const fallback=[{urls:['stun:stun.l.google.com:19302','stun:stun1.l.google.com:19302']}];
 try{
  const token=await backend.accessToken?.();if(!token)return fallback;
  const endpoint=import.meta.env?.VITE_TURN_ENDPOINT||'/api/turn';
  const response=await fetch(endpoint,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(6000)});
  if(response.ok){const data=await response.json();if(Array.isArray(data.iceServers)&&data.iceServers.length){cached=data.iceServers;expires=Date.now()+Math.min(600,Number(data.ttl)||600)*1000;return cached;}}
 }catch{}
 return fallback;
}
export const hasTurn=servers=>servers.some(s=>[].concat(s.urls||[]).some(url=>/^turns?:/i.test(url)));
