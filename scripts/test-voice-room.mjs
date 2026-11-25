import assert from 'node:assert/strict';
// Group (tapri circle) voice: 4 people in one room must form 6 links, one offer per pair,
// with no microphone before joining and every track/link closed on leave.
class Element{constructor(){this.children=[];}append(...c){this.children.push(...c);}replaceChildren(...c){this.children=c;}setAttribute(){}addEventListener(){}remove(){}}
globalThis.Node=Element;globalThis.document={body:new Element(),createElement:()=>new Element(),createTextNode:t=>t,getElementById:()=>new Element()};
const {createVoiceRoom}=await import('../src/systems/voice-room.js');
const flush=async()=>{for(let i=0;i<40;i++)await new Promise(r=>setImmediate(r));};
const hub=new Map();let offers=0,micOpened=0,stopped=0;
function backendFor(){return{accessToken:async()=>null,voiceRoom(room,who,{onPeers,onSignal}){
  if(!hub.has(room))hub.set(room,new Map());const members=hub.get(room);members.set(who.userId,{onPeers,onSignal});
  const sync=()=>{const ids=[...members.keys()];for(const m of members.values())m.onPeers(ids);};queueMicrotask(sync);
  return{send(p){if(p.type==='offer')offers++;const m=members.get(p.to);if(m)queueMicrotask(()=>m.onSignal(p));},leave(){members.delete(who.userId);sync();}};}};}
class Peer{constructor(){this.connectionState='new';this.signalingState='stable';this.remoteDescription=null;}
  addTrack(){}close(){this.connectionState='closed';}
  async createOffer(){return{type:'offer',sdp:'o'};}async createAnswer(){return{type:'answer',sdp:'a'};}
  async setLocalDescription(d){this.localDescription=d;if(d.type==='offer')this.signalingState='have-local-offer';else{this.signalingState='stable';this.up();}}
  async setRemoteDescription(d){this.remoteDescription=d;if(d.type==='answer'){this.signalingState='stable';this.up();}else this.signalingState='have-remote-offer';}
  up(){this.connectionState='connected';this.onconnectionstatechange?.();}
  async addIceCandidate(){}}
const media={async getUserMedia(){micOpened++;const t={enabled:true,stop(){stopped++;}};return{getTracks:()=>[t],getAudioTracks:()=>[t]};}};
const people=['a','b','c','d'].map(id=>{const app={backend:backendFor(),session:{userId:id},requireSignIn:()=>true,me:{name:id}};return{id,room:createVoiceRoom(app,{Peer,media,mount:false})};});
assert.equal(micOpened,0,'no microphone before joining');
for(const p of people){assert.ok(await p.room.join('table-masi-circle-0','Masi table'));await flush();}
await flush();
assert.equal(micOpened,4);assert.equal(offers,6,'exactly one offer per pair');
for(const p of people){assert.equal(p.room.members.length,4);assert.equal(p.room.peers.size,3);for(const e of p.room.peers.values())assert.equal(e.pc.connectionState,'connected');}
people[3].room.toggleMute();assert.ok(people[3].room.muted);
await people[3].room.leave(true);await flush();
assert.equal(stopped,1);for(const p of people.slice(0,3))assert.equal(p.room.peers.size,2,'others drop the person who left');
const late={backend:backendFor(),session:{userId:'e'},requireSignIn:()=>true,me:{name:'e'}};const e=createVoiceRoom(late,{Peer,media,mount:false});
await e.join('table-masi-circle-0');await flush();
for(const p of [...people.slice(0,3),{room:e}])assert.equal(p.room.peers.size,3,'late joiner connects to everyone');
for(const p of [...people.slice(0,3),{room:e}])await p.room.leave(true);
assert.equal(stopped,5,'every microphone track stopped');
console.log(`Table voice passed: 4-person circle formed 6 connected links with one offer per pair, mute, leave cleanup and late joiner (${offers} offers total).`);
process.exit(0);
