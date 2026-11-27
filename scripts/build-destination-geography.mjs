import fs from 'node:fs';
import {toLocal,placePos,placeById} from '../src/data/places.js';
import {worldToSite} from '../src/world/mahatma-layout.js';
const sources=['osm_gandhinagar.json','extra.json','rail.json','destinations-osm.json'].map(file=>({file,...JSON.parse(fs.readFileSync(new URL('../data/'+file,import.meta.url)))}));
// Newest available source wins; a cached mirror must not replace newer geometry.
const elements=new Map();for(const source of [...sources].sort((a,b)=>(a.osm3s?.timestamp_osm_base||'').localeCompare(b.osm3s?.timestamp_osm_base||'')))for(const e of source.elements)elements.set(e.type+e.id,e);
const all=[...elements.values()],point=g=>{const p=toLocal(g.lat,g.lon);return [Number(p.x.toFixed(2)),Number(p.z.toFixed(2))];};
const inside=(p,ring)=>{let yes=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
const bounds=ring=>({minX:Math.min(...ring.map(p=>p[0])),maxX:Math.max(...ring.map(p=>p[0])),minZ:Math.min(...ring.map(p=>p[1])),maxZ:Math.max(...ring.map(p=>p[1]))});
const area=ring=>Math.abs(ring.reduce((a,p,i)=>{const q=ring[(i+1)%ring.length];return a+p[0]*q[1]-q[0]*p[1];},0))/2;
const giftElement=elements.get('way544499329');if(!giftElement?.geometry)throw Error('Missing mapped GIFT boundary');
const giftOutline=giftElement.geometry.map(point),giftBounds=bounds(giftOutline),origin=placePos(placeById('dandi'));
const civicBounds={minU:-330,maxU:310,minV:-140,maxV:2940};
const inCivic=p=>{const l=worldToSite(origin,...p);return l.u>=civicBounds.minU&&l.u<=civicBounds.maxU&&l.v>=civicBounds.minV&&l.v<=civicBounds.maxV;};
const swarnim=elements.get('relation13639535');if(!swarnim?.members)throw Error('Missing mapped Swarnim Park relation');
const plots=swarnim.members.filter(m=>m.role==='outer').map(m=>({id:m.ref,pts:m.geometry.map(point)}));
const terminal=elements.get('way338493096');if(terminal?.geometry)plots.push({id:terminal.id,pts:terminal.geometry.map(point),terminalGarden:true});
function joinRings(members){const pending=members.filter(m=>m.geometry?.length>2).map(m=>m.geometry.map(point)),rings=[];const same=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1])<.05;while(pending.length){let ring=pending.shift(),changed=true;while(!same(ring[0],ring.at(-1))&&changed){changed=false;for(let i=0;i<pending.length;i++){let p=pending[i];if(same(ring.at(-1),p[0]))ring.push(...p.slice(1));else if(same(ring.at(-1),p.at(-1)))ring.push(...p.reverse().slice(1));else continue;pending.splice(i,1);changed=true;break;}}if(!same(ring[0],ring.at(-1)))throw Error('Unclosed multipolygon');rings.push(ring);}return rings;}
const buildings=[],relationMembers=new Set();
function building(e,pts,holes=[],suffix=''){
 const t=e.tags||{},levels=Number(t['building:levels'])||null,explicit=parseFloat(t.height),h=Number.isFinite(explicit)?explicit:levels?levels*3.2:7;
 if(h<=0)return;const inGift=pts.some(p=>inside(p,giftOutline)),inRegion=inGift||pts.some(inCivic);if(!inRegion)return;
 buildings.push({id:e.type==='relation'?`r${e.id}${suffix}`:e.id,osmType:e.type,osmId:e.id,name:t.name,kind:t.building||t['building:part']||'yes',h:Number(h.toFixed(2)),heightSource:Number.isFinite(explicit)?'height-tag':levels?'levels-estimate':'unmapped-height',levels,colour:t['building:colour'],material:t['building:material'],roofShape:t['roof:shape'],pts,...(holes.length?{holes}:{}),district:inGift?'gift':'civic'});
}
for(const e of all)if(e.type==='relation'&&e.tags?.building){const outer=joinRings(e.members.filter(m=>m.role==='outer')),holes=joinRings(e.members.filter(m=>m.role==='inner'));if(!outer.some(r=>r.some(p=>inside(p,giftOutline)||inCivic(p))))continue;for(const m of e.members)relationMembers.add(m.ref);outer.forEach((ring,i)=>building(e,ring,holes.filter(h=>inside(h[0],ring)),outer.length>1?`-${i}`:''));}
for(const e of all)if(e.type==='way'&&e.tags?.building&&e.geometry&&!relationMembers.has(e.id)&&e.tags.building!=='construction')building(e,e.geometry.map(point));
const roadKinds=new Set(['motorway','trunk','primary','secondary','tertiary','residential','unclassified','service','living_street','footway','path','pedestrian','cycleway']);
const roads=all.filter(e=>e.type==='way'&&e.geometry&&roadKinds.has(e.tags?.highway)).map(e=>{const t=e.tags;return {id:e.id,kind:t.highway,oneway:t.oneway==='-1'?-1:t.oneway==='yes'||t.junction==='roundabout'?1:0,bridge:t.bridge==='yes',...(t.tunnel==='yes'?{tunnel:true}:{}),...(t.layer?{layer:Number(t.layer)}:{}),pts:e.geometry.map(point)};}).filter(r=>r.pts.some(p=>inCivic(p)||p[0]>=giftBounds.minX-50&&p[0]<=giftBounds.maxX+50&&p[1]>=giftBounds.minZ-50&&p[1]<=giftBounds.maxZ+50));
const parkPaths=roads.filter(r=>['footway','path','pedestrian','cycleway'].includes(r.kind)&&r.pts.some(p=>plots.some(plot=>inside(p,plot.pts))));
const result={version:1,projection:{lat:23.195,lon:72.645,units:'metres',scale:1},attribution:'© OpenStreetMap contributors, ODbL',sources:sources.map(s=>({file:s.file,timestamp:s.osm3s?.timestamp_osm_base})),gift:{osmId:giftElement.id,outline:giftOutline,bounds:giftBounds,areaM2:Math.round(area(giftOutline)),buildingIds:buildings.filter(b=>b.district==='gift').map(b=>b.id)},civic:{...civicBounds},swarnim:{osmRelation:swarnim.id,plots,paths:parkPaths,areaM2:Math.round(plots.reduce((n,p)=>n+area(p.pts),0))},buildings,roads};
fs.writeFileSync(new URL('../src/data/destination-geography.json',import.meta.url),JSON.stringify(result));
console.log(JSON.stringify({giftArea:result.gift.areaM2,giftBuildings:result.gift.buildingIds.length,civicBuildings:buildings.filter(b=>b.district==='civic').length,swarnimArea:result.swarnim.areaM2,swarnimPlots:plots.length,paths:parkPaths.length,roads:roads.length,unknownGiftHeights:buildings.filter(b=>b.district==='gift'&&b.heightSource==='unmapped-height').length}));
