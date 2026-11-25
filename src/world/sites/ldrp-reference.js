// Traced from the user's annotated 622×282 reference. Black = campus drives;
// purple/blue = perimeter. Scale is approximate; this is not a measured survey.
export const PHOTO_SCALE=.55,PHOTO_YAW=-Math.atan2(68,117);
export const photoPoint=(x,y)=>[(x-215)*PHOTO_SCALE,(y-28)*PHOTO_SCALE];
const path=(pts,width=5.5)=>({points:pts.map(p=>photoPoint(...p)),width,height:.15,kind:'drive'});
// West corner now runs out to the metro viaduct's outer edge (user's outline):
// the strip under/inside the curve is a college bus park.
export const CAMPUS_BOUNDARY=[[25,278],[26,145],[30,102],[30,92],[30,39],[35,30],[47,22],[62,15.5],[79,12.5],[128,12],[128,21],[213,29],[294,17],[612,15],[619,126],[615,215],[594,230],[340,229],[339,257],[329,279]].map(p=>photoPoint(...p));
export const CAMPUS_DRIVES=[
 path([[121,46],[300,46],[402,42.5],[490,42],[590,40]]),
 path([[121,46],[104,42],[84,49],[60,72],[47,83],[36,93],[33,112],[40,145],[68,171],[117,202],[178,232],[242,242],[298,242],[306,224],[324,212],[345,204],[356,181],[375,163],[405,146],[490,146],[605,146]]),
 path([[402,42.5],[402,100],[405,146]]),path([[490,42],[490,146]]),
 path([[590,40],[578,70],[577,124],[491,124]]),path([[491,146],[492,211]]),
 path([[514,149],[514,210]]),path([[34,112],[35,262],[287,267]]),
 path([[215,-1],[215,44]],20),
];
export const GARDEN_CENTRE=photoPoint(211,79),GARDEN_HUB=photoPoint(211,51);
const pointOnArc=a=>photoPoint(211+76*Math.cos(a),50+65*Math.sin(a));
export const FOUR_GARDENS=Array.from({length:4},(_,i)=>{
 const a=Math.PI-i*Math.PI/4-.045,b=Math.PI-(i+1)*Math.PI/4+.045;
 return [photoPoint(211+8*Math.cos(a),50+8*Math.sin(a)),...Array.from({length:13},(_,j)=>pointOnArc(a+(b-a)*j/12)),photoPoint(211+8*Math.cos(b),50+8*Math.sin(b))];
});
export const GARDEN_PATHS=Array.from({length:5},(_,i)=>{const a=Math.PI-i*Math.PI/4;return{points:[GARDEN_HUB,photoPoint(211+83*Math.cos(a),50+72*Math.sin(a))],width:2.1,height:.13,kind:'garden'};});
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
export const BUS_DEPOT=[[584,50],[612,48],[616,123],[582,124]].map(p=>photoPoint(...p));
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
export const INSIDE_PARKING=[[112,199],[132,190],[237,231],[228,244],[199,235]].map(p=>photoPoint(...p));
export const OUTSIDE_PARKING=[[41,2],[126,-3],[207,3],[210,15],[128,10],[40,14]].map(p=>photoPoint(...p));
export const CAMPUS_BLOCKS=[
 {id:'hostel-d',label:'LDRP HOSTEL · D BLOCK',rect:[45,250,284,274],h:12.8},
 {id:'hostel-b',label:'BOYS HOSTEL · WING B',rect:[412,159,488,216],h:16,court:true},
 {id:'hostel-a',label:'DR. C. K. PATEL & A. K. PATEL HOSTEL',rect:[523,159,602,217],h:16,court:true},
 {id:'ldrp-academic',label:'LDRP INSTITUTE OF TECHNOLOGY & RESEARCH',rect:[410,49,487,126],h:14,court:true},
 {id:'academic-east',label:'ENGINEERING DEPARTMENTS',rect:[501,46,572,122],h:14,court:true},
 {id:'social-work',label:'MIPLVP INSTITUTE OF SOCIAL WORK',rect:[146,175,239,207],h:12.8},
 {id:'canteen',label:'LDRP CANTEEN',rect:[44,92,65,138],h:4},
];
export function referenceHeight(u,v){let y=.03;if(FOUR_GARDENS.some(p=>pointIn(u,v,p)))y=.09;for(const p of [...CAMPUS_DRIVES,...GARDEN_PATHS,GARDEN_PROMENADE])for(let i=1;i<p.points.length;i++)if(distance(u,v,p.points[i-1],p.points[i])<=p.width/2)y=Math.max(y,p.height);if(pointIn(u,v,INSIDE_PARKING))y=.16;if(pointIn(u,v,GATE_FORECOURT)||pointIn(u,v,BUS_DEPOT)||pointIn(u,v,WEST_BUS_PARK)||pointIn(u,v,WEST_JUNCTION)||pointIn(u,v,CAMPUS_SHOPS.yard))y=Math.max(y,.15);return y+.008;}
export function pointIn(x,z,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;return inside;}
export function distance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
