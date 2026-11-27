import {h,openPanel,closePanel} from './dom.js';
import {mapDestinations} from '../systems/map-destinations.js';
import {explorationCorners} from '../world/exploration-areas.js';
import './map.css';

export function openCityMap(app,focus){
 const destinations=mapDestinations(app.world),map=app.world.map,filters=new Set(['people','food','shops','events','cafes']);
 const canvas=h('canvas',{class:'map-canvas','aria-label':'City map. Choose a location using the buttons below.'}),list=h('div',{class:'map-destinations','aria-label':'Map destinations'});
 const search=h('input',{class:'map-search',type:'search',placeholder:'Find a place, club or shop…','aria-label':'Search map destinations',oninput:drawList});
 let zoom=focus?.x!=null ? .8 : .15,cx=focus?.x??app.player.position.x,cz=focus?.z??app.player.position.z,drag=null,full=false,initialFit=!focus,markers=[];
 const go=p=>{closePanel();app.travelTo(p.id);};
 const visible=p=>p.category==='place'||filters.has(p.category);
 function fit(){const points=destinations.filter(visible),xs=points.map(p=>p.x),zs=points.map(p=>p.z);if(!points.length)return;const minX=Math.min(...xs),maxX=Math.max(...xs),minZ=Math.min(...zs),maxZ=Math.max(...zs);cx=(minX+maxX)/2;cz=(minZ+maxZ)/2;zoom=Math.max(.015,Math.min(.8,(canvas.clientWidth-65)/Math.max(100,maxX-minX),(canvas.clientHeight-65)/Math.max(100,maxZ-minZ)));}
 function draw(){
  const w=canvas.clientWidth,hh=canvas.clientHeight;if(!w||!hh)return;if(initialFit){fit();initialFit=false;}
  const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(w*ratio);canvas.height=Math.round(hh*ratio);const c=canvas.getContext('2d');c.setTransform(ratio,0,0,ratio,0,0);
  const X=x=>w/2+(x-cx)*zoom,Y=z=>hh/2+(z-cz)*zoom;
  c.fillStyle='#eef0e4';c.fillRect(0,0,w,hh);
  const polygon=(pts,fill)=>{c.fillStyle=fill;c.beginPath();pts.forEach(([x,z],i)=>i?c.lineTo(X(x),Y(z)):c.moveTo(X(x),Y(z)));c.closePath();c.fill();};
  for(const p of map.parks)polygon(p.pts,'#cfdec0');
  for(const b of map.buildings){c.beginPath();for(const ring of [b.pts,...(b.holes||[])]){ring.forEach(([x,z],i)=>i?c.lineTo(X(x),Y(z)):c.moveTo(X(x),Y(z)));c.closePath();}c.fillStyle='#aab9b2';c.fill('evenodd');}
  for(const water of map.water){if(water.closed)polygon(water.pts,'#a8cfd4');else{c.strokeStyle='#a8cfd4';c.lineWidth=Math.max(3,110*zoom);c.beginPath();water.pts.forEach(([x,z],i)=>i?c.lineTo(X(x),Y(z)):c.moveTo(X(x),Y(z)));c.stroke();}}
  c.lineCap='round';for(const road of map.roads){if(!['motorway','trunk','primary','secondary','tertiary'].includes(road.kind))continue;c.strokeStyle='#fff';c.lineWidth=road.kind==='tertiary'?1.5:3;c.beginPath();road.pts.forEach(([x,z],i)=>i?c.lineTo(X(x),Y(z)):c.moveTo(X(x),Y(z)));c.stroke();}
  c.strokeStyle='#aa9166';c.lineWidth=1;c.setLineDash([5,4]);for(const ring of explorationCorners()){c.beginPath();ring.forEach((p,i)=>i?c.lineTo(X(p.x),Y(p.z)):c.moveTo(X(p.x),Y(p.z)));c.closePath();c.stroke();}c.setLineDash([]);
  markers=[];const labels=[];
  for(const p of destinations.filter(visible)){
   const x=X(p.x),y=Y(p.z);if(x<0||x>w||y<0||y>hh)continue;markers.push({x,y,p});c.fillStyle='#'+p.color.toString(16).padStart(6,'0');c.beginPath();c.arc(x,y,p.category==='place'||p.category==='events'?6:4,0,Math.PI*2);c.fill();c.strokeStyle='#fff';c.lineWidth=2;c.stroke();
   c.font='600 10px Inter, sans-serif';c.textAlign='left';const width=Math.min(w-16,c.measureText(p.name).width),lx=Math.max(8,Math.min(w-width-8,x+9)),ly=y-11,rect={x:lx,y:ly-11,w:width,h:15};
   if(ly>14&&ly<hh-28&&!labels.some(b=>rect.x<b.x+b.w+6&&rect.x+rect.w+6>b.x&&rect.y<b.y+b.h+4&&rect.y+rect.h+4>b.y)){c.fillStyle='#f9fbf2e8';c.fillRect(lx-3,ly-11,width+6,16);c.fillStyle='#284e3c';c.fillText(p.name,lx,ly);labels.push(rect);}
  }
  if(filters.has('people')){c.fillStyle='#8676ac';for(const p of app.presenceMembers())if(Number.isFinite(p.x)&&Number.isFinite(p.z)){c.beginPath();c.arc(X(p.x),Y(p.z),3,0,Math.PI*2);c.fill();}}
  const me=app.player.position;c.save();c.translate(X(me.x),Y(me.z));c.rotate(-app.player.heading+Math.PI);c.fillStyle='#b85036';c.beginPath();c.moveTo(0,-8);c.lineTo(6,6);c.lineTo(-6,6);c.closePath();c.fill();c.restore();
  const meters=zoom>.5?100:zoom>.12?500:2000;c.fillStyle='#284e3c';c.fillRect(12,hh-18,meters*zoom,3);c.font='10px Inter,sans-serif';c.fillText(meters>=1000?`${meters/1000} km`:`${meters} m`,16+meters*zoom,hh-14);
 }
 function drawList(){const query=search.value.trim().toLowerCase(),matches=destinations.filter(p=>visible(p)&&`${p.name} ${p.detail||''}`.toLowerCase().includes(query));list.replaceChildren(...matches.map(p=>h('button',{type:'button',class:'map-destination','aria-label':`Go to ${p.name}`,onclick:()=>go(p)},h('span',{class:'map-destination-dot',style:{background:'#'+p.color.toString(16).padStart(6,'0')}}),h('span',{},h('b',{},p.name),h('small',{},p.detail||'')),h('span',{class:'map-destination-action'},app.player.areaId===p.area?'Go →':'Metro →'))));if(!matches.length)list.append(h('p',{class:'muted small'},'No matching destination.'));}
 canvas.addEventListener('pointerdown',e=>{drag={id:e.pointerId,x:e.clientX,y:e.clientY,cx,cz,moved:0};canvas.setPointerCapture(e.pointerId);});
 canvas.addEventListener('pointermove',e=>{if(drag?.id!==e.pointerId)return;drag.moved=Math.max(drag.moved,Math.hypot(e.clientX-drag.x,e.clientY-drag.y));cx=drag.cx-(e.clientX-drag.x)/zoom;cz=drag.cz-(e.clientY-drag.y)/zoom;draw();});
 canvas.addEventListener('pointerup',e=>{if(drag?.id!==e.pointerId)return;const tap=drag.moved<7;drag=null;if(!tap)return;const b=canvas.getBoundingClientRect(),hit=markers.map(m=>({...m,d:Math.hypot(m.x-e.clientX+b.left,m.y-e.clientY+b.top)})).filter(m=>m.d<21).sort((a,b)=>a.d-b.d)[0];if(hit)go(hit.p);});
 canvas.addEventListener('pointercancel',()=>{drag=null;});canvas.addEventListener('lostpointercapture',()=>{drag=null;});
 canvas.addEventListener('wheel',e=>{e.preventDefault();zoom=Math.max(.015,Math.min(2,zoom*(e.deltaY<0?1.2:.83)));draw();},{passive:false});
 const sheet=h('div',{class:'map-wrap'},h('div',{class:'map-intro'},h('b',{},'Where do you want to go?'),h('p',{},'Tap a pin or choose a place below. Nearby stops take you straight there; another area starts a metro ride.')),
  h('div',{class:'chips'},...[["cafes","Cafes"],["food","Food"],["shops","Shops"],["events","Club & concerts"],["people","People"]].map(([id,label])=>h('button',{type:'button',class:'chip-btn on','aria-pressed':'true',onclick:e=>{filters.has(id)?filters.delete(id):filters.add(id);e.currentTarget.classList.toggle('on',filters.has(id));e.currentTarget.setAttribute('aria-pressed',String(filters.has(id)));draw();drawList();}},label))),
  h('div',{class:'map-area'},canvas,h('div',{class:'map-ctrl'},h('button',{type:'button','aria-label':'Zoom in',onclick:()=>{zoom=Math.min(2,zoom*1.4);draw();}},'+'),h('button',{type:'button','aria-label':'Zoom out',onclick:()=>{zoom=Math.max(.015,zoom/1.4);draw();}},'−'),h('button',{type:'button','aria-label':'Recentre on me',onclick:()=>{cx=app.player.position.x;cz=app.player.position.z;zoom=.8;draw();}},'◎'),h('button',{type:'button','aria-label':'Show all locations',onclick:()=>{fit();draw();}},'All'),h('button',{type:'button','aria-label':'Fullscreen map',onclick:()=>{full=!full;sheet.closest('.sheet').classList.toggle('full',full);requestAnimationFrame(draw);}},'⤢'))),
  search,list,h('p',{class:'muted small'},'Dashed lines show exploration limits. Drag the map to pan; use + / − to zoom.'),h('p',{class:'muted small'},'Map geometry: July 2026 · © OpenStreetMap contributors. Unmeasured building heights are approximate.'));
 openPanel('Gandhinagar map',sheet,{wide:true});drawList();requestAnimationFrame(draw);
 const resize=new ResizeObserver(()=>draw());resize.observe(canvas);const cleanup=new MutationObserver(()=>{if(!sheet.isConnected){resize.disconnect();cleanup.disconnect();}});cleanup.observe(document.body,{childList:true});
}
