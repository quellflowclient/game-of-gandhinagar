import {eventPhase,validateConcert} from '../systems/event-schedule.js';
const KEY='gnr-events-demo-v1';
const defaults=()=>({club:{id:'global',club_enabled:true,club_audio:'',club_bpm:120,club_volume:.7,revision:1,updated_at:new Date().toISOString()},events:[],members:[],people:[],arrival:0});
const load=()=>{try{return JSON.parse(localStorage.getItem(KEY))||defaults();}catch{return defaults();}};
const uid=()=>crypto.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
export async function demoEventRpc(name,args={},user=null,admin=false){
 const run=()=>{const db=load(),now=Date.now(),iso=new Date(now).toISOString(),event=()=>db.events.find(e=>e.id===args.eid);
  const member=()=>db.members.find(m=>m.event_id===args.eid&&m.user_id===user);
  const active=m=>!m.blocked&&!m.left_at&&Date.parse(m.lease_until)>now;
  const receipt=()=>{const e=event(),m=member();if(!e||['cancelled','ended','hidden'].includes(eventPhase(e,now)))return{active:false,ended:true};if(!m||!active(m))return{active:false,ended:false};return{active:true,event_id:e.id,tier:m.tier,arrival:m.arrival,position:db.members.filter(a=>a.event_id===e.id&&a.tier===m.tier&&active(a)&&a.arrival<m.arrival).length,lease_until:m.lease_until,server_now:now};};
  let out;
  if(name==='entertainment_catalog')out={server_now:now,club:db.club,events:db.events.filter(e=>e.status!=='draft')};
  else if(name.startsWith('admin_')){
   if(!admin)throw Error('Not an admin.');
   if(name==='admin_entertainment')out={club:db.club,events:db.events,members:db.members.map(m=>({...m,name:'Local preview member',active:active(m)}))};
   else if(name==='admin_save_club'){if(args.expected_revision!==db.club.revision)throw Error('Settings changed. Reload before saving.');db.club={...db.club,...args.payload,revision:db.club.revision+1,updated_at:iso};out=db.club;}
   else if(name==='admin_save_concert'){
    const p=validateConcert({...args.payload}),old=db.events.find(e=>e.id===p.id);if((old?.revision||0)!==(args.expected_revision||0))throw Error('Concert changed. Reload before saving.');
    if(p.status==='published'&&db.events.some(e=>e.id!==p.id&&e.status==='published'&&Date.parse(e.starts_at)<Date.parse(p.ends_at)&&Date.parse(e.ends_at)>Date.parse(p.starts_at)))throw Error('Another concert already uses this time slot.');
    out={...p,id:p.id||uid(),revision:(old?.revision||0)+1,updated_at:iso};db.events=db.events.filter(e=>e.id!==out.id);db.events.push(out);
   }else if(name==='admin_concert_guest'){const m=db.members.find(m=>m.event_id===args.eid&&m.user_id===args.guest);if(m){m.blocked=args.operation==='block';if(m.blocked){m.left_at=iso;m.lease_until=iso;}}out=null;}
  }else{
   if(!user)throw Error('Sign in first.');
   if(name==='join_concert'){
    const e=event(),phase=eventPhase(e,now);if(!['entry','live'].includes(phase))throw Error(phase==='upcoming'?'Entry has not opened yet.':'This concert is not open.');if(!['premium','middle','general'].includes(args.zone))throw Error('Choose a valid zone.');let m=member();if(m?.blocked)throw Error('The organiser has restricted your entry.');
    if(db.members.some(a=>a.event_id!==e.id&&a.user_id===user&&active(a)))throw Error('Leave your current concert first.');
    if(!m||!active(m)||m.tier!==args.zone){if(db.members.filter(a=>a.event_id===e.id&&a.tier===args.zone&&a.user_id!==user&&active(a)).length>=e[`${args.zone}_capacity`])throw Error('This zone is full.');if(!m){m={event_id:e.id,user_id:user};db.members.push(m);}Object.assign(m,{tier:args.zone,arrival:++db.arrival,joined_at:iso,left_at:null,blocked:false});}
    m.lease_until=new Date(Math.min(Date.parse(e.ends_at),now+90000)).toISOString();out=receipt();
   }else if(name==='renew_concert'){const e=event(),m=member();if(e&&m&&active(m))m.lease_until=new Date(Math.min(Date.parse(e.ends_at),now+90000)).toISOString();out=receipt();}
   else if(name==='event_receipt')out=receipt();
   else if(name==='leave_concert'){const m=member();if(m){m.left_at=iso;m.lease_until=iso;}out=null;}
   else if(name==='venue_action'){db.people=db.people.filter(p=>p.user_id!==user);db.people.push({user_id:user,venue_id:args.venue,action:args.kind,updated_at:iso});out=null;}
   else if(name==='venue_people'){out=db.people.filter(p=>p.venue_id===args.venue&&Date.parse(p.updated_at)>now-45000).map(p=>{const m=db.members.find(m=>m.user_id===p.user_id&&active(m));return{...p,...(m?{event_id:m.event_id,tier:m.tier,position:db.members.filter(a=>a.event_id===m.event_id&&a.tier===m.tier&&active(a)&&a.arrival<m.arrival).length}:{})};});}
  }
  localStorage.setItem(KEY,JSON.stringify(db));return out;
 };
 return typeof navigator!=='undefined'&&navigator.locks?.request?navigator.locks.request(KEY,run):run();
}
