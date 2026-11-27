// New virtual game venues inside GIFT's mapped boundary. The parcel was checked
// against every mapped road, water polygon and building; existing sites stay put.
export const ENTERTAINMENT_ORIGIN={x:3633.24,z:4124.77};
export const PLAZA={minU:-110,maxU:110,minV:-100,maxV:100};
export const CLUB={id:'city-club',name:'City Club',u:-70,v:-20,width:64,depth:60,entry:{u:-70,v:16}};
export const ARENA={id:'gift-live',name:'GIFT Live',u:48,v:-2,width:104,depth:164,entry:{u:48,v:88}};
export const CONCERT_ZONES=[{id:'premium',name:'Premium',front:-10,back:7,color:0xe9c779},{id:'middle',name:'Middle',front:13,back:30,color:0x6db9ad},{id:'general',name:'General',front:36,back:53,color:0x7b9aca}];
export const EVENT_COLUMNS=24,EVENT_ROWS=8,EVENT_CAPACITY=EVENT_COLUMNS*EVENT_ROWS;
export const entertainmentPoint=(u,v)=>({x:ENTERTAINMENT_ORIGIN.x+u,z:ENTERTAINMENT_ORIGIN.z+v});
export const entertainmentLocal=(x,z)=>({u:x-ENTERTAINMENT_ORIGIN.x,v:z-ENTERTAINMENT_ORIGIN.z});
export const venueEntry=id=>{const venue=[CLUB,ARENA].find(v=>v.id===id);return venue?entertainmentPoint(venue.entry.u,venue.entry.v):null;};
export const VENUE_MARKERS=[CLUB,ARENA].map(v=>({...v,...entertainmentPoint(v.u,v.v),place:'gift',virtual:true}));
export function standingSpot(tier,index){const zone=CONCERT_ZONES.find(z=>z.id===tier);if(!zone||!Number.isInteger(index)||index<0||index>=EVENT_CAPACITY)return null;const col=index%EVENT_COLUMNS,row=Math.floor(index/EVENT_COLUMNS),side=col<EVENT_COLUMNS/2?-1:1;return{...entertainmentPoint(ARENA.u+(col-(EVENT_COLUMNS-1)/2)*1.6+side*1.8,zone.front+row*1.8),y:.19,heading:0};}
export function venueAt(x,z){const {u,v}=entertainmentLocal(x,z);if(Math.abs(u-CLUB.u)<CLUB.width/2&&Math.abs(v-CLUB.v)<CLUB.depth/2)return CLUB.id;if(Math.abs(u-ARENA.u)<ARENA.width/2&&Math.abs(v-ARENA.v)<ARENA.depth/2)return ARENA.id;return null;}
