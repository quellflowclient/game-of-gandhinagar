import * as THREE from 'three';
import * as K from './kit.js';
import {buildLdrpMarket} from './ldrp-market.js';
import {roadClearance} from '../metro-road-clearance.js';
import {createVehicleModel} from '../vehicle-models.js';
import * as D from './ldrp-dressing.js';
import {PHOTO_YAW,photoPoint as P,CAMPUS_BOUNDARY,CAMPUS_DRIVES,GARDEN_PATHS,GARDEN_PROMENADE,ENTRY_APRON,FOUR_GARDENS,GARDEN_CENTRE,INSIDE_PARKING,OUTSIDE_PARKING,CAMPUS_BLOCKS,referenceHeight,pointIn,distance,GATE_FORECOURT,BUS_DEPOT,FLAG_POINT,OUTSIDE_APRON,APRON_Y,GATE_GARDEN,WEST_BUS_PARK,WEST_METRO_PIERS,CAMPUS_SHOPS,WEST_JUNCTION} from './ldrp-reference.js';

export const REFERENCE_LDRP={area:CAMPUS_BOUNDARY,gates:[{u:0,v:0,width:24,main:true}],gardenCentre:GARDEN_CENTRE,gardenRadius:43,hub:P(211,51)};
export function buildReferenceCampus(scene,map,origin){
 const gateOrigin={x:origin.x-25+Math.sin(PHOTO_YAW)*6.5,z:origin.z-87.93+Math.cos(PHOTO_YAW)*6.5},f=K.frame(gateOrigin,PHOTO_YAW),g=new THREE.Group();g.position.set(gateOrigin.x,0,gateOrigin.z);g.rotation.y=PHOTO_YAW;g.name='LDRP reference campus';scene.add(g);
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
 D.concreteSlab(g,GATE_FORECOURT,.149);D.concreteSlab(g,BUS_DEPOT,.149);const westPassage=CAMPUS_DRIVES[1].points.slice(0,8);{const l=D.offsetPoints(westPassage,11),r=D.offsetPoints(westPassage,-11);D.concreteSlab(g,[...l,...r.reverse()].filter(([u,v])=>true),.148);}
 D.concreteSlab(g,WEST_BUS_PARK,.149);D.concreteSlab(g,WEST_JUNCTION,.149);D.concreteSlab(g,CAMPUS_SHOPS.yard,.149);
 for(const [index,path]of CAMPUS_DRIVES.entries()){
  D.concreteDrive(g,path.points,path.width,path.height);
  for(const side of [-1,1])curbRuns(D.offsetPoints(path.points,side*(path.width/2+.1)),index).forEach(run=>D.stoneCurb(g,run,path.height,{height:.2}));
  map.roads.push({id:`ldrp-reference-${index}`,kind:'service',campus:true,width:path.width,surfaceHeight:path.height,pts:path.points.map(p=>{const w=f.toWorld(...p);return[w.x,w.z];})});
 }
 // Four separate garden lawns, with a clear cross-path and front promenade.
 const frontArc=GARDEN_PROMENADE.points,shrubs=D.createShrubbery(),grass=D.createGrassBorders();
 D.paverWalk(g,frontArc,4.4,.14);for(const side of [-1,1])curbRuns(D.offsetPoints(frontArc,side*2.3),-1).filter(r=>!r.some(([u,v])=>GARDEN_PATHS.some(d=>D.pathDistance(u,v,d.points)<d.width/2+.2))).forEach(run=>D.stoneCurb(g,run,.14,{height:.16,width:.16}));
 for(const path of GARDEN_PATHS)D.paverWalk(g,path.points,path.width,path.height);
 for(const [index,poly]of FOUR_GARDENS.entries()){
  K.slab(g,poly,.09,lawn,0,3.5);D.stoneCurb(g,[...poly,poly[0]],.09,{height:.24});
  const [u,v]=K.centroid(poly);
  for(const side of [-1,1]){K.bench(g,u+side*2.6,v+2,side<0?Math.PI/2:-Math.PI/2);solids.push({rect:[u+side*2.6,v+2,1.8,.55,side<0?Math.PI/2:-Math.PI/2]});}
  for(let j=0;j<3;j++){const x=u+(j-1)*2.0,z=v-.7,w=f.toWorld(x,z);gardenSeats.push({id:`ldrp-garden-${index}-${j}`,x:w.x,y:.098,z:w.z,yaw:-PHOTO_YAW+Math.PI,kind:'ground',garden:index});}
  for(const [du,dv]of [[-2,-3],[2.2,-2.8]]){K.palm(g,u+du,v+dv,.65);trees.push([u+du,v+dv,.22]);}
  grass.add(poly,[[(poly[0][0]+poly[1][0])/2,(poly[0][1]+poly[1][1])/2],poly[7],[(poly[13][0]+poly[14][0])/2,(poly[13][1]+poly[14][1])/2]]);for(const [pu,pv]of poly){const iu=pu+(u-pu)*.28,iv=pv+(v-pv)*.28;if(Math.hypot(iu-u,iv-v)>4.5&&Math.hypot(iu-FLAG_POINT[0],iv-FLAG_POINT[1])>4.5){shrubs.topiary(iu,iv,.95);trees.push([iu,iv,.15]);}}shrubs.topiary(u-4.2,v+.6,1.15);shrubs.topiary(u+4.4,v+.4,1.05);trees.push([u-4.2,v+.6,.15],[u+4.4,v+.4,.15]);for(const [du,dv]of [[-1,3.6],[1.4,3.8]])shrubs.bush(u+du,v+dv,.7);
 }
 const [flagU,flagV]=FLAG_POINT;
 for(let tier=0;tier<3;tier++)K.cyl(g,2.1-tier*.48,2.1-tier*.48,.2,0xaaa997,flagU,.12+tier*.2,flagV,32);
 const flag=K.flagPole(g,flagU,flagV,undefined,{height:25,width:4.5});solids.push({circle:[flagU,flagV,2.2]});

 // Curved academic frontage with four outward wings and visible open courts.
 const arc=(rx,ry,n=64)=>Array.from({length:n+1},(_,i)=>P(211+rx*Math.cos(i*Math.PI/n),50+ry*Math.sin(i*Math.PI/n)));
 const frontRing=[...arc(112,101),...arc(88,78).reverse()];K.building(g,frontRing,13.6,facade,{roof:0xd2cebd,parapet:.65});solids.push({poly:frontRing});
 for(const a of [Math.PI/8,Math.PI*3/8,Math.PI*5/8,Math.PI*7/8]){
  const base=[211+109*Math.cos(a),50+98*Math.sin(a)],side=[-Math.sin(a),Math.cos(a)],dir=[Math.cos(a),Math.sin(a)];
  const wing=(x0,x1,z0,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1]].map(([x,z])=>P(base[0]+side[0]*x+dir[0]*z,base[1]+side[1]*x+dir[1]*z));
  const strips=[[-24,24,0,11],[-24,-12,11,46],[12,24,11,46],[-12,12,35,46]];
  for(const r of strips)K.building(g,wing(...r),13.6,facade,{roof:0xd2cebd,parapet:.65});
  K.slab(g,wing(-12,12,11,35),.08,floor);solids.push({poly:wing(-24,24,0,46)});
 }
 const [pu,pv]=P(211,124);K.box(g,16,.52,5,0xa2aba8,pu,6.8,pv-1);
 for(const x of [-6.5,6.5]){K.box(g,.65,6.8,.65,0x72817c,pu+x,0,pv-3.1);solids.push({circle:[pu+x,pv-3.1,.45]});}
 K.textPlane(g,['LDRP INSTITUTE OF TECHNOLOGY & RESEARCH'],{bg:'#b9bfb7',fg:'#31453e'},15,.65,pu,7.1,pv-3.55,Math.PI);
 K.textPlane(g,['ATM','KALUPUR BANK'],{bg:'#234480',fg:'#f3f4e9',h:320},2.8,2,P(135,109)[0],2.2,P(135,109)[1],Math.PI);
 for(const block of CAMPUS_BLOCKS){
  if(block.id==='social-work'){const [u,v]=P(176,197);K.textPlane(g,[block.label],{bg:'#c5c6b9',fg:'#344b4b'},19,1.0,u,3.0,v,Math.PI);continue;}
  const [x0,y0,x1,y1]=block.rect,ring=photoRect(block.rect),mat=block.id.includes('hostel')?hostelFacade:facade;
  if(block.court){const w=11;for(const r of [[x0,y0,x1,y0+w],[x0,y1-w,x1,y1],[x0,y0+w,x0+w,y1-w],[x1-w,y0+w,x1,y1-w]])K.building(g,photoRect(r),block.h,mat,{roof:0xcac5b5,parapet:.6});K.slab(g,photoRect([x0+11,y0+11,x1-11,y1-11]),.08,floor);}
  else K.building(g,ring,block.h,mat,{roof:0xcac5b5,parapet:.6});
  solids.push({poly:ring});const [u,v]=P((x0+x1)/2,y0);K.textPlane(g,[block.label],{bg:'#d6d5c7',fg:'#344b4b',h:180},Math.min(24,(x1-x0)*.5),1.0,u,3.2,v-.05,Math.PI);
  const [cu,cv]=K.centroid(ring);for(let j=0;j<2;j++)K.cyl(g,.65,.7,1.1,0x313c39,cu+j*1.8,block.h+.3,cv,12);
 }
 // Inside lot in front of MIPLVP. Cars are deliberately absent.
 K.slab(g,INSIDE_PARKING,.16,floor);parking.push({id:'inside',label:'MIPLVP · Inside two-wheeler parking',polys:[INSIDE_PARKING],inside:true,slots:[]});
 const outside=[OUTSIDE_PARKING,[[243,-2],[610,-5],[610,12],[243,15]].map(p=>P(...p))];
 for(const poly of outside)K.slab(g,poly,.02,K.mat(K.dryGround(),{color:0xb6ad96,roughness:1}),0,4);
 parking.push({id:'outside',label:'Road No. 5 · Outside parking',polys:outside,inside:false,slots:[]});
 for(const lot of parking){
  for(const poly of lot.polys){const minU=Math.min(...poly.map(p=>p[0])),maxU=Math.max(...poly.map(p=>p[0])),minV=Math.min(...poly.map(p=>p[1])),maxV=Math.max(...poly.map(p=>p[1]));
   let n=0;for(let u=minU+2;u<maxU-1;u+=lot.inside?1.25:3.2)for(let v=minV+1.3;v<maxV-1;v+=lot.inside?4:5.7){if(!pointIn(u,v,poly))continue;const w=f.toWorld(u,v);if(!lot.inside&&(!offRoad(w.x,w.z,2.7)||pointIn(u,v,CAMPUS_BOUNDARY)))continue;if(lot.inside&&solids.some(s=>s.poly&&K.nearPolygon(u,v,s.poly,1)))continue;
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
  for(let d=1;d<len;d+=9){const u=a[0]+(b[0]-a[0])*d/len,v=a[1]+(b[1]-a[1])*d/len;if(Math.hypot(u,v)<14||pointIn(u,v+2.5,WEST_BUS_PARK)||pointIn(u,v+2.5,CAMPUS_SHOPS.yard)||pointIn(u,v+2.5,WEST_JUNCTION)||D.pathDistance(u,v+2.5,WEST_BUS_PARK.concat([WEST_BUS_PARK[0]]))<3)continue;K.tree(g,u,v+2.5,.65+(i%3)*.1);trees.push([u,v+2.5,.28]);}
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
 const booms=[];K.box(g,.4,1,.4,0xd8d0c0,-10.5,0,.35);
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
   &&!CAMPUS_DRIVES.some(d=>D.pathDistance(u,v,d.points)<d.width/2+m)&&!GARDEN_PATHS.some(d=>D.pathDistance(u,v,d.points)<d.width/2+m)&&D.pathDistance(u,v,frontArc)>2.2+m&&!pointIn(u,v,INSIDE_PARKING)&&!pointIn(u,v,BUS_DEPOT)&&!pointIn(u,v,WEST_BUS_PARK)&&!pointIn(u,v,WEST_JUNCTION)&&!pointIn(u,v,CAMPUS_SHOPS.yard)&&D.pathDistance(u,v,westPassage)>12&&!pointIn(u,v,GATE_FORECOURT)&&Math.hypot(u-FLAG_POINT[0],v-FLAG_POINT[1])>3.5&&Math.hypot(u,v)>16;
 for(const path of CAMPUS_DRIVES){if(path.width>12)continue;
  for(const side of [-1,1]){const off=D.offsetPoints(path.points,side*(path.width/2+.75));let run=[],step=0;
   for(const [u,v]of D.resample(off,.55)){if(free(u,v,.35)){run.push([u,v]);if(step%16===8&&free(u,v,.9))shrubs.topiary(u,v,1.1);step++;}else{if(run.length>1)shrubs.hedge(run,{height:.9,width:.75});run=[];}}
   if(run.length>1)shrubs.hedge(run,{height:.9,width:.75});
   const back=D.offsetPoints(path.points,side*(path.width/2+3.2));for(const [u,v]of D.resample(back,13))if(free(u,v,1.2)){K.tree(g,u,v,.8);trees.push([u,v,.25]);}
  }}
 for(const side of [-1,1])for(const [u,v]of D.resample(D.offsetPoints(frontArc,side*2.6),6))D.potPost(g,u,v);
 for(const [u,v,r]of trees)solids.push({circle:[u,v,r]});
 K.mergeStatic(g);g.traverse(o=>{if(o.userData.lamp)lamps.push(o.material);});shrubs.build(g);solids.push(...shrubs.solids());grass.build(g);solids.push(...grass.solids());if(gateFlowers)D.flowerBed(g,gateFlowers);
 // College buses: parked in the paved east depot; one runs a scripted trip out
 // of (and back in through) the RIGHT gate opening.
 const busModel=()=>{const root=new THREE.Group(),m=createVehicleModel('bus');for(const part of m.parts){const mesh=new THREE.Mesh(part.geometry,part.paint?K.mat(0xe0aa1c,{roughness:.45,metalness:.3}):part.material);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}g.add(root);return root;};
 const depotSlots=[[590,88],[599,90],[608,92]].map(p=>P(...p));
 for(const [u,v]of depotSlots.slice(0,2)){const b=busModel();b.position.set(u,.15,v);solids.push({rect:[u,v,2.6,11]});}
 const busRoute=[[608,108],[608,62],[590,40],[490,42],[402,42.5],[300,46],[222,46],[206,40],[203,20],[203,-1],[203,-4]].map(p=>P(...p));
 const routeLen=[0];for(let i=1;i<busRoute.length;i++)routeLen.push(routeLen[i-1]+Math.hypot(busRoute[i][0]-busRoute[i-1][0],busRoute[i][1]-busRoute[i-1][1]));
 const routeAt=s=>{s=Math.max(0,Math.min(routeLen.at(-1),s));let i=1;while(i<routeLen.length-1&&routeLen[i]<s)i++;const a=busRoute[i-1],b=busRoute[i],t=(s-routeLen[i-1])/(routeLen[i]-routeLen[i-1]||1);return{u:a[0]+(b[0]-a[0])*t,v:a[1]+(b[1]-a[1])*t,yaw:Math.atan2(b[0]-a[0],b[1]-a[1])};};
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
 const tripBus=busModel(),trip={s:0,dir:0,wait:40,speed:0};tripBus.position.set(busRoute[0][0],.15,busRoute[0][1]);

 const boomTex=K.canvasTex(128,16,(c,w,h)=>{for(let i=0;i<16;i++){c.fillStyle=i%2?'#eee9d8':'#b94532';c.fillRect(i*w/16,0,w/16,h);}});
 for(const x of [-10.5]){const pivot=new THREE.Group();pivot.position.set(x,1,.35);g.add(pivot);K.box(pivot,8,.09,.1,K.mat(boomTex),4,-.045,0);booms.push(pivot);}
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
 const outsideZone={id:'ldrp-outside-parking',contains:outsideContains,heights:(x,z,r=.38)=>{const p=f.toLocal(x,z);return zone.blocked(p.u,p.v,r)||gateRule(p.u,p.v,r)?[]:[pointIn(p.u,p.v,OUTSIDE_APRON)?APRON_Y+.008:pointIn(p.u,p.v,ENTRY_APRON)?referenceHeight(p.u,p.v):.028];},roadHeight:(x,z)=>{if(!outsideContains(x,z))return null;const p=f.toLocal(x,z);return pointIn(p.u,p.v,OUTSIDE_APRON)?APRON_Y:pointIn(p.u,p.v,ENTRY_APRON)?.15:.04;},forbidsVehicles:(x,z,r)=>{if(!outsideContains(x,z))return false;const p=f.toLocal(x,z);return zone.blocked(p.u,p.v,r);},clearing:{contains:(x,z)=>{const p=f.toLocal(x,z);return outside.some(poly=>pointIn(p.u,p.v,poly))||pointIn(p.u,p.v,ENTRY_APRON);},replacesWalk:(x,z)=>{const p=f.toLocal(x,z);return outside.some(poly=>pointIn(p.u,p.v,poly))||pointIn(p.u,p.v,ENTRY_APRON);}}};
 const campus={frame:f,root:g,zone,entry,gardenSeats,parking,actors,lamps,guard:f.toWorld(0,-4.85),guardYaw:PHOTO_YAW+Math.PI,groundY:APRON_Y,paji:{seat:f.toWorld(13.9,-2.5),desk:f.toWorld(13.9,-3.35),bike:f.toWorld(17.4,-4.4),y:APRON_Y,ride:[[17.4,-4.8],[17.2,-11],[16,-15.6],[45,-16],[75,-16.2]].map(p=>f.toWorld(...p)),yaw:PHOTO_YAW+Math.PI,bikeYaw:PHOTO_YAW+Math.PI/2},gateOrigin,booms,groundHeight(x,z){const p=f.toLocal(x,z);return referenceHeight(p.u,p.v);}};
 const market=buildLdrpMarket(scene,origin),spawn={...f.toWorld(-6,-10),y:.05,yaw:PHOTO_YAW+Math.PI,residents:[],customCrowd:true};
 return{zone,spawn,frame:f,market,campus,extraZones:[outsideZone,market.zone],update(t,p){flag.rotation.y=Math.sin(t*1.25)*.12;
  if(p){const l=f.toLocal(p.x,p.z);if(l.v>2.6&&zone.contains(p.x,p.z))entry.side='inside';else if(l.v<-1.2)entry.side='outside';}
  // Scripted college bus: waits in the depot, drives out of the right opening,
  // waits off-screen, returns. Stops for anyone standing in front of it.
  const dt=Math.min(.05,Math.max(0,t-(trip.last??t)));trip.last=t;
  if(trip.wait>0){trip.wait-=dt;if(trip.wait<=0){trip.dir=trip.s<1?1:-1;}}
  else{const at=routeAt(trip.s),ahead=routeAt(trip.s+trip.dir*7),w=f.toWorld(ahead.u,ahead.v);const blocked=p&&Math.hypot(p.x-w.x,p.z-w.z)<4.2;
   const nearGate=Math.abs(at.v)<14&&at.u<4,target=blocked?0:nearGate?2.6:5.2;trip.speed+=Math.max(-6*dt,Math.min(1.6*dt,target-trip.speed));trip.s+=trip.dir*trip.speed*dt;
   if(trip.s>=routeLen.at(-1)){trip.s=routeLen.at(-1);trip.wait=90;trip.speed=0;}if(trip.s<=0){trip.s=0;trip.wait=150;trip.speed=0;}}
  const at=routeAt(trip.s);tripBus.position.set(at.u,referenceHeight(at.u,at.v)+.0,at.v);tripBus.rotation.y=trip.dir<0?at.yaw+Math.PI:at.yaw;tripBus.visible=trip.s<routeLen.at(-1)-.5;
  const busAtGate=tripBus.visible&&Math.abs(at.v)<16&&at.u<4;
  entry.open=THREE.MathUtils.damp(entry.open,entry.openTarget||busAtGate?1:0,3,.016);for(const b of booms)b.rotation.z=-entry.open*Math.PI*.46;market.update(t,p);}};
}

function createBus(g,u,v){const bus=new THREE.Group();bus.position.set(u,0,v);g.add(bus);K.box(bus,2.3,2.8,8.2,0xc9a449,0,.38,0);K.box(bus,2.32,.9,6.8,0x354f50,0,1.7,0);for(const x of [-1.1,1.1])for(const z of [-2.6,2.7]){const wheel=K.cyl(bus,.42,.42,.2,0x272c2b,x,.2,z,16);wheel.rotation.z=Math.PI/2;}K.textPlane(bus,['LDRP COLLEGE BUS'],{bg:'#c9a449',fg:'#303c39'},2.0,.3,0,2.8,-4.11,Math.PI);return bus;}
