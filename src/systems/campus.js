import * as THREE from 'three';
import {h,openPanel,closePanel,toast} from '../ui/dom.js';
import {createAvatar,bicycle} from '../world/avatar.js';
import {createVehicleModel} from '../world/vehicle-models.js';
import {createRideTwoWheeler} from '../world/parked-models.js';
import {pointIn} from '../world/sites/ldrp-reference.js';

// Virtual game ID only. No real enrollment number, document upload or phone number.
export function createCampusLife(app,campus,{scene,renderer,lowEnd=false}){
 const player=app.player,storage='ldrp-campus-life-v1',read=()=>{try{return JSON.parse(localStorage.getItem(storage)||'{}');}catch{return{};}};
 let saved=read(),identity='',parked=null,model=null,checkUntil=0,t=0,lastKey='',actorTick=0;
 const strip=h('div',{class:'campus-actions',hidden:true,'aria-label':'Campus actions'});document.body.append(strip);
 const actors=[];let guard=null,guardBubble=null,bubbleTime=0;
 function userKey(){return app.session?.userId||'visitor';}
 function persist(){saved[identity]={id:virtualId(),vehicle:parked};try{localStorage.setItem(storage,JSON.stringify(saved));}catch{}}
 function virtualId(){return saved[identity]?.id||{name:app.me?.name||'Campus Visitor',number:`SIM-${Math.floor(100000+Math.random()*900000)}`,department:'Engineering',semester:'1',role:'student',hasCard:true};}
 function say(text){toast(`Security: ${text}`);app.sound.say(text,'gu-IN');if(guard){guard.avatar.setActivity('check-id');guardBubble.textContent=text;guardBubble.hidden=false;bubbleTime=t+3;}}
 function removeModel(){if(!model)return;scene.remove(model);model.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});model=null;}
 function showParked(){removeModel();if(!parked)return;
  // Revalidate saved vehicles against the current bays after parking edits.
  // Old positions on the apron/driveway must not reappear after a reload.
  const lot=campus.parking.find(l=>l.id===parked.lot);
  const valid=lot?.slots.find(s=>!s.occupied&&Math.hypot(s.x-parked.x,s.z-parked.z)<.2);
  if(!valid){const slot=lot?.slots.find(s=>!s.occupied);if(slot){Object.assign(parked,{x:slot.x,y:slot.y,z:slot.z,yaw:slot.yaw,slot:slot.id});persist();}else{parked=null;persist();return;}}
  if(['bike','scooter'].includes(parked.type))model=createRideTwoWheeler(parked.type);
  else if(parked.type==='cycle')model=bicycle();
  else{model=new THREE.Group();const m=createVehicleModel(parked.type==='auto'?'auto':'premium');for(const p of m.parts){const mesh=new THREE.Mesh(p.geometry,p.material);if(p.paint)p.material.color.setHex(0x718884);mesh.castShadow=mesh.receiveShadow=true;model.add(mesh);}}
  model.position.set(parked.x,parked.y,parked.z);model.rotation.y=parked.yaw;scene.add(model);
 }
 function nearbyLot(){const p=player.position;return campus.parking.map(lot=>({lot,d:Math.min(Infinity,...lot.slots.map(s=>Math.hypot(s.x-p.x,s.z-p.z)))})).sort((a,b)=>a.d-b.d)[0];}
 async function park(){const near=nearbyLot(),type=player.vehicle;if(!near||near.d>12)return toast('Parking ke paas khule bay mein aao.');
  if(near.lot.inside&&!['bike','scooter','cycle'].includes(type))return say('Gaadi bahar parking ma muki ne aavo.');
  if(!['bike','scooter','cycle','car','auto'].includes(type))return toast('Pehle apni vehicle lekar parking mein aao.');
  if(parked)return toast('Pehle apni parked vehicle retrieve karo.');
  const slot=near.lot.slots.filter(s=>!s.occupied).sort((a,b)=>Math.hypot(a.x-player.position.x,a.z-player.position.z)-Math.hypot(b.x-player.position.x,b.z-player.position.z))[0];
  if(!slot||Math.hypot(slot.x-player.position.x,slot.z-player.position.z)>12)return toast('Yahan free bay nahi hai. Agla parking bay choose karo.');
  const r=app.setVehicle('walk');if(r.error)return toast(r.error);
  parked={type,x:slot.x,y:slot.y,z:slot.z,yaw:slot.yaw,lot:near.lot.id,slot:slot.id,locked:true};showParked();persist();player.gesture('helmet',1.2);app.sound.chirp?.();toast('Vehicle parked aur locked. Isi browser/account par location saved.');
 }
 function retrieve(){if(!parked)return;if(parked.locked)return toast('Pehle vehicle unlock karo.');if(Math.hypot(parked.x-player.position.x,parked.z-player.position.z)>3)return toast('Apni parked vehicle ke paas aao.');
  const result=player.boardParked(parked);if(result.error)return toast(result.error);removeModel();parked=null;persist();toast('Vehicle ready. Helmet pehno aur dheere chalo.');
 }
 function portrait(){const avatar=createAvatar(app.me?.look||'casual',app.me?.skin),s=new THREE.Scene();s.background=new THREE.Color(0xd8e2d7);s.environment=scene.environment;s.add(new THREE.HemisphereLight(0xf5f5df,0x71816d,2));const light=new THREE.DirectionalLight(0xffffff,3);light.position.set(1,2,2);s.add(light,avatar.root);avatar.update(0,0);
  const c=new THREE.PerspectiveCamera(32,128/160,.1,10);c.position.set(0,1.52,1.4);c.lookAt(0,1.42,0);const target=new THREE.WebGLRenderTarget(128,160),old=renderer.getRenderTarget(),bytes=new Uint8Array(128*160*4);renderer.setRenderTarget(target);renderer.render(s,c);renderer.readRenderTargetPixels(target,0,0,128,160,bytes);renderer.setRenderTarget(old);target.dispose();avatar.dispose();
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=160;const ctx=canvas.getContext('2d'),image=ctx.createImageData(128,160);for(let y=0;y<160;y++)image.data.set(bytes.subarray((159-y)*128*4,(160-y)*128*4),y*128*4);ctx.putImageData(image,0,0);return canvas.toDataURL();
 }
 function inventory(){const id=virtualId(),name=h('input',{value:app.me?.name||id.name,maxlength:40}),department=h('input',{value:id.department,maxlength:50}),semester=h('select',{},...[1,2,3,4,5,6,7,8].map(n=>h('option',{value:n,selected:String(n)===String(id.semester)},String(n)))),role=h('select',{},...['student','professor','staff','visitor'].map(r=>h('option',{value:r,selected:r===id.role},r))),card=h('input',{type:'checkbox',checked:id.hasCard});
  openPanel('Virtual campus ID',h('div',{},h('div',{class:'campus-id-card'},h('img',{src:portrait(),alt:'Your game character portrait'}),h('div',{},h('b',{},'LDRP · VIRTUAL GAME ID'),h('p',{},id.number),h('p',{},id.name),h('p',{},`${id.department} · Semester ${id.semester}`),h('p',{},`${id.role} · ${campus.entry.allowed?'Gate checked':'Not checked at gate'}`))),
   h('p',{class:'muted small'},'Game-only ID, not an official college card. No real ID documents are required.'),h('label',{},'Name',name),h('label',{},'Department',department),h('label',{},'Semester',semester),h('label',{},'Role',role),h('label',{class:'check'},card,' Carry my virtual ID'),h('button',{class:'btn primary',onclick:()=>{saved[identity]={...saved[identity],id:{...id,name:name.value.trim()||'Campus Visitor',department:department.value.trim()||'Engineering',semester:semester.value,role:role.value,hasCard:card.checked},vehicle:parked};try{localStorage.setItem(storage,JSON.stringify(saved));}catch{}closePanel();toast('Virtual ID saved. Gate par guard ko dikhao.');}},'Save virtual ID')));
 }
 function check(visitor=false){if(Math.hypot(player.position.x-campus.gateOrigin.x,player.position.z-campus.gateOrigin.z)>17)return toast('Gate par guard ke paas aao.');
  if(['car','auto'].includes(player.vehicle))return say('Gaadi bahar parking ma muki ne aavo.');
  const id=virtualId();if(!id.hasCard&&!visitor)return say('ID card vagar entry nai male. Visitor pass lai lo.');
  campus.entry.checking=true;checkUntil=t+2.1;player.gesture('check-id',2.1);say(visitor?'Virtual visitor pass banavi aapu.':'Bhai, ID card batavo!');
  if(visitor){saved[identity]={...saved[identity],id:{...id,role:'visitor',hasCard:true},vehicle:parked};persist();}
  closePanel();
 }
 function gateMenu(){const id=virtualId();openPanel('Security · Main gate',h('div',{},h('p',{},'Bhai, ID card batavo! Cars and autos must stay outside, for every role.'),h('button',{class:'btn primary',onclick:()=>check(false)},`Show ${id.role} game ID`),h('button',{class:'btn',onclick:()=>{say('ID card vagar entry nai male. Visitor pass lai lo.');check(true);}},'No ID · Get virtual visitor pass'),h('button',{class:'btn',onclick:inventory},'View / edit my virtual ID')));}

 // ---- Paaji: the gate's register-wale Sardarji. Sits at a desk left of the
 // left opening, writes visitor / hostel in-out entries, hands out small passes,
 // jokes with everyone and now and then takes his Bajaj for a round. ----
 const PAJI_LINES=['Oye puttar, register vich naam likh de pehle!','Hostel ton ghar? Pass lai ja, te mummy nu Sat Sri Akal kehna!','Bina entry de andar? Na ji na, Paaji sab dekhde ne!','Chai pilaoge te pass jaldi milega... mazaak kar reha haan!','Exam aa rahe ne, canteen ghat te library zyada, samjhe?','Kithe chale ho hero? Bike te helmet paake jaana!','Late ho gaye? Koi gall nahi, kal ton 9 vaje, pakka?'];
 let paji=null,pajiBubble=null,pajiBubbleT=0,pajiNext=6,pajiRide={state:'desk',t:0,s:0,next:300+Math.random()*120},pajiPass=0;
 function pajiSay(text){if(!pajiBubble)return;pajiBubble.textContent=`Paaji: ${text}`;pajiBubble.hidden=false;pajiBubbleT=t+4.5;}
 function buildPaji(){
  const P=campus.paji;const avatar=createAvatar('casual',0x9b6a45);avatar.setBuild(1.55);avatar.root.scale.setScalar(1.08);avatar.setClothes(0x2f5f86,0x2c3038);
  const turban=new THREE.Mesh(new THREE.SphereGeometry(.158,18,12),new THREE.MeshStandardMaterial({color:0xe3a21a,roughness:.85}));turban.scale.set(1,.82,1.12);
  const knot=new THREE.Mesh(new THREE.TorusGeometry(.1,.035,8,18),turban.material);knot.rotation.x=Math.PI/2.6;knot.position.set(0,.04,.05);turban.add(knot);
  const beard=new THREE.Mesh(new THREE.SphereGeometry(.105,14,10),new THREE.MeshStandardMaterial({color:0x2a2420,roughness:.95}));beard.scale.set(1,1.15,.8);
  avatar.root.add(turban,beard);scene.add(avatar.root);
  const bike=createRideTwoWheeler('bike');bike.position.set(P.bike.x,P.y+.01,P.bike.z);bike.rotation.y=P.bikeYaw;scene.add(bike);
  paji={avatar,turban,beard,bike};pajiBubble=hNode();
 }
 function pajiMenu(){
  const entries=[['08:42','Visitor · Parent meeting','Pass V-112'],['09:15','Hostel D · Going home (weekend)','Pass H-388'],['10:02','Courier · Admin office','Pass V-113']];
  const book=h('table',{class:'paji-register'},h('tr',{},h('th',{},'Time'),h('th',{},'Name / Purpose'),h('th',{},'Pass')),...entries.map(e=>h('tr',{},...e.map(x=>h('td',{},x)))));
  const give=(purpose,prefix)=>{const id=virtualId(),now=new Date(),time=now.toTimeString().slice(0,5),no=`${prefix}-${400+(++pajiPass)}`;
   saved[identity]={...saved[identity],pajiPass:{no,purpose,time}};if(prefix==='V'){saved[identity].id={...id,role:'visitor',hasCard:true};campus.entry.allowed=true;}persist();
   pajiSay(prefix==='V'?`Lai pass ${no}. Andar khabbe (left) gate ton jaana, bahar sajje (right) gate ton!`:`Ghar jaa rahe ho? Pass ${no}, Monday nu time te aana!`);player.gesture('check-id',2);
   openPanel('Gate pass',h('div',{class:'paji-pass'},h('b',{},`LDRP GATE PASS · ${no}`),h('p',{},id.name),h('p',{},`${purpose} · ${time}`),h('p',{class:'muted small'},'Game-only pass. Entry: left gate · Exit: right gate.')));};
  openPanel('Paaji · Entry register',h('div',{},h('p',{},'Sat Sri Akal ji! Visitors and hostel students going home sign the register here and get a small pass.'),book,
   h('button',{class:'btn primary',onclick:()=>give('Visitor','V')},'Visitor · Sign register + get pass'),
   h('button',{class:'btn',onclick:()=>give('Hostel · going home','H')},'Hostel · Going home pass'),
   h('button',{class:'btn',onclick:()=>{closePanel();pajiSay(PAJI_LINES[Math.floor(Math.random()*PAJI_LINES.length)]);}},'Paaji se gappe maaro')));
 }
 function updatePaji(dt,p){
  const P=campus.paji;if(!paji)buildPaji();const a=paji.avatar,d=Math.hypot(p.x-P.seat.x,p.z-P.seat.z);
  a.root.visible=d<110;paji.bike.visible=d<110;if(!a.root.visible)return d;
  const r=pajiRide;r.t+=dt;
  const ride=P.ride,leg=s=>{const n=ride.length-1,f=Math.max(0,Math.min(n,s)),i=Math.min(n-1,Math.floor(f)),k=f-i;return{x:ride[i].x+(ride[i+1].x-ride[i].x)*k,z:ride[i].z+(ride[i+1].z-ride[i].z)*k,yaw:Math.atan2(ride[i+1].x-ride[i].x,ride[i+1].z-ride[i].z)};};
  if(r.state==='desk'&&r.t>r.next&&d>6){r.state='out';r.t=0;r.s=0;pajiSay('Ek round maar ke aaya, register sambhalo!');a.setMotorcycle(true);}
  if(r.state==='out'||r.state==='back'){r.s+=dt*(r.state==='out'?.16:-.16);const q=leg(r.s);const qy=r.s<1.2?P.y:.3;paji.bike.position.set(q.x,qy,q.z);paji.bike.rotation.y=r.state==='out'?q.yaw:q.yaw+Math.PI;a.root.position.set(q.x,qy,q.z);a.root.rotation.y=paji.bike.rotation.y;a.setActivity(null);a.update(dt,4);
   if(r.state==='out'&&r.s>=ride.length-1)r.state='back';if(r.state==='back'&&r.s<=0){r.state='desk';r.t=0;r.next=360+Math.random()*240;a.setMotorcycle(false);paji.bike.position.set(P.bike.x,P.y+.01,P.bike.z);paji.bike.rotation.y=P.bikeYaw;}}
  else{a.root.position.set(P.seat.x,P.y+.008,P.seat.z);a.root.rotation.y=d<7?Math.atan2(p.x-P.seat.x,p.z-P.seat.z):P.yaw;a.setActivity(Math.floor(t/7)%3===2?'check-id':'sit');a.update(dt,0);
   if(d<7&&t>pajiNext){pajiNext=t+11+Math.random()*6;pajiSay(PAJI_LINES[Math.floor(Math.random()*PAJI_LINES.length)]);if(Math.random()<.5)a.gesture('yes');}}
  const head=a.socket('Head');paji.turban.position.set(head.x,head.y+.13,head.z-.005);paji.beard.position.set(head.x,head.y-.01,head.z+.085);
  if(pajiBubble){pajiBubble.hidden=t>pajiBubbleT;const v=new THREE.Vector3(a.root.position.x,2.3,a.root.position.z).project(app.camera);pajiBubble.style.left=`${(v.x*.5+.5)*innerWidth}px`;pajiBubble.style.top=`${(-v.y*.5+.5)*innerHeight}px`;if(v.z>1)pajiBubble.hidden=true;}
  return r.state==='desk'?d:Infinity;
 }
 function makeActor(look,x,z,role,index){const avatar=createAvatar(look,index%2?0xc58c63:0xa86b47);avatar.root.position.set(x,referenceHeightWorld(x,z),z);scene.add(avatar.root);const a={avatar,home:{x,z},role,index};actors.push(a);return a;}
 function referenceHeightWorld(x,z){return campus.groundHeight(x,z);}
 function updateActors(dt){const p=player.position,d=Math.hypot(p.x-campus.gateOrigin.x,p.z-campus.gateOrigin.z),h=app.clock.hour(),busy=(h>=7&&h<10)||(h>=12&&h<14)||(h>=16&&h<19),night=h>=22||h<7;
  const near=d<190||campus.zone.contains(p.x,p.z);if(!near){for(const a of actors)a.avatar.root.visible=false;return;}
  if(!guard){guard=makeActor('worker',campus.guard.x,campus.guard.z,'guard',0);guard.avatar.setClothes(0x536c82,0x35414c);guardBubble=hNode();}
  const limit=lowEnd?(night?2:busy?4:3):(night?4:busy?13:9);
  while(actors.length<limit){const i=actors.length,seat=campus.gardenSeats[(i-1)%campus.gardenSeats.length];makeActor(i%3===0?'fcasual':'casual',seat.x,seat.z,i%4===0?'walk':i%3===0?'selfie':'garden',i);}
  for(const a of actors){a.avatar.root.visible=a.index<limit&&Math.hypot(a.avatar.root.position.x-p.x,a.avatar.root.position.z-p.z)<70;if(!a.avatar.root.visible)continue;a.avatar.setShadow(Math.hypot(a.avatar.root.position.x-p.x,a.avatar.root.position.z-p.z)<22);
   if(a.fall){a.fall.t+=dt;const rise=Math.max(0,Math.min(1,(a.fall.t-2.8)/1.1));a.avatar.setFall(Math.min(1,a.fall.t/.6)*(1-rise)*Math.PI/2,Math.max(0,Math.sin(Math.min(1,a.fall.t/.85)*Math.PI))*.55);a.avatar.update(dt,0);if(rise>=1){a.fall=null;a.avatar.setFall();}continue;}
   if(a===guard){const checking=campus.entry.checking,dg=Math.hypot(p.x-campus.guard.x,p.z-campus.guard.z);a.avatar.root.position.set(campus.guard.x,(campus.groundY??0)+.008,campus.guard.z);a.avatar.setActivity(checking?'check-id':'sit');a.avatar.root.rotation.y=dg<9?Math.atan2(p.x-campus.guard.x,p.z-campus.guard.z):(campus.guardYaw??0);a.avatar.update(dt,0);continue;}
   const occupied=player.sitting?.startsWith("ldrp-garden")&&Math.hypot(player.position.x-a.home.x,player.position.z-a.home.z)<1.5;
   if(a.role==='walk'||occupied){const local=campus.frame.toLocal(a.home.x,a.home.z),r=2.2,angle=t*.14+a.index;const w=campus.frame.toWorld(local.u+Math.cos(angle)*r,local.v+Math.sin(angle)*r);a.avatar.root.position.set(w.x,referenceHeightWorld(w.x,w.z),w.z);a.avatar.root.rotation.y=-angle;a.avatar.setActivity(null);a.avatar.update(dt,.8);}
   else{a.avatar.setActivity(a.role==='selfie'?(Math.floor(t/8)%2?'phone':'selfie'):'ground-sit');a.avatar.update(dt,0);if(a.role==='selfie'){if(!a.phone){a.phone=new THREE.Mesh(new THREE.BoxGeometry(.07,.135,.008),new THREE.MeshStandardMaterial({color:0x273139,roughness:.3}));a.avatar.root.add(a.phone);}a.phone.position.copy(a.avatar.socket('RightHand'));}}
  }
  if(guardBubble){guardBubble.hidden=t>bubbleTime;const v=new THREE.Vector3(campus.guard.x,2.2,campus.guard.z).project(app.camera);guardBubble.style.left=`${(v.x*.5+.5)*innerWidth}px`;guardBubble.style.top=`${(-v.y*.5+.5)*innerHeight}px`;}
 }
 function groundSeat(){const p=player.position,index=campus.gardenAt(p.x,p.z);if(index<0||!campus.entry.allowed)return null;
  if(app.world.navigation.surface(p.x,p.z,p.y,.45,.25)===undefined)return null;
  if(actors.some(a=>a.avatar.root.visible&&Math.hypot(a.avatar.root.position.x-p.x,a.avatar.root.position.z-p.z)<.9))return null;
  return{id:`ldrp-garden-${index}-ground`,x:p.x,y:campus.groundHeight(p.x,p.z),z:p.z,yaw:player.heading,kind:'ground',garden:index};
 }
 function hNode(){const el=h('div',{class:'accident-dialogue',hidden:true});document.body.append(el);return el;}
 return{inventory,park,retrieve,gateMenu,get actors(){return actors;},get parked(){return parked;},update(dt){t+=dt;const key=userKey();if(key!==identity){identity=key;parked=saved[key]?.vehicle||null;campus.entry.allowed=false;if(!saved[key])persist();showParked();lastKey='';}
   const p=player.position,gateDistance=Math.hypot(p.x-campus.gateOrigin.x,p.z-campus.gateOrigin.z),near=nearbyLot();
   if(campus.entry.checking&&t>checkUntil){campus.entry.checking=false;campus.entry.allowed=true;say(app.clock.hour()>10&&app.clock.hour()<12?'Aaje pan late aavya? Chalo, aavo.':'Aavo bhai, kem cho? Dheere chalao.');persist();}
   campus.entry.openTarget=campus.entry.allowed&&gateDistance<17;
   updateActors(dt);const pajiDistance=campus.paji?updatePaji(dt,p):Infinity;
   const ownNear=parked&&Math.hypot(p.x-parked.x,p.z-parked.z)<3;
   const garden=groundSeat();
   const driving=player.vehicle!=='walk',mode=player.sitting?.startsWith('ldrp-garden')?'stand':garden&&!driving?'garden':pajiDistance<3.2&&!driving?'paji':gateDistance<15?'gate':ownNear?'owned':near?.d<10&&driving?'park':null;
   const uiKey=[mode,parked?.locked,parked?.type,campus.entry.allowed,campus.entry.checking,garden?.id].join('|');strip.hidden=!mode;
   if(uiKey!==lastKey){lastKey=uiKey;strip.replaceChildren();const btn=(text,fn)=>strip.append(h('button',{onclick:fn,type:'button'},text));
    if(mode==='gate')btn(['car','auto'].includes(player.vehicle)?'Guard · Outside parking only':campus.entry.allowed?'My campus ID':campus.entry.checking?'ID checking…':'Guard · Show ID / Visitor pass',campus.entry.allowed?inventory:gateMenu);
    if(mode==='paji')btn('Paaji · Register / Pass',pajiMenu);
    if(mode==='park')btn(`Park · ${near.lot.inside?'Inside':'Outside'}`,park);
    if(mode==='owned'){btn(parked.locked?'Unlock my vehicle':'Lock my vehicle',()=>{parked.locked=!parked.locked;persist();app.sound.chirp?.();lastKey='';});if(!parked.locked)btn('Ride / Retrieve',retrieve);}
    if(mode==='garden')btn('Garden mein baitho',()=>{const seat=groundSeat();if(seat&&player.vehicle==='walk')player.sit(seat);lastKey='';});
    if(mode==='stand')btn('Garden se utho',()=>{player.stand();lastKey='';});
   }
  }};
}
