// New virtual game venues inside GIFT's mapped boundary. The parcel was checked
// against every mapped road, water polygon and building; existing sites stay put.
export const ENTERTAINMENT_ORIGIN={x:3633.24,z:4124.77};
export const PLAZA={minU:-12,maxU:110,minV:-100,maxV:100};
export const CLUB={id:'city-club',name:'City Club',origin:{x:3470,z:3320},u:0,v:0,width:38,depth:42,entry:{u:0,v:27}};
export const CLUB_PLAZA={minU:-27,maxU:27,minV:-29,maxV:33};
export const CLUB_APPROACH=[[0,27],[25,27],[40,14]];
export const ARENA={id:'gift-live',name:'GIFT Live',u:48,v:-2,width:104,depth:164,entry:{u:48,v:88}};
export const CONCERT_ZONES=[{id:'premium',name:'Premium',front:-10,back:7,color:0xe9c779},{id:'middle',name:'Middle',front:13,back:30,color:0x6db9ad},{id:'general',name:'General',front:36,back:53,color:0x7b9aca}];
export const EVENT_COLUMNS=24,EVENT_ROWS=8,EVENT_CAPACITY=EVENT_COLUMNS*EVENT_ROWS;
export const entertainmentPoint=(u,v)=>({x:ENTERTAINMENT_ORIGIN.x+u,z:ENTERTAINMENT_ORIGIN.z+v});
export const entertainmentLocal=(x,z)=>({u:x-ENTERTAINMENT_ORIGIN.x,v:z-ENTERTAINMENT_ORIGIN.z});
export const clubPoint=(u,v)=>({x:CLUB.origin.x+u,z:CLUB.origin.z+v});
export const clubLocal=(x,z)=>({u:x-CLUB.origin.x,v:z-CLUB.origin.z});
export const venueEntry=id=>id===CLUB.id?clubPoint(CLUB.entry.u,CLUB.entry.v):id===ARENA.id?entertainmentPoint(ARENA.entry.u,ARENA.entry.v):null;
export const VENUE_MARKERS=[{...CLUB,...clubPoint(0,0),place:'gift',virtual:true},{...ARENA,...entertainmentPoint(ARENA.u,ARENA.v),place:'gift',virtual:true}];
export function standingSpot(tier,index){const zone=CONCERT_ZONES.find(z=>z.id===tier);if(!zone||!Number.isInteger(index)||index<0||index>=EVENT_CAPACITY)return null;const col=index%EVENT_COLUMNS,row=Math.floor(index/EVENT_COLUMNS),side=col<EVENT_COLUMNS/2?-1:1;return{...entertainmentPoint(ARENA.u+(col-(EVENT_COLUMNS-1)/2)*1.6+side*1.8,zone.front+row*1.8),y:.19,heading:0};}
export function venueAt(x,z){const c=clubLocal(x,z);if(Math.abs(c.u)<CLUB.width/2&&Math.abs(c.v)<CLUB.depth/2)return CLUB.id;const {u,v}=entertainmentLocal(x,z);if(Math.abs(u-ARENA.u)<ARENA.width/2&&Math.abs(v-ARENA.v)<ARENA.depth/2)return ARENA.id;return null;}
