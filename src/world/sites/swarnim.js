import * as THREE from 'three';
import * as K from './kit.js';
import geography from '../../data/destination-geography.json' with {type:'json'};
import {districtFrame} from '../exploration-areas.js';
import {placePos,placeById} from '../../data/places.js';
import {siteToWorld} from '../mahatma-layout.js';
import {polygonIndex,buildingBlocks,insideWithMargin} from '../geographic-polygons.js';

// All source plots and paths stay at their original projected coordinates.
// OSM relation 13639535 (three outer sections), plus the mapped Secretariat garden.
export function buildSwarnim(scene,map,origin){
  const f=districtFrame('swarnim'),g=new THREE.Group();g.name='Swarnim Park · Full Central Vista';g.position.set(origin.x,0,origin.z);g.rotation.y=f.yaw;scene.add(g);
  const local=([x,z])=>{const p=f.toLocal(x,z);return [p.u,p.v];};
  const plots=geography.swarnim.plots.map(p=>({...p,pts:p.pts.map(local)}));
  const paths=geography.swarnim.paths.map(p=>({...p,pts:p.pts.map(local),width:p.kind==='pedestrian'?6:3}));
  const plotAt=polygonIndex(plots),buildings=map.buildings.map(b=>({...b,pts:b.pts.map(local),holes:(b.holes||[]).map(r=>r.map(local))})),buildingAt=polygonIndex(buildings);
  const inPark=(u,v,margin=0)=>plotAt(u,v).some(p=>insideWithMargin(u,v,p.pts,margin));
  const onPath=(u,v,margin=0)=>paths.some(p=>p.pts.some((b,i)=>i&&K.segDist(u,v,p.pts[i-1],b)<p.width/2+margin));
  const blockedBuilding=(u,v,r)=>buildingAt(u,v).some(b=>buildingBlocks(u,v,b,r));
  const solids=[],pools=[],pavers=K.mat(K.greyPavers(),{roughness:.9}),grass=K.mat(K.lawnTex(),{roughness:1});
  for(const p of plots){K.slab(g,p.pts,.065,grass,0,5);K.strip(g,[...p.pts,p.pts[0]],.18,.065,0xc3b79f,{height:.12});}
  for(const p of paths)K.strip(g,p.pts,p.width,.125,pavers,{tile:3});
  // Tree and furniture bays are fitted around the mapped paths and buildings.
  const free=(u,v,r=2)=>inPark(u,v,r)&&!onPath(u,v,r)&&!blockedBuilding(u,v,r)&&!solids.some(s=>s.circle&&Math.hypot(u-s.circle[0],v-s.circle[1])<r+s.circle[2]);
  let trees=0,benches=0,lights=0;
  for(const plot of plots){const [cu,cv]=K.centroid(plot.pts);
    for(let i=1;i<plot.pts.length;i++){const a=plot.pts[i-1],b=plot.pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=12;d<len;d+=24){let u=a[0]+(b[0]-a[0])*d/len,v=a[1]+(b[1]-a[1])*d/len;const towards=Math.hypot(cu-u,cv-v)||1;u+=(cu-u)*4/towards;v+=(cv-v)*4/towards;if(!free(u,v,2.8))continue;K.tree(g,u,v,.85+(trees%3)*.08);solids.push({circle:[u,v,.4]});trees++;}}
  }
  const poolTex=K.canvasTex(96,96,(c,w,h)=>{const glow=c.createRadialGradient(w/2,h/2,0,w/2,h/2,w/2);glow.addColorStop(0,'rgba(255,218,144,.45)');glow.addColorStop(1,'rgba(255,204,125,0)');c.fillStyle=glow;c.fillRect(0,0,w,h);});
  const poolMat=new THREE.MeshBasicMaterial({map:poolTex,transparent:true,depthWrite:false,toneMapped:false,opacity:.75});
  let sequence=0;
  for(const path of paths){let carry=0;for(let i=1;i<path.pts.length;i++){const a=path.pts[i-1],b=path.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(!len)continue;
    for(let d=(55-carry)%55;d<len;d+=55){const side=(sequence++%2?1:-1),u=a[0]+dx*d/len-dz/len*side*(path.width/2+3.5),v=a[1]+dz*d/len+dx/len*side*(path.width/2+3.5);if(!free(u,v,2))continue;
      K.streetLight(g,u,v,Math.atan2(dx,dz),{h:4.6});solids.push({circle:[u,v,.15]});lights++;
      const bu=u-dz/len*side*2.6,bv=v+dx/len*side*2.6;if(!free(bu,bv,1.5))continue;
      const yaw=Math.atan2(-dz,dx);K.bench(g,bu,bv,yaw);solids.push({rect:[bu,bv,2.1,.8,yaw]});benches++;
      if(sequence%4===0&&free(u+dx/len*8,v+dz/len*8,5)){
        const su=u+dx/len*8,sv=v+dz/len*8;K.cyl(g,.12,.18,4.5,0xb8b7ae,su,.1,sv,12);solids.push({circle:[su,sv,.2]});
        const shade=new THREE.Mesh(new THREE.ConeGeometry(4.6,2.1,24,1,true),K.mat(0xf2eee2,{side:THREE.DoubleSide,roughness:.6}));shade.position.set(su,5.5,sv);g.add(shade);
        K.cyl(g,1,1,.08,K.mat(0xffedba,{emissive:0xffd997,emissiveIntensity:.25}),su,4.25,sv,20);
        const pool=new THREE.Mesh(new THREE.PlaneGeometry(16,16),poolMat);pool.rotation.x=-Math.PI/2;pool.position.set(su,.145,sv);pool.visible=false;g.add(pool);pools.push(pool);
      }
    }carry=(carry+len)%55;
  }}
  K.mergeStatic(g);
  const points=plots.flatMap(p=>p.pts),minU=Math.min(...points.map(p=>p[0])),maxU=Math.max(...points.map(p=>p[0])),minV=Math.min(...points.map(p=>p[1])),maxV=Math.max(...points.map(p=>p[1]));
  const area=[[minU,minV],[maxU,minV],[maxU,maxV],[minU,maxV]],pathIds=new Set(paths.map(p=>p.id));
  const zone=K.createSiteZone({id:'swarnim-park',f,area,solids,groundY:(u,v)=>onPath(u,v)?.133:.073,vehicleFree:plots.map(p=>p.pts)});
  zone.contains=(x,z)=>{const p=f.toLocal(x,z);return inPark(p.u,p.v);};
  const world=points.map(p=>f.toWorld(...p));
  zone.clearing={contains:zone.contains,replacesBuilding:()=>false,replacesPark:(x,z)=>{const p=f.toLocal(x,z);return plots.some(plot=>K.nearPolygon(p.u,p.v,plot.pts,.15));},roadBounds:{minX:Math.min(...world.map(p=>p.x)),maxX:Math.max(...world.map(p=>p.x)),minZ:Math.min(...world.map(p=>p.z)),maxZ:Math.max(...world.map(p=>p.z))},replacesRoad:(x,z,road)=>pathIds.has(road?.id)&&zone.contains(x,z)};
  const civicOrigin=placePos(placeById('dandi'));
  const residents=[[0,780],[0,860],[0,1100],[0,1360],[0,1600],[0,2020],[0,2400],[0,2750]].map(([u,v])=>({...siteToWorld(civicOrigin,u,v),r:3}));
  return {group:g,zone,frame:f,plots,paths,counts:{trees,benches,lights},spawn:{...siteToWorld(civicOrigin,0,780),yaw:f.yaw+Math.PI,residents},setNight(on){for(const p of pools)p.visible=on;},update(){}};
}
