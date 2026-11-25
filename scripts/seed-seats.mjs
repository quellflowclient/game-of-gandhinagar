import fs from 'node:fs';
import {placeById,placePos} from '../src/data/places.js';
import {MARKET,MARKET_SHOPS,marketPoint,shopPoint,shopYaw} from '../src/world/sites/ldrp-market-layout.js';
const origin=placePos(placeById('ldrp')),rows=[];
const q=v=>v==null?'null':`'${String(v).replaceAll("'","''")}'`;
for(const s of MARKET_SHOPS){
 const add=(n,x,z,occupant,group,allow,yaw=0)=>{const uv=shopPoint(s,x,z),p=marketPoint(origin,...uv);rows.push(`(${q(`${s.id}-seat-${n}`)},${p.x},${p.z},${MARKET.yaw+shopYaw(s)+yaw},${p.x},${p.z},${q(group)},${q(occupant)},${allow})`);};
 if(s.kind==='food')for(let n=0;n<2;n++)for(let k=0;k<4;k++)add(n*4+k,(n?2.5:-2.5)+(k===2?1.25:k===3?-1.25:0),-6.2+(k===0?-1:k===1?1:0),k<2?`${s.id}-guest-${n}-${k}`:null,`${s.id}-friends-${n}`,k!==3,k===1?Math.PI:k===2?-Math.PI/2:k===3?Math.PI/2:0);
 else for(let row=0;row<5;row++)for(let col=0;col<5;col++){const n=row*5+col;add(n,(col-2)*1.65,-2.6-row*1.45,n<2?`${s.id}-guest-0-${n}`:null,n<4?`${s.id}-friends-0`:null,n!==3);}
}
fs.writeFileSync('supabase/seats-seed.sql',`-- Generated from the authored world coordinates; preserve existing claims.\ninsert into public.city_seats(id,x,z,yaw,home_x,home_z,group_name,native_occupant,allow_borrow) values\n${rows.join(',\n')}\non conflict(id) do nothing;\n`);
console.log(`Prepared ${rows.length} shared sitting tables.`);
