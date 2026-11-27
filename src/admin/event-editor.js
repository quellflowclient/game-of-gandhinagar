import {h} from '../ui/dom.js';
import {fromIST,toIST,validateConcert,validMediaUrl,eventPhase} from '../systems/event-schedule.js';
import {demoEventRpc} from '../backend/events-demo.js';
import setupSql from '../../supabase/entertainment.sql?raw';
import './event-editor.css';

export function createEventEditor(sb,{mock=false}={}){
 let data={club:null,events:[],members:[]},selected=null,busy=false,ready=false,dirty=false;
 const root=h('section',{class:'event-editor'}),status=h('p',{class:'content-status',role:'status','aria-live':'polite'}),list=h('div',{class:'event-list'}),editor=h('div',{class:'event-form'}),clubBox=h('div',{class:'event-club'}),guests=h('div',{class:'event-guests'});
 const rpc=async(name,args={})=>{if(mock)return demoEventRpc(name,args,'local-admin-preview',true);const r=await sb.rpc(name,args);if(r.error)throw r.error;return r.data;};
 const message=text=>{status.textContent=(mock?'LOCAL PREVIEW · Changes stay in this browser. ':'')+text;};
 const mark=()=>{dirty=true;message('Unsaved edits. Save to apply them.');};
 const field=(label,input,note)=>h('label',{class:'event-field'},h('span',{},label),input,note?h('small',{},note):null);
 const input=(key,value,attrs={})=>h('input',{class:'in',name:key,value:value??'',...attrs,oninput:mark});
 const number=(key,value,min,max,step=1)=>input(key,value,{type:'number',min,max,step,required:true});
 const check=(key,value,label)=>h('label',{class:'event-check'},h('input',{type:'checkbox',name:key,checked:!!value,onchange:mark}),label);
 function download(){const url=URL.createObjectURL(new Blob([setupSql],{type:'text/plain'}));h('a',{href:url,download:'entertainment.sql'}).click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
 async function load({retain=false}={}){
  if(busy)return;busy=true;
  try{data=await rpc('admin_entertainment');ready=true;if(!retain){selected=selected?data.events.find(e=>e.id===selected.id)||null:null;dirty=false;draw();}else drawGuests();message('Schedules use IST. Changes reach connected players automatically.');}
  catch(e){ready=false;message(`Event controls unavailable: ${e.message}. Install the database setup with your Supabase owner account, then reload.`);if(!retain)draw();}
  finally{busy=false;}
 }
 async function saveClub(e){
  e.preventDefault();const form=e.currentTarget;if(busy||!ready||!form.reportValidity())return;
  const fields=new FormData(form),payload={club_enabled:fields.has('club_enabled'),club_audio:fields.get('club_audio').trim(),club_bpm:Number(fields.get('club_bpm')),club_volume:Number(fields.get('club_volume'))};
  if(!validMediaUrl(payload.club_audio))return message('Use a direct HTTPS or /audio/ media file URL.');
  busy=true;const button=form.querySelector('[type=submit]');button.disabled=true;
  try{data.club=await rpc('admin_save_club',{payload,expected_revision:data.club.revision});dirty=false;drawClub();message('Club settings saved.');}catch(e){message(e.message);}finally{busy=false;button.disabled=false;}
 }
 function upload(target,videoOnly=false){
  const file=h('input',{type:'file',accept:videoOnly?'video/mp4,video/webm':'.mp3,.m4a,.aac,.ogg,.wav,.mp4,.webm',hidden:true});
  const button=h('button',{type:'button',class:'btn',disabled:mock||!ready,onclick:()=>file.click()},'Upload media');
  file.onchange=async()=>{const media=file.files?.[0];if(!media)return;
   try{if(media.size>52428800)throw Error('Maximum upload is 50 MB. Use a hosted direct media URL for larger files.');const ext=media.name.split('.').pop().toLowerCase();if(!(videoOnly?['mp4','webm']:['mp3','m4a','aac','ogg','wav','mp4','webm']).includes(ext))throw Error('Choose a supported media file.');button.disabled=true;message('Uploading media…');const path=`${crypto.randomUUID()}.${ext}`,r=await sb.storage.from('event-media').upload(path,media,{upsert:false,cacheControl:'3600',contentType:({mp3:'audio/mpeg',m4a:'audio/mp4',aac:'audio/aac',ogg:'audio/ogg',wav:'audio/wav',mp4:'video/mp4',webm:'video/webm'})[ext]});if(r.error)throw r.error;target.value=sb.storage.from('event-media').getPublicUrl(path).data.publicUrl;mark();message('Uploaded. Save the settings to use this file.');}
   catch(e){message(e.message);}finally{file.value='';button.disabled=mock||!ready;}
  };return h('div',{class:'event-upload'},target,button,file);
 }
 function drawClub(){
  const c=data.club||{club_enabled:false,club_audio:'',club_bpm:120,club_volume:.7};
  const form=h('form',{onsubmit:saveClub},h('h3',{},'City Club'),h('p',{class:'muted'},'The mapped game club has a shared dance floor and lighting. Add your finished song here.'),check('club_enabled',c.club_enabled,'Club open'),field('Music URL',upload(input('club_audio',c.club_audio,{type:'text',maxlength:2048,placeholder:'https://…/your-song.mp3'})),'A direct media file. Empty keeps the room quiet.'),h('div',{class:'event-grid'},field('Lighting tempo · BPM',number('club_bpm',c.club_bpm,60,200)),field('Volume · 0–1',number('club_volume',c.club_volume,0,1,.05))),h('button',{type:'submit',class:'btn primary',disabled:!ready},'Save club settings'));
  clubBox.replaceChildren(form);
 }
 function fresh(){const start=new Date(Math.ceil((Date.now()+3600000)/60000)*60000);return{title:'',artist:'',description:'',starts_at:start.toISOString(),ends_at:new Date(+start+3600000).toISOString(),entry_minutes:15,audio_url:'',video_url:'',loop_media:true,bpm:120,volume:.85,premium_capacity:96,middle_capacity:144,general_capacity:192,status:'draft',revision:0};}
 function choose(event){if(dirty&&!confirm('Discard unsaved edits and open this concert?'))return;selected=structuredClone(event||fresh());dirty=false;drawList();drawEvent();drawGuests();}
 function drawList(){list.replaceChildren(h('div',{class:'event-section-head'},h('h3',{},'Concert schedule'),h('button',{type:'button',class:'btn',disabled:!ready,onclick:()=>choose(null)},'New concert')),...data.events.map(e=>h('button',{type:'button',class:'event-list-item'+(selected?.id===e.id?' selected':''),onclick:()=>choose(e)},h('b',{},e.title),h('span',{},`${e.status} · ${toIST(e.starts_at).replace('T',' ')} IST`))),...(!data.events.length?[h('p',{class:'muted'},'No concerts yet. Create a draft and add media when it is ready.')]:[]));}
 async function probe(form){
  const fields=new FormData(form),audio=String(fields.get('audio_url')||'').trim(),video=String(fields.get('video_url')||'').trim();if(!audio&&!video)return message('Add media before checking playback.');
  try{for(const [url,isVideo]of [[audio,false],[video,true]]){if(!url)continue;if(!validMediaUrl(url)||isVideo&&!/\.(mp4|webm)(\?[^\s]*)?$/i.test(url))throw Error('Use a supported direct media URL.');await new Promise((resolve,reject)=>{const el=document.createElement(isVideo?'video':'audio');el.crossOrigin='anonymous';el.preload='metadata';el.muted=true;el.playsInline=true;const timer=setTimeout(()=>done(Error('Media did not respond. Check the URL and CORS settings.')),15000);function done(error){clearTimeout(timer);el.onloadedmetadata=el.onerror=null;el.removeAttribute('src');el.load();error?reject(error):resolve();}el.onloadedmetadata=()=>done();el.onerror=()=>done(Error('Media cannot be decoded or the host blocks cross-origin playback.'));el.src=url;el.load();});}message('Media metadata loaded successfully. Playback is ready for the game’s music and video controls.');}catch(e){message(e.message);}
 }
 async function saveEvent(e){
  e.preventDefault();const form=e.currentTarget;if(busy||!ready||!form.reportValidity())return;const fields=new FormData(form),state=e.submitter?.dataset.state||'draft';
  try{const payload=validateConcert({id:selected.id||undefined,title:String(fields.get('title')).trim(),artist:String(fields.get('artist')).trim(),description:String(fields.get('description')).trim(),starts_at:fromIST(fields.get('starts_at')),ends_at:fromIST(fields.get('ends_at')),entry_minutes:Number(fields.get('entry_minutes')),audio_url:String(fields.get('audio_url')).trim(),video_url:String(fields.get('video_url')).trim(),loop_media:fields.has('loop_media'),bpm:Number(fields.get('bpm')),volume:Number(fields.get('volume')),premium_capacity:Number(fields.get('premium_capacity')),middle_capacity:Number(fields.get('middle_capacity')),general_capacity:Number(fields.get('general_capacity')),status:state});
   busy=true;form.querySelectorAll('button').forEach(b=>b.disabled=true);const saved=await rpc('admin_save_concert',{payload,expected_revision:selected.revision||0});selected=saved;data.events=data.events.filter(a=>a.id!==saved.id);data.events.unshift(saved);dirty=false;drawList();drawEvent();drawGuests();message(state==='published'?`Published: ${saved.title}. Playback starts and stops at the scheduled server time.`:state==='cancelled'?'Concert cancelled. Current attendees will be released.':'Draft saved. It is visible only in this console.');
  }catch(e){message(e.message);}finally{busy=false;form.querySelectorAll('button').forEach(b=>b.disabled=false);}
 }
 function drawEvent(){
  if(!selected){editor.replaceChildren(h('p',{class:'muted'},'Choose a concert or create a new draft.'));return;}
  const e=selected,audio=input('audio_url',e.audio_url,{maxlength:2048,placeholder:'https://…/concert.mp3'}),video=input('video_url',e.video_url,{maxlength:2048,placeholder:'https://…/concert.mp4'});
  const form=h('form',{onsubmit:saveEvent},h('h3',{},e.id?'Edit concert':'New concert'),field('Concert title',input('title',e.title,{required:true,maxlength:80})),field('Artist / performer',input('artist',e.artist,{maxlength:80})),field('Description',h('textarea',{class:'in',name:'description',maxlength:500,rows:3,oninput:mark},e.description)),h('div',{class:'event-grid'},field('Starts · IST',input('starts_at',toIST(e.starts_at),{type:'datetime-local',required:true})),field('Ends · IST',input('ends_at',toIST(e.ends_at),{type:'datetime-local',required:true}))),field('Open entry before start · minutes',number('entry_minutes',e.entry_minutes,0,120)),field('Concert audio',upload(audio),'Leave empty to use the video’s sound.'),field('Stage screen video',upload(video,true),'Direct MP4 or WebM. Video pixels are muted; one music stream plays the audio.'),check('loop_media',e.loop_media,'Repeat media until the scheduled end'),h('div',{class:'event-grid'},field('Lighting tempo · BPM',number('bpm',e.bpm,60,200)),field('Volume · 0–1',number('volume',e.volume,0,1,.05))),h('h4',{},'Standing zones'),h('p',{class:'muted'},'0 closes a zone. Each zone supports up to 192 distinct positions. Earlier arrivals receive the front rows in their zone.'),h('div',{class:'event-grid three'},...['premium','middle','general'].map(t=>field(`${t[0].toUpperCase()+t.slice(1)} capacity`,number(`${t}_capacity`,e[`${t}_capacity`],0,192)))),h('div',{class:'event-toolbar'},h('button',{type:'button',class:'btn',onclick:()=>probe(form)},'Check media'),h('button',{type:'submit',class:'btn','data-state':'draft'},'Save draft'),h('button',{type:'submit',class:'btn primary','data-state':'published'},e.status==='published'?'Update live schedule':'Publish concert'),e.id?h('button',{type:'submit',class:'btn','data-state':'cancelled'},'Cancel concert'):null));
  editor.replaceChildren(form);
 }
 function drawGuests(){
  const members=selected?.id?data.members.filter(m=>m.event_id===selected.id).sort((a,b)=>Number(a.arrival)-Number(b.arrival)):[];
  guests.replaceChildren(h('div',{class:'event-section-head'},h('h3',{},'Concert attendees'),h('button',{type:'button',class:'btn',disabled:!ready,onclick:()=>load({retain:true})},'Refresh attendance')),h('p',{class:'muted'},'Active entry is held by a short connection lease. Disconnected users release their spot automatically.'),...members.map(m=>h('div',{class:'event-guest'},h('div',{},h('b',{},m.name),h('small',{},`${m.tier} · ${m.blocked?'Restricted':m.active?'Attending':'Left / disconnected'} · arrival ${m.arrival}`)),h('button',{type:'button',class:'btn',onclick:async button=>{const target=button.currentTarget;target.disabled=true;try{await rpc('admin_concert_guest',{eid:selected.id,guest:m.user_id,operation:m.blocked?'allow':'block'});await load({retain:true});message(m.blocked?'Entry allowed. The player can join again.':'Entry restricted. The player’s standing spot was released.');}catch(e){message(e.message);}finally{target.disabled=false;}}},m.blocked?'Allow entry':'Restrict entry'))),...(!members.length?[h('p',{class:'muted'},'No attendance recorded for this concert.')]:[]));
 }
 function draw(){drawClub();drawList();drawEvent();drawGuests();}
 root.append(h('h2',{},'Club & concerts'),h('p',{class:'muted'},'Manage the virtual GIFT City venues. No music or show is published until you add your own media and save it.'),h('div',{class:'event-toolbar'},h('button',{type:'button',class:'btn',onclick:()=>{if(!dirty||confirm('Discard unsaved edits and reload?'))load();}},'Reload'),h('button',{type:'button',class:'btn',onclick:download},'Download database setup')),status,clubBox,h('div',{class:'event-workspace'},list,editor),guests);
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});load();return root;
}
