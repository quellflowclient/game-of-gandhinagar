import {h,toast} from '../ui/dom.js';
import {voiceIce,hasTurn} from './voice-ice.js';

// Email-authenticated consent-based calls. Incoming fallback does not rely on a
// presence channel being subscribed at exactly the moment the phone rings.
export function createVoice(app,{Peer=globalThis.RTCPeerConnection,media=navigator.mediaDevices}={}){
 const backend=app.backend;if(!backend.startCall)return null;
 let call=null,pc=null,connecting=null,stream=null,micPending=null,epoch=0,muted=false,starting=false,offerSent=false,needsAudio=false,relay=false;
 let seen=new Set(),queuedIce=[],queue=Promise.resolve(),polling=false,lastPoll=0,lastBeat=0,deadline=0,pollErrors=0;
 const audio=h('audio',{autoplay:true,playsinline:true}),bar=h('div',{class:'voice-call',hidden:true,'aria-label':'Voice call'});audio.volume=1;document.body.append(bar,audio);
 const me=()=>app.session?.userId;
 function render(message){
  bar.hidden=!call;document.body.classList.toggle('voice-ui-open',!!call||!!app.voiceRoom?.room);if(!call)return;
  const incoming=call.status==='ringing'&&call.callee===me();
  bar.replaceChildren(h('span',{},message||(incoming?'Incoming voice call':pc?.connectionState==='connected'?'Connected · Voice call':'Connecting…')),
   ...(needsAudio?[h('button',{type:'button',onclick:()=>audio.play().then(()=>{needsAudio=false;render();}).catch(()=>toast('Audio ke liye browser permission check karo.','bad'))},'Enable audio')]:[]),
   ...(incoming?[h('button',{type:'button',onclick:accept,disabled:starting},starting?'Opening mic…':'Accept'),h('button',{type:'button',onclick:()=>end('declined')},'Decline')]:[
    h('button',{type:'button',onclick:()=>{muted=!muted;stream?.getAudioTracks().forEach(t=>t.enabled=!muted);render(muted?'Mic muted':undefined);}},muted?'Unmute':'Mute'),
    h('button',{type:'button',onclick:()=>end()},'End call')]));
 }
 function cleanup(){epoch++;pc?.close();pc=null;connecting=null;stream?.getTracks().forEach(t=>t.stop());stream=null;micPending=null;audio.pause();audio.srcObject=null;audio.volume=1;call=null;queuedIce=[];seen.clear();queue=Promise.resolve();offerSent=false;starting=false;muted=false;needsAudio=false;deadline=0;lastPoll=lastBeat=0;render();}
 async function end(status='ended'){const id=call?.id;cleanup();if(id)try{await backend.setCall(id,status);}catch{}}
 function fail(error){toast(error?.name==='NotAllowedError'?'Microphone permission allow karo, phir call karo.':error?.message||'Voice connection failed.','bad',6500);void end();}
 async function mic(){
  if(stream)return stream;if(micPending)return micPending;
  if(!Peer||!media?.getUserMedia)throw new Error('Voice ke liye HTTPS ya localhost aur microphone support chahiye.');
  const ticket=epoch;
  micPending=media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false}).then(local=>{if(ticket!==epoch){local.getTracks().forEach(t=>t.stop());throw new Error('Call cancelled.');}stream=local;return local;}).finally(()=>{if(ticket===epoch)micPending=null;});return micPending;
 }
 async function connection(){
  if(connecting)return connecting;if(pc)return pc;
  const ticket=epoch,id=call?.id;
  connecting=(async()=>{
   if(!stream)throw new Error('Accept call aur microphone allow karo.');
   const ice=await voiceIce(backend);if(ticket!==epoch||call?.id!==id)throw new Error('Call cancelled.');relay=hasTurn(ice);
   const peer=new Peer({iceServers:ice});pc=peer;
   stream.getTracks().forEach(t=>peer.addTrack(t,stream));
   peer.ontrack=e=>{if(peer!==pc)return;audio.srcObject=e.streams?.[0]||new MediaStream([e.track]);audio.volume=1;audio.play().catch(()=>{needsAudio=true;render('Enable audio tap karo');});};
   peer.onicecandidate=e=>{if(peer!==pc||!call||!e.candidate)return;backend.sendVoiceSignal(call.id,{type:'ice',candidate:e.candidate.toJSON?.()||e.candidate}).catch(error=>{if(peer===pc)fail(error);});};
   peer.onconnectionstatechange=()=>{if(peer!==pc)return;if(peer.connectionState==='connected'){deadline=0;render();}else if(peer.connectionState==='disconnected'){render('Network reconnecting…');deadline=Date.now()+20000;}else if(peer.connectionState==='failed')fail(new Error(relay?'Network connection failed. Dobara call try karo.':'Is network par voice relay chahiye. Server TURN setup pending hai.'));};
   return peer;
  })();try{return await connecting;}finally{if(ticket===epoch)connecting=null;}
 }
 async function signal(s){
  if(!call||call.status!=='accepted'||!stream||s.call_id!==call.id||s.sender===me()||seen.has(s.id))return;
  const ticket=epoch,p=s.payload,peer=await connection();if(ticket!==epoch)return;
  if(p.type==='ice'){if(peer.remoteDescription)await peer.addIceCandidate(p.candidate);else queuedIce.push(p.candidate);}
  else if(p.type==='offer'||p.type==='answer'){
   if(p.type==='answer'&&peer.signalingState!=='have-local-offer'){seen.add(s.id);return;}
   if(p.type==='offer'&&call.callee!==me())return;
   await peer.setRemoteDescription({type:p.type,sdp:p.sdp});
   for(const ice of queuedIce)await peer.addIceCandidate(ice);queuedIce=[];
   if(p.type==='offer'){const answer=await peer.createAnswer();await peer.setLocalDescription(answer);await backend.sendVoiceSignal(call.id,{type:'answer',sdp:peer.localDescription.sdp});}
  }
  seen.add(s.id);
 }
 function enqueue(s){const ticket=epoch;queue=queue.then(()=>ticket===epoch?signal(s):null).catch(error=>{if(ticket===epoch)fail(error);});}
 async function sync(c){
  if(!c?.id||![c.caller,c.callee].includes(me()))return;
  if(!call){if(c.status!=='ringing'||c.callee!==me()||Date.now()-Date.parse(c.created_at)>45000)return;call=c;deadline=Date.now()+45000;render('Incoming voice call');
   try{const other=await backend.getProfile(c.caller);if(call?.id===c.id&&call.status==='ringing')render(`${other?.name||'Player'} is calling`);}catch{}return;
  }
  if(c.id!==call.id)return;call=c;
  if(['ended','declined'].includes(c.status)){toast(c.status==='declined'?'Call declined.':'Call ended.');cleanup();return;}
  if(c.status==='accepted'&&c.caller===me()&&!offerSent){offerSent=true;render('Connecting…');deadline=Date.now()+35000;
   const ticket=epoch;await mic();const peer=await connection();if(ticket!==epoch)return;
   const offer=await peer.createOffer();await peer.setLocalDescription(offer);await backend.sendVoiceSignal(call.id,{type:'offer',sdp:peer.localDescription.sdp});
  }
 }
 async function accept(){if(starting||!call)return;if(app.voiceRoom?.room)return toast('Pehle table voice se leave karo.');starting=true;render();const id=call.id,ticket=epoch;
  try{await mic();if(ticket!==epoch||call?.id!==id)return;await connection();const accepted=await backend.setCall(id,'accepted');if(ticket!==epoch)return;await sync(accepted);deadline=Date.now()+35000;render('Connecting…');for(const s of await backend.voiceSignals(id))enqueue(s);}
  catch(error){if(ticket===epoch)fail(error);}finally{if(ticket===epoch){starting=false;render();}}
 }
 backend.onCall(c=>{const ticket=epoch;sync(c).catch(error=>{if(ticket===epoch)fail(error);});});backend.onVoiceSignal(enqueue);
 async function poll(){
  if(polling||!me()||document.hidden&&!call)return;polling=true;const ticket=epoch;
  try{
   if(call&&![call.caller,call.callee].includes(me()))return end();
   if(!call){if(Date.now()-lastPoll<5000)return;lastPoll=Date.now();const c=await backend.incomingCall?.();if(ticket===epoch)await sync(c);return;}
   const id=call.id;if(deadline&&Date.now()>deadline)return fail(new Error(call.status==='ringing'?'Call ka jawab nahi aaya.':relay?'Call connect nahi hui. Dobara try karo.':'Voice connect nahi hui. Mobile networks ke liye TURN relay configure karna baki hai.'));
   const interval=pc?.connectionState==='connected'?5000:1500;if(Date.now()-lastPoll<interval)return;lastPoll=Date.now();
   const c=await backend.getCall(id);if(ticket!==epoch)return;if(!c)return end();await sync(c);
   if(call?.status==='accepted'){
    if(Date.now()-lastBeat>15000){lastBeat=Date.now();await backend.setCall(id,'accepted');}
    for(const s of await backend.voiceSignals(id))enqueue(s);
   }pollErrors=0;
  }catch(error){if(ticket===epoch&&++pollErrors>=3&&pc?.connectionState!=='connected')fail(error);}
  finally{polling=false;}
 }
 const timer=setInterval(poll,1500);window.addEventListener('pagehide',()=>{clearInterval(timer);void end();});
 return{get active(){return !!call;},async start(target){
  if(!app.requireSignIn('voice chat'))return;if(app.voiceRoom?.room)return toast('Pehle table voice se leave karo.');if(call||starting)return toast('Pehle current call finish karo.');if(!target?.id||target.id===me())return;
  starting=true;const ticket=epoch;try{await mic();const c=await backend.startCall(target.id);if(ticket!==epoch){await backend.setCall(c.id,'ended');return;}call=c;deadline=Date.now()+45000;render(`Calling ${target.name||'Player'}…`);lastPoll=0;void poll();}catch(error){if(ticket===epoch)fail(error);}finally{if(ticket===epoch)starting=false;}
 },updateDistance(){audio.volume=1;},end};
}
