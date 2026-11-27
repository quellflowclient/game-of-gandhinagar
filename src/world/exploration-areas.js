import {placeById,placePos} from '../data/places.js';
import {inLdrpArea,marketPoint,toMarket,LDRP_PLAY_AREA} from './sites/ldrp-market-layout.js';
import {siteToWorld,worldToSite} from './mahatma-layout.js';
import geography from '../data/destination-geography.json' with {type:'json'};
import {insideWithMargin,ringDistance} from './geographic-polygons.js';

// The real civic corridor is one area. Distant destinations remain metro transfers.
// Local coordinates also drive site dressing, clipping, arrival and boundary checks.
export const DISTRICTS = {
  swarnim:{yaw:1.04,minU:-184,maxU:100,minV:200,maxV:475,label:'Swarnim Park · Central Vista'},
  swagat:{yaw:.531,minU:-62,maxU:65,minV:-55,maxV:44,label:'Swagat Holiday Mall · Sargasan'},
  gift:{yaw:0,minU:geography.gift.bounds.minX-placePos(placeById('gift')).x,maxU:geography.gift.bounds.maxX-placePos(placeById('gift')).x,minV:geography.gift.bounds.minZ-placePos(placeById('gift')).z,maxV:geography.gift.bounds.maxZ-placePos(placeById('gift')).z,label:'GIFT City · Full mapped boundary'},
};
export const CIVIC_AREA=geography.civic;
export const explorationAreaForPlace=id=>id==='swarnim'?'dandi':id;
export const explorationAreaLabel=id=>id==='dandi'?'Mahatma Mandir · Swarnim Park':placeById(id)?.name||'Local area';
export function districtFrame(id){
  const origin=placePos(placeById(id)),a=DISTRICTS[id]?.yaw||0,c=Math.cos(a),s=Math.sin(a);
  return {origin,yaw:a,toWorld:(u,v)=>({x:origin.x+u*c+v*s,z:origin.z-u*s+v*c}),toLocal:(x,z)=>({u:(x-origin.x)*c-(z-origin.z)*s,v:(x-origin.x)*s+(z-origin.z)*c})};
}
{
  const f=districtFrame('swarnim'),points=geography.swarnim.plots.flatMap(p=>p.pts.map(([x,z])=>f.toLocal(x,z)));
  Object.assign(DISTRICTS.swarnim,{minU:Math.min(...points.map(p=>p.u))-8,maxU:Math.max(...points.map(p=>p.u))+8,minV:Math.min(...points.map(p=>p.v))-8,maxV:Math.max(...points.map(p=>p.v))+8});
}
export function districtRing(id){if(id==='gift'){const f=districtFrame(id);return geography.gift.outline.map(([x,z])=>{const p=f.toLocal(x,z);return [p.u,p.v];});}const b=DISTRICTS[id];return [[b.minU,b.minV],[b.maxU,b.minV],[b.maxU,b.maxV],[b.minU,b.maxV]];}
export function explorationAreaAt(x,z,margin=0){
  if(inLdrpArea(placePos(placeById('ldrp')),x,z,margin))return 'ldrp';
  const d=worldToSite(placePos(placeById('dandi')),x,z);
  const b=CIVIC_AREA;if(d.u>=b.minU+margin&&d.u<=b.maxU-margin&&d.v>=b.minV+margin&&d.v<=b.maxV-margin)return 'dandi';
  for(const [id,b] of Object.entries(DISTRICTS)){if(id==='swarnim')continue;const p=districtFrame(id).toLocal(x,z);if(p.u>=b.minU+margin&&p.u<=b.maxU-margin&&p.v>=b.minV+margin&&p.v<=b.maxV-margin&&(id!=='gift'||insideWithMargin(x,z,geography.gift.outline,margin)))return id;}
  return null;
}
export function localPlaceAt(x,z){const area=explorationAreaAt(x,z);if(area!=='dandi')return area;if(geography.swarnim.plots.some(p=>insideWithMargin(x,z,p.pts)))return 'swarnim';const p=worldToSite(placePos(placeById('dandi')),x,z);return p.v<725?'dandi':null;}
export function explorationBoundaryDistance(x,z,id){
  if(id==='gift')return ringDistance(x,z,geography.gift.outline);
  const p=id==='ldrp'?toMarket(placePos(placeById('ldrp')),x,z):id==='dandi'?worldToSite(placePos(placeById('dandi')),x,z):districtFrame(id).toLocal(x,z);
  const b=id==='ldrp'?LDRP_PLAY_AREA:id==='dandi'?CIVIC_AREA:DISTRICTS[id];
  return Math.min(p.u-b.minU,b.maxU-p.u,p.v-b.minV,b.maxV-p.v);
}
export function explorationCorners(){
  const l=placePos(placeById('ldrp')),b=LDRP_PLAY_AREA,d=placePos(placeById('dandi'));
  return [
    [[b.minU,b.minV],[b.maxU,b.minV],[b.maxU,b.maxV],[b.minU,b.maxV]].map(p=>marketPoint(l,...p)),
    [[CIVIC_AREA.minU,CIVIC_AREA.minV],[CIVIC_AREA.maxU,CIVIC_AREA.minV],[CIVIC_AREA.maxU,CIVIC_AREA.maxV],[CIVIC_AREA.minU,CIVIC_AREA.maxV]].map(p=>siteToWorld(d,...p)),
    ...['swagat','gift'].map(id=>districtRing(id).map(p=>districtFrame(id).toWorld(...p))),
  ];
}
