import assert from 'node:assert/strict';
class Element{
 constructor(tag='div'){this.tag=tag;this.children=[];this.listeners={};this.dataset={};this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),contains:v=>this.classes.has(v),toggle:(v,on)=>on?this.classes.add(v):this.classes.delete(v)};}
 append(...children){this.children.push(...children);}setAttribute(key,value){this[key]=value;}
 addEventListener(name,fn){(this.listeners[name]??=[]).push(fn);}
 setPointerCapture(){}
 emit(type,props={}){for(const fn of this.listeners[type]||[])fn({type,preventDefault(){},stopPropagation(){},...props});}
}
const window=new Element(),document=new Element();
document.body=new Element();document.hidden=false;document.getElementById=()=>null;
document.querySelector=()=>null;document.createElement=tag=>new Element(tag);document.createTextNode=text=>text;
Object.assign(globalThis,{window,document,Node:Element});
const {createGameControls}=await import('../src/ui/game-controls.js');
let input={},resets=0;const player={vehicle:'car',setDriveInput(value){input={...value};},resetInput(){resets++;}};
const hud={root:new Element(),menuOpen:false};const controls=createGameControls({player,hud});controls.update();
const drive=hud.root.children[0],left=drive.children[0].children[0],right=drive.children[0].children[1],brake=drive.children[1].children[0],race=drive.children[1].children[1];
left.emit('pointerdown',{pointerId:1,button:0});race.emit('pointerdown',{pointerId:2,button:0});
assert.equal(input.steer,-1);assert.equal(input.throttle,1,'two thumbs steer and accelerate together');
left.emit('pointerup',{pointerId:1});assert.equal(input.steer,0);assert.equal(input.throttle,1,'releasing steering retains the other thumb');
brake.emit('pointerdown',{pointerId:3,button:0});assert.equal(input.brake,1);assert.equal(input.throttle,1);
race.emit('lostpointercapture',{pointerId:2});assert.equal(input.throttle,0);assert.equal(input.brake,1);
brake.emit('pointercancel',{pointerId:3});assert.equal(input.brake,0);
right.emit('pointerdown',{pointerId:4,button:0});window.emit('blur');assert.equal(input.steer,0);
race.emit('pointerdown',{pointerId:5,button:0});document.hidden=true;document.emit('visibilitychange');assert.equal(input.throttle,0);
document.hidden=false;race.emit('pointerdown',{pointerId:6,button:0});hud.menuOpen=true;controls.update();assert.equal(input.throttle,0);assert(drive.hidden);
race.emit('pointerdown',{pointerId:7,button:0});assert.equal(input.throttle,0,'a menu cannot leave a pedal held');
hud.menuOpen=false;controls.update();player.vehicle='walk';controls.update();assert(drive.hidden);assert(resets>0);
console.log('Touch controls passed: two-thumb steering/pedals, independent release, cancelled capture, blur/background reset, menu lock and vehicle exit.');
