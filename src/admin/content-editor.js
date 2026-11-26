import {h} from '../ui/dom.js';
import {defaultContent,validateContent} from '../systems/game-content.js';
import setupSql from '../../supabase/game-content.sql?raw';
const titles={labels:'Names & gate signs',stalls:'Stalls, menus & hours',dialogues:'All character dialogues',voices:'Voice settings',campus:'College ID & staff',gameplay:'Roads, limits & timing',music:'Music & popup',geometry:'Advanced 3D layout',textOverrides:'Screen & sign text'};
const label=key=>key.replace(/([a-z])([A-Z])/g,'$1 $2').replace(/_/g,' ').replace(/^./,s=>s.toUpperCase());
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=h('a',{href:url,download:name});a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export function createContentEditor(sb,{mock=false}={}){
 let config=defaultContent(),published=null,draft=null,history=[],section='labels',dirty=false,cloudReady=false,busy=false;
 const buffers=new Map(),root=h('section',{class:'content-editor'}),status=h('p',{class:'content-status',role:'status'}),body=h('div',{class:'content-fields'}),tabs=h('div',{class:'content-tabs'}),historyBox=h('div',{class:'content-history'});
 const save=h('button',{type:'button',class:'btn',onclick:()=>write(false)},'Save draft'),publish=h('button',{type:'button',class:'btn primary',onclick:()=>write(true)},'Review & publish');
 const mark=()=>{dirty=true;status.textContent='Unsaved changes · published game is unchanged.';};
 const set=(path,value)=>{let target=config;for(const k of path.slice(0,-1))target=target[k];target[path.at(-1)]=value;mark();};
 function flush(){for(const [input,{path,parse}]of buffers){try{set(path,parse(input.value));input.setCustomValidity('');}catch(e){input.setCustomValidity(e.message);input.reportValidity();throw Error(`${path.join('.')}: ${e.message}`);}}buffers.clear();}
 function widget(value,path){
  const name=path.at(-1),key=path.join('.');
  if(value&&typeof value==='object'&&!Array.isArray(value))return h('details',{class:'content-group',open:path.length<2},h('summary',{},label(name)),...Object.entries(value).map(([k,v])=>widget(v,[...path,k])));
  let input;
  if(typeof value==='boolean'){input=h('input',{type:'checkbox',checked:value,onchange:e=>set(path,e.target.checked)});return h('label',{class:'content-check'},input,label(name));}
  const array=Array.isArray(value),lines=array&&value.every(v=>typeof v==='string'),numeric=typeof value==='number';
  if(array){input=h('textarea',{rows:lines?5:8,spellcheck:'false','aria-label':key});input.value=lines?value.join('\n'):JSON.stringify(value,null,2);input.addEventListener('input',()=>{mark();buffers.set(input,{path,parse:text=>lines?text.split('\n').map(s=>s.trim()).filter(Boolean):JSON.parse(text)});});}
  else {input=h(typeof value==='string'&&value.length>100?'textarea':'input',{type:numeric?'number':'text',step:numeric?'any':null,rows:3,value:value??'','aria-label':key});if(input.tagName==='TEXTAREA')input.value=value;input.addEventListener('input',()=>set(path,numeric?(input.value===''?NaN:Number(input.value)):input.value));}
  if(section==='stalls'&&name==='id')input.disabled=true;
  return h('label',{class:'content-field'},h('span',{},label(name)),input,array?h('small',{},lines?'One line per dialogue.':'JSON array: preserve coordinates / item structure.'):null);
 }
 function draw(){
  buffers.clear();tabs.replaceChildren(...Object.entries(titles).map(([key,text])=>h('button',{type:'button',class:'btn'+(section===key?' primary':''),onclick:()=>{try{flush();section=key;draw();}catch(e){status.textContent=e.message;}}},text)));
  body.replaceChildren(h('h3',{},titles[section]));
  if(section==='stalls'){
   body.append(h('p',{class:'muted'},'Names, Gujarati signs, caller, call text, staff description, menu items/prices, opening hours and closed days. Stable IDs preserve existing orders and tables. Use enabled=false to close a stall. Coordinates are in the market frame.'));
   config.stalls.forEach((s,i)=>body.append(h('details',{class:'content-group',open:i===0},h('summary',{},s.name),...Object.entries(s).map(([k,v])=>widget(v,['stalls',i,k])))));
  }else{
   if(section==='dialogues')body.append(h('p',{class:'muted'},'Templates may use {caller}, {price}, {passNumber}. Guard ambient entries may use {idWhere}, {noId}, {idShow}, {greeting}, or your own complete sentence.'));
   if(section==='music')body.append(h('p',{class:'muted'},'Use direct audio file URLs. External HTTPS hosts must allow cross-origin audio playback.'));
   if(section==='voices')body.append(h('p',{class:'muted'},'Recorded clips take priority. Pitch/rate settings apply to browser fallback only. Match dialogue text exactly; a renamed dialogue needs its own matching audio URL. External audio hosts must allow cross-origin playback.'));
   if(section==='geometry')body.append(h('p',{class:'content-warning'},'Advanced: coordinates are local metres, not latitude/longitude. These change renderer and collision geometry on the next game reload. Export a backup first; use the full JSON editor to add nested blocks. Some handcrafted props remain code-defined. This is not a drag-and-drop 3D model editor.'));
   if(section==='textOverrides')body.append(h('p',{class:'muted'},'Exact original text → replacement. Applies to DOM labels and shared 3D sign textures. Add any missing original label below. Existing dynamic names and dialogue should use their dedicated sections.'));
   body.append(...Object.entries(config[section]).map(([k,v])=>widget(v,[section,k])));
   if(section==='textOverrides'){const original=h('input',{placeholder:'Exact original text'}),replacement=h('input',{placeholder:'Replacement text'});body.append(h('div',{class:'content-add'},original,replacement,h('button',{type:'button',class:'btn',onclick:()=>{try{flush();if(!original.value.trim())throw Error('Enter original text.');if(['__proto__','constructor','prototype'].includes(original.value))throw Error('Reserved key.');config.textOverrides[original.value]=replacement.value;mark();draw();}catch(e){status.textContent=e.message;}}},'Add text override')));}
   if(section==='voices'){
    const role=h('select',{'aria-label':'Recording character'},...['guard','male','female'].map(value=>h('option',{value},label(value)))),text=h('input',{placeholder:'Exact dialogue text','aria-label':'Exact dialogue text'}),url=h('input',{placeholder:'/audio/dialogues/file.mp3 or HTTPS audio URL','aria-label':'Recording URL'});
    body.append(h('div',{class:'content-add'},h('h3',{},'Add / replace recorded dialogue'),role,text,url,h('button',{type:'button',class:'btn',onclick:()=>{try{flush();if(!text.value.trim()||['__proto__','constructor','prototype'].includes(text.value.trim()))throw Error('Enter dialogue text.');if(!/^(\/audio\/[\w./-]+\.(mp3|ogg|wav)|https:\/\/[^\s]+)$/i.test(url.value.trim()))throw Error('Use a direct local /audio/ file or HTTPS audio URL.');config.voices[role.value].recordings??={};config.voices[role.value].recordings[text.value.trim()]=url.value.trim();mark();draw();}catch(e){status.textContent=e.message;}}},'Save recording in draft')));
   }
  }
  body.append(h('button',{type:'button',class:'btn',onclick:()=>{if(!confirm(`Reset ${titles[section]} in this draft to defaults?`))return;config[section]=defaultContent()[section];mark();draw();}},'Reset this section in draft'));
  save.disabled=publish.disabled=!cloudReady||busy;
  historyBox.replaceChildren(h('h3',{},'Revision history'),...history.map(row=>h('div',{class:'content-revision'},h('span',{},`#${row.revision} · ${row.target} · ${new Date(row.updated_at).toLocaleString()}`),h('button',{type:'button',class:'btn',onclick:()=>{if(dirty&&!confirm('Replace unsaved edits with this revision?'))return;config=structuredClone(row.config);mark();draw();}},'Restore into draft'))));
 }
 async function load(){
  busy=true;save.disabled=publish.disabled=true;status.textContent='Loading saved game content…';
  try{
   let data;if(mock)data=JSON.parse(localStorage.getItem('gog-admin-content-mock')||'{}');else{const r=await sb.rpc('admin_read_game_content');if(r.error)throw r.error;data=r.data;}
   published=data.published||null;draft=data.draft||null;history=data.history||[];config=structuredClone(draft?.config||published?.config||defaultContent());
   cloudReady=true;dirty=false;status.textContent=mock?'Mock console · edits stay in this browser.':`Published revision ${published?.revision||0} · draft ${draft?.revision||0}. Changes apply when players reload the game.`;
  }catch(e){cloudReady=false;status.textContent=`Cloud editor not ready: ${e.message}. Run game-content.sql with your Supabase owner account, then Reload. You can edit/export locally in the meantime.`;}
  finally{busy=false;draw();}
 }
 async function write(live){
  if(busy||!cloudReady)return;
  try{
   flush();const errors=validateContent(config);if(errors.length){status.textContent=errors.join('\n');return;}
   if(live&&!confirm('Publish this content for all players? It applies on their next game reload.'))return;
   busy=true;save.disabled=publish.disabled=true;status.textContent=live?'Publishing…':'Saving draft…';
   const previous=live?published:draft;let row;
   if(mock){row={config:structuredClone(config),revision:Date.now(),target:live?'published':'draft',updated_at:new Date().toISOString()};}
   else{const r=await sb.rpc('admin_save_game_content',{payload:config,expected_revision:previous?.revision||0,make_live:live});if(r.error)throw r.error;row=r.data;}
   if(live)published=row;else draft=row;history.unshift({...row,target:live?'published':'draft'});history=history.slice(0,20);
   if(mock)localStorage.setItem('gog-admin-content-mock',JSON.stringify({published,draft,history}));dirty=false;status.textContent=live?'Published. Reload the game to see updated names, dialogues and layout.':'Draft saved. The published game is unchanged.';
  }catch(e){status.textContent=e.message;}finally{busy=false;save.disabled=publish.disabled=!cloudReady;}
 }
 const file=h('input',{type:'file',accept:'.json,application/json',hidden:true,onchange:async e=>{try{const selected=e.target.files?.[0];if(!selected)return;if(selected.size>500000)throw Error('File exceeds 500 KB.');const next=JSON.parse(await selected.text()),errors=validateContent(next);if(errors.length)throw Error(errors.join('\n'));if(dirty&&!confirm('Replace unsaved edits with this import?'))return;config=next;mark();draw();}catch(error){status.textContent=error.message;}finally{file.value='';}}});
 const raw=h('textarea',{rows:20,spellcheck:'false','aria-label':'Full configuration JSON'}),rawBox=h('details',{class:'content-group'},h('summary',{},'Full JSON editor / add advanced fields'),h('p',{class:'muted'},'All sections in one document. Apply JSON first, then Save draft or Publish.'),raw,h('button',{type:'button',class:'btn',onclick:()=>{try{const next=JSON.parse(raw.value),errors=validateContent(next);if(errors.length)throw Error(errors.join('\n'));config=next;mark();draw();rawBox.open=false;}catch(e){status.textContent=e.message;}}},'Apply JSON to draft'));
 rawBox.addEventListener('toggle',()=>{if(rawBox.open){try{flush();raw.value=JSON.stringify(config,null,2);}catch(e){status.textContent=e.message;}}});
 root.append(h('h2',{},'Game content control'),h('p',{class:'muted'},'Public game content only. No player phone numbers, enrollment records or private conversations are stored here.'),h('div',{class:'content-toolbar'},save,publish,h('button',{type:'button',class:'btn',onclick:()=>{if(dirty&&!confirm('Discard unsaved edits and reload?'))return;load();}},'Reload'),h('button',{type:'button',class:'btn',onclick:()=>{try{flush();download('gog-game-content.json',JSON.stringify(config,null,2));}catch(e){status.textContent=e.message;}}},'Export JSON'),h('button',{type:'button',class:'btn',onclick:()=>file.click()},'Import JSON'),h('button',{type:'button',class:'btn',onclick:()=>download('game-content.sql',setupSql,'text/plain')},'Download database setup')),file,status,tabs,body,rawBox,historyBox);
 window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
 load();return root;
}
