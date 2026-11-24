import {h,openPanel,closePanel,toast} from './dom.js';
export function openVehicles(app,hud){
 const body=h('div',{class:'camera-menu'},h('p',{class:'muted small'},'Car / auto: joystick up = accelerate, down = brake, left / right = steer. Release to slow down. Public roads only.'));
 for(const [id,icon,name,detail] of [['walk','🚶','Walk','Explore campus and stalls'],['cycle','🚲','Cycle','Roads and designated campus paths'],['auto','🛺','Auto','0–35 km/h · public roads'],['car','🚗','Car','0–80 km/h · public roads']])body.append(h('button',{type:'button',class:'camera-choice','aria-pressed':String(app.player.vehicle===id),onclick:()=>{
   if(app.street?.service.meal?.item&&app.street.service.meal.phase!=='paid')return toast('Pehle apna order aur bill finish karo.');
   const result=app.setVehicle(id);if(result.error)return toast(result.error);hud.setVehicle(id);closePanel();toast(`${icon} ${name} selected`);
 }},h('b',{},`${icon} ${name}`),h('span',{},detail)));
 openPanel('Choose your ride',body);
}
