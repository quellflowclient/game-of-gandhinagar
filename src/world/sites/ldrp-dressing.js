import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as THREE from 'three';
import * as K from './kit.js';

// Look-and-feel pieces matched to the LDRP Street View walk-through: light grey
// cast-concrete drives, red/cream wave pavers, chunky stone curbs, thick trimmed
// hedges, round topiary and potted lamp posts. Everything is either a textured
// ribbon or one instanced batch, so the extra detail costs very few draw calls.

const rand=seed=>()=>((seed=(seed*16807)%2147483647)/2147483647);

// Cast concrete: pale grey, aggregate speckle, centre + transverse joints,
// faint tyre polish and stains. u spans the road width, one repeat per `tile` metres.
export function concreteTex(){
  return K.canvasTex(256,256,(c,w,h)=>{
    const r=rand(7);c.fillStyle='#bdb9b0';c.fillRect(0,0,w,h);
    for(let i=0;i<9000;i++){const v=150+r()*70|0;c.fillStyle=`rgba(${v},${v-3},${v-9},${.18+r()*.25})`;c.fillRect(r()*w,r()*h,1+r()*1.6,1+r()*1.6);}
    for(const x of [.27,.73]){const g=c.createLinearGradient((x-.09)*w,0,(x+.09)*w,0);g.addColorStop(0,'rgba(90,88,82,0)');g.addColorStop(.5,'rgba(90,88,82,.13)');g.addColorStop(1,'rgba(90,88,82,0)');c.fillStyle=g;c.fillRect((x-.09)*w,0,.18*w,h);}
    for(let i=0;i<5;i++){c.fillStyle=`rgba(110,104,92,${.05+r()*.06})`;c.beginPath();c.ellipse(r()*w,r()*h,8+r()*30,5+r()*16,r()*3,0,7);c.fill();}
    c.strokeStyle='rgba(78,76,70,.55)';c.lineWidth=2;c.beginPath();c.moveTo(0,1);c.lineTo(w,1);c.moveTo(w/2,0);c.lineTo(w/2,h);c.stroke();
    c.strokeStyle='rgba(80,78,72,.22)';c.lineWidth=1;c.beginPath();let x=w*.62,y=h*.2;c.moveTo(x,y);for(let i=0;i<7;i++){x+=(r()-.5)*18;y+=10+r()*9;c.lineTo(x,y);}c.stroke();
  });
}
// Interlocking "wave" pavers, cream field with red diagonal bands (main walkway).
export function wavePaverTex(){
  return K.canvasTex(512,512,(c,w,h)=>{
    const r=rand(11),cols=20,rows=40,pw=w/cols,ph=h/rows;
    c.fillStyle='#8f8578';c.fillRect(0,0,w,h);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
      const red=((i*2+j)%10)<3,base=red?[164,86,78]:[205,196,182],k=.9+r()*.16;
      c.fillStyle=`rgb(${base[0]*k|0},${base[1]*k|0},${base[2]*k|0})`;
      const x=i*pw+1.2,y=j*ph+1,ww=pw-2.4,hh=ph-2,a=ww*.16;
      c.beginPath();c.moveTo(x,y+hh*.5);
      c.bezierCurveTo(x+ww*.25,y-a*.3,x+ww*.5,y+a,x+ww*.75,y+a*.2);c.lineTo(x+ww,y+hh*.5);
      c.bezierCurveTo(x+ww*.75,y+hh+a*.3,x+ww*.5,y+hh-a,x+ww*.25,y+hh-a*.2);c.closePath();c.fill();
      c.fillStyle='rgba(255,255,255,.07)';c.fillRect(x+2,y+2,ww*.5,1.5);
    }
  });
}
// Stone/concrete curb blocks ~0.9 m long with mortar joints (v runs along).
export function curbTex(){
  return K.canvasTex(64,128,(c,w,h)=>{
    const r=rand(5);c.fillStyle='#b4ad9e';c.fillRect(0,0,w,h);
    for(let i=0;i<1400;i++){const v=140+r()*70|0;c.fillStyle=`rgba(${v},${v-4},${v-14},.35)`;c.fillRect(r()*w,r()*h,1.5,1.5);}
    c.fillStyle='rgba(60,58,52,.55)';c.fillRect(0,0,w,3);
    const g=c.createLinearGradient(0,0,w,0);g.addColorStop(0,'rgba(70,66,58,.18)');g.addColorStop(.5,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(70,66,58,.18)');c.fillStyle=g;c.fillRect(0,0,w,h);
  });
}
const leafTex=()=>K.canvasTex(128,128,(c,w,h)=>{
  const r=rand(3);c.fillStyle='#4d6e33';c.fillRect(0,0,w,h);
  for(let i=0;i<2600;i++){const g=70+r()*90|0;c.fillStyle=`rgba(${g*.55|0},${g},${g*.35|0},.8)`;c.beginPath();c.ellipse(r()*w,r()*h,1.2+r()*2.2,.8+r()*1.2,r()*3,0,7);c.fill();}
  for(let i=0;i<500;i++){c.fillStyle=`rgba(20,35,12,${.3+r()*.3})`;c.fillRect(r()*w,r()*h,1.5,1.5);}
},[2,2]);

let concrete,paver,curb;
export const materials=()=>{
  concrete??=K.mat(concreteTex(),{roughness:.93});
  paver??=K.mat(wavePaverTex(),{roughness:.88});
  curb??=K.mat(curbTex(),{roughness:.95});
  return {concrete,paver,curb};
};
export function concreteDrive(g,points,width,y){const m=materials();K.strip(g,points,width,y,m.concrete,{tile:4.5});}
export function paverWalk(g,points,width,y){const m=materials();K.strip(g,points,width,y,m.paver,{tile:width});}
export function paverSlab(g,ring,y){return K.slab(g,ring,y,materials().paver,0,4.4);}
export function stoneCurb(g,points,y,{offset=0,height=.26,width=.2}={}){K.strip(g,points,width,y,materials().curb,{offset,height,tile:.9});}

// Organic bush blob: a subdivided icosahedron pushed in/out by smooth noise.
function bushGeometry(detail=2){
  const geo=new THREE.IcosahedronGeometry(1,detail),p=geo.attributes.position,v=new THREE.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);const n=1+.09*Math.sin(v.x*5.1+v.y*3.3)+.07*Math.sin(v.z*6.7-v.y*4.1)+.05*Math.sin((v.x+v.z)*9);v.multiplyScalar(n);if(v.y<-.55)v.y=-.55-(v.y+.55)*.2;p.setXYZ(i,v.x,v.y,v.z);}
  geo.computeVertexNormals();return geo;
}
// One instanced batch for every hedge clump, round bush and topiary crown on campus.
export function createShrubbery(){
  const items=[],trunks=[],ribbons=[];
  return {
    // Continuous trimmed hedge: overlapping clumps every ~0.55 m with a flat-ish top.
    hedge(path,{height=.95,width=.85,closed=false}={}){
      const pts=closed?[...path,path[0]]:path,r=rand(path.length*31+17);ribbons.push({pts,height,width});
      for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
        for(let d=.4;d<len;d+=2.2){const t=d/len;items.push({low:true,x:a[0]+(b[0]-a[0])*t,y:height*.86,z:a[1]+(b[1]-a[1])*t,sx:width*.62*(0.9+r()*.2),sy:height*.28,sz:.95*(0.9+r()*.25),c:r()});}}
    },
    bush(x,z,size=1){const r=rand(Math.abs(x*97+z*13)|0||1);items.push({x,y:size*.62,z,sx:size*(0.9+r()*.25),sy:size*.78,sz:size*(0.9+r()*.25),c:r()});},
    // Clipped topiary tree: short trunk and a dense round crown (very common at LDRP).
    topiary(x,z,size=1.25){const r=rand(Math.abs(x*53+z*29)|0||1),h=1.1+r()*.6;trunks.push({x,z,h});items.push({x,y:h+size*.85,z,sx:size,sy:size*1.08,sz:size,c:r()});},
    // Hedges and bushes are real obstacles: nobody rides or walks through them.
    solids(){
      const out=[];
      for(const h of ribbons){const pts=resample(h.pts,2.4);pts.push(h.pts.at(-1));
        for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.05)continue;
          out.push({rect:[(a[0]+b[0])/2,(a[1]+b[1])/2,len+.25,h.width,Math.atan2(-dz,dx)]});}}
      for(const it of items)if(!it.low)out.push({circle:[it.x,it.z,it.y>1.2?.22:Math.max(it.sx,it.sz)*.8]});
      return out;
    },
    build(parent){
      const leaves=leafTex(),geo=bushGeometry(),mat=new THREE.MeshStandardMaterial({map:leaves,roughness:1,color:0xffffff});
      const wall=new THREE.MeshStandardMaterial({map:leaves,roughness:1,color:0xa9c08c,side:THREE.DoubleSide});
      const hedges=new THREE.Group();hedges.name="LDRP hedge rows";for(const h of ribbons)K.strip(hedges,h.pts,h.width,0,wall,{height:h.height,tile:1.4});K.mergeStatic(hedges);parent.add(hedges);
      // Hedge-top clumps: low poly, no shadow casting (the hedge ribbon casts).
      // Topiary crowns and bushes: smoother, with shadows.
      const o=new THREE.Object3D(),col=new THREE.Color();
      for(const [low,name] of [[true,'LDRP hedge clumps'],[false,'LDRP hedges and topiary']]){
        const list=items.filter(it=>!!it.low===low);if(!list.length)continue;
        const mesh=new THREE.InstancedMesh(low?bushGeometry(1):geo,mat,list.length);
        list.forEach((it,i)=>{o.position.set(it.x,it.y,it.z);o.rotation.set(0,it.c*6.28,0);o.scale.set(it.sx,it.sy,it.sz);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);
          col.setHSL(.24+it.c*.06,.38+it.c*.15,.52+it.c*.14);mesh.setColorAt(i,col);});
        mesh.castShadow=!low;mesh.receiveShadow=true;mesh.name=name;parent.add(mesh);
      }
      if(trunks.length){const tg=new THREE.CylinderGeometry(.07,.1,1,7);tg.translate(0,.5,0);const tm=new THREE.InstancedMesh(tg,K.mat(0x5e4c3b,{roughness:.9}),trunks.length);
        trunks.forEach((t,i)=>{o.position.set(t.x,0,t.z);o.rotation.set(0,0,0);o.scale.set(1,t.h+.4,1);o.updateMatrix();tm.setMatrixAt(i,o.matrix);});tm.castShadow=true;tm.name='LDRP topiary trunks';parent.add(tm);}
      return {count:items.length,trunks:trunks.length};
    },
  };
}
// Dark iron post with a square pink planter on top, lining the walkway.
export function potPost(g,x,z){K.box(g,.07,1.35,.07,0x3b3632,x,0,z);K.box(g,.42,.34,.42,0xc98a8a,x,1.35,z);K.box(g,.36,.04,.36,0x3f5e2c,x,1.69,z);}

