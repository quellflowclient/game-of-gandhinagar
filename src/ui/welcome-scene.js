import * as THREE from 'three';
import {MAHATMA} from '../world/mahatma-layout.js';

// An architectural study using the game's museum and bridge dimensions.
// Reuse the game's WebGL context; restore its canvas and sizing on entry.
export function createWelcomeScene({host,button,renderer,lowEnd}){
 const canvas=renderer.domElement,parent=canvas.parentElement,ratio=renderer.getPixelRatio();
 const shadowEnabled=renderer.shadowMap.enabled,shadowAutoUpdate=renderer.shadowMap.autoUpdate;
 const scene=new THREE.Scene();scene.background=new THREE.Color('#e9ece3');
 const camera=new THREE.OrthographicCamera(-300,300,240,-240,1,1600);
 const model=new THREE.Group();scene.add(model);
 scene.add(new THREE.HemisphereLight(0xffffff,0x687762,1.5));
 const sun=new THREE.DirectionalLight(0xffead0,2.8);sun.position.set(-180,350,250);sun.target.position.set(0,0,118);scene.add(sun,sun.target);
 sun.castShadow=true;sun.shadow.mapSize.set(lowEnd?512:1024,lowEnd?512:1024);Object.assign(sun.shadow.camera,{left:-300,right:300,top:330,bottom:-330,near:1,far:900});sun.shadow.bias=-.0004;sun.shadow.normalBias=.4;
 const fill=new THREE.DirectionalLight(0xdceaff,.6);fill.position.set(140,80,-150);scene.add(fill);
 const materials=new Set(),geometries=new Set();
 const material=(color,extra={})=>{const m=new THREE.MeshStandardMaterial({color,roughness:.68,metalness:.08,...extra});materials.add(m);return m;};
 const stone=material('#e5e1d2'),edge=material('#cacbb8'),gold=material('#9b7f3f',{metalness:.6,roughness:.38}),green=material('#81916d'),water=material('#487d79',{metalness:.38,roughness:.25});
 const add=(geo,mat,x=0,y=0,z=0)=>{geometries.add(geo);const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;model.add(mesh);return mesh;};
 const box=(w,h,d,mat,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),mat,x,y,z);
 const ring=(inner,outer,mat,y=0,z=0)=>{const mesh=add(new THREE.RingGeometry(inner,outer,96),mat,0,y,z);mesh.rotation.x=-Math.PI/2;mesh.castShadow=false;return mesh;};
 box(278,6,455,edge,0,-7,118);
 box(274,2,451,stone,0,-3,118);
 box(278,.4,455,gold,0,-4.2,118);
 // The salt mound, water ring and bridge retain the site's proportions.
 ring(0,MAHATMA.waterInner,green,0);
 ring(MAHATMA.coneRadius,MAHATMA.courtOuter,stone,.3);
 ring(MAHATMA.waterInner,MAHATMA.waterOuter,water,.1);
 ring(MAHATMA.waterOuter,MAHATMA.promenadeOuter,stone,.25);
 add(new THREE.ConeGeometry(MAHATMA.coneRadius,MAHATMA.coneHeight,96),stone,0,MAHATMA.coneHeight/2+.4,0);
 ring(101,101.3,gold,.35);
 const railPoints=[];
 for(let i=1;i<MAHATMA.bridge.length;i++){
  const [v0,h0]=MAHATMA.bridge[i-1],[v1,h1]=MAHATMA.bridge[i];
  const deck=box(MAHATMA.bridgeHalfWidth*2,1.2,Math.hypot(v1-v0,h1-h0),stone,0,(h0+h1)/2+1,(v0+v1)/2);
  deck.rotation.x=-Math.atan2(h1-h0,v1-v0);
  for(const x of [-MAHATMA.bridgeHalfWidth,MAHATMA.bridgeHalfWidth]){
   railPoints.push(new THREE.Vector3(x,h0+3,v0),new THREE.Vector3(x,h1+3,v1));
   for(let v=v0;v<v1;v+=8){const h=h0+(h1-h0)*(v-v0)/(v1-v0);railPoints.push(new THREE.Vector3(x,h+1,v),new THREE.Vector3(x,h+3,v));}
  }
 }
 const bridgeZ=218;
 for(const x of [-9,9])box(3,52,4,stone,x,33,bridgeZ);
 box(21,3,4,stone,0,34,bridgeZ);box(21,3,4,stone,0,54,bridgeZ);
 for(const x of [-9,9])for(const v of [110,133,156,179,257,280,303,326]){
  const profile=MAHATMA.bridge.findIndex(([pv])=>pv>=v),a=MAHATMA.bridge[profile-1],b=MAHATMA.bridge[profile];
  const height=a[1]+(b[1]-a[1])*(v-a[0])/(b[0]-a[0]);
  railPoints.push(new THREE.Vector3(x,56,bridgeZ),new THREE.Vector3(Math.sign(x)*3.8,height+2,v));
 }
 const lineGeo=new THREE.BufferGeometry().setFromPoints(railPoints);geometries.add(lineGeo);
 const lineMat=new THREE.LineBasicMaterial({color:'#a79266',transparent:true,opacity:.85});materials.add(lineMat);
 model.add(new THREE.LineSegments(lineGeo,lineMat));
 // Restrained landscaping reads as an architect's physical model.
 for(const x of [-108,108])for(let z=60;z<325;z+=39){box(17,.8,26,green,x,-1,z);box(4,6,4,green,x,2,z);}
 for(const x of [-70,70])for(let z=140;z<320;z+=45)box(25,.5,30,green,x,-1.3,z);
 const shadowMat=material('#88917e',{transparent:true,opacity:.13,depthWrite:false});
 const shadow=add(new THREE.PlaneGeometry(340,490),shadowMat,5,-11,126);shadow.rotation.x=-Math.PI/2;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 let paused=reduced.matches,visible=true,disposed=false,angle=0,targetAngle=0,elapsed=0,drag=null;
 const original={width:canvas.style.width,height:canvas.style.height};
 host.append(canvas);canvas.setAttribute('aria-hidden','true');
 renderer.shadowMap.enabled=true;renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowEnd?1:1.5));
 function syncButton(){button.textContent=paused?'Play motion':'Pause motion';button.setAttribute('aria-pressed',String(paused));host.parentElement.dataset.motion=paused?'paused':'playing';}
 function pause(){paused=!paused;syncButton();}button.addEventListener('click',pause);syncButton();
 const onReduced=()=>{paused=reduced.matches;syncButton();};reduced.addEventListener('change',onReduced);
 const down=e=>{if(e.isPrimary!==false&&e.button===0)drag={id:e.pointerId,x:e.clientX,y:e.clientY,angle:targetAngle,captured:false};};
 const move=e=>{
  if(!drag||e.pointerId!==drag.id)return;
  const dx=e.clientX-drag.x,dy=e.clientY-drag.y;
  if(!drag.captured){if(Math.abs(dy)>Math.abs(dx)+6){drag=null;return;}if(Math.abs(dx)<7)return;host.setPointerCapture(e.pointerId);drag.captured=true;}
  targetAngle=drag.angle-dx*.006;
 };
 const up=e=>{if(drag?.id!==e.pointerId)return;if(host.hasPointerCapture(e.pointerId))host.releasePointerCapture(e.pointerId);drag=null;};
 const key=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();targetAngle+=e.key==='ArrowLeft'?-.24:.24;}};
 host.addEventListener('pointerdown',down);host.addEventListener('pointermove',move);host.addEventListener('pointerup',up);host.addEventListener('pointercancel',up);host.addEventListener('lostpointercapture',up);host.addEventListener('keydown',key);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(host);
 let lastPose='';
 return{
  get animated(){return !paused&&visible;},
  render(dt){
   if(disposed||!visible)return;
   if(!paused)elapsed+=dt;
   angle+=(targetAngle-angle)*Math.min(1,dt*8);
   const orbit=.82+angle+Math.sin(elapsed*.24)*.22;
   const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
   const pose=[w,h,orbit.toFixed(4),paused].join(':');if(pose===lastPose)return;lastPose=pose;
   const dpr=renderer.getPixelRatio();if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr))renderer.setSize(w,h,false);
   const aspect=w/h,halfWidth=300*Math.max(1,aspect/1.45);
   camera.left=-halfWidth;camera.right=halfWidth;camera.top=halfWidth/aspect;camera.bottom=-halfWidth/aspect;camera.updateProjectionMatrix();
   camera.position.set(Math.sin(orbit)*650,360,118+Math.cos(orbit)*650);
   camera.lookAt(0,10,118);
   renderer.render(scene,camera);
   host.dataset.motion=paused?'paused':'playing';host.dataset.orbit=orbit.toFixed(3);
  },
  dispose(){
   if(disposed)return;disposed=true;observer.disconnect();button.removeEventListener('click',pause);reduced.removeEventListener('change',onReduced);
   host.removeEventListener('pointerdown',down);host.removeEventListener('pointermove',move);host.removeEventListener('pointerup',up);host.removeEventListener('pointercancel',up);host.removeEventListener('lostpointercapture',up);host.removeEventListener('keydown',key);
   parent.append(canvas);canvas.removeAttribute('aria-hidden');canvas.style.width=original.width;canvas.style.height=original.height;
   renderer.shadowMap.enabled=shadowEnabled;renderer.shadowMap.autoUpdate=shadowAutoUpdate;renderer.shadowMap.needsUpdate=true;renderer.setPixelRatio(ratio);renderer.setSize(innerWidth,innerHeight);
   sun.shadow.map?.dispose();
   for(const geo of geometries)geo.dispose();for(const mat of materials)mat.dispose();scene.clear();
  }
 };
}
