import * as THREE from 'three';
import { MAHATMA as D, CAMPUS_ROAD, CAMPUS_FENCES, CAMPUS_GATES } from './mahatma-layout.js';
import * as T from './textures.js';

// The photographed plot perimeter, not a circular island/rectangular baseboard.
// Rendered fence sections are exactly the sections used by pedestrian collision.
export function buildMahatmaGrounds({ emit,box,cylinder,beam,palette,mat,tree,signBoard,g }) {
  const wall=mat(T.boundaryStone(),{roughness:0.97});
  const iron=mat(0x929a96,{metalness:0.45,roughness:0.65});
  const curbYellow=mat(0xc5aa4b),curbBlack=mat(0x41433f);
  function floor(outline,material,y,hole=0) {
    const shape=new THREE.Shape(outline.map(([u,v])=>new THREE.Vector2(u,-v)));
    if(hole) {const path=new THREE.Path();path.absarc(0,0,hole,0,Math.PI*2,true);shape.holes.push(path);}
    const geo=new THREE.ShapeGeometry(shape,100);geo.rotateX(-Math.PI/2);
    const p=geo.attributes.position,uv=geo.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/3,p.getZ(i)/3);
    emit(geo,material,0,y,0);
  }
  // The promenade owns this entire annulus. Leaving turf below it at the
  // same elevation causes the flickering green triangles in oblique views.
  floor(D.museumPlot,palette.turf,D.ground,D.promenadeOuter+1);
  floor(D.conventionPlot,palette.turf,D.ground);
  const plaza=D.conventionPlot.filter(([,v])=>v<530);
  plaza.push([107,530],[-146,530]);
  floor(plaza,palette.paving,D.ground+0.006);
  const ribbon=(points,width,y,material,offset=0) => {
    const positions=[],uv=[];
    const closed=Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<0.001;
    const count=points.length-(closed?1:0);
    const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);return [-dz/len,dx/len];};
    const edge=(i,d)=>{
      i%=count;const p=points[i];
      const before=closed||i>0?normal(points[(i-1+count)%count],p):null;
      const after=closed||i<count-1?normal(p,points[(i+1)%count]):null;
      const a=before||after,b=after||before;
      const nx=a[0]+b[0],nz=a[1]+b[1],len=Math.hypot(nx,nz),mx=nx/len,mz=nz/len;
      const miter=d/Math.max(0.4,mx*b[0]+mz*b[1]);
      return [p[0]+mx*miter,y,p[1]+mz*miter];
    };
    for(let i=1;i<points.length;i++) {
      const vertices=[edge(i-1,offset-width/2),edge(i-1,offset+width/2),edge(i,offset-width/2),edge(i,offset+width/2)];
      for(const k of [0,1,2,1,3,2]){positions.push(...vertices[k]);uv.push(vertices[k][0]/3,vertices[k][2]/3);}
    }
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.computeVertexNormals();emit(geo,material);
  };
  const smooth=(points,n=80)=>new THREE.CatmullRomCurve3(points.map(([u,v])=>new THREE.Vector3(u,0,v)),false,'centripetal').getPoints(n).map(p=>[p.x,p.z]);
  // Continuous public footpath outside both fences, as in the supplied photos.
  for(const plot of [D.museumPlot,D.conventionPlot]) {
    const area=plot.reduce((sum,a,i)=>{const b=plot[(i+1)%plot.length];return sum+a[0]*b[1]-b[0]*a[1];},0);
    ribbon([...plot,plot[0]],2.6,D.ground,palette.paving,area>0?-1.65:1.65);
  }
  const road=smooth(CAMPUS_ROAD.path,140);
  ribbon(road,CAMPUS_ROAD.width,CAMPUS_ROAD.y,palette.asphalt);
  for(const side of [-1,1]) {
    ribbon(road,3,D.ground,palette.paving,side*(CAMPUS_ROAD.width/2+1.5));
    ribbon(road,0.12,CAMPUS_ROAD.y+0.012,palette.trim,side*(CAMPUS_ROAD.width/2-0.5));
  }
  // Raised centre divider, dashed lanes, curb paint and two zebra crossings.
  ribbon(road,0.9,0.14,palette.stone);
  for(let i=1;i<road.length-1;i+=3) {
    const a=road[i],b=road[i+1],dx=b[0]-a[0],dz=b[1]-a[1],yaw=Math.atan2(dx,dz),l=Math.hypot(dx,dz);
    for(const side of [-1,1]) {
      const nx=-dz/l,nz=dx/l,u=(a[0]+b[0])/2+nx*side*10.9,v=(a[1]+b[1])/2+nz*side*10.9;
      box(0.25,0.14,l, i%2?curbYellow:curbBlack,u,0.04,v,yaw);
    }
  }
  for(const u of [-95,95]) {
    const nearest=road.reduce((a,b)=>Math.abs(a[0]-u)<Math.abs(b[0]-u)?a:b);
    for(let v=-10;v<11;v+=2) box(4.8,0.012,0.9,palette.trim,u,0.055,nearest[1]+v);
  }
  // Radial entrances and garden walks within the museum's irregular side wedges.
  ribbon([[0,-97],[0,-112]],7,D.ground+0.012,palette.paving);
  ribbon([[97,0],[125,0]],6,D.ground+0.012,palette.paving);
  ribbon(smooth([[-105,42],[-113,72],[-110,106],[-95,130],[-95,152]],60),4,D.ground+0.012,palette.paving);
  ribbon(smooth([[101,48],[110,68],[108,106],[91,126],[63,130],[38,112],[12,104]],60),3.5,D.ground+0.012,palette.paving);
  // Gandhi Garden beyond the exhibition halls, contained in its own perimeter.
  ribbon([[0,516],[0,719]],6,D.ground+0.012,palette.paving);
  for(const v of [560,630,692]) {
    ribbon([[-132,v],[98,v]],3.5,D.ground+0.012,palette.paving);
    for(const u of [-105,-62,57,86])tree(u,v+15,0.85+(v%3)*0.08);
  }
  for(const u of [-129,94]) ribbon([[u,530],[u,703]],3,D.ground+0.012,palette.paving);

  for(const f of CAMPUS_FENCES) {
    const dx=f.b[0]-f.a[0],dz=f.b[1]-f.a[1],len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
    if(len<0.05)continue;
    box(0.32,0.34,len,wall,(f.a[0]+f.b[0])/2,D.ground,(f.a[1]+f.b[1])/2,yaw);
    const panels=Math.max(1,Math.ceil(len/3.5));
    for(let i=0;i<=panels;i++) {
      const t=i/panels,u=f.a[0]+dx*t,v=f.a[1]+dz*t;
      box(0.52,1.65,0.52,wall,u,D.ground,v);
      box(0.59,0.09,0.59,palette.stone,u,D.ground+1.65,v);
    }
    for(const h of [0.53,1.03,1.62])beam([f.a[0],D.ground+h,f.a[1]],[f.b[0],D.ground+h,f.b[1]],0.023,iron,5);
    const bars=Math.ceil(len/0.19);
    for(let i=0;i<=bars;i++) {
      const t=i/bars;box(0.027,1.38,0.027,iron,f.a[0]+dx*t,D.ground+0.32,f.a[1]+dz*t,yaw);
    }
  }
  for(const gate of CAMPUS_GATES) {
    const outline=gate.plot==='museum'?D.museumPlot:D.conventionPlot;
    let best={d:Infinity,a:null,b:null};
    for(let i=0;i<outline.length;i++) {
      const a=outline[i],b=outline[(i+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1];
      const t=Math.max(0,Math.min(1,((gate.u-a[0])*dx+(gate.v-a[1])*dz)/(dx*dx+dz*dz)));
      const d=Math.hypot(gate.u-a[0]-t*dx,gate.v-a[1]-t*dz);if(d<best.d)best={d,a,b};
    }
    const dx=best.b[0]-best.a[0],dz=best.b[1]-best.a[1],len=Math.hypot(dx,dz),yaw=Math.atan2(dx,dz);
    for(const side of [-1,1]) {
      const u=gate.u+dx/len*gate.width/2*side,v=gate.v+dz/len*gate.width/2*side;
      box(0.8,2.1,0.8,wall,u,D.ground,v);
      box(0.92,0.12,0.92,palette.stone,u,D.ground+2.1,v);
      // Open leaves fold back along the fence, never across the playable opening.
      const end=[u+dx/len*gate.width*0.44*side,v+dz/len*gate.width*0.44*side];
      for(const y of [0.35,1.65])beam([u,D.ground+y,v],[end[0],D.ground+y,end[1]],0.035,iron);
      for(let k=0;k<=12;k++){const t=k/12;box(0.035,1.3,0.035,iron,u+(end[0]-u)*t,D.ground+0.35,v+(end[1]-v)*t,yaw);}
    }
  }
  for(let i=5;i<road.length-5;i+=16) {
    const [u,v]=road[i],side=i%2?1:-1;
    cylinder(0.075,0.13,8.2,palette.metal,u,D.ground,v+side*13.4,8);
    beam([u,8.25,v+side*13.4],[u,8.25,v+side*10.4],0.06,palette.metal);
    box(0.5,0.12,1,palette.trim,u,8.2,v+side*10.5);
  }
  return { wall,iron };
}
