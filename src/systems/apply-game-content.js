import {CONTENT,mutate} from './game-content.js';
import * as R from '../world/sites/ldrp-reference.js';
import {configureMahatma} from '../world/mahatma-layout.js';
import {MARKET_SHOPS,MARKET,LDRP_PLAY_AREA,configureRoadWidth} from '../world/sites/ldrp-market-layout.js';
import {STALL_HOURS} from '../data/stall-hours.js';
import {DEGREES,BRANCHES} from './campus-id.js';
import {VEHICLES} from '../world/driving.js';
import {PLACES} from '../data/places.js';
import {CHAPTER} from '../data/live-content.js';
export function applyGameContent(){
 configureRoadWidth(CONTENT.gameplay.carriagewayWidth);
 const roadDelta=CONTENT.gameplay.carriagewayWidth-12;
 MARKET_SHOPS.splice(0,MARKET_SHOPS.length,...CONTENT.stalls.map(s=>({...structuredClone(s),v:s.v+roadDelta})));
 for(const s of CONTENT.stalls)STALL_HOURS[s.id]={...s.hours};
 mutate(MARKET,CONTENT.gameplay.marketFrame);mutate(LDRP_PLAY_AREA,CONTENT.gameplay.playArea);
 mutate(DEGREES,CONTENT.campus.degrees);mutate(BRANCHES,CONTENT.campus.branches);
 for(const [key,value]of Object.entries(CONTENT.geometry.ldrp)){const target=R[key];if(Array.isArray(target))target.splice(0,target.length,...structuredClone(value));else if(target&&typeof target==='object')mutate(target,value);}
 configureMahatma(CONTENT.geometry.mahatma);
 for(const [key,speed]of Object.entries(CONTENT.gameplay.vehicleSpeeds))if(VEHICLES[key])VEHICLES[key].maxKmh=speed;
 for(const p of PLACES){if(p.id==='ldrp')p.name=CONTENT.labels.campusName;if(p.id==='dandi')p.name=CONTENT.labels.mandirName;if(CONTENT.dialogues.guide[p.id])p.gu=CONTENT.dialogues.guide[p.id];}
 const intro=CHAPTER.missions.find(m=>m.id==='m1');if(intro)intro.gu=CONTENT.dialogues.guide.mission;
}
