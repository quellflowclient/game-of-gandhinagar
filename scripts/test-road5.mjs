import assert from 'node:assert/strict';
import fs from 'node:fs';
import {metroCenterlines,singleRowPiers} from '../src/world/metro-layout.js';
import {pierGeometry} from '../src/world/metro.js';
import {applyRoad5Profile,ROAD5_WAYS,MARKET_SHOPS,MARKET_GROUND,marketPoint} from '../src/world/sites/ldrp-market-layout.js';
import {placePos,placeById} from '../src/data/places.js';
import {createNavigation} from '../src/world/navigation.js';
import {CAMERA_MODES} from '../src/world/camera-modes.js';
const map=JSON.parse(fs.readFileSync(new URL('../public/data/gandhinagar-map.json',import.meta.url)));
applyRoad5Profile(map);for(const id of ROAD5_WAYS){const r=map.roads.find(r=>r.id===id);assert.equal(r.width,6.2);assert.deepEqual(r.sidewalkSides,[-1]);}
const ring=map.roads.find(r=>r.id===386749312),centre=marketPoint(placePos(placeById('ldrp')),0,0);for(const [k,key] of [[0,'x'],[1,'z']])assert.ok(Math.abs(centre[key]-(Math.min(...ring.pts.map(p=>p[k]))+Math.max(...ring.pts.map(p=>p[k])))/2)<.05,'Authored circle must be centred on the actual OSM ring');
for(const shop of MARKET_SHOPS)assert.ok(Math.abs(shop.v)<17,'Shops meet the outer footpath, not a lawn strip');
assert.ok(MARKET_GROUND>0.3);
const lines=metroCenterlines([{id:1,elevated:true,pts:[[0,0],[100,0]]},{id:2,elevated:true,pts:[[100,3],[0,3]]}]);assert.equal(lines.length,1);assert.ok(lines[0].pts.every(p=>p[1]===1.5));
assert.equal(singleRowPiers([[0,0,0],[26,0,0],[0,3,Math.PI],[26,3,Math.PI]]).length,2);
const geo=pierGeometry(),p=geo.attributes.position;let shaft=0;for(let i=0;i<p.count;i++)if(p.getY(i)<10.3){assert.ok(Math.hypot(p.getX(i),p.getZ(i))<=0.851,'Round shaft, no square corners');shaft++;}assert.ok(shaft>50);
const nav=createNavigation([],{roads:[{kind:'tertiary',width:6.2,sidewalkSides:[-1],pts:[[-40,0],[40,0]]}]});nav.addObstacles([{x:0,z:0,r:0.85}]);assert.equal(nav.surface(0,0,0),undefined);const walker={x:-3,y:0.233,z:0};nav.move(walker,6,0);assert.ok(walker.x<0,'Cannot walk through the circular metro support');
assert.deepEqual(CAMERA_MODES.map(m=>m.id),['follow','wide','front','orbit','eyes']);assert.ok(CAMERA_MODES.every(m=>m.fov>=45&&m.fov<=90));
const actual=metroCenterlines(map.metro);console.log(`Road 5 passed: footprint-adjacent shops, separate carriageways, outer footpaths, round single-row supports, physical pier collision and five camera modes. Metro ${map.metro.filter(l=>l.elevated).length} track ways → ${actual.length} viaduct paths.`);
