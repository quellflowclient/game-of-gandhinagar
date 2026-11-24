// Keep the full-city catalogue in content.js; expose only supported experiences.
import * as archive from './content.js';
import {isLivePlace} from './places.js';
export * from './content.js';
export const STORIES=archive.STORIES.filter(s=>isLivePlace(s.place));
export const GIGS=archive.GIGS.filter(s=>isLivePlace(s.place));
export const SAMPLE_EVENTS=[];
const overrides={
 m2:{title:'LDRP ni chai',brief:'Visit the LDRP stalls, call Masi by name, order masala chai and pay after drinking.',goals:[{type:'visit',place:'ldrp',label:'Reach LDRP'},{type:'buy',item:'Masala chai',label:'Order chai and pay the bill'}]},
 m4:{title:'Campus ane Mandir',brief:'Explore LDRP and visit Mahatma Mandir. Use Travel to switch areas.',goals:[{type:'visit',place:'ldrp',label:'Explore LDRP'},{type:'visit',place:'dandi',label:'Visit Mahatma Mandir'}]},
 m6:{title:'Mahatma Mandir ni saanj',brief:'Visit Mahatma Mandir in the evening or at night and greet two people.',goals:[{type:'night_at',place:'dandi',label:'Mahatma Mandir after sunset'},{type:'wave_ai',n:2,label:'Wave at two people'}]}
};
export const CHAPTER={...archive.CHAPTER,missions:archive.CHAPTER.missions.map(m=>({...m,...overrides[m.id]}))};