export {offsetPath as offsetPoints} from '../road-path.js';
export function resample(points,step){
  const out=[];let carry=0;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],len=Math.hypot(b[0]-a[0],b[1]-a[1]);
    for(let d=carry;d<len;d+=step){const t=d/len;out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}
    carry=((carry-len)%step+step)%step;}
  return out;
}
export function pathDistance(x,z,points){
  let best=Infinity;
  for(let i=1;i<points.length;i++){const a=points[i-1],b=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz||1)));best=Math.min(best,Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz));}
  return best;
}
export function concreteSlab(g,ring,y){return K.slab(g,ring,y,materials().concrete,0,4.5);}

// Market-style patio umbrella: 8 alternating cream/green panels with a slight
// droop, valance, ribs, finial, pole and a weighted cross base.
export function patioUmbrella(g,x,z,{r=1.65,h=2.45,colors=[0xece5d2,0x2f6b50]}={}){
  const root=new THREE.Group();root.position.set(x,0,z);g.add(root);
  const panels=[[],[]],n=8;
  for(let i=0;i<n;i++){const a0=i/n*Math.PI*2,a1=(i+1)/n*Math.PI*2,k=i%2;
    const P=(a,rr,y)=>[Math.cos(a)*rr,y,Math.sin(a)*rr];
    const apex=[0,h+.42,0],m0=P(a0,r*.55,h+.27),m1=P(a1,r*.55,h+.27),e0=P(a0,r,h),e1=P(a1,r,h);
    panels[k].push(...apex,...m1,...m0, ...m0,...m1,...e0, ...e0,...m1,...e1);
    const lo=-.17;panels[k].push(...e0,...e1,e0[0],h+lo,e0[2], e0[0],h+lo,e0[2],...e1,e1[0],h+lo*.6,e1[2]);
  }
  for(const k of [0,1]){const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(panels[k],3));geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,K.mat(colors[k],{roughness:.9}));mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}
  const ribMat=K.mat(0x8c8f8a,{metalness:.6,roughness:.4});
  for(let i=0;i<n;i++){const a=i/n*Math.PI*2,end=new THREE.Vector3(Math.cos(a)*r*.98,h-.03,Math.sin(a)*r*.98),start=new THREE.Vector3(0,h+.37,0),d=end.clone().sub(start);
    const rib=new THREE.Mesh(new THREE.CylinderGeometry(.008,.008,d.length(),4),ribMat);rib.position.copy(start).add(end).multiplyScalar(.5);rib.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());root.add(rib);}
  K.cyl(root,.028,.028,h+.42,0xb9bcb8,0,0,0,10);K.sphere(root,.045,0xb9bcb8,0,h+.47,0,8);
  K.box(root,.9,.06,.09,0x3a3d3a,0,0,0);K.box(root,.09,.06,.9,0x3a3d3a,0,0,0);K.cyl(root,.16,.18,.14,0x55595a,0,.06,0,14);
  return root;
}
// Low-poly flower heads (marigold / rose / periwinkle) in one instanced batch.
export function flowerBed(g,points){
  const geo=new THREE.IcosahedronGeometry(1,0),mesh=new THREE.InstancedMesh(geo,new THREE.MeshStandardMaterial({roughness:.8}),points.length),o=new THREE.Object3D(),c=new THREE.Color();
  const cols=[0xf0a020,0xe8721c,0xd8344a,0xf4d23c,0xe86fa8,0xffffff];
  points.forEach(([x,y,z,k],i)=>{o.position.set(x,y,z);o.scale.setScalar(.06+((i*37)%10)/200);o.rotation.set(i,i*2,0);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);mesh.setColorAt(i,c.setHex(cols[k%cols.length]));});
  mesh.receiveShadow=true;mesh.name='Gate garden flowers';g.add(mesh);return mesh;
}

