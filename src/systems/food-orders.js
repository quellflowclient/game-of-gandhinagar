// Deterministic, local play-money orders. Charging happens exactly once, after
// menu/proximity checks; leaving a stall doesn't erase a paid order.
export function createFoodOrders({now=()=>performance.now()/1000,position,onCollect=()=>{},onChange=()=>{}}) {
  const orders=new Map();let serial=0;
  const near=s=>{const p=position();return p&&Math.hypot(p.x-s.x,p.z-s.z)<6;};
  const state=s=>{
    const o=orders.get(s.id);if(!o)return null;
    if(o.status==='cooking'&&now()>=o.readyAt){o.status='ready';onChange(o);}
    return o;
  };
  return {
    state,
    place(stall,item,progress) {
      if(!near(stall))return {error:'Come to the counter to order.'};
      const menu=stall.items.find(([name])=>name===item);if(!menu)return {error:'That item is not on this menu.'};
      const prior=state(stall);if(prior&&prior.status!=='collected')return {error:`Token ${prior.token} is already being prepared.`};
      if(!progress.spend(menu[1]))return {error:'Not enough play money. Complete a gig to earn more.'};
      const o={token:++serial,shopId:stall.id,shopName:stall.name,item:menu[0],price:menu[1],status:'cooking',readyAt:now()+(stall.kind==='food'?9:5)};
      orders.set(stall.id,o);progress.track('buy',{item:o.item,place:'ldrp'});onChange(o);return {order:o};
    },
    collect(stall) {
      if(!near(stall))return {error:'Return to this counter to collect your order.'};
      const o=state(stall);if(!o||o.status!=='ready')return {error:'Your order is still being prepared.'};
      o.status='collected';onCollect(o);onChange(o);return {order:o};
    },
    tick(){for(const o of orders.values())if(o.status==='cooking'&&now()>=o.readyAt){o.status='ready';onChange(o);}},
    all(){return [...orders.values()].map(o=>({...o}));},
  };
}
