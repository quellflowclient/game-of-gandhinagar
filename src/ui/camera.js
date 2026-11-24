import {h,openPanel} from './dom.js';
import {CAMERA_MODES} from '../world/camera-modes.js';
export function openCamera(app){
 const body=h('div',{class:'camera-menu'});
 for(const mode of CAMERA_MODES){const button=h('button',{type:'button',class:'camera-choice','aria-pressed':String(app.player.cameraMode===mode.id),onclick:()=>{app.setCamera(mode.id);for(const b of body.querySelectorAll('.camera-choice'))b.setAttribute('aria-pressed',String(b===button));range.value=String(mode.fov);value.textContent=`${mode.fov}°`;}},h('b',{},mode.name),h('span',{},mode.detail));body.append(button);}
 const value=h('b',{},`${Math.round(app.player.cameraFov)}°`),range=h('input',{type:'range',min:45,max:90,value:Math.round(app.player.cameraFov),'aria-label':'Camera field of view',oninput:()=>{app.player.setCameraFov(+range.value);value.textContent=`${range.value}°`;}});
 body.append(h('label',{class:'camera-fov'},'View width ',value,range),h('p',{class:'muted small'},'Left circle moves your character. Drag the open scene to look; use two fingers to zoom.'));
 openPanel('Camera view',body);
}