// Painted yellow/black "keep clear" box round a metro pillar, with 4 bollards.
export function keepClear(g,x,z,yaw,size=3.4,y=.152){
  const tex=K.canvasTex(128,128,(c,w,h)=>{c.fillStyle='#3a3a36';c.fillRect(0,0,w,h);c.strokeStyle='#e7b928';c.lineWidth=9;for(let i=-w;i<w*2;i+=26){c.beginPath();c.moveTo(i,0);c.lineTo(i+h,h);c.stroke();}c.lineWidth=10;c.strokeRect(5,5,w-10,h-10);});
  const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),K.mat(tex,{roughness:.9,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.set(-Math.PI/2,0,yaw);m.position.set(x,y,z);m.receiveShadow=true;g.add(m);
  for(const [a,b]of [[-1,-1],[1,-1],[1,1],[-1,1]]){const c=Math.cos(yaw),s=Math.sin(yaw),u=a*size/2,v=b*size/2;K.cyl(g,.07,.08,.85,0xe7b928,x+u*c+v*s,y,z-u*s+v*c,10);K.cyl(g,.075,.075,.12,0x2a2a28,x+u*c+v*s,y+.55,z-u*s+v*c,10);}
}

// Tall ornamental grass (~60 cm) around a garden, with gaps for paths in/out.
// Visual: instanced crossed-blade tufts. Collision: rects along each run.
const grassTex=()=>K.canvasTex(64,64,(c,w,h)=>{c.clearRect(0,0,w,h);for(let i=0;i<46;i++){const x=4+Math.random()*(w-8),lean=(Math.random()-.5)*14,g=90+Math.random()*80|0;c.strokeStyle=`rgb(${g*.55|0},${g},${g*.32|0})`;c.lineWidth=1.4+Math.random()*1.6;c.beginPath();c.moveTo(x,h);c.quadraticCurveTo(x+lean*.4,h*.5,x+lean,h*(.05+Math.random()*.3));c.stroke();}});
export function createGrassBorders(){
  const tufts=[],runs=[];
  return {
    add(poly,gaps,{inset=.5,band=.9,gapWidth=2.2}={}){
      const ring=[...poly,poly[0]];
      for(let i=1;i<ring.length;i++){
        const a=ring[i-1],b=ring[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.2)continue;
        let nx=-dz/len,nz=dx/len;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
        if(!pointInPoly(mx+nx*.6,mz+nz*.6,poly)){nx=-nx;nz=-nz;}
        let run=[];
        for(let d=0;d<=len;d+=.3){const t=d/len,u=a[0]+dx*t,v=a[1]+dz*t;
          const open=gaps.some(([gu,gv])=>Math.hypot(u-gu,v-gv)<gapWidth/2);
          if(open){if(run.length>1)runs.push({pts:run,band});run=[];continue;}
          const p=[u+nx*inset,v+nz*inset];run.push(p);
          for(const k of [.2,.55,.85]){if(Math.random()<.85)tufts.push([u+nx*(inset-band/2+k*band)+(Math.random()-.5)*.12,v+nz*(inset-band/2+k*band)+(Math.random()-.5)*.12,.5+Math.random()*.35,Math.random()*Math.PI]);}
        }
        if(run.length>1)runs.push({pts:run,band});
      }
    },
    solids(){const out=[];for(const {pts,band}of runs)for(let i=1;i<pts.length;i+=4){const a=pts[i-1],b=pts[Math.min(i+3,pts.length-1)],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);if(len<.05)continue;out.push({rect:[(a[0]+b[0])/2,(a[1]+b[1])/2,len+.3,band,Math.atan2(-dz,dx)]});}return out;},
    build(parent,y=.09){
      if(!tufts.length)return;
      const blade=new THREE.PlaneGeometry(.55,1,1,1);blade.translate(0,.5,0);
      const geo=mergeGeometries([0,1,2].map(i=>{const g=blade.clone();g.rotateY(i*Math.PI/3);return g;}));
      const mat=new THREE.MeshStandardMaterial({map:grassTex(),alphaTest:.45,side:THREE.DoubleSide,roughness:1,color:0xd9e8b0});
      const mesh=new THREE.InstancedMesh(geo,mat,tufts.length),o=new THREE.Object3D();
      tufts.forEach(([x,z,h,r],i)=>{o.position.set(x,y,z);o.rotation.set(0,r,0);o.scale.set(1,h,1);o.updateMatrix();mesh.setMatrixAt(i,o.matrix);});
      mesh.receiveShadow=true;mesh.name='Garden tall grass';parent.add(mesh);
    },
  };
}
function pointInPoly(x,z,p){let inside=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;return inside;}
