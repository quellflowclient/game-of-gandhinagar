import * as THREE from 'three';
import * as K from './kit.js';
import * as T from '../textures.js';
import {districtFrame,districtRing} from '../exploration-areas.js';
import {districtGround} from './district-ground.js';
import geography from '../../data/destination-geography.json' with {type:'json'};

// Actual OSM footprints. GIFT One / Two height: IL&FS GIFT Two specification,
// 122 m / G+28. Other heights retain mapped estimates. Landscape is interpreted.
const TOWERS=[
  {id:386478178,name:'GIFT ONE',height:122,style:'gift',crown:1},
  {id:386478179,name:'GIFT TWO',height:122,style:'gift',crown:-1},
  {id:922160513,name:'HIRANANDANI SIGNATURE',style:'white'},
  {id:922160514,name:'BRIGADE IFC',style:'dark'},
  {id:922160515,name:'PRAGYA',style:'teal'},
];
export function buildGift(scene,map,origin){
  const f=districtFrame('gift'),g=new THREE.Group();g.name='GIFT City · Full mapped city';g.position.set(origin.x,0,origin.z);scene.add(g);
  const area=districtRing('gift'),solids=[],aprons=[],footprints=[],roadY=districtGround(map,f);
  const pavers=K.mat(K.greyPavers(),{roughness:.84});
  const styles={gift:{bay:20,floor:30,tex:T.giftGlass(1,1),rough:.18,metal:.48},teal:K.glassFins('#2d5f66','#d7e0e2'),white:K.glassFins('#3d5a74','#f3f2ee'),dark:K.glassFins('#22313f','#9aa5ae')};
  const ids=new Set(geography.gift.buildingIds),inventory=[];
  const towers=geography.gift.buildingIds.map(id=>{const b=map.buildings.find(b=>b.id===id);if(!b)throw Error(`Missing mapped GIFT building ${id}`);return {...b,...TOWERS.find(t=>t.id===id),style:TOWERS.find(t=>t.id===id)?.style||(b.kind==='apartments'?'white':b.kind==='commercial'?'dark':'mapped')};});
  styles.mapped=K.residentialFacade('#d4d0c5','#536777');
  for(const t of towers){
    const fp=K.osmFootprint(map,t.id,f);if(!fp)throw new Error(`Missing mapped GIFT tower ${t.id}`);
    const ring=fp.ring,[u,v]=K.centroid(ring),h=t.height||fp.h;
    inventory.push({id:t.id,pts:fp.pts,holes:t.holes||[],height:h,heightSource:t.height?'published-height':t.heightSource});
    const apron=ring.map(([a,b])=>{const l=Math.hypot(a-u,b-v)||1;return [a+(a-u)*6/l,b+(b-v)*6/l];});
    footprints.push(ring);solids.push({poly:ring,holes:fp.holes});
    // Mapped low-rise/service buildings and courtyards retain their whole shape.
    if(!TOWERS.some(k=>k.id===t.id)){
      const facade=t.colour?K.residentialFacade(t.colour,'#536777'):styles[t.style];
      K.building(g,ring,h,facade,{roof:0xb9b7ad,parapet:.35,holes:fp.holes});
      if(t.name)K.textPlane(g,[t.name],{bg:'#192e3c',fg:'#f3f1e3',w:1024,h:128,font:'700 60px Inter, sans-serif'},Math.min(16,Math.max(3,h*.5)),Math.min(1.7,h*.15),u,h-2,Math.max(...ring.map(p=>p[1]))+.08);
      continue;
    }
    K.slab(g,apron,.08,pavers,0,3);aprons.push(apron);
    K.building(g,ring,10,K.glassFins('#26394b','#c9d2da'),{roof:0x9aa3ab,parapet:0,holes:fp.holes});
    K.building(g,ring,h,styles[t.style],{roof:0xa7b0b7,base:10,parapet:1,parapetColor:0xdfe7ee,holes:fp.holes});
    if(t.crown){
      const positions=[];
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],ha=h+1.2+(a[0]-u)*.055*t.crown,hb=h+1.2+(b[0]-u)*.055*t.crown;
        positions.push(a[0],h-1,a[1],b[0],h-1,b[1],a[0],ha,a[1],a[0],ha,a[1],b[0],h-1,b[1],b[0],hb,b[1]);
      }
      const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.computeVertexNormals();g.add(new THREE.Mesh(geo,K.mat(0xcbd8df,{metalness:.5,roughness:.35})));
    }
    // Entrance follows the southern edge of the real rotated footprint.
    const edges=ring.map((a,i)=>({a,b:ring[(i+1)%ring.length]})).sort((a,b)=>(b.a[1]+b.b[1])-(a.a[1]+a.b[1]));
    const {a,b}=edges[0],mx=(a[0]+b[0])/2,mv=(a[1]+b[1])/2,dx=b[0]-a[0],dv=b[1]-a[1],len=Math.hypot(dx,dv);
    let nx=-dv/len,nv=dx/len;if(nx*(mx-u)+nv*(mv-v)<0){nx=-nx;nv=-nv;}
    const yaw=Math.atan2(nx,nv),cu=mx+nx*2.5,cv=mv+nv*2.5;
    K.box(g,12,.35,5,K.mat(0xdde2e4,{metalness:.45,roughness:.3}),cu,5,cv,yaw);
    for(const s of [-1,1]){
      const pu=cu+Math.cos(yaw)*s*5.2+nx*1.8,pv=cv-Math.sin(yaw)*s*5.2+nv*1.8;
      if(roadY(pu,pv)<.2){K.cyl(g,.14,.14,5,0xc0c9ce,pu,.08,pv,12);solids.push({circle:[pu,pv,.17]});}
    }
    K.textPlane(g,[t.name],{bg:'#192e3c',fg:'#f3f1e3',w:1024,h:128,font:'700 68px Inter, sans-serif'},Math.min(18,len*.7),2,mx+nx*.2,h-5,mv+nv*.2,yaw);
    for(const s of [-1,1]){
      const pu=mx+dx/len*s*(len/2+3)+nx*5,pv=mv+dv/len*s*(len/2+3)+nv*5;
      if(roadY(pu,pv)<.2){K.palm(g,pu,pv,.9);solids.push({circle:[pu,pv,.3]});}
    }
  }
  // Retained map buildings must also block walking.
  for(const b of map.buildings)if(!ids.has(b.id)){
    const ring=b.pts.map(p=>{const l=f.toLocal(...p);return [l.u,l.v];});
    if(ring.some(p=>K.pointInPolygon(...p,area)))solids.push({poly:ring});
  }
  const free=(u,v,r=2)=>K.pointInPolygon(u,v,area)&&roadY(u,v)<.2&&!solids.some(s=>s.poly&&K.nearPolygon(u,v,s.poly,r));
  for(let v=-110;v<360;v+=32)for(const u of [-220,275])if(free(u,v,5)){
    K.tree(g,u,v,.95);solids.push({circle:[u,v,.4]});
    if(free(u+4,v,2)){K.streetLight(g,u+4,v,Math.PI/2,{h:6});solids.push({circle:[u+4,v,.15]});}
  }
  for(const [u,v] of [[-83,48],[4,54],[154,148],[-203,193],[119,250]])if(free(u,v,5)&&free(u+3,v,2)){
    K.slab(g,[[u-5,v-3],[u+5,v-3],[u+5,v+3],[u-5,v+3]],.08,pavers,0,3);
    K.bench(g,u,v,Math.PI);solids.push({rect:[u,v,2.1,.8]});
    K.cyl(g,.6,.6,.55,0xafa697,u+3,.08,v,16);K.sphere(g,.8,0x466346,u+3,.85,v);solids.push({circle:[u+3,v,.85]});
    aprons.push([[u-5,v-3],[u+5,v-3],[u+5,v+3],[u-5,v+3]]);
  }
  K.mergeStatic(g);
  const zone=K.createSiteZone({id:'gift-city',f,area,solids,vehicleFree:footprints,groundY:(u,v)=>Math.max(roadY(u,v),aprons.some(p=>K.pointInPolygon(u,v,p))?.088:.008)});
  zone.clearing={replacesBuilding:b=>ids.has(b.id),contains(x,z){const {u,v}=f.toLocal(x,z);return footprints.some(p=>K.nearPolygon(u,v,p,.5));}};
  const residents=[[-77,50],[-20,54],[14,57],[58,65],[-102,116],[13,170],[144,234]].map(([u,v])=>({...f.toWorld(u,v),r:3}));
  return {group:g,zone,frame:f,inventory,spawn:{...f.toWorld(-31,27),yaw:0,residents},update(){}};
}
