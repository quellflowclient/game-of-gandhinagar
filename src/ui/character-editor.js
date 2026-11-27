import * as THREE from 'three';
import {h} from './dom.js';
import {lookById,encodeLook,SKIN_TONES} from '../data/content.js';
import {createAvatar} from '../world/avatar.js';
import './character-editor.css';

const CLOTH=[0x294c64,0x355c48,0x73434c,0xb48b56,0xd8d4c4,0x313740,0x839cb1,0x9d7c9d,0xc29d80,0x547e80,0x914d37,0xaeb88d];
const HAIR=[0x17130f,0x37261b,0x68452b,0x947359,0x77766f];
const STYLE={male:[['casual','Casual'],['hoodie','Shirt'],['business','Formal']],female:[['fcasual','Casual'],['adventurer','Shirt'],['jacket','Formal']]};
export function createCharacterEditor(app,profile,onChange=()=>{}){
 let look=lookById(profile.look),skin=profile.skin??SKIN_TONES[1],gender=look.long?'female':'male',mounted=false,disposed=false,avatar=null,angle=.08,frame=0,last=0;
 const host=h('div',{class:'character-stage','aria-label':'Your realistic 3D character preview'}),options=h('div',{class:'character-options'});
 const node=h('div',{class:'character-editor'},host,h('p',{class:'character-preview-note'},'Drag your character to turn around.'),options);
 const studio=new THREE.Scene();studio.background=new THREE.Color('#e8eee5');
 studio.add(new THREE.HemisphereLight(0xffffff,0x65715d,2.2));const light=new THREE.DirectionalLight(0xffedda,2.6);light.position.set(3,5,4);studio.add(light);const rim=new THREE.DirectionalLight(0xc7deff,1.2);rim.position.set(-3,3,-2);studio.add(rim);
 const camera=new THREE.PerspectiveCamera(31,1,.1,20);camera.position.set(0,1,4.1);camera.lookAt(0,.9,0);
 const renderer=app.renderer,canvas=renderer.domElement,parent=canvas.parentElement;
 const original={ratio:renderer.getPixelRatio(),shadow:renderer.shadowMap.enabled,width:canvas.style.width,height:canvas.style.height};
 const hex=n=>'#'+n.toString(16).padStart(6,'0');
 const emit=()=>{profile.look=encodeLook(look.id,look);profile.skin=skin;onChange({look:profile.look,skin});};
 function rebuild(){if(avatar){studio.remove(avatar.root);avatar.dispose();}avatar=createAvatar(encodeLook(look.id,look),skin);avatar.root.rotation.y=angle;studio.add(avatar.root);}
 function choose(change){change();emit();if(mounted)rebuild();paint();}
 function palette(label,key,colors,value,change){return h('fieldset',{class:'character-palette'},h('legend',{},label),h('div',{class:'character-swatches'},colors.map((color,i)=>h('button',{type:'button',class:'character-color',style:{'--tone':hex(color)},'aria-label':`${label} ${i+1}`,'aria-pressed':String(value===color),onclick:()=>choose(()=>change(color))},h('span',{'aria-hidden':'true'},'✓')))));}
 function paint(){const formal=['business','suit','jacket','dress'].includes(look.id);options.replaceChildren(...[
  h('fieldset',{class:'character-choice'},h('legend',{},'Character'),h('div',{class:'character-choice-row'},[['male','Male'],['female','Female']].map(([g,label])=>h('button',{type:'button','aria-pressed':String(gender===g),onclick:()=>choose(()=>{gender=g;look={...lookById(STYLE[g][0][0]),top:look.top,bottom:look.bottom,hair:look.hair,shoes:look.shoes};})},label)))),
  h('fieldset',{class:'character-choice'},h('legend',{},'Outfit'),h('div',{class:'character-choice-row'},STYLE[gender].map(([id,label])=>h('button',{type:'button','aria-pressed':String(look.id===id),onclick:()=>choose(()=>{look={...lookById(id),top:look.top,bottom:look.bottom,hair:look.hair,shoes:look.shoes};})},label)))),
  palette('Skin tone','skin',SKIN_TONES,skin,color=>skin=color),
  palette(formal?'Outfit colour':'Top colour','top',CLOTH,look.top,color=>look.top=color),
  !formal?palette('Trousers colour','bottom',CLOTH,look.bottom,color=>look.bottom=color):null,
  palette('Hair colour','hair',HAIR,look.hair,color=>look.hair=color),
  palette('Shoes colour','shoes',[0x292e30,0x5a4534,0xb3b4a8,0x36424c],look.shoes??0x292e30,color=>look.shoes=color)].filter(Boolean));}
 let drag=null;const down=e=>{drag={id:e.pointerId,x:e.clientX,angle};host.setPointerCapture(e.pointerId);};const move=e=>{if(drag?.id===e.pointerId)angle=drag.angle+(e.clientX-drag.x)*.012;};const up=()=>{drag=null;};
 function draw(stamp){if(disposed||!mounted)return;frame=requestAnimationFrame(draw);if(document.hidden||stamp-last<1000/24)return;const dt=last?Math.min(.05,(stamp-last)/1000):0;last=stamp;const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;const ratio=renderer.getPixelRatio();if(canvas.width!==Math.floor(w*ratio)||canvas.height!==Math.floor(h*ratio))renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();avatar.root.rotation.y=angle;avatar.update(dt,0);renderer.render(studio,camera);host.dataset.look=profile.look;host.dataset.gender=gender;}
 paint();emit();
 return{node,mount(){if(mounted||disposed)return;mounted=true;renderer.shadowMap.enabled=false;renderer.setPixelRatio(Math.min(devicePixelRatio||1,app.lowEnd?1:1.5));host.append(canvas);host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('lostpointercapture',up);rebuild();frame=requestAnimationFrame(draw);},dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);host.removeEventListener('lostpointercapture',up);if(mounted){parent.append(canvas);canvas.style.width=original.width;canvas.style.height=original.height;renderer.setPixelRatio(original.ratio);renderer.shadowMap.enabled=original.shadow;renderer.setSize(innerWidth,innerHeight);}if(avatar){studio.remove(avatar.root);avatar.dispose();}studio.clear();}};
}
