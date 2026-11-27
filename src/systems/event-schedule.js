export const ZONE_IDS=['premium','middle','general'];
export function eventPhase(event,now){
 if(!event||event.status==='draft')return 'hidden';if(event.status==='cancelled')return 'cancelled';
 const start=Date.parse(event.starts_at),end=Date.parse(event.ends_at);if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)return 'unavailable';
 if(now>=end)return 'ended';if(now>=start)return 'live';if(now>=start-(event.entry_minutes??15)*60000)return 'entry';return 'upcoming';
}
export function mediaPosition(startAt,now,duration,loop=true){
 const offset=(now-Number(startAt))/1000;if(!Number.isFinite(offset)||offset<0)return null;
 if(!Number.isFinite(duration)||duration<=0)return offset;
 return loop?offset%duration:Math.min(offset,Math.max(0,duration-.03));
}
export function fromIST(value){if(!/^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(value||''))throw Error('Choose a valid time in IST.');const date=new Date(`${value}:00+05:30`);if(!Number.isFinite(+date)||toIST(date.toISOString())!==value)throw Error('Choose a valid time in IST.');return date.toISOString();}
export function toIST(value){const date=new Date(value);if(!Number.isFinite(+date))return '';const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;}
export function validMediaUrl(value){return value===''||typeof value==='string'&&value.length<=2048&&/^(https:\/\/[^\s]+|\/(?:audio|media|events)\/[^\s]+)\.(?:mp3|m4a|aac|ogg|wav|mp4|webm)(?:\?[^\s]*)?$/i.test(value);}
export function createEventClock(now=()=>performance.now()){
 let stamp=now(),server=Date.now();return{sync(value,sent=now(),received=now()){if(!Number.isFinite(Number(value)))return;server=Number(value)+Math.max(0,received-sent)/2;stamp=received;},now(){return server+Math.max(0,now()-stamp);}};
}
export function validateConcert(event){
 const start=Date.parse(event.starts_at),end=Date.parse(event.ends_at);
 if(!String(event.title||'').trim()||event.title.length>80)throw Error('Add a concert title, up to 80 characters.');
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start||end-start>86400000)throw Error('The end must follow the start, within 24 hours.');
 for(const key of ['audio_url','video_url'])if(!validMediaUrl(event[key]||''))throw Error('Use a direct HTTPS MP3, M4A, WAV, MP4 or WebM media URL.');
 if(event.video_url&&!/\.(mp4|webm)(\?[^\s]*)?$/i.test(event.video_url))throw Error('The stage screen needs a direct MP4 or WebM video.');
 if(!['draft','published','cancelled'].includes(event.status))throw Error('Choose a valid event status.');
 if(!Number.isInteger(Number(event.entry_minutes))||event.entry_minutes<0||event.entry_minutes>120)throw Error('Entry opens 0–120 minutes before the show.');
 if(event.status==='published'&&!event.audio_url&&!event.video_url)throw Error('Add audio or video before publishing.');
 for(const zone of ZONE_IDS){const n=Number(event[`${zone}_capacity`]);if(!Number.isInteger(n)||n<0||n>192)throw Error('Each zone supports 0–192 people.');}
 if(!Number.isFinite(Number(event.volume))||event.volume<0||event.volume>1)throw Error('Volume must be between 0 and 1.');
 if(!Number.isInteger(Number(event.bpm))||event.bpm<60||event.bpm>200)throw Error('Tempo must be 60–200 BPM.');return event;
}
