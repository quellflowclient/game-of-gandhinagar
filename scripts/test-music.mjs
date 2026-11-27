import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Exercise media lifecycle without speakers, network, or browser autoplay permissions.
const script=readFileSync(new URL('../public/audio/theme-player.js',import.meta.url),'utf8');
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function createPlayer(){
 const timers=new Map();let timerId=0;
 class Element{
  constructor(){this.listeners={};this.dataset={};this.hidden=true;this.open=false;}
  addEventListener(type,fn){(this.listeners[type]??=[]).push(fn);}
  dispatchEvent(event){for(const fn of this.listeners[event.type]||[])fn(event);}
  emit(type){this.dispatchEvent({type,isTrusted:true,preventDefault(){}});}
  setAttribute(){}showModal(){this.open=true;}close(){this.open=false;}
 }
 class Audio extends Element{
  constructor(){super();this.paused=true;this.currentTime=0;this.duration=187;this.loop=true;this.volume=1;this.loads=[];this.rejectNext=false;}
  load(){this.currentTime=0;this.error=null;this.loads.push(this.src);this.emit('loadedmetadata');}
  play(){if(this.rejectNext){this.rejectNext=false;return Promise.reject(new Error('Autoplay blocked'));}this.paused=false;this.emit('playing');return Promise.resolve();}
  pause(){this.paused=true;}
  end(){this.currentTime=this.duration;this.paused=true;this.ended=true;this.emit('ended');}
 }
 const ids=['gog-theme','music-choice','music-mute','music-enable','music-title','music-description','music-yes','music-no'];
 const elements=Object.fromEntries(ids.map(id=>[id,id==='gog-theme'?new Audio():new Element()]));
 const document=new Element(),window=new Element();
 document.hidden=false;document.getElementById=id=>elements[id];
 vm.runInNewContext(script,{window,document,navigator:{userAgent:'Desktop',platform:'Win32',maxTouchPoints:0},Event:class{constructor(type){this.type=type;}},setTimeout(fn){const id=++timerId;timers.set(id,fn);return id;},clearTimeout(id){timers.delete(id);}});
 window.gogMusic.configure({general:'/audio/general.mp3',campus:'/audio/campus.mp3',prompt:'Music?',description:'Choose',yes:'Yes',no:'No'});
 const audio=elements['gog-theme'],music=window.gogMusic;
 return {audio,music,elements,document,window,
  enter(place='gift',extra={}){music.update({entered:true,place,vehicle:'walk',inside:false,...extra});},
  async flush(){for(const [id,fn] of [...timers]){timers.delete(id);fn();}await settle();},
  async choose(on=true){elements[on?'music-yes':'music-no'].emit('click');await settle();},
 };
}
const isGift=audio=>audio.src.startsWith('/audio/gift-city-entry.mp3');

const p=createPlayer();
assert(p.audio.paused,'no playback before music choice');
await p.choose();p.audio.currentTime=42;
p.enter();await p.flush();
assert(isGift(p.audio),'entry selects supplied MP3');assert(!p.audio.paused);assert(!p.audio.loop,'entry recording must not loop');assert.equal(p.audio.volume,1);
p.audio.currentTime=12;const entryLoads=p.audio.loads.length;
p.enter('gift',{vehicle:'car'});p.enter();await p.flush();
assert.equal(p.audio.loads.length,entryLoads,'walking/vehicle changes inside GIFT must not restart recording');assert.equal(p.audio.currentTime,12);
p.music.duck(true);assert.equal(p.audio.volume,.2);p.music.duck(false);
p.audio.end();await p.flush();
assert(p.audio.src.startsWith('/audio/general.mp3'));assert(p.audio.loop);assert.equal(p.audio.currentTime,42,'background resumes its previous position');assert.equal(p.audio.volume,.25);
p.enter();await p.flush();assert(!isGift(p.audio),'completed recording stays completed during the same visit');
p.enter(null);await p.flush();p.enter();await p.flush();
assert(isGift(p.audio));assert.equal(p.audio.currentTime,0,'a new visit starts from the beginning');
p.audio.currentTime=17;p.enter('ldrp',{inside:true});await p.flush();
assert(p.audio.src.startsWith('/audio/campus.mp3'),'leaving GIFT interrupts its recording');assert(p.audio.loop);

