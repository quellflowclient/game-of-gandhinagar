import {h,openPanel,closePanel,toast,panelOpen} from '../ui/dom.js';
import {ARENA,CLUB,VENUE_MARKERS,venueAt,venueEntry,standingSpot,entertainmentPoint} from '../world/entertainment-layout.js';
import {createEventClock,eventPhase} from './event-schedule.js';
import {createVenueMedia} from './venue-media.js';
import '../ui/entertainment.css';

const fmt=t=>new Date(t).toLocaleString('en-IN',{timeZone:'Asia/Kolkata',day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})+' IST';
const errorText=e=>/PGRST202|does not exist|Could not find the function/i.test(e?.message||'')?'Concerts are unavailable right now. Please try again later.':e?.message||'Please try again.';
export function createEntertainment(app,{onMap}){
 const clock=createEventClock(),world=app.world.entertainment,backend=app.backend;
 let catalog={club:null,events:[]},available=null,entry=null,entered=false,waypoint=null,loading=null,lastCatalog=0,lastPeers=0,lastRenew=0,lastAction=0,renewing=false,joining=false,localKind='idle',localStarted=0,watchVenue=null,unwatch=null,program=null,lastLabel='',lastBar='',resumePending=false;
 const peers=new Map();let activeVenue=null,watchedUser=null,entryEpoch=0;
 const badge=h('button',{type:'button',class:'entertainment-chip',hidden:true,onclick:()=>{if(waypoint&&app.player.areaId!=='gift')app.open('travel');else open(activeVenue||waypoint||ARENA.id);}});
 const barTitle=h('b',{}),barTime=h('small',{}),videoRetry=h('button',{type:'button',class:'btn sm',hidden:true,onclick:()=>media.retry(program)},'Resume video');
 const liveBar=h('div',{class:'concert-live-bar',hidden:true},h('div',{class:'concert-live-title'},barTitle,barTime),h('div',{class:'concert-live-actions'},...['cheer','clap','wave'].map(kind=>h('button',{type:'button',onclick:()=>perform(kind)},kind==='cheer'?'Cheer':kind==='clap'?'Clap':'Wave')),videoRetry,h('button',{type:'button',class:'concert-leave',onclick:()=>leave()},'Leave')));
 document.body.append(badge,liveBar);
 const media=createVenueMedia({world,clock,onError:()=>{videoRetry.hidden=false;}});
 async function load(){
  if(loading)return loading;const sent=performance.now();loading=(async()=>{try{const data=await backend.entertainmentCatalog();clock.sync(data.server_now,sent,performance.now());catalog={club:data.club,events:data.events||[]};available=true;lastCatalog=clock.now();}catch(e){available=false;lastCatalog=clock.now();}finally{loading=null;resumePending=false;}})();return loading;
 }
 function current(){const now=clock.now(),events=[...catalog.events].sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));return entry?events.find(e=>e.id===entry.event_id):events.find(e=>eventPhase(e,now)==='live')||events.find(e=>['entry','upcoming'].includes(eventPhase(e,now)));}
 function setWaypoint(id){const marker=VENUE_MARKERS.find(v=>v.id===id);if(!marker)return;waypoint=id;closePanel();toast(app.player.areaId==='gift'?`${marker.name} marked. Follow the venue marker.`:`${marker.name} is in GIFT City. Take the metro there first.`,'info',6000,app.player.areaId==='gift'?undefined:{label:'Metro',fn:()=>app.open('travel')});}
 async function join(event,tier,button){
  if(joining)return;if(!app.requireSignIn('attend a concert'))return;
  if(app.player.sitting||app.player.carrying||app.player.crashed)return toast('Finish your current activity before joining the concert.');
  const gate=venueEntry(ARENA.id),p=app.player.position;
  if(app.player.areaId!=='gift'||!entry&&Math.hypot(p.x-gate.x,p.z-gate.z)>55){setWaypoint(ARENA.id);return;}
  joining=true;if(button)button.disabled=true;
  const epoch=++entryEpoch;
  try{
   const next=await backend.joinConcert(event.id,tier);if(epoch!==entryEpoch){backend.leaveConcert(event.id).catch(()=>{});return;}if(!next?.active)throw Error('Entry could not complete. Please try again.');
   entry=next;const spot=standingSpot(next.tier,Number(next.position));if(!spot)throw Error('Your standing spot is unavailable.');
   app.player.setEventSpot(spot);document.body.classList.add('concert-attending');closePanel();localKind='idle';localStarted=clock.now();lastRenew=0;lastPeers=0;
   await backend.venueAction(ARENA.id,'idle').catch(()=>{});backend.refreshNearby?.();toast(`You joined ${next.tier}. Earlier arrivals stand closer to the stage.`,'good');
  }catch(e){toast(errorText(e),'bad');}finally{joining=false;if(button)button.disabled=false;}
 }
 async function leave(message){
  entryEpoch++;
  const previous=entry;entry=null;app.player.setEventSpot(null);app.player.setEmote(null);document.body.classList.remove('concert-attending');liveBar.hidden=true;
  if(previous){const gate=venueEntry(ARENA.id),safe=app.world.navigation.safePoint(gate.x,gate.z);app.player.teleport(safe.x,safe.z,0,safe.y);backend.leaveConcert(previous.event_id).catch(()=>{});}
  localKind='idle';if(message)toast(message,'info');
 }
 async function perform(kind){
  const venue=entry?ARENA.id:venueAt(app.player.position.x,app.player.position.z);
  if(!venue)return toast('Go inside the club or take your concert spot first.');
  if(venue===ARENA.id&&!entry)return open(ARENA.id);
  if(venue===CLUB.id&&catalog.club?.club_enabled===false&&kind!=='idle')return toast('City Club is closed right now.');
  closePanel();localKind=kind;localStarted=clock.now();lastAction=clock.now();
  if(kind==='wave'){app.player.setEmote(null);app.player.wave();}else app.player.setEmote(kind==='idle'?null:kind);
  if(app.session)try{await backend.venueAction(venue,kind);}catch{toast('Your move is not shared yet. Try again.','info');}
 }
 async function open(id=ARENA.id){
  const venue=VENUE_MARKERS.find(v=>v.id===id)||VENUE_MARKERS[1];
  const content=h('div',{class:'venue-panel'},h('p',{class:'muted small'},'Game venue · GIFT City'),h('button',{type:'button',class:'btn',onclick:()=>onMap(venue)},'View map location'));
  if(id===CLUB.id){
   content.append(h('h3',{},'City Club'),h('p',{},catalog.club?.club_enabled===false?'City Club is closed right now.':'Step onto the dance floor, meet people and choose your move.'),h('p',{class:'muted small'},catalog.club?.club_audio?'Music is shared through your music control.':'No track is playing right now.'),h('div',{class:'venue-moves'},...['dance','cheer','clap','wave','idle'].map(kind=>h('button',{type:'button',class:'btn',disabled:catalog.club?.club_enabled===false&&kind!=='idle',onclick:()=>perform(kind)},({dance:'Dance',cheer:'Cheer',clap:'Clap',wave:'Wave',idle:'Stop dancing'})[kind]))),h('button',{type:'button',class:'btn primary',onclick:()=>setWaypoint(CLUB.id)},'Mark club entrance'));
   openPanel('City Club',content);return;
  }
  const list=h('div',{},h('p',{class:'muted'},'Loading concert schedule…'));content.append(list);openPanel('GIFT Live',content);await load();if(!content.isConnected)return;
  list.replaceChildren();if(available===false&&!catalog.events.length){list.append(h('p',{},'Concerts are unavailable right now. Please try again later.'));return;}
  const shows=catalog.events.filter(e=>['upcoming','entry','live'].includes(eventPhase(e,clock.now()))).sort((a,b)=>Date.parse(a.starts_at)-Date.parse(b.starts_at));
  if(!shows.length){list.append(h('h3',{},'No concert scheduled'),h('p',{class:'muted'},'New shows will appear here when they are announced.'),h('button',{type:'button',class:'btn',onclick:()=>setWaypoint(ARENA.id)},'Mark concert entrance'));return;}
  for(const event of shows){const phase=eventPhase(event,clock.now());const card=h('section',{class:'concert-card'},h('span',{class:`concert-phase ${phase}`},phase==='live'?'LIVE NOW':phase==='entry'?'ENTRY OPEN':'UPCOMING'),h('h3',{},event.title),h('p',{},event.artist||''),h('p',{class:'muted small'},`${fmt(event.starts_at)} — ${fmt(event.ends_at)}`),event.description?h('p',{class:'muted small'},event.description):null,h('p',{class:'concert-order-note'},'Within each zone, earlier arrivals get the front positions. Your spot is held while you stay connected.'));
   for(const [tier,label] of [['premium','Premium · Front'],['middle','Middle'],['general','General · Back']]){const capacity=event[`${tier}_capacity`]||0,b=h('button',{type:'button',class:'btn concert-zone',disabled:phase==='upcoming'||capacity===0,onclick:()=>join(event,tier,b)},h('b',{},label),h('small',{},capacity?`${capacity} places · ${phase==='upcoming'?'Entry opens '+(event.entry_minutes||15)+' min before':'Join zone'}`:'Closed'));card.append(b);}
   card.append(h('button',{type:'button',class:'link',onclick:()=>setWaypoint(ARENA.id)},'Find the entrance'));list.append(card);
  }
 }
 async function renew(){if(!entry||renewing)return;renewing=true;const epoch=entryEpoch,eid=entry.event_id;try{const next=await backend.renewConcert(eid);if(epoch!==entryEpoch||entry?.event_id!==eid)return;if(next?.active){entry=next;readPeers(ARENA.id);}else await leave(next?.ended?'The concert has ended.':'Your standing spot was released. You can join again.');}catch{if(epoch===entryEpoch&&entry&&Date.parse(entry.lease_until)<clock.now())await leave('Your standing spot was released. You can join again.');}finally{renewing=false;}}
 async function readPeers(venue){if(!app.session)return;const user=app.session.userId,epoch=entryEpoch;try{const list=await backend.venuePeople(venue);if(venue!==watchVenue||app.session?.userId!==user||epoch!==entryEpoch)return;peers.clear();for(const p of list||[])peers.set(p.user_id,p);if(entry){const own=peers.get(app.session.userId);if(own?.event_id===entry.event_id){entry={...entry,position:own.position};const spot=standingSpot(own.tier,Number(own.position));if(spot)app.player.setEventSpot(spot);}}app.people?.setVenueStates?.(peers,clock.now());}catch{}}
 function syncVenue(venue){if(venue===watchVenue&&watchedUser===app.session?.userId)return;watchedUser=app.session?.userId;unwatch?.();unwatch=null;watchVenue=venue;peers.clear();app.people?.setVenueStates?.(peers,clock.now());if(venue&&app.session){unwatch=backend.watchVenue?.(venue,({new:row})=>{if(venue!==watchVenue||!row?.user_id)return;const previous=peers.get(row.user_id)||{};if(venue===ARENA.id&&row.event_id==null){peers.delete(row.user_id);if(row.user_id===app.session?.userId&&entry)renew();readPeers(venue);}else peers.set(row.user_id,{...previous,...row});app.people?.setVenueStates?.(peers,clock.now());});readPeers(venue);}}
 function visible(){if(document.hidden){media.pause();return;}resumePending=true;load().then(()=>{lastPeers=0;lastRenew=0;if(localKind!=='idle')app.player.setEmote(localKind,(clock.now()-localStarted)/1000);});}
 const unwatchCatalog=backend.watchEntertainment?.(()=>{if(!loading&&clock.now()-lastCatalog>500)load();});
 document.addEventListener('visibilitychange',visible);load();
 return{
  open,setWaypoint,perform,get attending(){return !!entry;},get joining(){return joining;},
  update(dt,{running=false,transit=false}={}){
   entered=running;if(!entered||transit){badge.hidden=true;media.update(null);return;}
   const now=clock.now(),p=app.player.position,local=venueAt(p.x,p.z),gate=venueEntry(ARENA.id),club=entertainmentPoint(CLUB.u,CLUB.v),stage=entertainmentPoint(ARENA.u,-60),nearClub=Math.hypot(p.x-club.x,p.z-club.z),nearGate=Math.hypot(p.x-gate.x,p.z-gate.z),nearPlaza=app.player.areaId==='gift'&&(nearClub<100||nearGate<180);
   activeVenue=local||(nearGate<40?ARENA.id:nearClub<45?CLUB.id:null);
   if(now-lastCatalog>(nearPlaza?15000:60000)&&!loading)load();
   const event=current(),phase=eventPhase(event,now);
   if(entry&&(!app.session||app.me?.visible===false))leave('Your concert spot was released.');
   if(entry&&(!event||['ended','cancelled','hidden'].includes(phase))){leave('The concert has ended.');}
   if(entry&&now-lastRenew>10000){lastRenew=now;renew();}
   const socialVenue=entry?ARENA.id:local===CLUB.id?CLUB.id:null;syncVenue(socialVenue);
   if(socialVenue&&now-lastPeers>10000){lastPeers=now;readPeers(socialVenue);}
   if(!socialVenue&&localKind!=='idle'){app.player.setEmote(null);localKind='idle';if(app.session)backend.venueAction(CLUB.id,'idle').catch(()=>{});}
   if(['cheer','clap','wave'].includes(localKind)&&now-localStarted>4500){localKind='idle';app.player.setEmote(null);if(app.session&&socialVenue)backend.venueAction(socialVenue,'idle').catch(()=>{});}
   const caption=event?`${event.id}:${event.revision}:${phase}`:'none';if(caption!==lastLabel){lastLabel=caption;world.setLabel(event?.title,event?.artist,phase==='live'?'LIVE NOW':phase==='entry'?'ENTRY OPEN':phase==='upcoming'?fmt(event.starts_at):'NO SHOW SCHEDULED');}
   program=null;
   if(!resumePending&&phase==='live'&&event&&local!==CLUB.id&&(entry||app.player.areaId==='gift'&&Math.hypot(p.x-stage.x,p.z-stage.z)<210))program={key:`concert:${event.id}:${event.revision}`,url:event.audio_url||event.video_url,videoUrl:event.video_url,startAt:Date.parse(event.starts_at),endAt:Date.parse(event.ends_at),loop:event.loop_media,volume:(event.volume??.85)*(entry?1:Math.max(.1,1-Math.hypot(p.x-stage.x,p.z-stage.z)/230))};
   else if(!resumePending&&app.player.areaId==='gift'&&catalog.club?.club_enabled&&catalog.club.club_audio&&nearClub<65)program={key:`club:${catalog.club.revision}`,url:catalog.club.club_audio,videoUrl:'',startAt:Date.parse(catalog.club.updated_at)||0,endAt:Infinity,loop:true,volume:catalog.club.club_volume*Math.min(1,Math.max(0,(65-nearClub)/30))};
   world.setLive(phase==='live',event?.bpm||catalog.club?.club_bpm||120);media.update(program,{videoVisible:!panelOpen()});
   liveBar.hidden=!entry;videoRetry.hidden=!media.videoFailed;
   if(entry&&event){const seconds=Math.max(0,Math.ceil((Date.parse(phase==='entry'?event.starts_at:event.ends_at)-now)/1000)),text=`${event.title}|${entry.tier}|${entry.position}|${seconds}|${phase}`;if(text!==lastBar){lastBar=text;barTitle.textContent=`${event.title} · ${entry.tier} · Spot ${Number(entry.position)+1}`;barTime.textContent=phase==='entry'?`Starts in ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`:`Live · ${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')} remaining`;}}
   badge.hidden=!!entry||!activeVenue&&!waypoint;
   if(!badge.hidden){const id=activeVenue||waypoint,marker=VENUE_MARKERS.find(v=>v.id===id),at=venueEntry(id),distance=Math.round(Math.hypot(p.x-at.x,p.z-at.z));badge.textContent=activeVenue?`${marker.name} · ${id===CLUB.id?'Dance & meet':'Concerts'}`:app.player.areaId==='gift'?`${marker.name} · ${distance} m`:`${marker.name} · Take metro`;if(activeVenue===waypoint&&distance<15)waypoint=null;}
  },
  dispose(){unwatch?.();unwatchCatalog?.();document.removeEventListener('visibilitychange',visible);media.dispose();badge.remove();liveBar.remove();app.player.setEventSpot(null);document.body.classList.remove('concert-attending');}
 };
}
