import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createStreetService,createSeatState,atStallCounter} from '../src/systems/street-service.js';
import {MARKET_SHOPS,marketPoint,toMarket} from '../src/world/sites/ldrp-market-layout.js';
import {createNavigation} from '../src/world/navigation.js';
import {ldrpCyclePaths} from '../src/world/sites/ldrp-paths.js';
import {LDRP} from '../src/world/sites/ldrp.js';
import * as K from '../src/world/sites/kit.js';

// User-specified sketch ordering, opposite sides and Patel's tempo.
assert.equal(MARKET_SHOPS.length,8);
assert.deepEqual(MARKET_SHOPS.filter(s=>s.u<0).sort((a,b)=>a.u-b.u).map(s=>s.id),['babu','chintu','lalbhai','natu']);
assert.ok(MARKET_SHOPS.find(s=>s.id==='ajit').v<0&&MARKET_SHOPS.find(s=>s.id==='patel').v<0);
assert.equal(MARKET_SHOPS.find(s=>s.id==='patel').kind,'tempo');
for(const s of MARKET_SHOPS){const w=marketPoint({x:-607,z:-4897},s.u,s.v),p=toMarket({x:-607,z:-4897},w.x,w.z);assert.ok(Math.hypot(p.u-s.u,p.v-s.v)<1e-8);}
let t=0,coins=100,charges=0,eaten=0,pos={x:0,z:0};
const shop={...MARKET_SHOPS[0],x:0,z:0};
const service=createStreetService({now:()=>t,position:()=>pos,spend:n=>{if(coins<n)return false;coins-=n;charges++;return true;},onEat:()=>eaten++});
assert.ok(service.order('Chhole kulche',100).error);
for(const p of [{x:3,z:0},{x:0,z:10},{x:12,z:0},{x:0,z:0,y:3}]){pos=p;assert.equal(atStallCounter(shop,p),false);assert.ok(service.call(shop).error,'Cannot call from median, road or far from counter');}
pos={x:50,z:0};assert.ok(service.call(shop).error);pos={x:0,z:0};assert.ok(service.call(shop).ok);
t=4;service.tick(5);assert.equal(service.meal.phase,'approaching');
service.tick(1);assert.equal(service.meal.phase,'taking-order');
assert.ok(service.order('Not on menu',100).error);assert.ok(service.order('Chhole kulche',10).error);
assert.ok(service.order('Chhole kulche',100).ok);assert.equal(coins,100);assert.equal(charges,0);
assert.ok(service.call(shop).error);assert.ok(service.pay().error);
t=20;service.tick(10);assert.equal(service.meal.phase,'delivering');
pos={x:40,z:0};service.tick(1);assert.equal(service.meal.phase,'delivering');pos={x:0,z:0};service.tick(1);assert.equal(service.meal.phase,'eating');assert.equal(eaten,1);
t=40;service.tick(1);assert.equal(service.meal.phase,'bill-due');assert.equal(coins,100);
coins=1;assert.ok(service.pay().error);assert.equal(service.meal.phase,'bill-due');coins=100;
assert.ok(service.pay().ok);assert.equal(coins,40);assert.equal(charges,1);assert.ok(service.pay().error);assert.equal(charges,1);

const seats=createSeatState([{id:'occupied',occupant:'npc',group:'friends',x:0,z:0},{id:'yes',occupant:null,group:'friends',allowBorrow:true,x:2,z:0},{id:'no',occupant:null,group:'friends',allowBorrow:false,x:4,z:0},{id:'free',occupant:null,group:null,x:6,z:0}]);
assert.ok(seats.sit('occupied','a').error);assert.ok(seats.carry('occupied','a').error);
assert.ok(seats.carry('yes','a').error);assert.ok(seats.ask('yes','a').ok);assert.ok(seats.carry('yes','b').error);
assert.ok(seats.ask('no','a').denied);assert.ok(seats.carry('no','a').error);
assert.ok(seats.sit('no','a').error,'Cannot occupy a table after the group refuses');
assert.ok(seats.carry('yes','a').ok);assert.ok(seats.sit('free','a').error);assert.ok(seats.sit('yes','b').error);
assert.ok(seats.drop('yes','a',8,1,0).ok);assert.ok(seats.sit('yes','a').ok);assert.ok(seats.sit('yes','b').error);assert.equal(seats.stand('yes','b'),false);assert.equal(seats.stand('yes','a'),true);assert.ok(seats.sit('yes','b').ok);
// Walking remains allowed on gardens; bikes remain on real drives and paved paths.
const map=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)));
const f=K.frame({x:-607.26044,z:-4897.2117}),paths=ldrpCyclePaths(LDRP,map,f);
let lawns=0,paving=0;
for(let u=-100;u<100;u+=2)for(let v=-85;v<90;v+=2)if(K.pointInPolygon(u,v,LDRP.area)) {
  assert.ok(paths.allowed(u,v,0.38));if(paths.allowed(u,v,0.52))paving++;else lawns++;
}
assert.ok(lawns+paving>1000); // open campus ground is rideable since the 2026-11-25 campus pass
const nav=createNavigation([],{roads:[{kind:'residential',pts:[[-50,0],[50,0]]}]});
assert.notEqual(nav.surface(0,0,0,0.52),undefined);assert.equal(nav.surface(0,15,0,0.52),undefined);assert.notEqual(nav.surface(0,15,0,0.38),undefined);
assert.ok(Math.abs(nav.surface(0,0,0,0.38)-(0.2+7*0.004+0.008))<1e-8,'Feet must sit on the rendered road ribbon');
const publicRoad=createNavigation([],{roads:[{kind:'secondary',pts:[[-50,0],[50,0]]}]});
assert.ok(Math.abs(publicRoad.surface(0,7.4,0)-(0.3+13*0.004+0.008))<1e-8,'Feet must rise onto the public footpath');
assert.ok(paths.height(...LDRP.hub)>=0.138,'Campus hub has a raised rendered surface');
const cyclist={x:0,y:0,z:0};nav.move(cyclist,0,20,0.52);assert.ok(cyclist.z<4.3,'Cyclist must stop before lawn');
console.log(`Street life passed: 8 PDF locations, name-call service, food before one final payment, permission/denial, exclusive seats and ${lawns} lawn/${paving} paved cycling probes.`);
