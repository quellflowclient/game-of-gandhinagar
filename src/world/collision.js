// Metre-scale oriented footprints. Sweeps prevent a fast car tunnelling through people.
export function overlaps(a,b) {
  if(Math.abs((a.y||0)-(b.y||0))>1.3)return false;
  const axes=p=>[[Math.sin(p.yaw||0),Math.cos(p.yaw||0)],[Math.cos(p.yaw||0),-Math.sin(p.yaw||0)]];
  const aa=axes(a),bb=axes(b),delta=[b.x-a.x,b.z-a.z];
  for(const u of [...aa,...bb]) {
    const extent=(p,ax)=>Math.abs(u[0]*ax[0][0]+u[1]*ax[0][1])*p.length/2+Math.abs(u[0]*ax[1][0]+u[1]*ax[1][1])*p.width/2;
    if(Math.abs(delta[0]*u[0]+delta[1]*u[1])>=extent(a,aa)+extent(b,bb))return false;
  }
  return true;
}
export function sweptContact(a0,a1,b0,b1) {
  const travel=Math.hypot(a1.x-a0.x,a1.z-a0.z)+Math.hypot(b1.x-b0.x,b1.z-b0.z);
  if(travel>15)return null; // teleport / traffic respawn, not a physical impact
  const angle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
  const at=(a,b,t)=>({...b,x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,y:(a.y||0)+((b.y||0)-(a.y||0))*t,yaw:(a.yaw||0)+angle(a.yaw||0,b.yaw||0)*t});
  const n=Math.max(1,Math.ceil(travel/.2));let safe=0;
  for(let i=0;i<=n;i++) {const t=i/n,a=at(a0,a1,t),b=at(b0,b1,t);if(overlaps(a,b))return{t,safe,a:at(a0,a1,safe),b:at(b0,b1,safe)};safe=t;}
  return null;
}
export function createCollisionSystem(onImpact) {
  let previous=new Map(),time=0;const cooldown=new Map();let impacts=0;
  return {
    update(dt,entities) {
      time+=dt;const now=new Map(entities.map(e=>[e.id,{...e}])),buckets=new Map(),pairs=new Set();
      for(const e of entities) {
        let old=previous.get(e.id)||e;if(Math.hypot(old.x-e.x,old.z-e.z)>15)old=e;
        const r=Math.hypot(e.width,e.length)/2;
        for(let x=Math.floor((Math.min(old.x,e.x)-r)/12);x<=Math.floor((Math.max(old.x,e.x)+r)/12);x++)for(let z=Math.floor((Math.min(old.z,e.z)-r)/12);z<=Math.floor((Math.max(old.z,e.z)+r)/12);z++){
          const key=`${x},${z}`;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(e);
        }
      }
      for(const group of buckets.values())for(let i=0;i<group.length;i++)for(let j=i+1;j<group.length;j++) {
        const a=group[i],b=group[j],key=[a.id,b.id].sort().join('|');
        if(pairs.has(key)||(!a.motor&&!b.motor))continue;pairs.add(key);
        const a0=previous.get(a.id),b0=previous.get(b.id);if(!a0||!b0)continue;
        // Existing contact must allow reversing/walking away instead of trapping
        // both objects forever at t=0 of every sweep.
        if(overlaps(a0,b0)&&Math.hypot(a.x-b.x,a.z-b.z)>Math.hypot(a0.x-b0.x,a0.z-b0.z)+.001)continue;
        const hit=sweptContact(a0,a,b0,b);if(!hit)continue;
        // Stop contact at any speed. Only energetic impacts need an accident effect.
        const vx=(a.x-a0.x-b.x+b0.x)/Math.max(dt,.001),vz=(a.z-a0.z-b.z+b0.z)/Math.max(dt,.001),speed=Math.hypot(vx,vz),direction={x:vx/(speed||1),z:vz/(speed||1)};
        a.stop?.(hit.a);b.stop?.(hit.b);
        Object.assign(a,hit.a);Object.assign(b,hit.b);
        now.set(a.id,{...a,...hit.a});now.set(b.id,{...b,...hit.b});
        const threshold=a.motor&&b.motor?6.5:4.2;
        if(speed>threshold&&!a.recovering&&!b.recovering&&(cooldown.get(key)||0)<time){cooldown.set(key,time+12);impacts++;
          a.hit?.({speed,direction:{x:-direction.x,z:-direction.z}});b.hit?.({speed,direction});
          onImpact?.({x:(hit.a.x+hit.b.x)/2,y:Math.max(hit.a.y||0,hit.b.y||0)+.5,z:(hit.a.z+hit.b.z)/2,speed,player:a.player||b.player,a,b});}
      }
      previous=now;
      for(const[k,t]of cooldown)if(t<time-5)cooldown.delete(k);
    },
    get impacts(){return impacts;},
  };
}
