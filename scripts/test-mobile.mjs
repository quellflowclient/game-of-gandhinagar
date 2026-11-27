import assert from 'node:assert/strict';
import {browserProblem} from '../src/browser-support.js';
import {withDeadline,timeoutSignal} from '../src/systems/network.js';
import {hdPixelRatio,createAdaptiveQuality} from '../src/world/render-quality.js';

const supported={WebGL2RenderingContext:class{},structuredClone,Array,Object,HTMLDialogElement:{prototype:{showModal(){}}}};
assert.equal(browserProblem(supported),null);
assert.match(browserProblem({...supported,WebGL2RenderingContext:undefined}),/3D city/);
assert.match(browserProblem({...supported,structuredClone:undefined}),/Update your browser/);
assert.match(browserProblem({...supported,HTMLDialogElement:undefined}),/Update your browser/);
assert.equal(await withDeadline(async()=>42,100),42);
await assert.rejects(withDeadline(async()=>{throw new Error('Bad model');},100),/Bad model/);
let aborted=false;
await assert.rejects(withDeadline(signal=>new Promise(()=>{signal.addEventListener('abort',()=>{aborted=true;});}),8),/Loading took too long/);
assert(aborted,'timeout aborts supported network requests and settles ignored requests');
const timeout=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
try{
 Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined});
 const fallback=timeoutSignal(8);assert(!fallback.aborted);
 await new Promise(resolve=>fallback.addEventListener('abort',resolve,{once:true}));assert(fallback.aborted);
}finally{Object.defineProperty(AbortSignal,'timeout',timeout);}

for(const phone of [false,true]){
 const q=createAdaptiveQuality(phone),sample=(count,ms)=>{for(let i=0;i<count;i++)q.sample(ms);};
 sample(1,1000);sample(119,4);assert.equal(q.scale,1,'one shader compile does not blur the game');
 sample(120,80);assert.equal(q.scale,.85,'sustained expensive rendering lowers the buffer');
 sample(1200,80);assert.equal(q.scale,.65,'quality has a bounded floor');
 sample(240,1);assert.equal(q.scale,.65,'recovery waits for sustained headroom');
 sample(120,1);assert.equal(q.scale,.7,'recovery is gradual');
 sample(120,80);q.reset();sample(119,80);assert.equal(q.scale,.65,'pauses clear sampling history');
 for(const [w,h,dpr] of [[320,568,2],[360,800,3],[390,844,3],[844,390,3],[768,1024,2]]){
  const ratio=Math.max(.5,hdPixelRatio(w,h,dpr,phone)*q.scale);
  assert(Number.isFinite(ratio)&&ratio>=.5);assert(w*h*ratio**2<=(phone?1200001:2200001));
 }
}
console.log('Mobile passed: capability recovery, bounded startup requests, mobile timeout fallback, sustained-load render scaling, gradual recovery and portrait/landscape buffer limits.');
