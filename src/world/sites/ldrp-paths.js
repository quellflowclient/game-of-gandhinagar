import * as K from './kit.js';
export function ldrpCyclePaths(layout,map,f) {
  const paths=[];
  for(const road of map.roads) {
    if(!['service','residential','footway','pedestrian','path','cycleway'].includes(road.kind))continue;
    const pts=road.pts.map(([x,z])=>{const p=f.toLocal(x,z);return[p.u,p.v];});
    for(let i=1;i<pts.length;i++)if(K.nearPolygon(...pts[i],layout.area,2)||K.nearPolygon(...pts[i-1],layout.area,2))paths.push({points:[pts[i-1],pts[i]],width:['footway','path'].includes(road.kind)?2.4:5.5,height:0.15,kind:'drive'});
  }
  paths.push({points:[[layout.gates[0].u,layout.gates[0].v],layout.hub],width:7,height:0.15,kind:'drive'});
  for(let i=0;i<=6;i++) {
    const a=Math.PI*0.08+Math.PI*0.84*i/6;
    paths.push({points:[layout.hub,[layout.gardenCentre[0]+Math.cos(a)*layout.gardenRadius,layout.gardenCentre[1]+Math.sin(a)*layout.gardenRadius]],width:2.6,height:0.12,kind:'garden'});
  }
  return {paths,height(u,v) {
    let y=0.03;const r=Math.hypot(u-layout.gardenCentre[0],v-layout.gardenCentre[1]);
    if(r<=50)y=0.06;if(r<=44)y=0.09;
    if(Math.hypot(u-layout.hub[0],v-layout.hub[1])<7)y=0.13;
    for(const p of paths)if(K.segDist(u,v,p.points[0],p.points[1])<=p.width/2)y=Math.max(y,p.height);
    return y+0.008;
  },allowed(u,v,r) {
    if(r<0.5||!K.pointInPolygon(u,v,layout.area))return true;
    const ringDistance=Math.hypot(u-layout.gardenCentre[0],v-layout.gardenCentre[1]);
    if(Math.abs(ringDistance-47)<3-r||Math.hypot(u-layout.hub[0],v-layout.hub[1])<7-r)return true;
    return paths.some(p=>K.segDist(u,v,p.points[0],p.points[1])<=p.width/2-r);
  }};
}
