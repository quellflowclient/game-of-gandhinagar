import * as THREE from 'three';
import {CAMPUS_DRIVES} from './sites/ldrp-reference.js';
// Uses the already-loaded real weather code; no invented rain when weather is unavailable.
export function createCampusWeather(scene,campus,{lowEnd=false}={}){
 const count=lowEnd?360:720,positions=new Float32Array(count*6),geo=new THREE.BufferGeometry(),wind={value:0},materials=new Map();
 for(let i=0;i<count;i++){const k=i*6,x=(Math.random()-.5)*80,z=(Math.random()-.5)*80,y=Math.random()*28;positions.set([x,y,z,x-.03,y-.7,z],k);}
 geo.setAttribute('position',new THREE.BufferAttribute(positions,3));const rain=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xb2c5cc,transparent:true,opacity:.38,depthWrite:false}));rain.frustumCulled=false;rain.visible=false;scene.add(rain);
 const puddles=new THREE.Group(),puddleMat=new THREE.MeshPhysicalMaterial({color:0x779197,roughness:.12,metalness:.25,transparent:true,opacity:.28,depthWrite:false});scene.add(puddles);
 for(let i=0;i<12;i++){const path=CAMPUS_DRIVES[i%CAMPUS_DRIVES.length],p=path.points[Math.min(1,path.points.length-1)],w=campus.frame.toWorld(p[0]+(i%3-1),p[1]);const mesh=new THREE.Mesh(new THREE.CircleGeometry(.45+(i%3)*.23,18),puddleMat);mesh.rotation.x=-Math.PI/2;mesh.scale.y=.6;mesh.position.set(w.x,path.height+.01,w.z);puddles.add(mesh);}puddles.visible=false;
 scene.traverse(o=>{for(const m of [].concat(o.material||[])){if(!m.isMeshStandardMaterial||materials.has(m))continue;materials.set(m,{roughness:m.roughness});
   if(m.alphaTest>.3&&m.map){const previous=m.onBeforeCompile;m.onBeforeCompile=shader=>{previous?.(shader);shader.uniforms.campusWind=wind;shader.vertexShader='uniform float campusWind;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed.x += sin(position.x*.17 + campusWind)*.035*clamp(position.y*.15,0.,1.);');};m.needsUpdate=true;}
 }});
 let time=0,wet=0,lastWet=-1;
 return{update(dt,player,weather){time+=dt;wind.value=time*(.6+(weather.wind||0)*.03);const code=weather.loaded?weather.code:null,isRain=code!=null&&((code>=51&&code<=67)||(code>=80&&code<=82)||code>=95),fog=code===45||code===48;
  rain.visible=isRain;rain.position.set(player.x,player.y,player.z);puddles.visible=isRain&&Math.hypot(player.x-campus.gateOrigin.x,player.z-campus.gateOrigin.z)<240;
  wet=THREE.MathUtils.damp(wet,isRain?1:0,.5,dt);if(Math.abs(wet-lastWet)>.003){lastWet=wet;for(const[m,base]of materials)if(base.roughness>.7)m.roughness=base.roughness*(1-wet*.42);}
  if(isRain){for(let i=0;i<count;i++){const k=i*6;positions[k+1]-=dt*17;if(positions[k+1]<0)positions[k+1]=28;positions[k+4]=positions[k+1]-.7;}geo.attributes.position.needsUpdate=true;}
  if(scene.fog)scene.fog.far=fog?290:code===3?1500:2000;
  return{rain:isRain,night:false};
 }};
}
