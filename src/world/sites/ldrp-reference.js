// Traced from the user's annotated 622×282 reference. Black = campus drives;
// purple/blue = perimeter. Scale is approximate; this is not a measured survey.
export const PHOTO_SCALE=.55,PHOTO_YAW=-Math.atan2(68,117);
export const photoPoint=(x,y)=>[(x-215)*PHOTO_SCALE,(y-28)*PHOTO_SCALE];
const path=(pts,width=5.5)=>({points:pts.map(p=>photoPoint(...p)),width,height:.15,kind:'drive'});
// West corner now runs out to the metro viaduct's outer edge (user's outline):
// the strip under/inside the curve is a college bus park.
export const CAMPUS_BOUNDARY=[[25,278],[26,145],[30,102],[30,92],[30,39],[35,30],[47,22],[62,15.5],[79,12.5],[128,12],[128,21],[213,29],[294,17],[612,15],[619,126],[615,215],[594,230],[340,229],[339,257],[329,279]].map(p=>photoPoint(...p));
// One road per marked black centreline. No second west-edge loop or
// duplicate parallel branch between the two hostel blocks.
function roundedDrive(points,radius=7){
 const out=[points[0]];
 for(let i=1;i<points.length-1;i++){
  const a=points[i-1],b=points[i],c=points[i+1],l=Math.hypot(b[0]-a[0],b[1]-a[1]),r=Math.hypot(c[0]-b[0],c[1]-b[1]);
  if(!l||!r)continue;
  const dot=((b[0]-a[0])*(c[0]-b[0])+(b[1]-a[1])*(c[1]-b[1]))/l/r;
  if(dot>.999||b[0]===400&&b[1]===146){out.push(b);continue;}
  const d=Math.min(radius,l*.3,r*.3),start=[b[0]-(b[0]-a[0])*d/l,b[1]-(b[1]-a[1])*d/l],end=[b[0]+(c[0]-b[0])*d/r,b[1]+(c[1]-b[1])*d/r];
  out.push(start);for(let j=1;j<=8;j++){const t=j/8,k=1-t;out.push([k*k*start[0]+2*k*t*b[0]+t*t*end[0],k*k*start[1]+2*k*t*b[1]+t*t*end[1]]);}
 }out.push(points.at(-1));return out;
}
export const CAMPUS_DRIVES=[
 path([[121,43],[300,43],[400,43],[494,43],[590,43]]),
 path(roundedDrive([[121,43],[104,46],[84,49],[60,58],[45,73],[38,94],[38,117],[50,145],[80,173],[117,202],[178,232],[242,242],[298,242],[318,219],[345,204],[361,180],[382,158],[400,146],[494,146],[605,146]])),
 path([[400,43],[400,146]]),path([[494,43],[494,146]]),
 path(roundedDrive([[590,43],[579,70],[579,146]])),
 path([[505,146],[505,218]]),
 path([[215,-1],[215,43]],20),
];
// Curved infill buildings bridge the three gaps between the four radial wings.
export const ACADEMIC_WING_ANGLES=[Math.PI/8,Math.PI*3/8,Math.PI*5/8,Math.PI*7/8];
const wingSide=(a,side,depth)=>[211+(109+depth)*Math.cos(a)-side*Math.sin(a),50+(98+depth)*Math.sin(a)+side*Math.cos(a)];
function curvedWingEdge(a,b,depth){
 const start=wingSide(a,24,depth),end=wingSide(b,-24,depth),da=Math.atan2(24,109+depth),db=Math.atan2(24,109+depth),k=4/3*Math.tan((b-a-da-db)/4),rx=109+depth,ry=98+depth;
 const c1=[start[0]-rx*Math.sin(a+da)*k,start[1]+ry*Math.cos(a+da)*k],c2=[end[0]+rx*Math.sin(b-db)*k,end[1]-ry*Math.cos(b-db)*k];
 return Array.from({length:21},(_,i)=>{const t=i/20,q=1-t;return photoPoint(q*q*q*start[0]+3*q*q*t*c1[0]+3*q*t*t*c2[0]+t*t*t*end[0],q*q*q*start[1]+3*q*q*t*c1[1]+3*q*t*t*c2[1]+t*t*t*end[1]);});
}
export const ACADEMIC_LINKS=ACADEMIC_WING_ANGLES.slice(0,-1).map((a,i)=>[...curvedWingEdge(a,ACADEMIC_WING_ANGLES[i+1],46),...curvedWingEdge(a,ACADEMIC_WING_ANGLES[i+1],22).reverse()]);
export const HOSTEL_YARD=[[397,149],[610,149],[610,215],[599,223],[397,223]].map(p=>photoPoint(...p));
export const GARDEN_CENTRE=photoPoint(211,79),GARDEN_HUB=photoPoint(211,51);
// Offset lawn edges from each radial path by a fixed distance. The lawns
// taper towards the gate; the walking corridors keep the same 3.6 m width.
const gardenRay=i=>photoPoint(211+83*Math.cos(Math.PI-i*Math.PI/4),50+72*Math.sin(Math.PI-i*Math.PI/4));
export const GARDEN_PATHS=Array.from({length:5},(_,i)=>({points:[GARDEN_HUB,gardenRay(i)],width:3.6,height:.13,kind:'garden'}));
function clipLawn(poly,score,min){const out=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],da=score(a)-min,db=score(b)-min;if(da>=0)out.push(a);if((da>=0)!==(db>=0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}return out;}
export const FOUR_GARDENS=Array.from({length:4},(_,i)=>{
 const a=Math.PI-i*Math.PI/4,b=a-Math.PI/4,mid=photoPoint(211+45*Math.cos((a+b)/2),50+40*Math.sin((a+b)/2));
 let poly=[GARDEN_HUB,...Array.from({length:33},(_,j)=>photoPoint(211+76*Math.cos(a+(b-a)*j/32),50+65*Math.sin(a+(b-a)*j/32)))];
 for(const ray of [gardenRay(i),gardenRay(i+1)]){const dx=ray[0]-GARDEN_HUB[0],dz=ray[1]-GARDEN_HUB[1],len=Math.hypot(dx,dz),cross=p=>(dx*(p[1]-GARDEN_HUB[1])-dz*(p[0]-GARDEN_HUB[0]))/len,sign=Math.sign(cross(mid));poly=clipLawn(poly,p=>cross(p)*sign,2.12);}
 return clipLawn(poly,p=>p[1]-GARDEN_HUB[1],4.2);
});
export const GARDEN_PROMENADE={points:Array.from({length:65},(_,i)=>photoPoint(211+82*Math.cos(i*Math.PI/64),50+71*Math.sin(i*Math.PI/64))),width:4.4,height:.14};
// One continuous concrete forecourt where the gate drive meets the front drive
// (no strip of ground or curb between two parallel roads).
export const GATE_FORECOURT=[[191,-1],[239,-1],[239,44],[191,44]].map(p=>photoPoint(...p));
// Outside the gate: one even concrete apron from the Road 5 edge to the gate
// line, covering the old asphalt stub, sand patch and Paaji's desk corner.
export const OUTSIDE_APRON=[[-10.6,-13.6],[19.5,-13.6],[19.5,.15],[-10.6,.15]];
export const APRON_Y=.29;
// Fenced half-circle flower garden just inside, between the two openings.
export const GATE_GARDEN={c:[0,3.6],r:3.2};
// Paved college-bus depot on the east strip between the departments block and
// the boundary wall (former bare ground with trees). Buses use the right gate.
// Latest annotation replaces the east bus depot with E wing / faculty homes.
export const BUS_DEPOT=[];
// Flag moved off the central garden path onto the lawn beside it.
export const FLAG_POINT=photoPoint(220,79);
// Metro pillars inside that strip (map coords). Never moved; buses keep clear.
export const WEST_METRO_PIERS=[[131,9],[89,31],[53,61]].map(p=>photoPoint(...p));
// Concrete bus park between the new outer wall and the west drive.
// Whole triangle up to the Road 5 / roundabout / south-road edges, meeting the
// west drive so the passage behind the college stays one open concrete surface.
export const WEST_BUS_PARK=[[127,13],[127,24],[121,46],[104,42],[84,49],[60,72],[47,83],[36,93],[33,96],[31.5,92],[31.5,40],[36,31.5],[48,24],[63,17],[80,14]].map(p=>photoPoint(...p));
// Shops just inside the wall, west of the gate: stationery/xerox (nearer the
// gate) and a small bike repair garage. Local metres; front faces the drive.
export const CAMPUS_SHOPS={stationery:{c:[-31,1.4],w:9,d:4.2},garage:{c:[-44.5,1.6],w:6.6,d:4.2},yard:[[-49,-2.2],[-25.5,-1.6],[-25.5,7.6],[-49,7.6]]};
// Paved junction where the front drive, the west drive and the promenade meet
// (old soil island with plants between the roads).
export const WEST_JUNCTION=[[104,39],[140,40],[140,47],[133,50],[129,56],[118,56],[100,53],[99,45]].map(p=>photoPoint(...p));
export const ENTRY_APRON=[[194,-2],[236,-2],[236,28],[194,28]].map(p=>photoPoint(...p));
// Black annotation 2: parking directly south of academic block 16.
export const INSIDE_PARKING=[[413,128],[487,128],[487,140],[413,140]].map(p=>photoPoint(...p));
export const OUTSIDE_PARKING=[[41,2],[126,-3],[207,3],[210,15],[128,10],[40,14]].map(p=>photoPoint(...p));
export const CAMPUS_BLOCKS=[
 {id:'hostel-d',label:'HOSTEL · D WING',rect:[128,250,284,274],h:12.8},
 {id:'hostel-b',label:'HOSTEL · B WING',rect:[412,159,488,216],h:16,court:true},
 {id:'hostel-a',label:'HOSTEL · A WING',rect:[523,159,602,217],h:16,court:true},
 {id:'ldrp-academic',label:'LDRP INSTITUTE OF TECHNOLOGY & RESEARCH',rect:[410,49,487,126],h:14,court:true},
 {id:'hostel-c',label:'HOSTEL · C WING',rect:[501,46,572,122],h:14,court:true},
 {id:'social-work',label:'MIPLVP INSTITUTE OF SOCIAL WORK',rect:[146,175,239,207],h:12.8},
 // Black strip: ground-floor canteen behind the separate blue-marked block.
 {id:'canteen',label:'COLLEGE CANTEEN · GROUND FLOOR',rect:[28,180,39,239],h:3.4,floors:1},
 {id:'mechanical',label:'MECHANICAL ENGINEERING · G + 3',rect:[44,180,67,239],h:13.6,floors:4},
 {id:'guest-house',label:'PREMIUM GUEST HOUSE',rect:[501,126,546,140],h:10.2,floors:3,premium:true},
 {id:'hostel-e',label:'HOSTEL · E WING',rect:[585,55,612,86],h:12.8},
 {id:'faculty-residences',label:'FACULTY RESIDENCES',rect:[585,95,612,133],h:9.6},
 {id:'small-house-1',label:'SMALL HOUSE 1',rect:[48,253,68,271],h:2.8,smallHouse:true},
 {id:'small-house-2',label:'SMALL HOUSE 2',rect:[77,253,97,271],h:2.8,smallHouse:true},
 {id:'small-house-3',label:'SMALL HOUSE 3',rect:[106,253,123,271],h:2.8,smallHouse:true},
];
export function referenceHeight(u,v){let y=.03;if(FOUR_GARDENS.some(p=>pointIn(u,v,p)))y=.09;for(const p of [...CAMPUS_DRIVES,...GARDEN_PATHS,GARDEN_PROMENADE])for(let i=1;i<p.points.length;i++)if(distance(u,v,p.points[i-1],p.points[i])<=p.width/2)y=Math.max(y,p.height);if(pointIn(u,v,INSIDE_PARKING))y=.16;if(pointIn(u,v,GATE_FORECOURT)||pointIn(u,v,BUS_DEPOT)||pointIn(u,v,WEST_BUS_PARK)||pointIn(u,v,WEST_JUNCTION)||pointIn(u,v,CAMPUS_SHOPS.yard)||pointIn(u,v,HOSTEL_YARD))y=Math.max(y,.15);return y+.008;}
export function pointIn(x,z,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;return inside;}
export function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
