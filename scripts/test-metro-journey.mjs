import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){return url.endsWith('.css')?{format:'module',source:'export default {}',shortCircuit:true}:next(url,context);}});
class El{
 constructor(tag){this.tagName=tag;this.children=[];this.style={};this.attrs={};this.listeners={};this.hidden=false;this.isConnected=true;this.classList={add(){},remove(){}};}
 append(...nodes){this.children.push(...nodes);for(const n of nodes)if(n&&typeof n==='object')n.parentElement=this;}
 appendChild(n){this.append(n);return n;}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}
 addEventListener(k,v){this.listeners[k]=v;}
 focus(){document.activeElement=this;}
}
globalThis.Node=El;
globalThis.document={createElement:tag=>new El(tag),createTextNode:text=>Object.assign(new El('#text'),{textContent:text}),body:new El('body'),activeElement:new El('button')};
let now=0,reduced=false;globalThis.performance={now:()=>now};globalThis.matchMedia=()=>({matches:reduced});
const {createMetroJourney,journeyPose,JOURNEY_SECONDS}=await import('../src/world/metro-journey.js');
let lock=0,unlock=0,arrivals=0,renders=0;
const renderer={getSize:v=>v.set(1280,720),render(scene,camera){renders++;scene.updateMatrixWorld(true);assert.ok(camera.projectionMatrix.elements.every(Number.isFinite));}};
const journey=createMetroJourney(renderer,{onLock:()=>lock++,onUnlock:()=>unlock++});
assert.equal(journey.start({from:'LDRP',to:'Swarnim Park',onArrive:()=>arrivals++}),true);
assert.equal(journey.start({to:'GIFT City',onArrive:()=>arrivals+=100}),false,'Repeated clicks cannot replace an in-flight destination');
now=3900;assert.equal(journey.update(.001),true);assert.equal(arrivals,0);assert.ok(journey.active);
now=JOURNEY_SECONDS*1000+1;journey.update(.001);assert.equal(arrivals,1);assert.equal(journey.active,false);journey.finish();assert.equal(arrivals,1);assert.equal(lock,unlock);
journey.start({to:'Swagat Mall',onArrive:()=>arrivals++});journey.finish();journey.finish();assert.equal(arrivals,2);assert.equal(lock,unlock);
reduced=true;journey.start({to:'GIFT City',onArrive:()=>arrivals++});now+=500;journey.update(.001);assert.equal(journey.active,false);assert.equal(arrivals,3);
journey.start({to:'Mahatma Mandir',onArrive:()=>{throw Error('test arrival failure');}});assert.throws(()=>journey.finish(),/test arrival failure/);assert.equal(journey.active,false);assert.equal(lock,unlock,'Input always unlocks on failure');
let distance=-1;for(let t=0;t<=JOURNEY_SECONDS;t+=.01){const p=journeyPose(t);assert.ok(p.distance>=distance&&p.distance<=240);assert.ok(p.doorOpen>=0&&p.doorOpen<=1);if(p.distance>.01&&p.distance<239.99)assert.ok(p.doorOpen<.001,'Doors stay closed in motion');distance=p.distance;}
console.log(`Metro passed: smooth acceleration/braking, closed doors in motion, real-time arrival, reduced motion, skip, re-entry guard and failure cleanup (${renders} renders).`);
