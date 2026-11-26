import {CONTENT} from './game-content.js';
// Name-call → staff approaches → verbal order → preparation → delivery → eat
// → pay afterwards. There are deliberately no tokens or advance charges.
export const STALL_CALL_DISTANCE=2.6;
export const atStallCounter=(shop,position)=>Math.hypot(position.x-shop.x,position.z-shop.z)<=CONTENT.gameplay.stallCallDistance&&Math.abs((position.y??.33)-(shop.y??.33))<.65;
export function createStreetService({now,position,spend,onChange=()=>{},onEat=()=>{},isOpen=()=>true}) {
  let meal=null;
  const nearby=s=>Math.hypot(position().x-s.x,position().z-s.z)<15;
  const change=phase=>{meal.phase=phase;meal.since=now();onChange({...meal});};
  return {
    get meal(){return meal;},
    call(shop) {
      if(shop.enabled===false||!isOpen(shop))return {error:"Stall abhi band hai. Opening hours check karo."};
      if(!atStallCounter(shop,position()))return {error:'Stall ke counter ke paas aake naam se bulao.'};
      if(meal&&meal.phase!=='paid')return {error:'Pehle apna current order aur bill complete karo.'};
      meal={shop,phase:'approaching',since:now(),customer:{...position()},item:null,price:0};onChange({...meal});return {ok:true};
    },
    order(item,balance) {
      if(meal?.phase!=='taking-order'||!nearby(meal.shop))return {error:'Staff ke paas aane par order do.'};
      const entry=meal.shop.items.find(([name])=>name===item);
      if(!entry)return {error:'Yeh item menu mein nahi hai.'};
      if(balance<entry[1])return {error:'Is meal ke bill ke liye play money kam hai.'};
      meal.item=entry[0];meal.price=entry[1];change('cooking');return {ok:true};
    },
    tick(workerDistance=0) {
      if(!meal)return;const elapsed=now()-meal.since;
      if(["approaching","taking-order"].includes(meal.phase)&&!isOpen(meal.shop)){meal=null;onChange(null);return;}
      if(['approaching','taking-order'].includes(meal.phase)&&!nearby(meal.shop)){meal=null;onChange(null);return;}
      if(nearby(meal.shop))meal.customer={...position()};
      if(meal.phase==='approaching'&&workerDistance<1.8&&elapsed>1)change('taking-order');
      else if(meal.phase==='cooking'&&elapsed>(meal.shop.kind==='food'?12:8))change('delivering');
      else if(meal.phase==='delivering'&&nearby(meal.shop)&&workerDistance<1.8){change('eating');onEat(meal.item);}
      else if(meal.phase==='eating'&&elapsed>10)change('bill-due');
    },
    pay() {
      if(meal?.phase!=='bill-due')return {error:'Khana khatam hone par bill dena.'};
      if(!nearby(meal.shop))return {error:'Bill dene ke liye shop ke paas aao.'};
      if(!spend(meal.price))return {error:'Play money kam hai. Bill pending rahega.'};
      change('paid');return {ok:true,price:meal.price};
    },
    cancelCall(){if(['approaching','taking-order'].includes(meal?.phase)){meal=null;onChange(null);return true;}return false;},
  };
}

// One occupant per small sitting table. A group-owned free table is not free
// to take: the group's explicit answer must grant permission first.
export function createSeatState(definitions) {
  const seats=new Map(definitions.map(s=>[s.id,{...s,nativeOccupant:s.occupant||null,permission:null,carriedBy:null}]));
  const get=id=>seats.get(id);
  return {
    all:()=>[...seats.values()],get,
    ask(id,person) {
      const s=get(id);if(!s||s.occupant||s.carriedBy)return {error:'Yeh table khaali nahi hai.'};
      if(!s.group){s.permission=person;return {ok:true,answer:CONTENT.dialogues.seating.yesFree};}
      if(!s.allowBorrow)return {error:CONTENT.dialogues.seating.noGroup,denied:true};
      s.permission=person;return {ok:true,answer:CONTENT.dialogues.seating.yesGroup};
    },
    sit(id,person) {
      const s=get(id);if(!s||s.occupant||s.carriedBy)return {error:'Is table par koi baitha hai.'};
      if(s.group&&s.permission!==person&&s.nativeOccupant!==person)return {error:'Is group se pehle poochho: table khaali hai?'};
      if([...seats.values()].some(x=>x.occupant===person||x.carriedBy===person))return {error:'Pehle current table se utho ya carry ki hui table rakh do.'};
      s.occupant=person;return {ok:true,seat:s};
    },
    stand(id,person){const s=get(id);if(s?.occupant!==person)return false;s.occupant=null;return true;},
    carry(id,person) {
      const s=get(id);if(!s||s.occupant||s.carriedBy)return {error:'Occupied table nahi utha sakte.'};
      if(s.group&&s.permission!==person)return {error:'Pehle group se permission lo.'};
      if([...seats.values()].some(x=>x.carriedBy===person||x.occupant===person))return {error:'Pehle utho ya current table rakh do.'};
      s.carriedBy=person;return {ok:true,seat:s};
    },
    drop(id,person,x,z,yaw) {
      const s=get(id);if(s?.carriedBy!==person)return {error:'Yeh table tum carry nahi kar rahe.'};
      s.x=x;s.z=z;s.yaw=yaw;s.carriedBy=null;s.group=null;s.permission=null;return {ok:true,seat:s};
    },
  };
}