const muted=createPlayer();await muted.choose(false);muted.enter();await muted.flush();
assert(muted.audio.paused,'No choice stays quiet even on entry');assert.equal(muted.audio.loads.length,0);
muted.elements['music-mute'].emit('click');await muted.flush();assert(isGift(muted.audio));assert(!muted.audio.paused);
muted.audio.currentTime=31;muted.music.setMaster(false);assert(muted.audio.paused);
muted.music.setMaster(true);await muted.flush();assert.equal(muted.audio.currentTime,31,'mute/resume does not restart visit');assert(!muted.audio.paused);
muted.document.hidden=true;muted.document.emit('visibilitychange');assert(muted.audio.paused);
muted.document.hidden=false;muted.document.emit('visibilitychange');await muted.flush();assert(!muted.audio.paused);assert.equal(muted.audio.currentTime,31);

const cancelled=createPlayer();await cancelled.choose();cancelled.audio.currentTime=8;
cancelled.enter();cancelled.enter('ldrp');await cancelled.flush();
assert(!isGift(cancelled.audio),'cancelled entry fade must not start obsolete recording');assert.equal(cancelled.audio.currentTime,8);assert.equal(cancelled.audio.volume,.25);
cancelled.enter();cancelled.music.setMaster(false);await cancelled.flush();
cancelled.enter('ldrp');cancelled.music.setMaster(true);await cancelled.flush();
assert(!isGift(cancelled.audio),'entry while muted must not play after leaving');

const blocked=createPlayer();await blocked.choose();blocked.audio.rejectNext=true;blocked.enter();await blocked.flush();
assert(blocked.audio.paused);assert(!blocked.elements['music-enable'].hidden,'blocked autoplay offers visible retry');
assert.match(blocked.elements['music-enable'].textContent,/GIFT City/);
blocked.elements['music-enable'].emit('click');await blocked.flush();assert(!blocked.audio.paused);assert(blocked.elements['music-enable'].hidden);
blocked.audio.error={code:2};blocked.audio.paused=true;blocked.audio.emit('error');assert(!blocked.elements['music-enable'].hidden);
blocked.elements['music-enable'].emit('click');await blocked.flush();assert(!blocked.audio.paused,'media errors can be retried');

console.log('Music passed: GIFT entry once per visit, no background overlap, completion/exit restore, consent/mute/visibility, stale transition cancellation, autoplay/error recovery.');

const eventPlayer=createPlayer();await eventPlayer.choose();eventPlayer.enter();await eventPlayer.flush();eventPlayer.audio.currentTime=16;
let eventNow=127500;const program={key:'test-concert',url:'https://example.com/show.mp3',startAt:0,endAt:3600000,clock:()=>eventNow,loop:true,volume:.8};
eventPlayer.music.setVenue(program);await eventPlayer.flush();assert.equal(eventPlayer.audio.src,program.url);assert.equal(eventPlayer.audio.currentTime,127.5);assert.equal(eventPlayer.audio.volume,.8);assert(eventPlayer.audio.loop);
eventPlayer.audio.currentTime=0;eventNow=207500;eventPlayer.music.setVenue(program);assert.equal(eventPlayer.audio.currentTime,20.5,'late join and drift align to the same shared clock');
eventPlayer.elements['music-mute'].emit('click');eventNow=217500;eventPlayer.music.setVenue(program);assert(eventPlayer.audio.paused,'event respects mute');eventPlayer.elements['music-mute'].emit('click');await eventPlayer.flush();assert.equal(eventPlayer.audio.currentTime,30.5,'unmute rejoins the current media position');
eventPlayer.music.setVenue(null);await eventPlayer.flush();assert(isGift(eventPlayer.audio));assert.equal(eventPlayer.audio.currentTime,16,'event exit restores the interrupted GIFT recording');
eventPlayer.music.setVenue({...program,key:'one-shot',loop:false});await eventPlayer.flush();eventPlayer.audio.end();eventPlayer.music.setVenue({...program,key:'one-shot',loop:false});assert(eventPlayer.audio.paused,'a completed non-looping concert track stays quiet');
eventPlayer.music.setVenue(null);eventPlayer.audio.ended=false;await eventPlayer.flush();
const quietEvent=createPlayer();await quietEvent.choose(false);quietEvent.enter();quietEvent.music.setVenue(program);await quietEvent.flush();assert(quietEvent.audio.paused);assert.equal(quietEvent.audio.loads.length,0,'event audio never bypasses consent');
console.log('Venue music passed: one audible stream, exact shared-clock offset, drift correction, consent, mute/unmute resync, interrupted recording restore and non-loop completion.');
