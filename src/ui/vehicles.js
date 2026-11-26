import {h,openPanel,closePanel,toast} from './dom.js';
export function chooseRide(app,hud,id){
 if(app.player.speedKmh>1&&app.player.vehicle!=='walk')return toast('Pehle brake laga kar gaadi roko, phir ride badlo.');
 if(app.street?.service.meal?.item&&app.street.service.meal.phase!=='paid')return toast('Pehle apna order aur bill finish karo.');
 const result=app.setVehicle(id);if(result.error)return toast(result.error);
 hud.setVehicle(id);closePanel();toast(id==='walk'?'Gaadi se utar gaye.':`${({car:'Car',auto:'Rickshaw',bike:'Bike',scooter:'Activa',cycle:'Cycle'})[id]} ready · ${['car','auto','bike','scooter'].includes(id)?'Race: aage · Brake hold: ruko, phir reverse':'Ride ready'}`);
}
export function openVehicles(app,hud){
 const body=h('div',{class:'camera-menu ride-grid'},h('p',{class:'muted small'},'Left / Right: steer · Race: forward · Brake / Reverse: stop, then reverse while held. Release to slow down. Keyboard: W forward, S brake/reverse, A/D steer, Space brake only.'));
 for(const [id,icon,name,detail] of [['walk','🚶','Walk','Explore campus and stalls'],['cycle','🚲','Cycle','Campus open grounds and paths'],['bike','🏍️','Bike','0–45 km/h · campus limit 15'],['scooter','🛵','Activa / Scooter','0–35 km/h · campus limit 15'],['auto','🛺','Auto','0–35 km/h · public roads'],['car','🚗','Car','0–80 km/h · outside parking only']])body.append(h('button',{type:'button',class:'camera-choice','aria-pressed':String(app.player.vehicle===id),onclick:()=>{
   chooseRide(app,hud,id);
 }},h('b',{},`${icon} ${name}`),h('span',{},detail)));
 openPanel('Choose your ride',body);
}
