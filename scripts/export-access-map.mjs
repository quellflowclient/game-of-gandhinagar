// Read-only map export: use the game's authored layout; never alter the world.
import fs from 'node:fs';
import * as R from '../src/world/sites/ldrp-reference.js';
import {MARKET,MARKET_SHOPS,LDRP_PLAY_AREA,ROAD5_WAYS,ROAD5_OUTER_EXPANSION,toMarket} from '../src/world/sites/ldrp-market-layout.js';
import {MAHATMA as M,CAMPUS_ROAD,CAMPUS_FENCES,CAMPUS_GATES,SITE_BEDS,bedOutline} from '../src/world/mahatma-layout.js';
import {placePos,placeById} from '../src/data/places.js';
import {createLiveMap} from '../src/world/live-map.js';
import {alignMetroRoads} from '../src/world/metro-road-clearance.js';
import {STALL_HOURS,businessHour} from '../src/data/stall-hours.js';
const out='output/maps';fs.mkdirSync(out,{recursive:true});
const E=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const C={ink:'#183b40',muted:'#5a7374',paper:'#faf8ef',ground:'#e1e9d9',garden:'#a4cfa4',road:'#657174',path:'#f0dcc1',blocked:'#d9978a',wall:'#9b4351',water:'#84c4d3',boundary:'#6b4db5'};
function canvas(w,h,title,subtitle){let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><title>${E(title)}</title><rect width="${w}" height="${h}" fill="${C.paper}"/>`;return{
 text(x,y,t,size=14,fill=C.ink,anchor='start'){s+=`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}" text-anchor="${anchor}">${E(t)}</text>`;},
 rect(x,y,w,h,fill,stroke='none',sw=1){s+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;},
 poly(p,fill,stroke='none',sw=1){s+=`<polygon points="${p.map(p=>p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;},
 line(p,color,width=2,dash=''){s+=`<polyline points="${p.map(p=>p.join(',')).join(' ')}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"${dash?` stroke-dasharray="${dash}"`:''}/>`;},
 circle(x,y,r,fill,stroke='none',sw=1){s+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;},
 mark(p,id){this.circle(...p,10,C.ink,'#fff',1.5);this.text(p[0],p[1]+3.5,id,10,'#fff','middle');},
 finish(){return s+'</svg>';},header(){this.text(42,43,title,28);this.text(42,70,subtitle,13,C.muted);}
};}
const details=[
 ['1','Single main gate','Security check / virtual campus ID or visitor pass. Entry on foot through the narrow pedestrian lane; everyone exits through the other opening. Car/auto stay outside.'],
 ['2','Security cabin / gate flower garden','Guard, register desk, umbrella, barricade lane and sliding exit gate. ID check happens near the gate.'],
 ['3','Paaji register desk','Outside gate: register, chair and parked bike.'],
 ['4','Stationery / Xerox','Small shop beside the inside west gate yard.'],['5','Bike repair garage','Separate small garage beside stationery.'],
 ['6','Four student gardens','Walk and sit on the ground within lawns. No campus garden benches. Trees/hedges/soil strips have solid borders; vehicle access is blocked.'],
 ['7','Tall Indian flag','One tall flag in the central garden; base is solid.'],
 ['8','Curved main college','Curved frontage, four radial wings, connected curved rear links and courtyards. Building mass/interiors are blocked.'],
 ['9','Kalupur Bank ATM','ATM sign on the college facade; no usable interior represented.'],
 ['10','Mechanical engineering','Separate ground + 3 floors block; exterior only.'],['11','College canteen','Long, narrow ground-floor block behind mechanical; exterior only.'],
 ['12','Social Work wing','MIPLVP wing / signage; building interior closed.'],['13','Hostel D wing','Long rear hostel block, separate from the three small houses. Exterior roads only.'],
 ['14','Hostel B wing','Courtyard hostel; exterior only.'],['15','Hostel A wing','Courtyard hostel; exterior only.'],['16','LDRP academic block','Separate courtyard academic block; exterior only.'],['17','Hostel C wing','Separate courtyard block; exterior only.'],
 ['18','Hostel E wing','East strip block; exterior only.'],['19','Faculty residences','Separate residential block, not the student hostel.'],['20','Premium guest house','Three floors, facade and balcony detail; exterior only.'],
 ['21','Three small houses','Small pitched-roof homes west of D wing; solid buildings.'],['22','Inside two-wheeler parking','Below the separate academic block; marked bays and parked bikes/scooters.'],
 ['23','Outside parking / raised footpath','Two lots on Road 5 frontage. Footpath avoids road/gate and leaves flush parking access gaps.'],['24','West bus parking','College bus park along west curved drive / metro side.'],
 ['25','KH-5 circle','Roundabout island, sculpture, signals and surrounding road. Driving stays on road; planted median is restricted.'],
 ['26','Metro corridor','Elevated metro, piers and fenced planted median. Track, piers and fenced beds are not player routes.'],
 ['27','Campus road network','Single connected drives: front cross-road, west/rear curve, academic/hostel branches. Walk/cycle routes; solid buildings and planted borders remain blocked.'],
];
const origin=placePos(placeById('ldrp')),co=Math.cos(R.PHOTO_YAW),si=Math.sin(R.PHOTO_YAW);
const gate={x:origin.x-25+si*(6.5+ROAD5_OUTER_EXPANSION),z:origin.z-87.93+co*(6.5+ROAD5_OUTER_EXPANSION)};
const world=([u,v])=>[gate.x+u*co+v*si,gate.z-u*si+v*co];
const ldrpXY=([x,z])=>{const p=toMarket(origin,x,z);return[65+(212-p.u)*1.83,105+(65-p.v)*1.83];};
const local=p=>ldrpXY(world(p)),photo=(x,y)=>local(R.photoPoint(x,y));
const map=alignMetroRoads(createLiveMap(JSON.parse(fs.readFileSync('public/data/gandhinagar-map.json','utf8'))));
const L=canvas(1320,1110,'GOG / LDRP + KH-5 access map','Current game layout • Road 5 at top • Rotated view, not north-up • Read numbered key below');L.header();
const b=LDRP_PLAY_AREA,corners=[[b.minU,b.minV],[b.minU,b.maxV],[b.maxU,b.maxV],[b.maxU,b.minV]];
const marketXY=([u,v])=>[65+(212-u)*1.83,105+(65-v)*1.83];
L.poly(corners.map(marketXY),C.ground,C.boundary,3);
L.text(72,742,'Purple outline = LDRP hard play limit (player uses an extra 1.5 m inset). Beyond it movement stops.',14,C.boundary);
for(const road of map.roads){const p=road.pts.map(ldrpXY);if(!p.some(([x,y])=>x>25&&x<1285&&y>85&&y<730))continue;const widths={primary:18,secondary:13,tertiary:10,residential:7,service:5};L.line(p,C.road,(road.width||widths[road.kind]||5)*1.83);if(ROAD5_WAYS.includes(road.id))L.line(p,'#e1e1cf',1,'9 10');}
for(const line of map.metro||[]){const p=line.pts.map(ldrpXY);if(p.some(([x,y])=>x>25&&x<1285&&y>85&&y<730)){L.line(p,'#a1a994',7);L.line(p,'#4c6764',2,'7 5');}}
L.poly(R.CAMPUS_BOUNDARY.map(local),'#e4e8d5',C.wall,3);
const lots=[R.OUTSIDE_PARKING,[[243,-2],[610,-5],[610,12],[243,15]].map(p=>R.photoPoint(...p))];
for(const p of lots)L.poly(p.map(local),'#e9ca87','#ae975c');
for(const p of [R.WEST_BUS_PARK,R.WEST_JUNCTION,R.GATE_FORECOURT,R.HOSTEL_YARD])L.poly(p.map(local),'#dddcd1');
for(const p of R.CAMPUS_DRIVES)L.line(p.points.map(local),C.road,p.width*1.83);
for(const p of [...R.GARDEN_PATHS,R.GARDEN_PROMENADE])L.line(p.points.map(local),C.path,p.width*1.83);
for(const p of R.FOUR_GARDENS)L.poly(p.map(local),C.garden,'#709876',1.2);
const arc=(rx,ry)=>Array.from({length:65},(_,i)=>R.photoPoint(211+rx*Math.cos(i*Math.PI/64),50+ry*Math.sin(i*Math.PI/64)));
L.poly([...arc(112,101),...arc(88,78).reverse()].map(local),C.blocked,'#a87066');
for(const a of R.ACADEMIC_WING_ANGLES){const base=[211+109*Math.cos(a),50+98*Math.sin(a)],side=[-Math.sin(a),Math.cos(a)],dir=[Math.cos(a),Math.sin(a)];const poly=[[-24,0],[24,0],[24,46],[-24,46]].map(([x,z])=>R.photoPoint(base[0]+side[0]*x+dir[0]*z,base[1]+side[1]*x+dir[1]*z));L.poly(poly.map(local),C.blocked,'#a87066');}
for(const p of R.ACADEMIC_LINKS)L.poly(p.map(local),C.blocked,'#a87066');
const blockIds={'mechanical':10,'canteen':11,'hostel-d':13,'hostel-b':14,'hostel-a':15,'ldrp-academic':16,'hostel-c':17,'hostel-e':18,'faculty-residences':19,'guest-house':20};
for(const block of R.CAMPUS_BLOCKS){if(block.id==='social-work')continue;const[x0,y0,x1,y1]=block.rect;L.poly([[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(p=>photo(...p)),C.blocked,'#a87066');if(block.court)L.poly([[x0+11,y0+11],[x1-11,y0+11],[x1-11,y1-11],[x0+11,y1-11]].map(p=>photo(...p)),'#e4e8d5');if(blockIds[block.id])L.mark(photo((x0+x1)/2,(y0+y1)/2),blockIds[block.id]);}
L.poly(R.INSIDE_PARKING.map(local),'#e9ca87','#ae975c');
for(const [id,p]of [[1,photo(215,29)],[2,local([0,3.6])],[3,local([13.9,-3.35])],[4,local([-31,1.4])],[5,local([-44.5,1.6])],[6,photo(171,80)],[7,local(R.FLAG_POINT)],[8,photo(211,140)],[9,photo(135,109)],[12,photo(176,197)],[21,photo(84,261)],[22,photo(450,134)],[23,photo(490,2)],[24,photo(90,27)],[25,marketXY([0,0])],[26,marketXY([85,0])],[27,photo(346,208)]] )L.mark(p,id);
L.circle(...local([5.1,0]),5,'#167a73');L.circle(...local([-6,0]),5,'#167a73');
for(const [i,shop]of MARKET_SHOPS.entries()){const p=marketXY([shop.u,shop.v]);L.rect(p[0]-8,p[1]-7,16,14,'#be7c42','#fff');L.text(p[0],p[1]+3,String.fromCharCode(65+i),10,'white','middle');}
// Crop road context to the map panel, keeping title and key unobstructed.
L.rect(0,0,1320,100,C.paper);L.header();L.rect(0,770,1320,340,C.paper);
L.rect(0,100,60,670,C.paper);L.rect(1250,100,70,670,C.paper);
L.line([...corners,corners[0]].map(marketXY),C.boundary,3);
L.text(42,785,'CAMPUS KEY / all buildings shown in red are closed interiors',18);
details.forEach(([id,name],i)=>{const col=Math.floor(i/9),row=i%9;L.text(42+col*421,818+row*23,`${id.padStart(2,'0')}  ${name}`,13);});
L.text(42,1049,'STALLS: A Babu • B Anjali • C Lalbhai • D Natu • E Masi • F Sarpanch • G Patel tempo • H Ajit',14);
L.text(42,1078,'Green: gardens / open grounds   Grey: roads   Sand: walking paths   Gold: parking   Red: solid buildings   Purple: play limit',12,C.muted);
fs.writeFileSync(`${out}/ldrp-access-map.svg`,L.finish());
const md=[['1','Dandi Kutir / salt mound','Solid cone. No walking inside or on its sloping surface.'],['2','Inner courtyard','Walkable ring between radii 45 and 53 m, connected through four radial passages.'],['3','Annular gallery / sloping berm','Blocked except the north/south/east/west passages. Sloping roof is not a walking surface.'],['4','Inner waterside path','Walkable ring between radii 73 and 80 m.'],['5','Water moat','Blocked water band, crossed only at the four radial crossings / elevated bridge.'],['6','Outer promenade','Walkable ring between radii 94 and 101 m.'],['7','Museum garden paths','Open grounds and paths outside the ring. Trees, planting beds, furniture and fences block their footprints.'],['8','Dandi footbridge','Separate elevated walkable deck, roughly 7.6 m wide. Rise/fall follows the bridge; rails keep users on deck.'],['9','Road between compounds','22 m authored roadway, centre divider, sidewalks and zebra crossings. Vehicles use road; compounds block motor vehicles.'],['10','Convention / exhibition building','Solid building footprint; closed interior. Bridge deck may pass above it as a separate surface.'],['11','Convention exterior plaza','Paved exterior grounds around halls; use open gates and avoid solid footprint.'],['12','Gandhi Garden','Rear garden paths, lawns and trees beyond the halls; compound fence remains solid.']];
const D=canvas(1040,1220,'GOG / Mahatma Mandir access map','Current authored game geometry • Local bridge axis points down • Not north-up');D.header();
const xy=([u,v])=>[280+u*1.07,235+v*1.07];
for(const p of [M.museumPlot,M.conventionPlot])D.poly(p.map(xy),C.ground);
D.line(CAMPUS_ROAD.path.map(xy),C.road,CAMPUS_ROAD.width*1.07);
for(const [r,color]of [[101,C.path],[94,C.water],[80,C.path],[73,C.blocked],[53,C.path],[45,C.blocked]])D.circle(...xy([0,0]),r*1.07,color);
for(const axis of [0,1])D.line((axis?[[-101,0],[101,0]]:[[0,-101],[0,101]]).map(xy),C.path,8*1.07);
D.circle(...xy([0,0]),45*1.07,C.blocked,'#a87066',1.5);
D.poly(M.convention.map(xy),C.blocked,'#a87066',1.5);
for(const bed of SITE_BEDS)D.poly(bedOutline(bed).map(xy),'#658e5d');
D.line([[0,516],[0,719]].map(xy),C.path,6*1.07);for(const v of [560,630,692])D.line([[-132,v],[98,v]].map(xy),C.path,3.5*1.07);
for(const u of [-129,94])D.line([[u,530],[u,703]].map(xy),C.path,3*1.07);
for(const f of CAMPUS_FENCES)D.line([f.a,f.b].map(xy),C.wall,2.8);
D.line([[0,46.5],[0,338]].map(xy),'#3c90b2',8);D.line([[0,46.5],[0,338]].map(xy),'#fff',1.7,'6 5');
for(const g of CAMPUS_GATES){D.circle(...xy([g.u,g.v]),5,'#167a73','#fff',1);}
for(const [id,p]of [[1,[0,0]],[2,[24.5,-42.4]],[3,[-31,-53.7]],[4,[-71.4,26]],[5,[81.8,29.8]],[6,[69.3,-69.3]],[7,[95,113]],[8,[0,291]],[9,[145,174]],[10,[-25,445]],[11,[-109,392]],[12,[0,625]]])D.mark(xy(p),id);
D.text(540,115,'ACCESS KEY',19);md.forEach(([id,title],i)=>D.text(540,150+i*28,`${id.padStart(2,'0')}  ${title}`,13));
D.text(540,536,'GATES (green dots)',17);CAMPUS_GATES.forEach((g,i)=>D.text(540,568+i*25,g.name,13));
['Vehicles: outside road only.','Walk: paths, plazas, bridge and open grounds.','Red: solid building / gallery / berm.','Blue: moat; dashed blue: elevated bridge.','Brown lines: compound fence; use a gate.','Plant beds / trunks / benches block footprints.'].forEach((t,i)=>D.text(540,775+i*27,t,13));
D.text(42,1080,'BOUNDARY NOTE',18,C.boundary);D.text(42,1110,'Mahatma has compound fences, but no separate LDRP-style local play-limit rectangle.',13);
D.text(42,1134,'Outside the compound, the generic map bounds apply. The map shows the authored site, not an invented hard limit.',12,C.muted);
D.text(42,1180,'Source: mahatma-layout.js / mahatma-grounds.js / current navigation rules. Static code export; no gameplay test.',12,C.muted);
fs.writeFileSync(`${out}/mahatma-access-map.svg`,D.finish());
const cards=items=>items.map(([id,title,body])=>`<article><b>${E(id)} · ${E(title)}</b><p>${E(body)}</p></article>`).join('');
const shopRows=MARKET_SHOPS.map((s,i)=>{const h=STALL_HOURS[s.id];return`<tr><td>${String.fromCharCode(65+i)} · ${E(s.name)}</td><td>${businessHour(h.open)}–${businessHour(h.close)}${h.closedDays?' · Sunday closed':''}</td><td>${E(s.staff)}</td><td>${s.items.map(([n,p])=>`${E(n)} ₹${p}`).join(', ')}</td></tr>`;}).join('');
const html=`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>GOG · Full game access guide</title><style>*{box-sizing:border-box}body{margin:0;background:#f5f4eb;color:#183b40;font:15px/1.6 system-ui,sans-serif}header,main{max-width:1360px;margin:auto;padding:25px}header{padding-bottom:8px}h1{font-size:32px;line-height:1.2}h2{margin:30px 0 12px}p{margin:8px 0}nav{display:flex;gap:8px;position:sticky;top:0;background:#f5f4ebf5;padding:10px 25px;z-index:2;flex-wrap:wrap}button,a.pill{border:1px solid #aebdb0;border-radius:25px;background:white;color:#183b40;padding:10px 18px;font:inherit;cursor:pointer;text-decoration:none}button.active{background:#183b40;color:#fff}.pane[hidden]{display:none}.map{overflow:auto;background:#faf8ef;border:1px solid #b6c4b6;border-radius:12px}.map img{width:100%;display:block;max-width:none}.tools{display:flex;gap:10px;align-items:center;margin:12px 0;flex-wrap:wrap}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(270px,1fr));gap:12px}article,.note{padding:17px;background:white;border:1px solid #d7dfd3;border-radius:10px}article p{color:#526c6b;font-size:14px}.warning{border-left:5px solid #9b4351}.scroll{overflow:auto}table{border-collapse:collapse;width:100%;background:white}td,th{padding:12px;text-align:left;border-bottom:1px solid #dde3d8;min-width:150px}.muted{color:#617877;font-size:13px}footer{padding:25px;border-top:1px solid #d6dfd2}a{color:#167a73}</style>
<header><p class="muted">GOG · CURRENT CODE MAP · 26 NOV 2026</p><h1>Poore game mein kahan ja sakte ho?</h1><p>Abhi live destinations: <b>LDRP + KH-5 market</b> aur <b>Mahatma Mandir / Dandi Kutir</b>. Yeh current code ka map hai; surveyed real-world map nahi.</p></header>
<nav><button class="active" data-tab="ldrp">LDRP + stalls</button><button data-tab="mahatma">Mahatma Mandir</button><button data-tab="rules">Access / limits</button></nav><main>
<section class="pane" id="ldrp"><div class="tools"><button data-zoom="1">Fit map</button><button data-zoom="1.5">150%</button><button data-zoom="2">200%</button><a class="pill" href="ldrp-access-map.svg" download>Download LDRP map</a><span class="muted">Zoom karke swipe / scroll karo.</span></div><div class="map"><img src="ldrp-access-map.svg" alt="LDRP map with campus blocks, stalls, roads and hard play boundary"></div><h2>Campus ke andar kya hai</h2><div class="grid">${cards(details)}</div><h2>Eight stalls · timings / people / menu</h2><div class="scroll"><table><tr><th>Map / stall</th><th>IST hours</th><th>People</th><th>Menu in game</th></tr>${shopRows}</table></div><p class="note">Order ke liye stall counter ke paas jaana hota hai. Named server ko bulao, order do, delivery / eating ke baad payment. Seat occupancy aur permission-based seat carrying ka logic hai. Current non-food stall layout: <b>22 small sitting tables + 5 shared chai tables per stall</b>; earlier requested 25 sitting tables is not the current code count.</p></section>
<section class="pane" id="mahatma" hidden><div class="tools"><button data-zoom="1">Fit map</button><button data-zoom="1.5">150%</button><button data-zoom="2">200%</button><a class="pill" href="mahatma-access-map.svg" download>Download Mahatma map</a></div><div class="map"><img src="mahatma-access-map.svg" alt="Mahatma Mandir pedestrian areas, moat, bridge, convention hall and fence gates"></div><h2>Mahatma: detailed access</h2><div class="grid">${cards(md)}</div><h2>Compound gates</h2><div class="grid">${cards(CAMPUS_GATES.map((g,i)=>[i+1,g.name,`${g.plot==='museum'?'Museum':'Convention'} compound · opening ${g.width} m wide. Fence ke through nahi; gate opening se jao.`]))}</div></section>
<section class="pane" id="rules" hidden><h2>Kahan allowed / kahan blocked</h2><div class="grid">${cards([
 ['01','LDRP outer limit','Market frame: u −432 to +212 m; v −295 to +65 m. Player uses 1.5 m inset. LDRP spawn activates area lock; walking and driving cannot cross it.'],
 ['02','Campus entry','One main entrance compound with separate openings. Guard within 17 m; virtual ID or visitor pass; about 2.1 s checking. Pedestrian entry lane only. Exit uses sliding-gate opening.'],
 ['03','Campus vehicles','Car and auto stay outside for all roles. Cycle can use allowed campus paths after entering on foot. Bike/scooter are admitted only on permitted road/parking footprints, outside gardens, with checked entry; campus motor two-wheelers capped at 15 km/h.'],
 ['04','Closed interiors','Academic blocks, curved college, mechanical, canteen, hostels, faculty homes, guest house, houses and convention hall are solid exterior models. Their doors do not lead into playable rooms.'],
 ['05','Gardens','LDRP lawns allow ground sitting; garden beds, hedges, trunks, curbs and solid furniture still obstruct movement. Vehicles cannot use gardens as a shortcut.'],
 ['06','Roads / rides','Cars 80 km/h, auto 35, bike 45, scooter 35, cycle 36 maximum in current settings. Whole motor-vehicle footprint must fit road/allowed parking surface; median, footpath and grass are not driving lanes.'],
 ['07','Mahatma rules','Walk inside the compounds, around the salt mound, through radial passages, exterior plazas and elevated bridge. Solid cone, gallery berm, water, convention footprint and fences block ground access. All motor vehicles are forbidden inside both compounds.'],
 ['08','Important boundary difference','Mahatma teleport disables the LDRP area lock. Its fences restrict compound crossing, but no dedicated outer Mahatma play rectangle exists. Global limits are derived from live map road extents plus 300 m padding, so do not assume every blank area outside is blocked.'],
 ['09','Travel between destinations','Use Travel / BRTS selection between the two live locations. The currently exported live map is two clipped site regions, not a fully detailed continuous Gandhinagar city between them. Sitting/carrying and unpaid meal state can delay travel.'],
 ['10','Other places','Other destinations remain in source code but are filtered out of the current live location list. This guide does not mark them as playable.'],
 ['11','Map accuracy','Building footprints, campus drives, four lawns, hostels, stalls, road widths and outer play limit come from current layout exports. Small props and individual pedestrians/parked vehicles are omitted for readability. Footpath line is a frontage region, not a surveyed path.'],
 ['12','Verification scope','This is a static code/layout inspection. No gameplay, browser or device testing performed. Multiplayer presence and voice depend on backend/server configuration and are not established by this map.']
 ])}</div><h2>Legend</h2><p class="note">Green = lawns/open grounds · grey = roads · sand = pedestrian paths · gold = parking · red = solid buildings/blocked gallery · blue = water · dashed blue = elevated footbridge · brown = compound fences · purple = LDRP hard play boundary.</p></section>
<footer class="muted">Generated from current local source. No game layout changes and no push. Main sources: ldrp-reference.js, ldrp-campus.js, ldrp-market-layout.js, mahatma-layout.js, driving.js, campus.js and main.js.</footer></main>
<script>document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==b.dataset.tab);document.querySelectorAll('[data-tab]').forEach(n=>n.classList.toggle('active',n===b));});document.querySelectorAll('[data-zoom]').forEach(b=>b.onclick=()=>{b.closest('.pane').querySelector('.map img').style.width=(Number(b.dataset.zoom)*100)+'%';});</script></html>`;
fs.writeFileSync(`${out}/game-access-guide.html`,html);
console.log('Created 2 SVG maps and complete interactive access guide in '+out);
