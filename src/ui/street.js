import {h,toast,openPanel,closePanel} from './dom.js';
import {createSeatState,createStreetService} from '../systems/street-service.js';

export function createStreetLife(app,market) {
  const player=app.player,me=`guest-${crypto.randomUUID()}`,seats=createSeatState(market.seats);
  const strip=h('div',{class:'street-actions',hidden:true,'aria-label':'Nearby street actions'});document.body.append(strip);
  let elapsed=0,closest=null,carried=null,lastKey='',lastHeartbeat=0,lastRunKey='';
  const storageKey='kh5-sitting-tables-v4';
  function readShared(){try{return JSON.parse(localStorage.getItem(storageKey)||'{}');}catch{return {};}}
  function syncShared(shared=readShared()) {
    for(const [id,v] of Object.entries(shared)) {
      const seat=seats.get(id);if(!seat)continue;
      if(v.expires&&v.expires<Date.now()){v.occupant=null;v.carriedBy=null;v.owner=null;}
      Object.assign(seat,v);
    }
    if(player.sitting&&seats.get(player.sitting)?.occupant!==me){player.stand();toast('Yeh table ab occupied hai. Doosri khaali table choose karo.');}
  }
  async function changeSeat(id,action) {
    const run=()=>{
      const shared=readShared();syncShared(shared);
      const result=action();if(result?.error){toast(result.error,'info');return result;}
      const s=seats.get(id);shared[id]={x:s.x,z:s.z,yaw:s.yaw,group:s.group,occupant:s.occupant,carriedBy:s.carriedBy,owner:s.occupant===me||s.carriedBy===me?me:null,expires:s.occupant===me||s.carriedBy===me?Date.now()+30000:0};market.furnitureChanged();
      try{localStorage.setItem(storageKey,JSON.stringify(shared));}catch{}
      return result;
    };
    return navigator.locks?navigator.locks.request('kh5-furniture',run):run();
  }
  window.addEventListener('storage',e=>{if(e.key===storageKey)syncShared();});
  window.addEventListener('pagehide',()=>{const shared=readShared();for(const v of Object.values(shared))if(v.owner===me){v.occupant=null;v.carriedBy=null;v.owner=null;}try{localStorage.setItem(storageKey,JSON.stringify(shared));}catch{}});
  const service=createStreetService({now:()=>elapsed,position:()=>player.position,spend:n=>app.progress.spend(n),onEat:item=>player.eat(item),onChange:meal=>{
    if(!meal)return;
    const message={approaching:`${meal.shop.caller}! Idhar aana bhai.`, 'taking-order':`${meal.shop.caller}: Haan bolo, kya khana hai?`,cooking:`${meal.shop.caller}: Abhi bana ke laata hoon.`,delivering:`${meal.shop.caller} tumhara order leke aa rahe hain.`,eating:`${meal.shop.caller}: Lo bhai, garam hai. Aaraam se khao.`, 'bill-due':`Khana ho gaya? Bill ₹${meal.price}, khaane ke baad dena.`,paid:'Paisa mil gaya. Shukriya, phir aana!'}[meal.phase];
    if(message)toast(message,'info',4500);
    if(meal.phase==='taking-order')openMenu(meal.shop);
    if(meal.phase==='paid'){player.pay();app.progress.track('buy',{item:meal.item,place:'ldrp'});market.react(meal.shop.id,true);}
  }});
  market.bind(service,seats);
  function openMenu(shop) {
    if(['car','auto'].includes(player.vehicle))return toast('Pehle gaadi se utro, phir order do.');
    const meal=service.meal;
    const content=h('div',{class:'street-menu'},h('p',{class:'muted small'},`${shop.staff}. Game characters and sample prices. Wallet ₹${app.progress.state.coins} play money; pay after eating.`));
    if(!meal||meal.phase==='paid') {
      content.append(h('p',{},'Paas baitho ya khade raho, naam se bulao. Woh aake tumhara order lenge.'),h('button',{class:'btn primary',onclick:()=>{const r=service.call(shop);if(r.error)return toast(r.error);player.wave();app.sound.say(`${shop.caller} bhai!`);closePanel();}},`${shop.caller}! Zara idhar aao`));
    } else if(meal.shop.id!==shop.id)content.append(h('p',{},`Pehle ${meal.shop.name} ka current order aur bill finish karo.`));
    else if(meal.phase==='taking-order') {
      for(const [item,price] of shop.items)content.append(h('button',{class:'street-menu-item',onclick:()=>{const r=service.order(item,app.progress.state.coins);if(r.error)return toast(r.error);closePanel();}},h('span',{},item),h('b',{},`₹${price}`)));
      if(shop.whisper)content.append(h('button',{class:'btn',onclick:()=>{const r=service.order('Soda bottle',app.progress.state.coins);if(r.error)return toast(r.error);toast('Natu: Thandi soda bottle laata hoon.');closePanel();}},'Dheere se bolo: Natu, soda bottle chahiye'));
    } else {
      content.append(h('p',{},`${meal.item||'Tumhara order'} · ${({'approaching':'Staff aa rahe hain','cooking':'Kitchen mein ban raha hai','delivering':'Khana lekar aa rahe hain','eating':'Aaraam se khao','bill-due':'Khana ho gaya, bill dena hai'})[meal.phase]||meal.phase}`));
      if(meal.phase==='bill-due')content.append(h('button',{class:'btn primary',onclick:()=>{const r=service.pay();if(r.error)return toast(r.error);closePanel();}},`₹${meal.price} bill pay karo`));
      if(['approaching','taking-order'].includes(meal.phase))content.append(h('button',{class:'btn',onclick:()=>{service.cancelCall();closePanel();}},'Abhi nahi, shukriya'));
    }
    openPanel(`${shop.emoji} ${shop.name}`,content);
  }
  function seatMenu(seat) {
    if(['car','auto'].includes(player.vehicle))return toast('Pehle gaadi se utro.');
    const body=h('div',{},h('p',{},seat.occupant?'Is chhoti table par koi baitha hai.':seat.group?'Yeh table paas wale group ke saath hai. Le jaane se pehle poochna.':'Khaali chhoti table. Ek person baith sakta hai.'));
    if(!seat.occupant&&!seat.carriedBy) {
      if(!seat.group||seat.permission===me)body.append(h('button',{class:'btn primary',onclick:async()=>{const p=player.position,d=Math.hypot(p.x-seat.x,p.z-seat.z);if(d>0.85){const target={x:seat.x+(p.x-seat.x)/d*0.85,y:p.y,z:seat.z+(p.z-seat.z)/d*0.85};if(!app.world.navigation.canTravel(p,target))return toast('Table ke paas khule raste se aao.');}const r=await changeSeat(seat.id,()=>seats.sit(seat.id,me));if(r?.ok){player.sit(r.seat);closePanel();}}},'Baitho'));
      if(seat.group&&seat.permission!==me)body.append(h('button',{class:'btn',onclick:()=>{const answer=seats.ask(seat.id,me);market.react(seat.shopId,!!answer.ok);toast(`Tum: Khaali hai? Table le jaun?  Group: ${answer.answer||answer.error}`,'info',6000);if(answer.ok)seatMenu(seat);}},'Group se poochho: Table khaali hai?'));
      else body.append(h('button',{class:'btn',onclick:async()=>{const r=await changeSeat(seat.id,()=>seats.carry(seat.id,me));if(r?.ok){carried=seat.id;player.setCarrying(true);closePanel();}}},'Table uthao'));
    }
    openPanel('Chhoti table',body);
  }
  function drop() {
    const x=player.position.x+Math.sin(player.heading)*1.2,z=player.position.z+Math.cos(player.heading)*1.2;
    if(!market.canDrop(x,z))return toast('Path, road, doorway ya doosri table ke upar nahi. Baithne ki jagah par rakho.');
    changeSeat(carried,()=>seats.drop(carried,me,x,z,player.heading)).then(r=>{if(r?.ok){player.setCarrying(false);carried=null;}});
  }
  function stand(){const id=player.sitting;if(!id)return;changeSeat(id,()=>({ok:seats.stand(id,me)})).then(r=>{if(r?.ok)player.stand();});}
  function update(dt) {
    elapsed+=dt;service.tick(market.staffDistance());
    if(elapsed-lastHeartbeat>4){lastHeartbeat=elapsed;const shared=readShared();for(const v of Object.values(shared))if(v.owner===me){v.expires=Date.now()+30000;}try{localStorage.setItem(storageKey,JSON.stringify(shared));}catch{}syncShared(shared);}
    market.renderSeats(seats,player,me);
    const p=player.position;closest=market.shops.map(s=>({s,d:Math.hypot(s.x-p.x,s.z-p.z)})).sort((a,b)=>a.d-b.d)[0];
    const seat=seats.all().filter(s=>!s.carriedBy&&Math.hypot(s.x-p.x,s.z-p.z)<1.9).sort((a,b)=>Math.hypot(a.x-p.x,a.z-p.z)-Math.hypot(b.x-p.x,b.z-p.z))[0];
    const nearby=closest?.d<14?closest.s:null,meal=service.meal;
    const key=[nearby?.id,seat?.id,seat?.occupant,seat?.permission,carried,player.sitting,meal?.phase].join('|');
    strip.hidden=!nearby&&!seat&&!player.sitting&&!carried;
    if(key!==lastKey){lastKey=key;strip.replaceChildren();const btn=(text,fn)=>strip.append(h('button',{type:'button',onclick:fn},text));
      if(player.sitting)btn('Utho',stand);
      else if(carried)btn('Table yahan rakho',drop);
      else if(seat)btn(seat.occupant?'Table occupied':'Baitho / Table lo',()=>seatMenu(seat));
      if(nearby)btn(meal?.shop.id===nearby.id&&meal.phase==='bill-due'?`Bill ₹${meal.price} do`:`${nearby.caller} ko bulao / Order`,()=>openMenu(nearby));
    }
    document.querySelector('canvas[data-human-assets]')?.setAttribute('data-street-state',JSON.stringify({nearShop:nearby?.id,seated:player.sitting,carrying:carried,meal:meal?{phase:meal.phase,item:meal.item,price:meal.price}:null,occupied:seats.all().filter(s=>s.occupant).length}));
  }
  return {update,openShop:openMenu,seats,service,stand,drop};
}
