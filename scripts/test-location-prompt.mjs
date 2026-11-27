import assert from 'node:assert/strict';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.classList={contains:()=>false};}
 append(...children){for(const c of children){this.children.push(c);if(c instanceof Element)c.parent=this;}}
 setAttribute(key,value){this[key]=value;}addEventListener(name,fn){this.listeners[name]=fn;}
 focus(){}remove(){this.parent.children=this.parent.children.filter(c=>c!==this);}
}
let blocked=true,hidden=false,watched=0;
const timers=new Map();let next=0;
const originalTimeout=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
globalThis.setTimeout=fn=>{timers.set(++next,fn);return next;};globalThis.clearTimeout=id=>timers.delete(id);
globalThis.Node=Element;globalThis.window={isSecureContext:true};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{permissions:{query:async()=>({state:'prompt'})},geolocation:{watchPosition(){watched++;return 1;},clearWatch(){}}}});
globalThis.localStorage={getItem:()=>null,setItem(){}};
const body=new Element();globalThis.document={body,head:new Element(),get hidden(){return hidden;},getElementById:()=>null,querySelector:()=>blocked?{}:null,createElement:tag=>new Element(tag),createTextNode:t=>t};
const {createLocationSharing}=await import('../src/systems/location.js');
const sharing=createLocationSharing({backend:{},isSignedIn:()=>false,toast(){}});
const tick=async()=>{const pending=[...timers];timers.clear();for(const [,fn]of pending)await fn();};
const prompts=()=>body.children.filter(e=>e.className==='loc-ask');
sharing.begin();sharing.begin();assert.equal(timers.size,1,'startup schedules only one permission question');
await tick();await tick();assert.equal(prompts().length,0,'mission/form stays unobstructed');assert.equal(watched,0);
blocked=false;hidden=true;await tick();assert.equal(prompts().length,0,'background tabs do not show a new question');
hidden=false;await tick();assert.equal(prompts().length,1,'question appears when the screen is free');
const skip=()=>prompts()[0].children[0].children.at(-1).children[0].listeners.click();
skip();assert.equal(prompts().length,0);await tick();assert.equal(prompts().length,1,'deferring did not consume the second question');
skip();await tick();assert.equal(prompts().length,0,'at most two questions per visit');assert.equal(watched,0,'skipping never starts GPS');
globalThis.setTimeout=originalTimeout;globalThis.clearTimeout=originalClear;
console.log('Location prompt passed: one startup timer, no overlap with mission/form or hidden page, deferred retry retains allowance, two-question limit and no GPS without opt-in.');
