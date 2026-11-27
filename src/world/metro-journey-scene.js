import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A compact ride scene, separate from mapped destination geometry. The same
// renderer switches between a seated passenger view and a close exterior view.
export function buildJourneyScene({lowEnd=false}={}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(58,1,.035,950),scenery=new THREE.Group(),train=new THREE.Group(),doors=[],wheels=[],batches=new Map();
 scene.name='Metro passenger journey';scene.background=new THREE.Color(0xc3d3dc);scene.fog=new THREE.Fog(0xc3d3dc,210,650);scene.add(scenery,train);
 const hemi=new THREE.HemisphereLight(0xf1f5ff,0x837f6c,2.1),sunlight=new THREE.DirectionalLight(0xffe8c5,2.7);sunlight.position.set(-35,65,35);scene.add(hemi,sunlight);
 const mat=(color,metalness=0,roughness=.65)=>new THREE.MeshStandardMaterial({color,metalness,roughness});
 const shell=mat(0xe6e8e3,.3,.36),ceiling=mat(0xf0ede5,.08,.7),steel=mat(0xa6b4bc,.75,.3),dark=mat(0x273035,.15,.66),rubber=mat(0x172125),blue=mat(0x285a94,.16,.54),orange=mat(0xdc793d),floor=mat(0x6d7779,.12,.85),seat=mat(0x466e92,.22,.4),concrete=mat(0xb9b7ac),road=mat(0x5d6568),curb=mat(0xc2bfb0),soil=mat(0x75836b),trunk=mat(0x76664e),leaf=mat(0x4d6b4f);
 const glass=new THREE.MeshStandardMaterial({color:0xacc9d0,transparent:true,opacity:.12,roughness:.18,metalness:.1,depthWrite:false,side:THREE.DoubleSide});
 const lamp=new THREE.MeshBasicMaterial({color:0xfff3d8}),marker=new THREE.MeshBasicMaterial({color:0xd7be7b}),leaves=[leaf,mat(0x637b55),mat(0x435e49)];
 const whiteLines=mat(0xd7d7c4),skylineMaterials=[mat(0xa1aaa4),mat(0x9bafa9),mat(0x819aa7),mat(0xc8bca9)];
 const aisle=mat(0x9aa5a5),vehicleGlass=mat(0x547482,.2,.35);
 const emit=(group,geo,material,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(rx,ry,rz)),new THREE.Vector3(1,1,1)));let groups=batches.get(group);if(!groups)batches.set(group,groups=new Map());if(!groups.has(material))groups.set(material,[]);groups.get(material).push(geo);};
 const box=(group,w,h,d,m,x,y,z,round=false)=>{const geo=round?new RoundedBoxGeometry(w,h,d,lowEnd?1:2,Math.min(.12,w/4,h/4,d/4)):new THREE.BoxGeometry(w,h,d);if(m.userData.journeyFacade){const p=geo.attributes.position,n=geo.attributes.normal,uv=geo.attributes.uv;for(let i=0;i<p.count;i++)uv.setXY(i,(Math.abs(n.getX(i))>.5?p.getZ(i):p.getX(i))/12,p.getY(i)/24);}emit(group,geo,m,x,y,z);};
 const pole=(group,x,z,height=2.3,y=2.05)=>emit(group,new THREE.CylinderGeometry(.027,.027,height,8),steel,x,y,z);
 function label(group,text,w,h,x,y,z,ry=0,background='#183648',foreground='#e5efd9'){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=background;c.fillRect(0,0,1024,128);c.fillStyle=foreground;c.font='600 45px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(text,512,64,960);const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide});emit(group,new THREE.PlaneGeometry(w,h),material,x,y,z,0,ry);return{canvas,texture};
 }
 const routeDisplay=label(train,'NEXT STOP · GANDHINAGAR',1.65,.21,10.45,3.06,0,-Math.PI/2);
 // Three connected coaches. Solid side panels stop at the actual window and
 // door openings, so the interior and passing scenery remain visible.
 const bays=[[-10.5,-7.5],[-5.9,-.8],[.8,5.9],[7.5,10.5]];
 for(const cx of [-22.4,0,22.4]){
  box(train,21.6,.22,2.84,floor,cx,.75,0);box(train,21.6,.19,2.94,shell,cx,3.66,0,true);box(train,19,.28,2.15,dark,cx,3.96,0,true);box(train,21,.24,2.6,dark,cx,.48,0);
  box(train,21.25,.035,2.68,ceiling,cx,3.55,0);box(train,21,.025,.52,aisle,cx,.875,0);
  for(const side of [-1,1]){
   box(train,20.9,.17,.035,blue,cx,1.15,side*1.44);box(train,20.9,.055,.035,orange,cx,.99,side*1.45);
   box(train,19.5,.04,.055,lamp,cx,3.48,side*.89);box(train,19.5,.042,.042,steel,cx,3.06,side*.73);
   for(const [a,b]of bays){
    const mid=cx+(a+b)/2,len=b-a;
    box(train,len,.91,.105,shell,mid,1.28,side*1.42);box(train,len,.42,.105,shell,mid,3.34,side*1.42);
    for(const end of [a,b])box(train,.15,1.42,.105,shell,cx+end,2.44,side*1.42);
    const span=len-.32;box(train,span,.07,.11,rubber,mid,1.75,side*1.43);box(train,span,.07,.11,rubber,mid,3.11,side*1.43);
    box(train,span,1.29,.025,glass,mid,2.43,side*1.43);
    // Seats, rounded cushion edges and a recessed foot space beneath them.
    box(train,len-.45,.13,.49,seat,mid,1.28,side*1.09,true);box(train,len-.45,.63,.095,seat,mid,1.61,side*1.31,true);box(train,len-.6,.3,.2,steel,mid,.99,side*1.24);
    const count=Math.max(2,Math.floor((len-.45)/.59));for(let j=1;j<count;j++)box(train,.012,.018,.42,steel,mid-(len-.45)/2+j*(len-.45)/count,1.355,side*1.09);
   }
   for(const dx of [-6.7,0,6.7]){
    for(const half of [-1,1]){
     const panel=new THREE.Group();panel.position.set(cx+dx+half*.4,2.16,side*1.44);train.add(panel);
     const pieces=[[.78,1.1,0,-.725],[.78,.4,0,1.075],[.12,1.05,-.33,.35],[.12,1.05,.33,.35]].map(([w,h,x,y])=>new THREE.BoxGeometry(w,h,.08).translate(x,y,0));
     panel.add(new THREE.Mesh(mergeGeometries(pieces,false),shell));pieces.forEach(g=>g.dispose());
     const pane=new THREE.Mesh(new THREE.PlaneGeometry(.54,1.05),glass);pane.position.set(0,.35,side*.05);panel.add(pane);
     const trims=[new THREE.BoxGeometry(.59,.04,.09).translate(0,.89,0),new THREE.BoxGeometry(.59,.04,.09).translate(0,-.19,0)];panel.add(new THREE.Mesh(mergeGeometries(trims,false),rubber));trims.forEach(g=>g.dispose());
     doors.push({panel,base:panel.position.x,half});
    }
    for(const z of [-.64,.64]){pole(train,cx+dx,z);box(train,.27,.06,.055,steel,cx+dx,3.17,z);}
   }
   for(let dx=-8.5;dx<=8.5;dx+=1.7){
    box(train,.025,.18,.025,steel,cx+dx,2.96,side*.73);const handle=new THREE.TorusGeometry(.088,.018,5,12);emit(train,handle,blue,cx+dx,2.78,side*.73,0,0,0);
   }
  }
  for(const dx of [-7.1,7.1]){box(train,2.65,.48,1.96,dark,cx+dx,.42,0);for(const xx of [-.85,.85])for(const z of [-1.06,1.06]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.38,.38,.16,12),rubber);wheel.rotation.x=Math.PI/2;wheel.position.set(cx+dx+xx,.3,z);train.add(wheel);wheels.push(wheel);}}
 }
 for(const cx of [-11.2,11.2]){box(train,.85,2.5,2.4,rubber,cx,2.05,0);for(let i=0;i<6;i++)box(train,.035,2.6,2.48,dark,cx-.35+i*.14,2.05,0);}
 for(const side of [-1,1]){
  box(train,.65,2.8,2.75,shell,side*33.05,2.18,0,true);box(train,.08,1.15,2.18,mat(0x24434c,.25,.27),side*33.4,2.62,0);box(train,.085,.3,2.3,blue,side*33.42,1.53,0);
  for(const z of [-.98,.98])box(train,.09,.16,.31,lamp,side*33.43,1.3,z);box(train,1,.28,.75,dark,side*33.65,.55,0);
 }
 // Ground and guideway extend far beyond the longest trip and camera frustum.
 // All roadside detail moves together, avoiding a train over a blank plane.
 box(scenery,2600,.45,1800,soil,250,-9.4,0);box(scenery,2300,.22,26,road,250,-9.05,2);
 for(const z of [-13,17])box(scenery,2300,.3,4,curb,250,-8.95,z);
 box(scenery,2300,.25,2.4,soil,250,-8.85,2);
 for(const z of [-6.5,10.5])for(let x=-700;x<1300;x+=12)box(scenery,5,.02,.12,whiteLines,x,-8.92,z);
 box(scenery,2200,.62,10.6,concrete,250,-.58,2.3);
 for(const z of [-2.65,7.25]){box(scenery,2200,.7,.22,concrete,250,.05,z);box(scenery,2200,.08,.27,steel,250,.45,z);}
 for(const z of [-.72,.72,3.88,5.32])box(scenery,2200,.13,.075,steel,250,.04,z);
 for(let x=-700;x<1300;x+=1.05)for(const z of [0,4.6])box(scenery,.18,.11,2.15,concrete,x,-.065,z);
 for(let x=-690;x<=1290;x+=27){box(scenery,1.5,8.3,1.6,concrete,x,-4.85,2.3);box(scenery,1.6,.65,9.4,concrete,x,-1,2.3);}
 // Deterministic varied blocks on both sides, with a finer street layer below.
 const rand=n=>{const v=Math.sin(n*127.1+74.7)*43758.5453;return v-Math.floor(v);};
 const facadeCanvas=document.createElement('canvas');facadeCanvas.width=128;facadeCanvas.height=128;const fc=facadeCanvas.getContext('2d');fc.fillStyle='#b8c2bf';fc.fillRect(0,0,128,128);for(let row=0;row<8;row++)for(let col=0;col<6;col++){fc.fillStyle=(row+col)%5===0?'#90a3a7':'#536b76';fc.fillRect(col*21+3,row*16+3,14,10);}const facade=new THREE.CanvasTexture(facadeCanvas);facade.colorSpace=THREE.SRGBColorSpace;facade.wrapS=facade.wrapT=THREE.RepeatWrapping;
 const facades=skylineMaterials.map(m=>{const f=m.clone();f.map=facade;f.roughness=.8;f.userData.journeyFacade=true;return f;});
 for(const side of [-1,1])for(let i=-22;i<=42;i++){
  const x=i*31+rand(i+80)*9;
  for(let row=0;row<3;row++){
   const seed=(i+40)*7+row*37+(side+1)*97,z=side*(39+row*73+rand(seed)*14),height=row===0?5+rand(seed+1)*12:12+rand(seed+1)*65,w=13+rand(seed+2)*14,d=14+rand(seed+3)*17;
   box(scenery,w,height,d,facades[Math.floor(rand(seed+4)*4)],x+row*11,-8.95+height/2,z);box(scenery,w+.4,.25,d+.4,curb,x+row*11,-8.83+height,z);
  }
  const tx=x+10,tz=side*(23+rand(i+22)*4);box(scenery,.27,4,.27,trunk,tx,-7,tz);
  for(let j=0;j<3;j++){const crown=new THREE.SphereGeometry(2.5+j*.14,lowEnd?7:10,6);crown.scale(1.1,.85,1);emit(scenery,crown,leaves[(i+j+90)%3],tx+(j-1)*1.3,-4.7+j*.6,tz+(j%2)*.8);}
  box(scenery,.12,9,.12,steel,x,-4.4,side*18.8);box(scenery,.9,.13,.3,ceiling,x,-.05,side*18.8);
  if(i%2===0){const z=side===1?9:-5;box(scenery,3.7,1.15,1.65,skylineMaterials[(i+24)%4],x+6,-8.3,z,true);box(scenery,1.9,.6,1.5,vehicleGlass,x+6,-7.5,z,true);}
 }
 const platforms=[];
 for(const at of [0,420]){
  const station=new THREE.Group();station.position.x=at;scenery.add(station);platforms.push(station);
  box(station,78,1.2,7.8,concrete,0,-.1,-6.45);box(station,76,.035,.4,marker,0,.52,-2.75);box(station,81,.25,9,ceiling,0,5.3,-6.3);
  for(let x=-32;x<=32;x+=8){box(station,.22,4.6,.22,steel,x,2.9,-8.8);box(station,5,.035,.3,lamp,x,5.1,-5.2);box(station,2.8,.1,.48,steel,x,.95,-6.8);for(const dx of [-1.1,1.1])box(station,.08,.45,.08,steel,x+dx,.7,-6.8);}
  label(station,'GANDHINAGAR · METRO',12,.85,0,3.8,-8.6,0,'#234b60');
 }
 // Static geometry is merged per material, keeping the rich scenery affordable
 // on phones; only sliding doors and rotating wheels remain individual meshes.
 for(const [group,materials]of batches)for(const [material,geometries]of materials){
  // Preserve shared vertices in the large street/track batches. Rounded parts
  // use their own non-indexed batch with the same material.
  for(const indexed of [true,false]){const compatible=geometries.filter(g=>!!g.index===indexed);if(!compatible.length)continue;const merged=mergeGeometries(compatible,false);if(!merged)throw Error('Could not build metro geometry');const mesh=new THREE.Mesh(merged,material);mesh.name=group===train?'Metro coach detail':'Metro surroundings';group.add(mesh);}
  for(const geo of geometries)geo.dispose();
 }
 return{scene,camera,scenery,train,doors,wheels,platforms,sunlight,hemi,routeDisplay,
  setNight(night){scene.background.set(night?0x192c40:0xc3d3dc);scene.fog.color.copy(scene.background);sunlight.intensity=night?.55:2.7;hemi.intensity=night?1.2:2.1;},
  setRoute(text){const c=routeDisplay.canvas.getContext('2d');c.fillStyle='#183648';c.fillRect(0,0,1024,128);c.fillStyle='#e5efd9';c.font='600 44px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(`NEXT STOP · ${text}`.toUpperCase(),512,64,960);routeDisplay.texture.needsUpdate=true;},
  pose(mode,progress,reduced=false){const sway=reduced?0:Math.sin(progress*Math.PI*12)*.012;
   if(mode==='inside'){camera.fov=66;camera.position.set(1.4,2.23+sway,.36);camera.lookAt(7.4,2.12,-2.2);}
   else{camera.fov=47;const distance=camera.aspect<.8?1.4:1;camera.position.set(19+25*distance,6.3+sway,22*distance);camera.lookAt(17,1.9,0);}
   camera.updateProjectionMatrix();
  }
 };
}
