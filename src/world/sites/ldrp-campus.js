import * as THREE from 'three';
import * as K from './kit.js';
import {ROAD5_OUTER_EXPANSION} from './ldrp-market-layout.js';
import {buildLdrpMarket} from './ldrp-market.js';
import {roadClearance} from '../metro-road-clearance.js';
import {createVehicleModel} from '../vehicle-models.js';
import * as D from './ldrp-dressing.js';
import {PHOTO_YAW,ACADEMIC_WING_ANGLES,ACADEMIC_LINKS,HOSTEL_YARD,photoPoint as P,CAMPUS_BOUNDARY,CAMPUS_DRIVES,GARDEN_PATHS,GARDEN_PROMENADE,ENTRY_APRON,FOUR_GARDENS,GARDEN_CENTRE,INSIDE_PARKING,OUTSIDE_PARKING,CAMPUS_BLOCKS,referenceHeight,pointIn,distance,GATE_FORECOURT,BUS_DEPOT,FLAG_POINT,OUTSIDE_APRON,APRON_Y,GATE_GARDEN,WEST_BUS_PARK,WEST_METRO_PIERS,CAMPUS_SHOPS,WEST_JUNCTION} from './ldrp-reference.js';

export const REFERENCE_LDRP={area:CAMPUS_BOUNDARY,gates:[{u:0,v:0,width:24,main:true}],gardenCentre:GARDEN_CENTRE,gardenRadius:43,hub:P(211,51)};
export function buildReferenceCampus(scene,map,origin){
 const gateOrigin={x:origin.x-25+Math.sin(PHOTO_YAW)*(6.5+ROAD5_OUTER_EXPANSION),z:origin.z-87.93+Math.cos(PHOTO_YAW)*(6.5+ROAD5_OUTER_EXPANSION)},f=K.frame(gateOrigin,PHOTO_YAW),g=new THREE.Group();g.position.set(gateOrigin.x,0,gateOrigin.z);g.rotation.y=PHOTO_YAW;g.name='LDRP reference campus';scene.add(g);
 const solids=[],trees=[],lamps=[],parking=[],gardenSeats=[],entry={allowed:false,checking:false,open:0},actors=[];
 const floor=K.mat(K.greyPavers(),{color:0xa9a197,roughness:.97}),brick=K.mat(K.brickPaving(),{color:0xc6b2a1,roughness:.95}),lawn=K.mat(K.lawnTex(),{color:0xa2ae82,roughness:1});
 const rect=(a,b,c,d)=>[[a,c],[b,c],[b,d],[a,d]],photoRect=r=>rect(r[0],r[2],r[1],r[3]).map(p=>P(...p));
 const offRoad=roadClearance(map),facade=K.ksvFacade(),hostelFacade=K.residentialFacade(0xd2cebd,0x899082);
 K.slab(g,CAMPUS_BOUNDARY,.03,K.mat(K.dryGround(),{color:0xc4bba9,roughness:1}),0,5);
 // Continuous drives traced from the black annotation, with the interlocking
 // red/grey paving seen throughout the user's 64-second campus video.
 // Curb stones stop wherever they would sit on another drive, path, forecourt
 // or depot, so junctions are one smooth concrete surface.
 const paved=(u,v,skip)=>CAMPUS_DRIVES.some((d,i)=>i!==skip&&D.pathDistance(u,v,d.points)<d.width/2+.25)||GARDEN_PATHS.some(d=>D.pathDistance(u,v,d.points)<d.width/2+.25)||D.pathDistance(u,v,GARDEN_PROMENADE.points)<2.45||pointIn(u,v,GATE_FORECOURT)||pointIn(u,v,BUS_DEPOT)||pointIn(u,v,WEST_BUS_PARK)||pointIn(u,v,WEST_JUNCTION)||pointIn(u,v,CAMPUS_SHOPS.yard);
 const curbRuns=(points,skip)=>{const runs=[];let run=[];for(const p of D.resample(points,.3)){if(!paved(p[0],p[1],skip))run.push(p);else{if(run.length>1)runs.push(run);run=[];}}if(run.length>1)runs.push(run);return runs;};
 D.concreteSlab(g,GATE_FORECOURT,.149);D.concreteSlab(g,HOSTEL_YARD,.149);
 const westPassage=CAMPUS_DRIVES[1].points;
 D.concreteSlab(g,WEST_BUS_PARK,.149);D.concreteSlab(g,WEST_JUNCTION,.149);D.concreteSlab(g,CAMPUS_SHOPS.yard,.149);
 for(const [index,path]of CAMPUS_DRIVES.entries()){
  D.concreteDrive(g,path.points,path.width,path.height);
  for(const side of [-1,1])curbRuns(D.offsetPoints(path.points,side*(path.width/2+.1)),index).forEach(run=>D.stoneCurb(g,run,path.height,{height:.2}));
  map.roads.push({id:`ldrp-reference-${index}`,kind:'service',campus:true,width:path.width,surfaceHeight:path.height,pts:path.points.map(p=>{const w=f.toWorld(...p);return[w.x,w.z];})});
 }
 // Four separate garden lawns, with a clear cross-path and front promenade.
 const frontArc=GARDEN_PROMENADE.points,shrubs=D.createShrubbery(),grass=D.createGrassBorders();
 D.paverWalk(g,frontArc,4.4,.14);
 // Split at path junctions instead of dropping an entire curved border when
 // just one point touches an entrance. Border follows the outer planted edge.
 for(const side of [-1,1]){let run=[];const flush=()=>{if(run.length>1)D.stoneCurb(g,run,.14,{height:.22,width:.24});run=[];};
  for(const [u,v]of D.resample(D.offsetPoints(frontArc,side*2.3),.35)){
   if(CAMPUS_DRIVES.some(d=>D.pathDistance(u,v,d.points)<d.width/2+.2)||pointIn(u,v,GATE_FORECOURT)||GARDEN_PATHS.some(d=>D.pathDistance(u,v,d.points)<d.width/2+.18))flush();else run.push([u,v]);
  }flush();
 }
 for(const path of GARDEN_PATHS)D.paverWalk(g,path.points,path.width,path.height);
 // Front tree beds end at the road-side outline, rather than at the inner
 // hedge. Rounded tips leave the central gate approach completely open.
 const frontBeds=[];
 for(const mirror of [false,true]){
  const outline=[[137,54.5],[180,54.5],[187,54.9],[192,56.5],[195,59.5],[193,61.5],[137,61.5]].map(([x,y])=>P(mirror?422-x:x,y));
  K.slab(g,outline,.1,K.mat(K.dryGround(),{color:0xb8ab88,roughness:1}));
  D.stoneCurb(g,[...outline,outline[0]],.1,{height:.25,width:.24});frontBeds.push({poly:outline});
  for(const x of [145,162,179]){const [u,v]=P(mirror?422-x:x,58);K.tree(g,u,v,.55);trees.push([u,v,.22]);}
 }
 solids.push(...frontBeds);
 for(const [index,poly]of FOUR_GARDENS.entries()){
  K.slab(g,poly,.09,lawn,0,3.5);
  let lawnCurb=[];const flushLawn=()=>{if(lawnCurb.length>1)D.stoneCurb(g,lawnCurb,.09,{height:.25,width:.26});lawnCurb=[];};
  for(const p of D.resample([...poly,poly[0]],.35)){if(frontBeds.some(b=>K.nearPolygon(p[0],p[1],b.poly,1.3)))flushLawn();else lawnCurb.push(p);}flushLawn();
  const [u,v]=K.centroid(poly),homes=[];
  for(let j=0;j<3;j++){const x=u+(j-1)*1.6,z=v-.5;if(!pointIn(x,z,poly))continue;const w=f.toWorld(x,z);homes.push([x,z]);gardenSeats.push({id:`ldrp-garden-${index}-${j}`,x:w.x,y:.098,z:w.z,yaw:-PHOTO_YAW+Math.PI,kind:'ground',garden:index});}
  const plantHere=(x,z,r)=>pointIn(x,z,poly)&&D.pathDistance(x,z,[...poly,poly[0]])>r+.18&&GARDEN_PATHS.every(path=>D.pathDistance(x,z,path.points)>path.width/2+r+.2)&&D.pathDistance(x,z,frontArc)>2.2+r&&homes.every(([a,b])=>Math.hypot(a-x,b-z)>r+1.1)&&Math.hypot(x-FLAG_POINT[0],z-FLAG_POINT[1])>r+2.3;
  for(const [du,dv]of [[-2,-3],[2.2,-2.8]])if(plantHere(u+du,v+dv,.65)){K.palm(g,u+du,v+dv,.65);trees.push([u+du,v+dv,.22]);}
  grass.add(poly,poly.filter((_,i)=>i%6===0),{inset:.8,band:.65});
  for(const [pu,pv]of poly.filter((_,i)=>i%4===0)){const x=pu+(u-pu)*.35,z=pv+(v-pv)*.35;if(plantHere(x,z,.8)){shrubs.topiary(x,z,.8);trees.push([x,z,.15]);}}
 }
 const [flagU,flagV]=FLAG_POINT;
 for(let tier=0;tier<3;tier++)K.cyl(g,2.1-tier*.48,2.1-tier*.48,.2,0xaaa997,flagU,.12+tier*.2,flagV,32);
 const flag=K.flagPole(g,flagU,flagV,undefined,{height:25,width:4.5});solids.push({circle:[flagU,flagV,2.2]});

 // Curved academic frontage with four outward wings and visible open courts.
 const arc=(rx,ry,n=64)=>Array.from({length:n+1},(_,i)=>P(211+rx*Math.cos(i*Math.PI/n),50+ry*Math.sin(i*Math.PI/n)));
 const frontRing=[...arc(112,101),...arc(88,78).reverse()];K.building(g,frontRing,13.6,facade,{roof:0xd2cebd,parapet:.65});solids.push({poly:frontRing});
 for(const a of ACADEMIC_WING_ANGLES){
  const base=[211+109*Math.cos(a),50+98*Math.sin(a)],side=[-Math.sin(a),Math.cos(a)],dir=[Math.cos(a),Math.sin(a)];
  const wing=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>P(base[0]+side[0]*x+dir[0]*z,base[1]+side[1]*x+dir[1]*z));
  const strips=[[-24,24,0,11],[-24,-12,11,46],[12,24,11,46],[-12,12,35,46]];
  for(const r of strips)K.building(g,wing(...r),13.6,facade,{roof:0xd2cebd,parapet:.65});
  K.slab(g,wing(-12,12,11,35),.08,floor);solids.push({poly:wing(-24,24,0,46)});
 }
 for(const poly of ACADEMIC_LINKS){K.building(g,poly,13.6,facade,{roof:0xd2cebd,parapet:.65});solids.push({poly});}
 const [pu,pv]=P(211,124);K.box(g,16,.52,5,0xa2aba8,pu,6.8,pv-1);
 for(const x of [-6.5,6.5]){K.box(g,.65,6.8,.65,0x72817c,pu+x,0,pv-3.1);solids.push({circle:[pu+x,pv-3.1,.45]});}
 K.textPlane(g,['LDRP INSTITUTE OF TECHNOLOGY & RESEARCH'],{bg:'#b9bfb7',fg:'#31453e'},15,.65,pu,7.1,pv-3.55,Math.PI);
 K.textPlane(g,['ATM','KALUPUR BANK'],{bg:'#234480',fg:'#f3f4e9',h:320},2.8,2,P(135,109)[0],2.2,P(135,109)[1],Math.PI);
 for(const block of CAMPUS_BLOCKS){
  if(block.id==='social-work'){const [u,v]=P(176,197);K.textPlane(g,[block.label],{bg:'#c5c6b9',fg:'#344b4b'},19,1.0,u,3.0,v,Math.PI);continue;}
  const [x0,y0,x1,y1]=block.rect,ring=photoRect(block.rect),baseFacade=block.id==='faculty-residences'?K.residentialFacade(0xd8cfbb,0x7d8d94):block.id.includes('hostel')?hostelFacade:facade,mat=block.floors?{...baseFacade,floor:block.h/block.floors}:baseFacade;
  if(block.smallHouse){
   const [cu,cv]=K.centroid(ring),w=(x1-x0)*.55,d=(y1-y0)*.55;
   K.box(g,w,block.h,d,K.mat(0xd3c5ad,{roughness:1}),cu,0,cv);
   const roofMat=K.mat(0x856750,{roughness:.9}),slope=.32;
   for(const side of [-1,1]){const roof=new THREE.Mesh(new THREE.BoxGeometry(w/2+.45,.12,d+.55),roofMat);roof.position.set(cu+side*w/4,block.h+.18+w/4*Math.sin(slope),cv);roof.rotation.z=-side*slope;g.add(roof);}
   K.box(g,.95,1.9,.05,0x665448,cu,0,cv-d/2-.03);K.box(g,1.0,.85,.05,0x5a747b,cu+w*.3,1,cv-d/2-.03);
   solids.push({poly:ring});continue;
  }
  if(block.premium){
   const [cu,cv]=K.centroid(ring),w=(x1-x0)*.55,d=(y1-y0)*.55;
   K.building(g,ring,block.h,{...K.residentialFacade(0xe0d9c8,0x76979b),floor:3.4},{roof:0xc6c3b7,parapet:.35});
   const glazing=K.mat(0x527e8a,{metalness:.4,roughness:.15}),stone=K.mat(0xe5dfcd),bronze=K.mat(0x8a7050,{metalness:.6,roughness:.4});
   for(let floor=0;floor<3;floor++){
    K.box(g,w-.6,2.15,.06,glazing,cu,floor*3.4+.6,cv+d/2+.02);
    K.box(g,w+.15,.2,.55,stone,cu,floor*3.4+.1,cv+d/2-.25);
    for(let x=-w/2+.6;x<w/2;x+=3)K.box(g,.1,2.65,.14,bronze,cu+x,floor*3.4+.3,cv+d/2+.05);
   }
   K.box(g,4.2,.2,1.6,stone,cu,3.0,cv+d/2-.4);K.textPlane(g,['GUEST HOUSE'],{bg:'#d9d2bd',fg:'#6f5739'},Math.min(12,w-.5),.6,cu,block.h-.5,cv+d/2+.12);
  }
  else if(block.court){const w=11;for(const r of [[x0,y0,x1,y0+w],[x0,y1-w,x1,y1],[x0,y0+w,x0+w,y1-w],[x1-w,y0+w,x1,y1-w]])K.building(g,photoRect(r),block.h,mat,{roof:0xcac5b5,parapet:.6});K.slab(g,photoRect([x0+11,y0+11,x1-11,y1-11]),.08,floor);}
  else K.building(g,ring,block.h,mat,{roof:0xcac5b5,parapet:.6});
  solids.push({poly:ring});const [u,v]=P((x0+x1)/2,y0);K.textPlane(g,[block.label],{bg:'#d6d5c7',fg:'#344b4b',h:180},Math.min(24,(x1-x0)*.5),1.0,u,3.2,v-.05,Math.PI);
  const [cu,cv]=K.centroid(ring);for(let j=0;j<2;j++)K.cyl(g,.65,.7,1.1,0x313c39,cu+j*1.8,block.h+.3,cv,12);
 }
 // Parking relocated to annotation 2, below the separate academic block.
 K.slab(g,INSIDE_PARKING,.16,floor);parking.push({id:'inside',label:'Academic block · Inside two-wheeler parking',polys:[INSIDE_PARKING],inside:true,slots:[]});
 const outside=[OUTSIDE_PARKING,[[243,-2],[610,-5],[610,12],[243,15]].map(p=>P(...p))];
 for(const poly of outside)K.slab(g,poly,.02,K.mat(K.dryGround(),{color:0xb6ad96,roughness:1}),0,4);
 parking.push({id:'outside',label:'Road No. 5 · Outside parking',polys:outside,inside:false,slots:[]});
 // Roadside footpath stays raised, with one six-metre flush driveway per lot.
 const parkingWalks=[],parkingAccess=[];
 for(const [lotIndex,poly]of outside.entries()){
  const edge=poly.slice(0,lotIndex===0?3:2),centre=K.centroid(poly);
  const lengths=edge.slice(1).map((b,i)=>Math.hypot(b[0]-edge[i][0],b[1]-edge[i][1]));
  const total=lengths.reduce((a,b)=>a+b,0),entryAt=total/2;let travelled=0;
  for(let i=0;i<lengths.length;i++){
   const a=edge[i],b=edge[i+1],len=lengths[i],dx=(b[0]-a[0])/len,dz=(b[1]-a[1])/len;
   const sign=Math.sign(-dz*(centre[0]-a[0])+dx*(centre[1]-a[1]))||1,nx=-dz*sign,nz=dx*sign;
   const at=(d,w)=>[a[0]+dx*d+nx*w,a[1]+dz*d+nz*w];
   const lo=Math.max(0,entryAt-3-travelled),hi=Math.min(len,entryAt+3-travelled);
   const spans=hi>lo?[[0,lo],[hi,len]]:[[0,len]];
   if(hi>lo){const access=[at(lo,0),at(hi,0),at(hi,3),at(lo,3)];parkingAccess.push(access);D.concreteSlab(g,access,.025);}
   // The sketch's lot edge is not the asphalt edge. Move the whole path
   // footprint into the lot until it clears actual widened road geometry.
   const clearPoint=([u,v])=>{const w=f.toWorld(u,v);return pointIn(u,v,poly)&&offRoad(w.x,w.z,.3)&&!K.nearPolygon(u,v,OUTSIDE_APRON,1)&&!K.nearPolygon(u,v,ENTRY_APRON,.65)&&!K.nearPolygon(u,v,CAMPUS_BOUNDARY,.12);};
   for(const [start,end]of spans){if(end-start<.2)continue;
    let run=[];
    const flush=()=>{
     if(run.length>1){const left=D.offsetPoints(run,.7),right=D.offsetPoints(run,-.7),ring=[...left,...right.slice().reverse()];
      if(ring.every(clearPoint)){parkingWalks.push(ring);const walk=K.slab(g,ring,.02,D.materials().paver,.46,1.4);walk.name='Road-aligned raised parking footpath';for(const edge of [left,right])D.stoneCurb(g,edge,.02,{height:.46,width:.17});}
     }run=[];
    };
    const count=Math.max(1,Math.ceil(end-start));
    for(let k=0;k<=count;k++){
     const d=start+(end-start)*k/count;let p=null;
     for(let inset=.95;inset<9;inset+=.2){const c=at(d,inset);if([-.85,0,.85].every(w=>[-.55,0,.55].every(l=>clearPoint([c[0]+nx*w+dx*l,c[1]+nz*w+dz*l])))){p=c;break;}}
     if(!p){flush();continue;}if(run.length&&Math.hypot(p[0]-run.at(-1)[0],p[1]-run.at(-1)[1])>1.8)flush();run.push(p);
    }flush();
   }
   travelled+=len;
  }
 }
 const onParkingWalk=(u,v,r=0)=>parkingWalks.some(poly=>K.nearPolygon(u,v,poly,r));
 const bayFits=(u,v,lot,poly)=>{
  // Validate the whole bay, not just its centre: no wheel/body overhang into
  // the gate apron, a drive, the new footpath or a vehicle access opening.
  const halfW=lot.inside?.58:1.3,halfD=lot.inside?1.12:2.4;
  return [-halfW,0,halfW].every(x=>[-halfD,0,halfD].every(z=>{
   const a=u+x,b=v+z;if(!pointIn(a,b,poly))return false;
   if(lot.inside)return !solids.some(s=>s.poly&&K.nearPolygon(a,b,s.poly,.15));
   const w=f.toWorld(a,b);
   return offRoad(w.x,w.z,.35)&&!pointIn(a,b,CAMPUS_BOUNDARY)&&!K.nearPolygon(a,b,OUTSIDE_APRON,.7)&&!K.nearPolygon(a,b,ENTRY_APRON,.7)&&!onParkingWalk(a,b,.2)&&!parkingAccess.some(p=>K.nearPolygon(a,b,p,.25));
  }));
 };

 for(const lot of parking){
  for(const poly of lot.polys){const minU=Math.min(...poly.map(p=>p[0])),maxU=Math.max(...poly.map(p=>p[0])),minV=Math.min(...poly.map(p=>p[1])),maxV=Math.max(...poly.map(p=>p[1]));
   let n=0;for(let u=minU+2;u<maxU-1;u+=lot.inside?1.25:3.2)for(let v=minV+1.3;v<maxV-1;v+=lot.inside?4:5.7){if(!bayFits(u,v,lot,poly))continue;const w=f.toWorld(u,v);if(!lot.inside&&(!offRoad(w.x,w.z,2.7)||pointIn(u,v,CAMPUS_BOUNDARY)))continue;if(lot.inside&&solids.some(s=>s.poly&&K.nearPolygon(u,v,s.poly,1)))continue;
    const yaw=PHOTO_YAW,slot={...w,y:lot.inside?.178:.04,yaw,id:`${lot.id}-${n++}`,occupied:false};lot.slots.push(slot);
    const ambient=lot.inside?lot.slots.length%4!==0:lot.slots.length%3!==0;
    if(ambient){slot.occupied=true;if(!lot.inside&&lot.slots.length%4===0){const car=new THREE.Group();car.position.set(u,.02,v);g.add(car);const vehicle=createVehicleModel(n%2?'sedan':'hatch');for(const part of vehicle.parts){const mesh=new THREE.Mesh(part.geometry,part.material);if(part.paint)part.material.color.setHex([0xe2e0d7,0x8b9995,0x272e32][n%3]);car.add(mesh);}solids.push({rect:[u,v,1.95,4.5,0]});}else{slot.anchor=K.scooter(g,u,v,0,0x344942);slot.anchor.position.y+=lot.inside?.16:.02;solids.push({rect:[u,v,1,2.05,0]});}}
    for(const side of [-1,1]){const w=lot.inside?.58:1.25,d=lot.inside?1.05:2.3;K.strip(g,[[u+side*w,v-d],[u+side*w,v+d]],.05,lot.inside?.18:.04,0xd3cdb6);}
   }
   const [cu,cv]=K.centroid(poly);K.textPlane(g,[lot.inside?'TWO WHEELERS ONLY':'OUTSIDE PARKING','P'],{bg:'#426059',fg:'#f2ecda',h:300},4,1.6,cu,2.1,cv,Math.PI);
  }
 }
 // Reference wall: weathered pale masonry, scalloped coping and dark pickets.
 const walls=K.compoundWall(g,CAMPUS_BOUNDARY,REFERENCE_LDRP.gates,{height:1.85,railing:false});
 for(let i=0;i<CAMPUS_BOUNDARY.length;i++){
  const a=CAMPUS_BOUNDARY[i],b=CAMPUS_BOUNDARY[(i+1)%CAMPUS_BOUNDARY.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
  for(let d=1;d<len;d+=9){const u=a[0]+(b[0]-a[0])*d/len,v=a[1]+(b[1]-a[1])*d/len;if(Math.hypot(u,v)<14||pointIn(u,v+2.5,HOSTEL_YARD)||pointIn(u,v+2.5,WEST_BUS_PARK)||pointIn(u,v+2.5,CAMPUS_SHOPS.yard)||pointIn(u,v+2.5,WEST_JUNCTION)||D.pathDistance(u,v+2.5,WEST_BUS_PARK.concat([WEST_BUS_PARK[0]]))<3)continue;K.tree(g,u,v+2.5,.65+(i%3)*.1);trees.push([u,v+2.5,.28]);}
 }
 const gate=new THREE.Group();gate.name='Photo reference main gate';g.add(gate);
 for(const x of [-12,0,12]){K.box(gate,.85,5.3,1.2,0x9d9f90,x,0,0);K.box(gate,1.1,.2,1.4,0x858c80,x,5.3,0);solids.push({rect:[x,0,.9,1.2]});}
 K.box(gate,25,.58,1.3,0x898f81,0,5.45,0);K.textPlane(gate,['LILABEN DASHRATHBHAI RAMDAS PATEL INSTITUTE OF TECHNOLOGY AND RESEARCH'],{bg:'#898f81',fg:'#d0bb83',font:'600 62px sans-serif'},24.6,.48,0,5.76,-.67,Math.PI);
 for(const [x,text]of [[-6,'MANAGED BY SARVA VIDYALAYA KELAVANI MANDAL'],[6,'DO GOOD, FOR GOOD WILL COME BACK TO YOU']]){K.box(gate,10.7,.43,1.15,0xa0a390,x,4.3,.05);K.textPlane(gate,[text],{bg:'#a0a390',fg:'#5c6655'},10.3,.31,x,4.55,-.55,Math.PI);}
 // Outside apron: one even concrete surface from Road 5 to the gate. Everything
 // standing on it lives in `front`, lifted to the apron top.
 D.concreteSlab(g,OUTSIDE_APRON,APRON_Y);
 const front=new THREE.Group();front.position.y=APRON_Y;g.add(front);
 // Outside the gate: one umbrella over a small table where a guard sits.
 K.box(front,1.0,.04,.6,0x8a6b4a,0,.74,-5.6);for(const dx of [-.44,.44])for(const dz of [-.24,.24])K.box(front,.04,.74,.04,0x4a3a2a,dx,0,-5.6+dz);
 K.box(front,.3,.02,.22,0xf1ead8,-.2,.76,-5.6);K.cyl(front,.05,.04,.1,0xe9e2cf,.28,.76,-5.65,10);
 K.box(front,.48,.45,.46,0x3d5e78,0,0,-4.85);K.box(front,.48,.48,.06,0x3d5e78,0,.45,-4.62);
 D.patioUmbrella(front,1.05,-5.3);solids.push({rect:[0,-5.6,1.1,.7]},{rect:[0,-4.85,.55,.55]},{circle:[1.05,-5.3,.1]});
 const booms=[];
 // Narrow pedestrian entry lane through the LEFT opening (seen from Road 5).
 // No signs: the gate rules themselves stop anyone walking out this way.
 const lane=[4.4,5.9];
 for(const x of lane)for(let z=-9.5;z<-.3;z+=2.9){for(const y of [.22,1.13])K.box(front,.06,.06,2.6,0xd7a533,x,y,z);for(let dz=-1.15;dz<1.3;dz+=.46)K.box(front,.045,1.2,.045,0xd7a533,x,0,z+dz);for(const dz of [-1.2,1.2])K.box(front,.5,.05,.08,0x8a6d22,x,0,z+dz);solids.push({rect:[x,z,.12,2.6]});}
 // Paaji's register desk right beside the left gate column, outside the wall.
 const paji={desk:[13.9,-3.35],chair:[13.9,-2.5],bike:[17.4,-4.4]};
 K.box(front,1.3,.05,.68,0x7b5636,paji.desk[0],.74,paji.desk[1]);for(const dx of [-.58,.58])for(const dz of [-.28,.28])K.box(front,.05,.74,.05,0x4a3524,paji.desk[0]+dx,0,paji.desk[1]+dz);
 K.box(front,.62,.025,.44,0xf1ead8,paji.desk[0]-.18,.79,paji.desk[1]);K.box(front,.02,.028,.44,0x7a2c22,paji.desk[0]-.18,.79,paji.desk[1]);
 K.textPlane(front,['VISITOR / HOSTEL','ENTRY REGISTER'],{bg:'#f1ead8',fg:'#3b3a35',h:200},.55,.36,paji.desk[0]-.18,.81,paji.desk[1],-Math.PI/2);
 K.box(front,.2,.03,.14,0xd9c27a,paji.desk[0]+.38,.79,paji.desk[1]-.1);K.box(front,.2,.03,.14,0xd9c27a,paji.desk[0]+.4,.82,paji.desk[1]-.08);K.cyl(front,.006,.006,.15,0x1d3d8a,paji.desk[0]+.2,.8,paji.desk[1]+.15,6).rotation.z=Math.PI/2;
 K.box(front,.52,.45,.5,0x2e5b8a,paji.chair[0],0,paji.chair[1]);K.box(front,.52,.5,.06,0x2e5b8a,paji.chair[0],.45,paji.chair[1]+.24);
 solids.push({rect:[paji.desk[0],paji.desk[1],1.4,.8]},{rect:[paji.chair[0],paji.chair[1],.6,.6]});
 let gateFlowers=null;
 // Half-circle garden just inside, between the two openings: raised curb,
 // soil, small ornamental trees, clipped bushes and flowers. Nobody walks in.
 {const [gu,gv]=GATE_GARDEN.c,gr=GATE_GARDEN.r,arc=Array.from({length:33},(_,i)=>{const a=Math.PI*i/32;return[gu+Math.cos(a)*gr,gv+Math.sin(a)*gr];});
  K.slab(g,arc,.24,K.mat(0x5b4331,{roughness:1}),.09,2);D.stoneCurb(g,[...arc,arc[0]],.15,{height:.24,width:.22});solids.push({poly:arc});
  // Security cabin sits inside the island right behind the centre column, with
  // windows onto both openings and the campus; the garden wraps its front.
  const cab=[0,2.25],cw=3.0,cd=2.5,cy=.155,glass=K.mat(0x4d665e,{roughness:.3,metalness:.15});
  K.box(g,cw,2.15,cd,0xb6bab0,cab[0],cy,cab[1]);K.box(g,cw+.3,.16,cd+.3,0x777e70,cab[0],cy+2.15,cab[1]);K.box(g,cw+.1,.12,cd+.1,0x8f948a,cab[0],cy-.04,cab[1]);
  K.box(g,2.2,.75,.04,glass,cab[0],cy+1.05,cab[1]+cd/2+.01);for(const sx of [-1,1])K.box(g,.04,.75,1.5,glass,cab[0]+sx*(cw/2+.01),cy+1.05,cab[1]);
  K.box(g,.8,1.85,.04,0x6c5440,cab[0]+cw/2-.7,cy,cab[1]+cd/2+.015);
  K.textPlane(g,['SECURITY'],{bg:'#b6bab0',fg:'#344e4c',h:120},1.6,.32,cab[0],cy+1.75,cab[1]+cd/2+.03,0);
  for(const [du,dv,k]of [[-2.0,1.3,.3],[2.0,1.3,.3]])K.tree(g,gu+du,gv+dv,k);solids.push({rect:[cab[0],cab[1],cw+.2,cd+.2]});
  for(let i=0;i<11;i++){const a=Math.PI*(i+.5)/11;shrubs.bush(gu+Math.cos(a)*(gr-.55),gv+Math.sin(a)*(gr-.55),.38);}
  shrubs.topiary(gu,gv+2.1,.5);
  const inCabin=(u,v)=>Math.abs(u-cab[0])<cw/2+.3&&v<cab[1]+cd/2+.3;
  const pts=[];for(let i=0;pts.length<150&&i<900;i++){const a=Math.PI*((i*.618)%1),rr=.45+((i*.37)%1)*(gr-.95),u=gu+Math.cos(a)*rr,v=gv+Math.sin(a)*rr;if(!inCabin(u,v))pts.push([u,.42+((i*13)%7)/60,v,Math.floor(pts.length/30)]);}
  gateFlowers=pts;}
 // ---- Stationery / xerox shop and bike repair garage (inside, west of gate) ----
 {const S=CAMPUS_SHOPS,st=S.stationery,ga=S.garage,base=.15;
  const wall=K.mat(0xe4ddcc,{roughness:.95}),trim=K.mat(0x2f5f86,{roughness:.6}),tin=K.mat(0x8d9aa3,{metalness:.5,roughness:.45}),dark=0x3a3d3a;
  // stationery: plastered box, rolled-up shutter, blue awning, counter, shelves
  {const [cx,cz]=st.c,w=st.w,d=st.d,h=3.1,front=cz+d/2;
   K.box(g,w,h,.2,wall,cx,base,cz-d/2+.1);for(const s of [-1,1])K.box(g,.2,h,d,wall,cx+s*(w/2-.1),base,cz);K.box(g,w+.3,.18,d+.3,0xcfc8b6,cx,base+h,cz);
   K.box(g,w-.4,.35,.3,0x9aa0a4,cx,base+h-.45,front-.05);
   const aw=new THREE.Mesh(new THREE.BoxGeometry(w+.2,.06,1.5),trim);aw.position.set(cx,base+h-.55,front+.65);aw.rotation.x=.22;g.add(aw);
   K.textPlane(g,['LDRP STATIONERY','XEROX · PRINT · BOOKS'],{bg:'#2f5f86',fg:'#f5f1e4',h:220},w-1.2,.7,cx,base+h-.1,front+.08,0);
   K.box(g,w-1.6,1.0,.55,0x7b5636,cx,base,front-.45);K.box(g,w-1.6,.04,.58,K.mat(0xbfd6e0,{roughness:.1,metalness:.2,transparent:true,opacity:.55}),cx,base+1.0,front-.45);
   for(let row=0;row<4;row++)for(let i=0;i<14;i++){const c=[0xc0392b,0x2e86c1,0xf1c40f,0x27ae60,0x8e44ad,0xecf0f1,0xe67e22][(i*3+row)%7];K.box(g,.12+((i*7)%3)*.03,.26,.22,c,cx-w/2+.6+i*.56,base+.45+row*.55,cz-d/2+.35);}
   for(let row=0;row<4;row++)K.box(g,w-.8,.03,.32,0x6e5a44,cx,base+.42+row*.55,cz-d/2+.35);
   K.box(g,.75,1.05,.6,0xd6d8d5,cx+w/2-1.0,base,cz-.2);K.box(g,.7,.06,.5,0x4a4f52,cx+w/2-1.0,base+1.05,cz-.2);
   for(const dx of [-2.6,2.6]){K.box(g,.5,.9,.35,0x3d5e78,cx+dx,base,front+.45);for(let k=0;k<4;k++)K.box(g,.42,.04,.3,[0xf3e9d2,0xd7e3f0,0xf0d9d9,0xe0edd2][k],cx+dx,base+.92+k*.045,front+.45);}
   solids.push({rect:[cx,cz,w+.2,d+.2]},{rect:[cx-2.6,front+.45,.6,.45]},{rect:[cx+2.6,front+.45,.6,.45]});}
  // garage: open tin shed, sloped roof, tyre stacks, workbench, compressor
  {const [cx,cz]=ga.c,w=ga.w,d=ga.d,front=cz+d/2;
   K.box(g,w,1.2,.18,0xb9846a,cx,base,cz-d/2+.09);K.box(g,w,1.6,.06,tin,cx,base+1.2,cz-d/2+.03);
   for(const s of [-1,1])K.box(g,.06,2.8,d,tin,cx+s*w/2,base,cz);
   for(const [x,z]of [[-w/2,d/2],[w/2,d/2]])K.box(g,.1,2.7,.1,dark,cx+x,base,cz+z);
   const roof=new THREE.Mesh(new THREE.BoxGeometry(w+.5,.05,d+.9),tin);roof.position.set(cx,base+2.95,cz+.2);roof.rotation.x=-.1;roof.castShadow=true;g.add(roof);
   K.textPlane(g,['BIKE GARAGE','PUNCTURE · SERVICE · AIR'],{bg:'#b0322b',fg:'#fbf3e2',h:220},w-1,.62,cx,base+2.4,front+.06,0);
   for(const [x,n]of [[-2.3,4],[-1.6,3],[2.2,5]])for(let k=0;k<n;k++){const t=new THREE.Mesh(new THREE.TorusGeometry(.3,.1,8,18),K.mat(0x1c1d1e,{roughness:.9}));t.rotation.x=Math.PI/2;t.position.set(cx+x,base+.1+k*.2,cz-.8);t.castShadow=true;g.add(t);}
   K.box(g,1.6,.85,.6,0x6b5236,cx+.4,base,cz-d/2+.5);K.box(g,1.5,.6,.03,0x3b3f42,cx+.4,base+1.2,cz-d/2+.2);
   K.cyl(g,.25,.25,.7,0xc0392b,cx+1.6,base,cz-.4,14);K.cyl(g,.05,.05,.3,dark,cx+1.6,base+.7,cz-.4,8);
   for(let k=0;k<3;k++)K.cyl(g,.12,.12,.3,[0x2e86c1,0xf1c40f,0x27ae60][k],cx-.2+k*.3,base+.85,cz-d/2+.5,10);
   solids.push({rect:[cx,cz-.6,w+.2,d-1.0]},{circle:[cx-2.3,cz-.8,.45]},{circle:[cx+2.2,cz-.8,.45]});}
 }
 for(const p of [P(125,160),P(325,200),P(425,133),P(571,131),P(85,240),P(250,17)]){K.streetLight(g,...p,0,{h:6});}
 // Street View: every internal drive is lined by a trimmed hedge with clipped
 // topiary and shade trees behind it; walkways have pink planter posts.
 const free=(u,v,m=.6)=>pointIn(u,v,CAMPUS_BOUNDARY)&&!solids.some(s=>s.poly?pointIn(u,v,s.poly):s.circle?Math.hypot(u-s.circle[0],v-s.circle[1])<s.circle[2]+m:s.rect?Math.hypot(u-s.rect[0],v-s.rect[1])<Math.hypot(s.rect[2],s.rect[3])/2+m:false)
   &&!CAMPUS_DRIVES.some(d=>D.pathDistance(u,v,d.points)<d.width/2+m)&&!GARDEN_PATHS.some(d=>D.pathDistance(u,v,d.points)<d.width/2+m)&&D.pathDistance(u,v,frontArc)>2.2+m&&!pointIn(u,v,HOSTEL_YARD)&&!pointIn(u,v,INSIDE_PARKING)&&!pointIn(u,v,BUS_DEPOT)&&!pointIn(u,v,WEST_BUS_PARK)&&!pointIn(u,v,WEST_JUNCTION)&&!pointIn(u,v,CAMPUS_SHOPS.yard)&&D.pathDistance(u,v,westPassage)>4.5&&!pointIn(u,v,GATE_FORECOURT)&&Math.hypot(u-FLAG_POINT[0],v-FLAG_POINT[1])>3.5&&Math.hypot(u,v)>16;
 // The outer stone border encloses the soil/tree strip, not just the lawn.
 // All planting stays behind the border; road and paver surfaces stay clear.
 const bedSoil=K.mat(K.dryGround(),{color:0xb8ab88,roughness:1}),bedSolids=[];
 for(const path of CAMPUS_DRIVES){if(path.width>12)continue;
  for(const side of [-1,1]){
   const centre=D.offsetPoints(path.points,side*(path.width/2+2)),runs=[];let run=[];
   for(const [u,v]of D.resample(centre,.8)){if(free(u,v,1.55))run.push([u,v]);else{if(run.length>4)runs.push(run);run=[];}}if(run.length>4)runs.push(run);
   for(const row of runs){
    const left=D.offsetPoints(row,1.45),right=D.offsetPoints(row,-1.45),bed=[...left,...right.slice().reverse()];
    if(!bed.every(([u,v])=>pointIn(u,v,CAMPUS_BOUNDARY)&&!solids.some(s=>s.poly&&K.nearPolygon(u,v,s.poly,.2))))continue;
    K.slab(g,bed,.06,bedSoil);D.stoneCurb(g,[...bed,bed[0]],.06,{height:.2,width:.18});bedSolids.push({poly:bed});
    const hedge=D.offsetPoints(row,side*1.2);shrubs.hedge(hedge,{height:.65,width:.45});
    for(const [u,v]of D.resample(row,11)){if(Math.hypot(u-row[0][0],v-row[0][1])<1.4||Math.hypot(u-row.at(-1)[0],v-row.at(-1)[1])<1.4)continue;K.tree(g,u,v,.75);trees.push([u,v,.25]);}
   }
  }
 }
 solids.push(...bedSolids);
 for(const side of [-1,1])for(const [u,v]of D.resample(D.offsetPoints(frontArc,side*2.6),6))D.potPost(g,u,v);
 for(const [u,v,r]of trees)solids.push({circle:[u,v,r]});
 K.mergeStatic(g);g.traverse(o=>{if(o.userData.lamp)lamps.push(o.material);});shrubs.build(g);solids.push(...shrubs.solids());grass.build(g);solids.push(...grass.solids());if(gateFlowers)D.flowerBed(g,gateFlowers);
 // College buses remain only in the west park, clear of the new residences.
 const busModel=()=>{const root=new THREE.Group(),m=createVehicleModel('bus');for(const part of m.parts){const mesh=new THREE.Mesh(part.geometry,part.paint?K.mat(0xe0aa1c,{roughness:.45,metalness:.3}):part.material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}g.add(root);return root;};
 // West bus park under the metro curve: one row on the campus side of the
 // pillars. A slot is used only if the whole bus is on the park slab and at
 // least 2 m clear of every pillar; each pillar gets a painted keep-clear box.
 {const line=WEST_METRO_PIERS,drive=CAMPUS_DRIVES[1];let n=0;
  for(const [i,p]of line.entries()){const q=line[Math.min(i+1,line.length-1)],r=line[Math.max(i-1,0)],yaw=Math.atan2(q[0]-r[0],q[1]-r[1]);D.keepClear(g,p[0],p[1],yaw);solids.push({circle:[p[0],p[1],1.6]});}
  for(const row of [D.offsetPoints(line,-3.9),D.offsetPoints(line,6.2),D.offsetPoints(line,10.4)])for(const [u,v]of D.resample(row,12.6)){if(n>=9)break;const near=D.resample(row,.5).sort((a,b)=>Math.hypot(a[0]-u,a[1]-v)-Math.hypot(b[0]-u,b[1]-v)),a=near[0],b=near[1]||near[0];
   const yaw=Math.atan2(b[0]-a[0],b[1]-a[1])||0,fx=Math.sin(yaw),fz=Math.cos(yaw),corners=[[-1.3,-5.5],[1.3,-5.5],[1.3,5.5],[-1.3,5.5]].map(([x,z])=>[u+x*fz+z*fx,v-x*fx+z*fz]);
   if(!corners.every(([x,z])=>pointIn(x,z,WEST_BUS_PARK)&&D.pathDistance(x,z,drive.points)>drive.width/2+1.2))continue;
   if(WEST_METRO_PIERS.some(([px,pz])=>corners.concat([[u,v]]).some(([x,z])=>Math.hypot(x-px,z-pz)<2.0)||D.pathDistance(px,pz,[corners[0],corners[1],corners[2],corners[3],corners[0]])<2.0))continue;
   const bus=busModel();bus.position.set(u,.15,v);bus.rotation.y=yaw;solids.push({rect:[u,v,2.6,11,yaw]});n++;}}


 // Exit: a full steel sliding gate retracts along the west boundary wall.
 // Built after static batching so the entire leaf remains animated as one mesh.
 const slidingGate=new THREE.Group(),gateMetal=K.mat(0x43514d,{metalness:.65,roughness:.55});
 slidingGate.name='LDRP exit sliding gate';
 for(const y of [.22,1.15,2.2])K.box(slidingGate,10.4,.12,.18,gateMetal,5.2,y,0);
 for(let x=.1;x<=10.3;x+=.28)K.box(slidingGate,.065,2.12,.085,gateMetal,x,.24,0);
 for(const x of [.12,10.28])K.box(slidingGate,.14,2.35,.22,gateMetal,x,.12,0);
 for(const x of [1,9.4]){const wheel=K.cyl(slidingGate,.13,.13,.12,0x242c29,x,.03,0,12);wheel.rotation.x=Math.PI/2;}
 K.mergeStatic(slidingGate);slidingGate.position.set(-11.2,.15,.55);g.add(slidingGate);booms.push(slidingGate);
 K.box(g,22,.025,.075,0x6f7774,-11.5,.15,.55);
 const slidingSolid={rect:[-6,.55,10.4,.25]};solids.push(slidingSolid);
 let gateLastTime=null;
 const zone=K.createSiteZone({id:'ldrp-campus',f,area:CAMPUS_BOUNDARY,solids,walls,groundY:referenceHeight,replaceRoads:true});
 const baseHeights=zone.heights;
 // Gate rules: LEFT opening (+u) = pedestrian entry only; RIGHT opening (-u) =
 // buses in/out, everyone exits there, two-wheelers may only come out.
 let gateRule=()=>false;
 const leftOpening=(u,v)=>u>.6&&u<11.4&&v>-1&&v<2.2,rightOpening=(u,v)=>u<-.6&&u>-11.4&&v>-1&&v<2.2;
 entry.side='outside';
 const inLane=u=>u>lane[0]+.1&&u<lane[1]-.1,cycleRadius=r=>(r??.38)>.45,inGarden=(u,v)=>FOUR_GARDENS.some(p=>pointIn(u,v,p));
 gateRule=(u,v,r)=>leftOpening(u,v)&&(entry.side==='inside'||cycleRadius(r)||!inLane(u));
 zone.heights=(x,z,r)=>{if(!entry.allowed)return [];const p=f.toLocal(x,z);if(gateRule(p.u,p.v,r))return [];if(cycleRadius(r)&&inGarden(p.u,p.v))return [];return baseHeights(x,z,r);};
 zone.forbidsVehicles=(x,z,margin=0,type)=>{const p=f.toLocal(x,z);if(!K.nearPolygon(p.u,p.v,CAMPUS_BOUNDARY,margin))return false;if(leftOpening(p.u,p.v)||inGarden(p.u,p.v))return true;if(rightOpening(p.u,p.v)&&entry.side==='outside')return true;return !['bike','scooter'].includes(type)||!entry.allowed||zone.blocked(p.u,p.v,margin);};
 zone.roadHeight=(x,z)=>{const p=f.toLocal(x,z);if(!zone.contains(x,z))return null;return pointIn(p.u,p.v,INSIDE_PARKING)?referenceHeight(p.u,p.v):null;};
 const outsideContains=(x,z)=>{const p=f.toLocal(x,z);return (pointIn(p.u,p.v,OUTSIDE_APRON)||offRoad(x,z,.12)&&(outside.some(poly=>pointIn(p.u,p.v,poly))||pointIn(p.u,p.v,ENTRY_APRON)))&&!zone.contains(x,z);};
 const outsideZone={id:'ldrp-outside-parking',contains:outsideContains,heights:(x,z,r=.38)=>{const p=f.toLocal(x,z);return zone.blocked(p.u,p.v,r)||gateRule(p.u,p.v,r)?[]:[pointIn(p.u,p.v,OUTSIDE_APRON)?APRON_Y+.008:onParkingWalk(p.u,p.v)?.488:pointIn(p.u,p.v,ENTRY_APRON)?referenceHeight(p.u,p.v):.028];},roadHeight:(x,z)=>{if(!outsideContains(x,z))return null;const p=f.toLocal(x,z);return pointIn(p.u,p.v,OUTSIDE_APRON)?APRON_Y:onParkingWalk(p.u,p.v)?.48:pointIn(p.u,p.v,ENTRY_APRON)?.15:.04;},forbidsVehicles:(x,z,r)=>{if(!outsideContains(x,z))return false;const p=f.toLocal(x,z);return onParkingWalk(p.u,p.v,r)||zone.blocked(p.u,p.v,r);},clearing:{contains:(x,z)=>{const p=f.toLocal(x,z);return outside.some(poly=>pointIn(p.u,p.v,poly))||pointIn(p.u,p.v,OUTSIDE_APRON)||pointIn(p.u,p.v,ENTRY_APRON);},replacesWalk:(x,z)=>{const p=f.toLocal(x,z);return outside.some(poly=>pointIn(p.u,p.v,poly))||pointIn(p.u,p.v,OUTSIDE_APRON)||pointIn(p.u,p.v,ENTRY_APRON);}}};
 const campus={gardenAt(x,z){const p=f.toLocal(x,z);return FOUR_GARDENS.findIndex(poly=>pointIn(p.u,p.v,poly));},frame:f,root:g,zone,entry,gardenSeats,parking,actors,lamps,guard:f.toWorld(0,-4.85),guardYaw:PHOTO_YAW+Math.PI,groundY:APRON_Y,paji:{seat:f.toWorld(13.9,-2.5),desk:f.toWorld(13.9,-3.35),bike:f.toWorld(17.4,-4.4),y:APRON_Y,ride:[[17.4,-4.8],[17.2,-11],[16,-15.6],[45,-16],[75,-16.2]].map(p=>f.toWorld(...p)),yaw:PHOTO_YAW+Math.PI,bikeYaw:PHOTO_YAW+Math.PI/2},gateOrigin,booms,groundHeight(x,z){const p=f.toLocal(x,z);return referenceHeight(p.u,p.v);}};
 const market=buildLdrpMarket(scene,origin),spawn={...f.toWorld(-6,-10),y:.05,yaw:PHOTO_YAW+Math.PI,residents:[],customCrowd:true};
 return{zone,spawn,frame:f,market,campus,extraZones:[outsideZone,market.zone],update(t,p){flag.rotation.y=Math.sin(t*1.25)*.12;
  if(p){const l=f.toLocal(p.x,p.z);if(l.v>2.6&&zone.contains(p.x,p.z))entry.side='inside';else if(l.v<-1.2)entry.side='outside';}
  const gateDt=gateLastTime===null?0:Math.min(.1,Math.max(0,t-gateLastTime));gateLastTime=t;entry.open=THREE.MathUtils.damp(entry.open,entry.openTarget?1:0,3,gateDt);slidingGate.position.x=-11.2-entry.open*11;slidingSolid.rect[0]=-6-entry.open*11;market.update(t,p);}};
}

function createBus(g,u,v){const bus=new THREE.Group();bus.position.set(u,0,v);g.add(bus);K.box(bus,2.3,2.8,8.2,0xc9a449,0,.38,0);K.box(bus,2.32,.9,6.8,0x354f50,0,1.7,0);for(const x of [-1.1,1.1])for(const z of [-2.6,2.7]){const wheel=K.cyl(bus,.42,.42,.2,0x272c2b,x,.2,z,16);wheel.rotation.z=Math.PI/2;}K.textPlane(bus,['LDRP COLLEGE BUS'],{bg:'#c9a449',fg:'#303c39'},2.0,.3,0,2.8,-4.11,Math.PI);return bus;}
