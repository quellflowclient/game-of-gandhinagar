import assert from 'node:assert/strict';

// Exercise the real account UI and demo persistence without email delivery or WebGL.
class Element{
 constructor(tag='div',text=''){this.tag=tag;this.children=[];this.listeners={};this.attrs={};this.value='';this.checked=false;this.disabled=false;this.text=text;this.isConnected=true;this.classes=new Set();this.classList={add:v=>this.classes.add(v),remove:v=>this.classes.delete(v),contains:v=>this.classes.has(v)};}
 setAttribute(k,v){this.attrs[k]=v;if(k==='class')this.classes=new Set(v.split(' '));if(k==='value')this.value=v;}
 set className(v){this.classes=new Set(v.split(' '));}get className(){return [...this.classes].join(' ');}
 append(...nodes){for(const n of nodes){this.children.push(n);if(n instanceof Element)n.parent=this;}}
 replaceChildren(...nodes){this.children=[];this.text='';this.append(...nodes);}
 get textContent(){return this.text+this.children.map(n=>n.textContent??n).join('');}set textContent(v){this.text=String(v);this.children=[];}
 addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
 emit(k,extra={}){for(const fn of this.listeners[k]||[])fn({preventDefault(){},stopPropagation(){},target:this,...extra});}
 focus(){document.activeElement=this;}select(){this.focus();}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(n=>n!==this);this.isConnected=false;}
 querySelectorAll(selector){return descendants(this).filter(n=>selector.startsWith('.')?n.classes.has(selector.slice(1)):n.tag===selector);}
 querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
const descendants=root=>root.children.flatMap(n=>n instanceof Element?[n,...descendants(n)]:[]);
const body=new Element('body');
globalThis.Node=Element;globalThis.document={body,activeElement:null,createElement:t=>new Element(t),createTextNode:t=>new Element('#text',String(t)),getElementById:id=>descendants(body).find(n=>n.attrs.id===id)||null};
const memory=()=>{const data=new Map();return{getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,String(v)),removeItem:k=>data.delete(k)};};
Object.assign(globalThis,{localStorage:memory(),sessionStorage:memory(),BroadcastChannel:undefined});
const intervals=new Map();let serial=0;const saved={setInterval,clearInterval,setTimeout,clearTimeout};
globalThis.setInterval=fn=>{intervals.set(++serial,fn);return serial;};globalThis.clearInterval=id=>intervals.delete(id);globalThis.setTimeout=()=>++serial;globalThis.clearTimeout=()=>{};
const {openSignUp,openSignIn}=await import('../src/ui/auth.js');
const {closePanel}=await import('../src/ui/dom.js');
const {local}=await import('../src/backend/local.js');
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const all=()=>descendants(body),button=text=>all().find(n=>n.tag==='button'&&n.textContent===text),field=label=>all().find(n=>n.attrs['aria-label']===label),form=()=>all().find(n=>n.tag==='form');
let ready=0,verifications=0;const requests=[],backend={mode:'demo',async signInWithOtp(email,options){requests.push({email,options});return local.signInWithOtp(email,options);},verifyOtp(...args){verifications++;return local.verifyOtp(...args);}};
const app={backend,async onSignedIn(){ready++;app.session=await local.getSession();}};
await assert.rejects(local.signInWithOtp('new@example.com'),/Sign up/);
openSignUp(app);field('Email address').value=' New@Example.com ';
form().emit('submit');await settle();assert.equal(requests.length,0,'signup requires age and terms confirmation');
const checks=all().filter(n=>n.attrs.type==='checkbox');checks.forEach(n=>n.checked=true);
form().emit('submit');form().emit('submit');await settle();assert.equal(requests.length,1,'duplicate send is suppressed');assert.equal(requests[0].email,'new@example.com');assert.equal(requests[0].options.createUser,true);
assert.equal(intervals.size,1);assert(field('6-digit code'));assert(button('Verify and continue'));
const db=()=>JSON.parse(localStorage.getItem('gnr-db-v1'));
const correct=db().otps['new@example.com'].code;
assert.match(correct,/^\d{6}$/,'new demo emails use exactly six digits');
assert.equal(field('6-digit code').attrs.maxlength,6);assert.equal(field('6-digit code').attrs.minlength,6);
let pasteBlocked=false;field('6-digit code').emit('paste',{clipboardData:{getData:()=>correct+'12'},preventDefault(){pasteBlocked=true;}});await settle();assert(pasteBlocked);assert.equal(field('6-digit code').value,'');assert.equal(verifications,0,'an old eight-digit code cannot be truncated and auto-submitted');
await assert.rejects(local.verifyOtp('new@example.com',correct+'12'),/6-digit/);assert.equal(await local.getSession(),null);
field('6-digit code').value=correct+'12';field('6-digit code').emit('input');await settle();assert.equal(verifications,0,'overlong autofill cannot auto-submit a partial code');assert.equal(field('6-digit code').value,'');
field('6-digit code').value=correct==='000000'?'111111':'000000';form().emit('submit');await settle();assert.equal(ready,0,'invalid OTP cannot create a session');assert.equal(await local.getSession(),null);
field('6-digit code').value=correct;field('6-digit code').emit('input');form().emit('submit');await settle();assert.equal(ready,1,'auto-submit and Enter cannot verify twice');assert(app.session.userId);assert.equal(intervals.size,0,'successful verification stops the resend timer');
await local.saveProfile({name:'Test Resident',look:'fcasual',skin:0xc58c63});const id=app.session.userId;await local.signOut();
openSignIn(app);field('Email address').value='new@example.com';assert.equal(all().filter(n=>n.attrs.type==='checkbox').length,0,'returning users do not repeat signup consent');form().emit('submit');await settle();assert.equal(requests.at(-1).options.createUser,false);
field('6-digit code').value=db().otps['new@example.com'].code;form().emit('submit');await settle();assert.equal(app.session.userId,id,'sign-in returns to the same account');assert.equal((await local.getMyProfile()).look,'fcasual','sign-in preserves the saved character');
openSignUp(app);field('Email address').value='other@example.com';button('Sign in').emit('click');assert.equal(field('Email address').value,'other@example.com','switching modes preserves the email');assert(button('Send sign-in code'));button('Sign up').emit('click');assert(button('Send verification code'));
all().filter(n=>n.attrs.type==='checkbox').forEach(n=>n.checked=true);form().emit('submit');await settle();assert.equal(intervals.size,1);button('Change email').emit('click');assert.equal(intervals.size,0,'changing email cleans up the old resend timer');
let finish;const pendingApp={backend:{signInWithOtp:()=>new Promise(r=>finish=r)},onSignedIn(){throw Error('Closed panel must not finish auth');}};
openSignIn(pendingApp);field('Email address').value='new@example.com';form().emit('submit');closePanel();finish({sent:true});await settle();assert.equal(form(),undefined,'a late response cannot reopen a dismissed auth panel');assert.equal(intervals.size,0);
Object.assign(globalThis,saved);
console.log('Account access passed: explicit signup/signin, age/terms, email normalization, duplicate request guards, wrong-code rejection, new account verification, existing character persistence, mode switching and closed-panel/timer cleanup.');
