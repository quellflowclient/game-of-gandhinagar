import assert from 'node:assert/strict';
// Resource/consent checks without real microphones, accounts, or network calls.
class Element {
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.attrs={};this.style={};this.classList={add(){},toggle(){}};}
 append(...items){this.children.push(...items);}replaceChildren(...items){this.children=items;}
 setAttribute(k,v){this.attrs[k]=v;}addEventListener(k,fn){this.listeners[k]=fn;}remove(){}
 pause(){this.paused=true;}play(){this.paused=false;return Promise.resolve();}
}
globalThis.Node=Element;const body=new Element();
globalThis.document={body,createElement:tag=>new Element(tag),createTextNode:t=>Object.assign(new Element('text'),{text:t}),getElementById:()=>new Element()};
globalThis.window={addEventListener(){}};
const originalTimeout=globalThis.setTimeout,originalInterval=globalThis.setInterval;
globalThis.setTimeout=globalThis.setInterval=()=>0;
const {createVoice}=await import('../src/systems/voice.js');
let micCount=0,stopped=0,closed=0,callHandler;
const track={enabled:true,stop(){stopped++;}},media={async getUserMedia(){micCount++;return{getTracks:()=>[track],getAudioTracks:()=>[track]};}};
class Peer{addTrack(){}close(){closed++;}async createOffer(){return{type:'offer',sdp:'QA'};}async setLocalDescription(x){this.localDescription=x;}async setRemoteDescription(x){this.remoteDescription=x;}async addIceCandidate(){}async createAnswer(){return{type:'answer',sdp:'QA'};}}
const call={id:'qa-call',caller:'me',callee:'other',status:'ringing',created_at:new Date().toISOString()};
const backend={startCall:async()=>({...call}),setCall:async(id,status)=>({...call,id,status}),onCall(fn){callHandler=fn;},onVoiceSignal(){},getProfile:async()=>({name:'Other'}),voiceSignals:async()=>[],sendVoiceSignal:async()=>{}};
const app={backend,session:{userId:'me'},requireSignIn:()=>true};
const voice=createVoice(app,{Peer,media});assert.equal(micCount,0,'loading game must not open a microphone');
await voice.start({id:'other',name:'Other'});assert(voice.active);assert.equal(micCount,1);
await voice.end();assert(!voice.active);assert.equal(stopped,1,'end must stop every local audio track');
await callHandler({...call,caller:'other',callee:'me'});await Promise.resolve();assert.equal(micCount,1,'incoming ring must not open microphone');
await voice.end('declined');assert.equal(micCount,1,'decline must not open microphone');
await voice.start({id:'other',name:'Other'});await callHandler({...call,status:'accepted'});await new Promise(resolve=>setImmediate(resolve));
await voice.end();assert.equal(stopped,2);assert(closed>0,'end must close the peer connection');
app.requireSignIn=()=>false;await voice.start({id:'other'});assert.equal(micCount,2,'visitor cannot start voice call');
globalThis.setTimeout=originalTimeout;globalThis.setInterval=originalInterval;
console.log('Voice consent/resources passed: no automatic microphone, caller opt-in, no microphone for ring/decline, tracks and peer closed on hangup, visitor blocked.');
