// The user's one-page sketch is schematic, not a measured survey. Its left/right
// order and sides are preserved in a frame anchored to the mapped KH-5 circle.
// Relative to placePos(LDRP), using the same spherical projection as the map.
// Centre is the bounding centre of OSM roundabout way 386749312.
export const MARKET = {circle:[-116.4718436661,-155.4405480674],yaw:Math.PI*5/6};
export const MARKET_GROUND=0.33;
// Entire campus plus KH-5 junction and all eight stalls, in the road frame.
export const LDRP_PLAY_AREA={minU:-432,maxU:212,minV:-295,maxV:65};
export function inLdrpArea(origin,x,z,margin=0){const p=toMarket(origin,x,z),b=LDRP_PLAY_AREA;return p.u>=b.minU+margin&&p.u<=b.maxU-margin&&p.v>=b.minV+margin&&p.v<=b.maxV-margin;}
export const ROAD5_WAYS=[326054220,386749311,386751118,903991653];
export const CARRIAGEWAY_WIDTH=4.8;
export function applyRoad5Profile(map){for(const road of map.roads)if(ROAD5_WAYS.includes(road.id)){road.width=CARRIAGEWAY_WIDTH;road.sidewalkSides=[-1];}}
export const MARKET_SHOPS = [
  {id:'babu',name:'Babu na Chhole Kulche',gu:'બાબુના છોલે કુલચે',u:-155,v:15.5,kind:'food',color:0x87342c,emoji:'🍲',items:[['Chhole kulche',60],['Extra kulcha',15]],staff:'Saras cooks · Masi takes payment · Babu serves'},
  {id:'chintu',name:'Chintu ki Pav-Bhaji',gu:'ચિન્ટુની પાવભાજી',u:-116,v:15.5,kind:'food',color:0x30756b,emoji:'🍛',items:[['Pav-bhaji',70],['Extra butter pav',20]],staff:'Chintu & Kaka · Hot bhaji, toasted pav'},
  {id:'lalbhai',name:'Lalbhai ni Bethak',gu:'લાલભાઈની બેઠક',u:-77,v:15.5,kind:'lari',color:0x476c3a,emoji:'☕',items:[['Chai',10],['Balaji wafers',10],['Gopal snacks',10]],staff:'Lalbhai · Chai and packet snacks'},
  {id:'natu',name:'Natu Desi Adda',gu:'નટુ દેશી અડ્ડા',u:-38,v:15.5,kind:'lari',color:0x855f3c,emoji:'🥤',items:[['Chai',10],['Soda bottle',20]],staff:'Natu · Ask quietly for a chilled soda',whisper:true},
  {id:'masi',name:'Masi ni Cha',gu:'માસીની ચા',u:30,v:15.5,kind:'tea',color:0xa37234,emoji:'☕',items:[['Masala chai',10],['Ginger chai',15],['Biscuit packet',10]],staff:'Masi & Kaka · Fresh chai, seats behind the lari'},
  {id:'sarpanch',name:'Sarpanch ni Cha',gu:'સરપંચની ચા',u:165,v:15.5,kind:'tea',color:0x375b72,emoji:'☕',items:[['Kadak chai',10],['Coffee',20]],staff:'Sarpanch · Chai and a long conversation'},
  {id:'patel',name:'Patel ni Cha',gu:'પટેલની ચા',u:165,v:-13.8,kind:'tempo',color:0x789a9b,emoji:'🚚',items:[['Chai',10],['Biscuit packet',10]],staff:'Patel · Tea from the tempo, seating behind'},
  {id:'ajit',name:'Ajit no Gallo',gu:'અજિતનો ગલ્લો',u:28,v:-13.8,kind:'tea',color:0x8b4845,emoji:'☕',items:[['Chai',10],['Toast biscuit',15]],staff:'Ajit · His stern Bapu occasionally minds the stall'},
];
export const shopYaw=s=>s.v>0?Math.PI:0;
export function marketPoint(origin,u,v) {
  const c=Math.cos(MARKET.yaw),s=Math.sin(MARKET.yaw);
  return {x:origin.x+MARKET.circle[0]+u*c+v*s,z:origin.z+MARKET.circle[1]-u*s+v*c};
}
export function toMarket(origin,x,z) {
  const dx=x-origin.x-MARKET.circle[0],dz=z-origin.z-MARKET.circle[1],c=Math.cos(MARKET.yaw),s=Math.sin(MARKET.yaw);
  return {u:dx*c-dz*s,v:dx*s+dz*c};
}
export function shopPoint(s,x,z) {const c=Math.cos(shopYaw(s)),sn=Math.sin(shopYaw(s));return [s.u+x*c+z*sn,s.v-x*sn+z*c];}
export function shopPlot(s) {return [[-7,-10],[7,-10],[7,5],[-7,5]].map(([x,z])=>shopPoint(s,x,z));}
