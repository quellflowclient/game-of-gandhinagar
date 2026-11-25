import {voiceIce} from './voice-ice.js';
import {h,toast} from '../ui/dom.js';

// Group voice for people sitting together (a tapri circle of 4-5 seats).
// Every member opens one WebRTC audio link to every other member (mesh, max 6).
// Signalling (offer/answer/ICE) goes over a realtime broadcast room, never the
// database, so joining is fast. The microphone starts only when the player taps
// "Join table voice" and stops as soon as they leave or stand up.
export const MAX_ROOM = 6;
export function createVoiceRoom(app,{Peer=globalThis.RTCPeerConnection,media=globalThis.navigator?.mediaDevices,mount=true}={}) {
  const backend=app.backend;
  if(!backend.voiceRoom)return null;
  let joining=false,room=null,label='',stream=null,link=null,muted=false,members=[],ice=null,queue=Promise.resolve(),epoch=0,retry=null;
  const peers=new Map(),speaking=new Set(),earlyIce=new Map(),needsAudio=new Set();
  const bar=mount?h('div',{class:'voice-call voice-room',hidden:true,'aria-label':'Table voice'}):null;
  if(bar)document.body.append(bar);
  const me=()=>app.session?.userId;
  function render(){
    if(!bar)return;bar.hidden=!room;document.body.classList.toggle("voice-ui-open",!!room||!!app.voice?.active);if(!room)return;
    const others=members.filter(id=>id!==me()),live=others.filter(id=>peers.get(id)?.pc.connectionState==='connected').length;
    bar.replaceChildren(h('span',{},`🎙 ${label} · ${members.length} ${members.length===1?'person':'people'}${others.length?` · ${live}/${others.length} connected`:' · waiting for friends'}`),
      ...(needsAudio.size?[h('button',{onclick:async()=>{for(const id of [...needsAudio]){try{await peers.get(id)?.audio?.play();needsAudio.delete(id);}catch{}}render();}},'Enable audio')]:[]),
      h('button',{onclick:toggleMute},muted?'Unmute':'Mute'),h('button',{onclick:()=>leave()},'Leave'));
  }
  const iceServers=()=>voiceIce(backend);
  function drop(id){const e=peers.get(id);if(!e)return;peers.delete(id);needsAudio.delete(id);e.pc.close();if(e.audio){e.audio.srcObject=null;e.audio.remove?.();}}
  function peerFor(id){
    if(peers.has(id))return peers.get(id);
    const pc=new Peer({iceServers:ice}),audio=mount?h('audio',{autoplay:true,playsinline:true}):null,entry={pc,audio,queued:[]};
    if(audio)document.body.append(audio);
    peers.set(id,entry);
    stream?.getTracks().forEach(t=>pc.addTrack(t,stream));
    pc.ontrack=e=>{if(!audio)return;audio.srcObject=e.streams?.[0]||new MediaStream([e.track]);audio.play?.().catch(()=>{needsAudio.add(id);render();});};
    pc.onicecandidate=e=>{if(e.candidate&&link)link.send({to:id,from:me(),type:'ice',candidate:e.candidate.toJSON?e.candidate.toJSON():e.candidate});};
    pc.onconnectionstatechange=()=>{if(peers.get(id)!==entry)return;if(pc.connectionState==='failed')drop(id);render();};
    return entry;
  }
  async function flush(entry){for(const c of entry.queued)await entry.pc.addIceCandidate(c).catch(()=>{});entry.queued=[];}
  async function offerTo(id){const entry=peerFor(id),offer=await entry.pc.createOffer();await entry.pc.setLocalDescription(offer);link?.send({to:id,from:me(),type:'offer',sdp:offer.sdp});}
  async function handle(s){
    if(!room||s.to!==me()||s.from===me())return;
    if(s.type==='offer'){const waiting=[...(peers.get(s.from)?.queued||[]),...(earlyIce.get(s.from)||[])];earlyIce.delete(s.from);drop(s.from);const entry=peerFor(s.from);entry.queued.push(...waiting);await entry.pc.setRemoteDescription({type:'offer',sdp:s.sdp});await flush(entry);
      const answer=await entry.pc.createAnswer();await entry.pc.setLocalDescription(answer);link?.send({to:s.from,from:me(),type:'answer',sdp:answer.sdp});}
    else if(s.type==='answer'){const entry=peers.get(s.from);if(entry&&entry.pc.signalingState==='have-local-offer'){await entry.pc.setRemoteDescription({type:'answer',sdp:s.sdp});await flush(entry);}}
    else if(s.type==='ice'){const entry=peers.get(s.from);if(!entry){const waiting=earlyIce.get(s.from)||[];if(waiting.length<40)waiting.push(s.candidate);earlyIce.set(s.from,waiting);return;}if(entry.pc.remoteDescription)await entry.pc.addIceCandidate(s.candidate).catch(()=>{});else entry.queued.push(s.candidate);}
  }
  function onSignal(s){const current=epoch;queue=queue.then(()=>current===epoch?handle(s):null).catch(e=>console.warn('Table voice:',e.message));}
  // The member with the smaller id always makes the offer, so two people never
  // offer to each other at the same moment.
  function onPeers(ids){
    if(!room)return;members=[...new Set(ids)].sort();
    if(members.length>MAX_ROOM&&members.indexOf(me())>=MAX_ROOM){toast(`Is table par voice full hai (${MAX_ROOM} log).`);leave();return;}
    for(const id of [...peers.keys()])if(!members.includes(id))drop(id);
    const current=epoch;
    for(const id of members)if(id!==me()&&!peers.has(id)&&me()<id)queue=queue.then(()=>current===epoch?offerTo(id):null).catch(e=>console.warn('Table voice:',e.message));
    render();
  }
  async function join(roomId,name='Table voice'){
    if(!app.requireSignIn?.('table voice'))return false;
    if(room===roomId)return true;
    if(joining)return false;
    if(app.voice?.active){toast('Pehle current 1:1 call khatam karo.');return false;}
    await leave(true);
    if(!Peer||!media?.getUserMedia){toast('Voice ke liye HTTPS aur microphone wala browser chahiye.','bad');return false;}
    const current=++epoch;joining=true;let acquired;
    try{acquired=await media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});}
    catch(e){if(current===epoch)joining=false;toast(e?.name==='NotAllowedError'?'Microphone permission nahi mili. Browser settings mein allow karo.':'Microphone start nahi hua.','bad');return false;}
    if(current!==epoch){acquired.getTracks().forEach(t=>t.stop());return false;}
    stream=acquired;ice=await iceServers();if(current!==epoch){acquired.getTracks().forEach(t=>t.stop());return false;}joining=false;room=roomId;label=name;muted=false;members=[me()];
    link=backend.voiceRoom(roomId,{userId:me(),name:app.me?.name||'Player'},{onPeers,onSignal});
    // Re-offer to anyone whose link dropped (network change, phone sleep).
    retry=setInterval(()=>onPeers(members),6000);
    render();toast('Table voice on: circle ke sab log ek saath baat kar sakte hain.');
    return true;
  }
  async function leave(silent=false){
    epoch++;joining=false;clearInterval(retry);earlyIce.clear();needsAudio.clear();
    for(const id of [...peers.keys()])drop(id);
    link?.leave();link=null;stream?.getTracks().forEach(t=>t.stop());stream=null;room=null;members=[];render();
    if(!silent)toast('Table voice band.');
  }
  function toggleMute(){muted=!muted;stream?.getAudioTracks().forEach(t=>t.enabled=!muted);render();}
  globalThis.addEventListener?.('pagehide',()=>leave(true));
  return {join,leave,toggleMute,get room(){return room;},get members(){return members;},get muted(){return muted;},get peers(){return peers;},speaking};
}
