import {h,toast} from '../ui/dom.js';
// One consensual audio call at a time. No recording and no background microphone.
export function createVoice(app,{Peer=globalThis.RTCPeerConnection,media=navigator.mediaDevices}={}) {
  const backend=app.backend;
  if(!backend.startCall)return null;
  let call=null,pc=null,stream=null,timeout=null,poll=null,muted=false,starting=false,offerSent=false,needsAudio=false;
  let queuedIce=[],seen=new Set(),signalQueue=Promise.resolve(),disposed=0;
  const audio=h('audio',{autoplay:true,playsinline:true}),bar=h('div',{class:'voice-call',hidden:true,'aria-label':'Voice call'});
  document.body.append(bar,audio);
  function render(message){bar.hidden=!call;if(!call)return;bar.replaceChildren(h('span',{},message||'Voice call'),
    ...(needsAudio?[h('button',{onclick:()=>audio.play().then(()=>{needsAudio=false;render('Voice call');}).catch(()=>toast('Phone audio permission check karo.'))},'Enable audio')]:[]),
    ...(call.status==='ringing'&&call.callee===app.session?.userId?[h('button',{onclick:()=>accept()},'Accept'),h('button',{onclick:()=>end('declined')},'Decline')]:[
      h('button',{onclick:()=>{muted=!muted;stream?.getAudioTracks().forEach(t=>t.enabled=!muted);render(muted?'Mic muted':'Voice call');}},muted?'Unmute':'Mute'),
      h('button',{onclick:()=>end()},'End call')]));}
  function cleanup(){disposed++;clearTimeout(timeout);clearInterval(poll);pc?.close();pc=null;stream?.getTracks().forEach(t=>t.stop());stream=null;audio.srcObject=null;call=null;queuedIce=[];seen=new Set();offerSent=false;starting=false;muted=false;needsAudio=false;render();}
  async function end(status='ended'){const id=call?.id;cleanup();if(id)try{await backend.setCall(id,status);}catch{} }
  function fail(e){toast(e?.name==='NotAllowedError'?'Microphone permission nahi mili. Call band kar di.':e?.message||'Voice connection nahi ho paya. Text chat use karo.','bad');end();}
  async function mic(){if(!Peer||!media?.getUserMedia)throw new Error('Voice calls require HTTPS and microphone support.');const epoch=disposed;const local=await media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(epoch!==disposed){local.getTracks().forEach(t=>t.stop());throw new Error('Call ended.');}stream=local;}
  async function connection(){if(pc)return pc;const peer=new Peer({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});pc=peer;
    // An optional short-lived TURN configuration is obtained from the owner's server.
    if(import.meta.env?.VITE_TURN_ENDPOINT){const r=await fetch(import.meta.env.VITE_TURN_ENDPOINT,{headers:{Authorization:`Bearer ${await backend.accessToken()}`}});if(r.ok){const config=await r.json();if(Array.isArray(config.iceServers))peer.setConfiguration({iceServers:config.iceServers});}}
    stream?.getTracks().forEach(t=>peer.addTrack(t,stream));
    peer.ontrack=e=>{audio.srcObject=e.streams[0];audio.play().catch(()=>{needsAudio=true;render('Tap Enable audio to hear');});};
    peer.onicecandidate=e=>{if(e.candidate&&call)backend.sendVoiceSignal(call.id,{type:'ice',candidate:e.candidate.toJSON()}).catch(fail);};
    peer.onconnectionstatechange=()=>{if(peer!==pc)return;if(peer.connectionState==='connected'){clearTimeout(timeout);render('Connected · Voice call');}if(peer.connectionState==='failed')fail(new Error('Voice network connection failed. Text chat is available.'));};
    return peer;
  }
  async function signal(s){if(!call||s.call_id!==call.id||s.sender===app.session?.userId||seen.has(s.id))return;seen.add(s.id);const p=s.payload,peer=await connection();
    if(p.type==='ice'){if(peer.remoteDescription)await peer.addIceCandidate(p.candidate);else queuedIce.push(p.candidate);return;}
    if(p.type==='offer'||p.type==='answer'){
      await peer.setRemoteDescription({type:p.type,sdp:p.sdp});for(const ice of queuedIce)await peer.addIceCandidate(ice);queuedIce=[];
      if(p.type==='offer'){const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await backend.sendVoiceSignal(call.id,{type:'answer',sdp:answer.sdp});}
    }
  }
  function enqueue(s){const epoch=disposed;signalQueue=signalQueue.then(()=>epoch===disposed?signal(s):null).catch(e=>{if(epoch===disposed)fail(e);});}
  async function sync(c){if(!c?.id)return;
    if(!call){if(c.status!=='ringing'||c.callee!==app.session?.userId||Date.now()-Date.parse(c.created_at)>35000)return;call=c;const other=await backend.getProfile(c.caller);if(!call||call.id!==c.id)return;render(`${other?.name||'Player'} is calling`);watch();return;}
    if(c.id!==call.id)return;call=c;
    if(['ended','declined'].includes(c.status)){toast(c.status==='declined'?'Call declined.':'Call ended.');cleanup();return;}
    if(c.status==='accepted'&&c.caller===app.session?.userId&&!offerSent){offerSent=true;render('Connecting…');const peer=await connection(),offer=await peer.createOffer();await peer.setLocalDescription(offer);await backend.sendVoiceSignal(c.id,{type:'offer',sdp:offer.sdp});}
  }
  function watch(){clearTimeout(timeout);timeout=setTimeout(()=>{toast('Call timed out. Try text chat.');end();},35000);clearInterval(poll);poll=setInterval(async()=>{if(!call)return;try{const c=await backend.getCall(call.id);if(!c)return end();await sync(c);if(call?.status==='accepted'){await backend.setCall(call.id,'accepted');for(const s of await backend.voiceSignals(call.id))enqueue(s);}}catch(e){fail(e);}},call?.status==="accepted"?4000:3000);}
  async function accept(){if(starting)return;starting=true;try{await mic();if(!call)return;await connection();await sync(await backend.setCall(call.id,'accepted'));render('Connecting…');for(const s of await backend.voiceSignals(call.id))enqueue(s);}catch(e){fail(e);}finally{starting=false;}}
  backend.onCall(c=>sync(c).catch(fail));backend.onVoiceSignal(enqueue);
  window.addEventListener('pagehide',()=>end());
  return{get active(){return !!call;},async start(target){if(!app.requireSignIn('voice chat'))return;if(call||starting)return toast('Pehle current call finish karo.');starting=true;
    try{await mic();call=await backend.startCall(target.id);render(`Calling ${target.name}…`);watch();}catch(e){fail(e);}finally{starting=false;}
  },updateDistance(){if(!call)return;const peer=call.caller===app.session?.userId?call.callee:call.caller,p=backend.presenceList().find(p=>p.userId===peer);audio.volume=p?Math.max(0,Math.min(1,1-Math.hypot(p.x-app.player.position.x,p.z-app.player.position.z)/28)):0;},end};
}
