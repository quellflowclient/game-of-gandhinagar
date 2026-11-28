import {placedPlaces,placePos} from '../data/places.js';
import {explorationAreaForPlace,explorationAreaAt} from '../world/exploration-areas.js';
import {VENUE_MARKERS,venueEntry} from '../world/entertainment-layout.js';

export function mapDestinations(world){
 const destinations=placedPlaces().map(p=>({...p,...(world.spawns[p.id]||placePos(p)),area:explorationAreaForPlace(p.id),category:'place',detail:p.blurb}));
 for(const venue of VENUE_MARKERS)destinations.push({...venue,...venueEntry(venue.id),area:'gift',category:'events',detail:venue.id==='city-club'?'Juice lounge & dance floor · GIFT City':'Concert entrance · GIFT City',color:venue.id==='city-club'?0x805cc4:0xbc8546});
 const shops=[...(world.stalls||[]),...(world.markets||[]).flatMap(m=>m.shops||[])];
 for(const s of shops){const area=explorationAreaForPlace(s.place);if(!area||!Number.isFinite(s.x)||!Number.isFinite(s.z))continue;const cafe=/chai|tea|coffee/i.test(s.name),shop=/bandhani|khadi|toys/i.test(s.name);if(destinations.some(p=>p.id===`shop:${s.place}:${s.id}`))continue;destinations.push({...s,id:`shop:${s.place}:${s.id}`,area,category:cafe?'cafes':shop?'shops':'food',detail:s.place==='ldrp'?'LDRP market':'Food & shops',color:0x98613e});}
 return destinations;
}
export function safeMapArrival(target,world){
 if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z)||!target.area)throw Error('This destination is unavailable.');
 const safe=world.navigation.safePoint(target.x,target.z,target.y||0);
 if(explorationAreaAt(safe.x,safe.z,1)!==target.area||Math.hypot(safe.x-target.x,safe.z-target.z)>30)throw Error('A safe arrival point could not be found.');
 return safe;
}
