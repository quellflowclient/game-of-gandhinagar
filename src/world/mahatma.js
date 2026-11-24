import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import * as T from './textures.js';
import { MAHATMA as D, SITE_BEDS, SITE_BENCHES, SITE_TREES, bridgeHeight, bedOutline } from './mahatma-layout.js';
import { buildMahatmaGrounds } from './mahatma-grounds.js';

// Photo/360°-based exterior reconstruction; the OSM footprint and bridge bearing
// anchor it to the city. Meshes are batched by material to keep the game playable.
export function buildMahatma(parent, { mat, signBoard }) {
  const g = new THREE.Group();
  g.name = 'Mahatma Mandir and Dandi Kutir';
  g.rotation.y = D.yaw;
  parent.add(g);
  const batches = new Map();
  const palette = {
    stone: mat(0xd2cec1), trim: mat(0xedece5), sand: mat(0xb9aa8b),
    concrete: mat(0xbcbcaf), dark: mat(0x35413f), metal: mat(0x798487, { metalness: 0.65, roughness: 0.36 }),
    glass: mat(0x486a70, { metalness: 0.38, roughness: 0.22 }),
    galleryGlass: mat(0x50676a, { side: THREE.DoubleSide, roughness: 0.45 }),
    grass: mat(0x75855a), leaf: mat(0x506849), leaf2: mat(0x698255), wood: mat(0x6e5945),
    foliage: mat(T.foliage(),{alphaTest:0.45,side:THREE.DoubleSide,roughness:0.95}),
    palmLeaf: mat(0x55774b,{side:THREE.DoubleSide,roughness:0.95}),
    paving: mat(T.pavers()), salt: mat(T.saltRings(), { roughness: 0.93, bumpMap: T.saltRings(), bumpScale: 0.025 }),
    asphalt: mat(0x646765), turf: mat(T.grass(), { color: 0x71875a }),
  };
  function emit(geo, material, x = 0, y = 0, z = 0, yaw = 0) {
    geo.rotateY(yaw); geo.translate(x, y, z);
    if(!geo.attributes.uv)geo.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
    if(material===palette.paving) {
      // One consistent 37.5 cm tile grid across rings, long crossings and
      // footpaths. Box UVs otherwise stretch eight tiles across a 50 m span.
      const p=geo.attributes.position,uv=geo.attributes.uv;
      for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/3,p.getZ(i)/3);
    }
    const flat = geo.index ? geo.toNonIndexed() : geo;
    if (flat !== geo) geo.dispose();
    if (!batches.has(material)) batches.set(material, []);
    batches.get(material).push(flat);
  }
  function box(w, h, d, m, x, y, z, yaw = 0) { emit(new THREE.BoxGeometry(w, h, d), m, x, y + h / 2, z, yaw); }
  function cylinder(rt, rb, h, m, x, y, z, n = 24) { emit(new THREE.CylinderGeometry(rt, rb, h, n), m, x, y + h / 2, z); }
  function beam(a, b, radius, material, segments = 6) {
    const av = new THREE.Vector3(...a), bv = new THREE.Vector3(...b), delta = bv.clone().sub(av);
    const geo = new THREE.CylinderGeometry(radius, radius, delta.length(), segments);
    geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), delta.normalize()));
    const mid = av.add(bv).multiplyScalar(0.5);
    emit(geo, material, mid.x, mid.y, mid.z);
  }
  // Annular surface, optionally sloped, with UVs in metres; angles start at +v.
  function ring(ri, ro, yi, yo, m, start = 0, arc = Math.PI * 2, n = 144) {
    const positions = [], uv = [];
    for (let i = 0; i < n; i++) {
      const a = start + arc * i / n, b = start + arc * (i + 1) / n;
      const p = [[Math.sin(a)*ri,yi,Math.cos(a)*ri],[Math.sin(a)*ro,yo,Math.cos(a)*ro],
        [Math.sin(b)*ri,yi,Math.cos(b)*ri],[Math.sin(b)*ro,yo,Math.cos(b)*ro]];
      for (const j of [0, 1, 2, 1, 3, 2]) { positions.push(...p[j]); uv.push(p[j][0] / 5, p[j][2] / 5); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.computeVertexNormals(); emit(geo, m);
  }
  function roundWall(r, h, y, m, start, arc) {
    emit(new THREE.CylinderGeometry(r, r, h, 48, 1, true, start, arc), m, 0, y + h / 2, 0);
  }
  function tree(u, v, k = 1) {
    cylinder(0.14*k, 0.29*k, 4.6*k, palette.wood, u, D.ground, v, 9);
    cylinder(0.3*k,0.33*k,0.8*k,palette.trim,u,D.ground,v,9);
    for (let i = 0; i < 5; i++) {
      const a=i*2.4,cu=u+Math.cos(a)*1.5*k,cv=v+Math.sin(a)*1.5*k,cy=(4.5+(i%3)*0.55)*k;
      beam([u,2.6*k,v],[cu,cy,cv],0.07*k,palette.wood,6);
      for(let j=0;j<4;j++) {
        const geo=new THREE.PlaneGeometry(4.6*k,3.7*k);geo.rotateZ(Math.sin(i+j)*0.24);
        emit(geo,palette.foliage,cu,cy,cv,j*Math.PI/4+a);
      }
    }
  }

  const perimeterMaterials=buildMahatmaGrounds({emit,box,cylinder,beam,palette,mat,tree,signBoard,g});
  function palm(u,v) {
    const top=D.ground+7.2;
    for(let i=0;i<6;i++)cylinder(0.19-i*0.012,0.22-i*0.012,1.25,palette.wood,u+i*0.04,D.ground+i*1.18,v,9);
    const positions=[];
    for(let i=0;i<9;i++) {
      const a=i*Math.PI*2/9,dx=Math.sin(a),dz=Math.cos(a);
      const at=t=>[u+0.24+dx*t*3.5,top+Math.sin(t*Math.PI)*0.5-t*t*1.3,v+dz*t*3.5];
      for(let j=1;j<=9;j++) {
        const t=j/10,p=at(t),prev=at(t-0.1),len=Math.sin(t*Math.PI)*0.8;
        beam(prev,p,0.018,palette.wood,4);
        for(const side of [-1,1]) {
          const tip=[p[0]+dz*len*side-dx*0.25,p[1]-0.18,p[2]-dx*len*side-dz*0.25];
          positions.push(...prev,...p,...tip);
        }
      }
    }
    const leaves=new THREE.BufferGeometry();leaves.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));leaves.computeVertexNormals();emit(leaves,palette.palmLeaf);
  }

  // Circular museum island, two promenades and four genuine radial crossings.
  ring(D.coneRadius, D.courtOuter, D.ground, D.ground, palette.paving);
  ring(D.bermOuter, D.waterInner, D.ground, D.ground, palette.paving);
  ring(D.waterOuter, D.promenadeOuter, D.ground, D.ground, palette.paving);
  ring(D.promenadeOuter, D.promenadeOuter+1, D.ground+0.02, D.ground+0.02, palette.trim);
  ring(D.waterInner, D.waterOuter, D.ground-0.27, D.ground-0.27, palette.stone);
  const waterMaterial = new THREE.MeshPhysicalMaterial({ color: 0x75aeb5, metalness: 0.18,
    roughness: 0.2, normalMap: T.waterNormals().clone(), normalScale: new THREE.Vector2(0.12, 0.12),
    clearcoat: 1, clearcoatRoughness: 0.18 });
  ring(D.waterInner+0.25, D.waterOuter-0.25, D.ground-0.15, D.ground-0.15, waterMaterial);
  // Low pool coping, visible at real pedestrian eye level.
  ring(D.waterInner-0.35, D.waterInner+0.25, D.ground+0.22, D.ground+0.22, palette.stone);
  ring(D.waterOuter-0.25, D.waterOuter+0.35, D.ground+0.22, D.ground+0.22, palette.stone);

  const gateAngle = Math.asin(D.gateHalfWidth / 53);
  for (let k = 0; k < 4; k++) {
    const start = k * Math.PI / 2 + gateAngle, arc = Math.PI / 2 - gateAngle * 2;
    // The beige annular gallery slopes OUT to the inner waterside path. Its
    // glazed courtyard wall is a building facade; its roof isn't a footpath.
    ring(D.courtOuter, D.bermOuter, 6.7, D.ground+0.25, palette.sand, start, arc, 48);
    roundWall(53, 6.7-D.ground, D.ground, palette.galleryGlass, start, arc);
    ring(52.75, 53.35, 6.75, 6.75, palette.trim, start, arc, 48);
    for (let j = 1; j < 16; j++) {
      const a = start + arc*j/16;
      box(0.22, 6.7-D.ground, 0.3, palette.trim, Math.sin(a)*52.8, D.ground, Math.cos(a)*52.8, a);
    }
    // Bridges over the shallow moat, with the axes left open through the berm.
    const a = k * Math.PI / 2;
    box(9, 0.16, 50, palette.paving, Math.sin(a)*78, D.ground-0.145, Math.cos(a)*78, a);
    for (const side of [-1, 1]) for (let r = D.waterInner+1; r <= D.waterOuter-1; r += 3.5) {
      const u = Math.sin(a)*r + Math.cos(a)*side*4.3;
      const v = Math.cos(a)*r - Math.sin(a)*side*4.3;
      cylinder(0.05, 0.05, 0.7, palette.metal, u, D.ground, v, 5);
    }
    for (const side of [-1, 1]) {
      const u = Math.cos(a)*side*4.3, v = -Math.sin(a)*side*4.3;
      beam([Math.sin(a)*D.waterInner+u,D.ground+0.7,Math.cos(a)*D.waterInner+v],[Math.sin(a)*D.waterOuter+u,D.ground+0.7,Math.cos(a)*D.waterOuter+v],0.045,palette.metal);
    }
  }

  // 90 m diameter / 40.5 m height; a round salt mound with a small capped apex.
  cylinder(1.15, 45, D.coneHeight, palette.salt, 0, D.ground, 0, 144);
  cylinder(1.4, 1.65, 0.45, palette.trim, 0, D.ground+D.coneHeight, 0, 48);
  cylinder(1.1, 1.4, 0.25, palette.dark, 0, D.ground+D.coneHeight+0.45, 0, 48);
  // Low entrance portals/canopies around the base, seen in aerial photographs.
  for (let i = 0; i < 12; i++) {
    const a = i*Math.PI/6, u = Math.sin(a)*44.7, v = Math.cos(a)*44.7;
    box(3.8, 2.2, 0.24, palette.glass, u, D.ground, v, a);
    box(4.8, 0.25, 3.1, palette.trim, Math.sin(a)*45.5, D.ground+2.2, Math.cos(a)*45.5, a);
  }
  for (const b of SITE_BENCHES) {
    box(b.w, 0.18, b.d, palette.stone, b.u, D.ground+0.45, b.v, b.yaw);
    for (const side of [-1, 1]) box(0.25, 0.45, 0.5, palette.concrete,
      b.u + Math.cos(b.yaw)*side*0.8, D.ground, b.v - Math.sin(b.yaw)*side*0.8, b.yaw);
  }
  // Waterside rails and flowers on the inner promenade, from the supplied 360°.
  for (let i = 0; i < 112; i++) {
    const a = (i+0.5)*Math.PI*2/112;
    if (Math.min(Math.abs(Math.sin(a)),Math.abs(Math.cos(a)))*D.waterInner < 5.5) continue;
    const u = Math.sin(a)*(D.waterInner-0.4), v = Math.cos(a)*(D.waterInner-0.4);
    cylinder(0.04, 0.04, 0.55, palette.metal, u, D.ground+0.22, v, 5);
    const b = a+Math.PI*2/112;
    beam([u,D.ground+0.77,v],[Math.sin(b)*(D.waterInner-0.4),D.ground+0.77,Math.cos(b)*(D.waterInner-0.4)],0.04,palette.metal);
    if (i % 3 === 0) box(1.7, 0.35, 0.5, palette.leaf2, Math.sin(a)*(D.bermOuter+0.7), D.ground, Math.cos(a)*(D.bermOuter+0.7), a);
    const r = D.waterOuter+0.35;
    cylinder(0.04,0.04,0.55,palette.metal,Math.sin(a)*r,D.ground+0.22,Math.cos(a)*r,5);
    beam([Math.sin(a)*r,D.ground+0.77,Math.cos(a)*r],[Math.sin(b)*r,D.ground+0.77,Math.cos(b)*r],0.04,palette.metal);
  }
  ring(D.bermOuter+0.04,D.bermOuter+0.24,D.ground+0.01,D.ground+0.01,palette.dark);

  // Landscape between the museum and the convention halls.
  for (const b of SITE_BEDS) {
    const outline=bedOutline(b);
    const curbShape=new THREE.Shape(outline.map(([u,v])=>new THREE.Vector2(u,-v)));
    const curb=new THREE.ExtrudeGeometry(curbShape,{depth:0.22,bevelEnabled:false});
    curb.rotateX(-Math.PI/2); emit(curb,palette.trim,0,D.ground,0);
    const turfShape=new THREE.Shape(outline.map(([u,v])=>new THREE.Vector2(b.u+(u-b.u)*0.96,-(b.v+(v-b.v)*0.92))));
    const turf=new THREE.ShapeGeometry(turfShape); turf.rotateX(-Math.PI/2);
    emit(turf,palette.grass,0,D.ground+0.23,0);
    for (const du of [-11, 11]) tree(b.u+du, b.v, 0.9);
    for (const du of [-8,0,8]) {
      const shrub=new THREE.SphereGeometry(1.6,8,6); shrub.scale(1.6,0.4,1);
      emit(shrub,palette.leaf,b.u+du,1,b.v-b.d*0.24);
    }
  }
  for (const t of SITE_TREES) {
    if(t.palm)palm(t.u,t.v);else tree(t.u, t.v, t.k);
    if (t.small) {
      box(1.4, 0.03, 1.4, palette.dark, t.u, D.ground+0.01, t.v);
      for (let j = 0; j < 5; j++) emit(new THREE.SphereGeometry(0.08,5,4),palette.trim,t.u+Math.sin(j*2)*0.8,2.9+(j%2)*0.25,t.v+Math.cos(j*2)*0.8);
    }
  }
  for (let v = 225; v < 525; v += 28) tree(-138, v, 0.85);

  // The actual U-shaped convention/exhibition footprint; a central open court
  // admits the bridge. The green roof is intentionally never a walk surface.
  const shape = new THREE.Shape(D.convention.map(([u,v]) => new THREE.Vector2(u, -v)));
  const building = new THREE.ExtrudeGeometry(shape, { depth: 15, bevelEnabled: false });
  building.rotateX(-Math.PI/2); emit(building, palette.concrete, 0, D.ground, 0);
  const roof = new THREE.ShapeGeometry(shape); roof.rotateX(-Math.PI/2);
  emit(roof, palette.turf, 0, D.ground+15.03, 0);
  for (let i = 0; i < D.convention.length; i++) {
    const [u,v] = D.convention[i], [x,z] = D.convention[(i+1)%D.convention.length];
    beam([u,D.ground+15.2,v],[x,D.ground+15.2,z],0.32,palette.trim);
  }
  // Full-height glazing and white fins along the two courtyard-facing facades.
  for (const side of [-1, 1]) {
    const frontU = side < 0 ? -21.1 : 34.8, rearU = side < 0 ? -11.4 : 22.5;
    for (let v = 217; v < 388; v += 5.5) {
      const u = THREE.MathUtils.lerp(frontU, rearU, (v-215)/178)-side*0.4;
      box(0.25, 12.6, 5.25, palette.glass, u, 0.8, v);
      box(0.6, 14.3, 0.35, palette.trim, u-side*0.4, D.ground, v-2.65);
    }
    box(73, 4.2, 0.35, palette.glass, side < 0 ? -57 : 74, 0.8, 212.4);
    for (let j = 0; j < 13; j++) box(0.65, 14.2, 0.65, palette.trim,
      (side < 0 ? -91 : 38) + j*5.7, D.ground, 212.1);
  }
  signBoard(g, ['MAHATMA MANDIR', 'CONVENTION & EXHIBITION CENTRE'],
    { bg: 'rgba(0,0,0,0)', fg: '#f5f0df', w: 1024, h: 180 }, 36, 5, -58, 10, 211.7, Math.PI);

  // KH Road is rendered by buildMahatmaGrounds between the two fenced plots.

  // Bridge deck and continuous rails use the exact navigation height profile.
  for (let v = 46.5; v < 338; v += 2.5) {
    const end = Math.min(338, v+2.5), y = bridgeHeight(v), ey = bridgeHeight(end);
    const mid = (v+end)/2, pitch = Math.atan2(ey-y,end-v);
    const geo = new THREE.BoxGeometry(8.2, 0.55, Math.hypot(end-v,ey-y)+0.03);
    geo.rotateX(-pitch); emit(geo, palette.concrete, 0, (y+ey)/2-0.275, mid);
    for (const side of [-1,1]) {
      beam([side*4.05,y+0.3,v],[side*4.05,ey+0.3,end],0.11,palette.trim);
      beam([side*4.05,y+1.15,v],[side*4.05,ey+1.15,end],0.065,palette.metal);
      beam([side*4.05,y+0.35,v],[side*4.05,y+1.15,v],0.04,palette.metal);
    }
  }
  // Leaning H pylons, high crossbeams, fan cables and the twin wind turbines.
  for (const side of [-1,1]) {
    // Broad, pierced feet taper into the leaning shafts visible in the 360°
    // and aerial photos. The arch is a real hole in the pylon geometry.
    const leg = new THREE.Shape();
    leg.moveTo(202,77); leg.lineTo(208,77); leg.lineTo(217,19);
    leg.quadraticCurveTo(219,7,230,0); leg.lineTo(207,0);
    leg.quadraticCurveTo(209,13,207,25); leg.closePath();
    const hole = new THREE.Path(); hole.absellipse(216.5,6.5,3.3,5.4,0,Math.PI*2,true);
    leg.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(leg,{depth:2.6,bevelEnabled:false,curveSegments:16});
    geo.rotateY(-Math.PI/2);
    const p = geo.attributes.position;
    for (let i=0;i<p.count;i++) p.setX(i,p.getX(i)+1.3+side*(8-3.4*p.getY(i)/77));
    geo.computeVertexNormals(); emit(geo,palette.trim);
    for (let v = 88; v <= 320; v += 16) beam([side*4.6,69,206],[side*4.0,bridgeHeight(v)+0.5,v],0.065,palette.metal,5);
    cylinder(0.18,0.27,4.2,palette.trim,side*4.6,77,205,10);
    const center = new THREE.Vector3(side*4.6,80.6,204.7);
    emit(new THREE.SphereGeometry(0.38,10,8),palette.trim,...center.toArray());
    for (let blade = 0; blade < 3; blade++) {
      const a = blade*Math.PI*2/3+side*0.3;
      beam(center.toArray(),[center.x+Math.sin(a)*2.5,center.y+Math.cos(a)*2.5,center.z],0.12,palette.trim,5);
    }
  }
  for (const y of [57,69]) beam([-5.5,y,210-y/12],[5.5,y,210-y/12],0.85,palette.trim,4);

  // A small bilingual entry plaque, rather than a billboard hiding the museum.
  box(8.5, 1.1, 0.4, palette.stone, -8, D.ground, -106);
  const entrancePlaque=signBoard(g, ['DANDI KUTIR', 'દાંડી કુટીર'], { bg: '#d2cec1', fg: '#35413f', w: 768, h: 256 }, 7.8, 2.1, -8, 2.1, -106.25, Math.PI);
  entrancePlaque.material.side=THREE.FrontSide;

  const blue = new THREE.MeshStandardMaterial({ color: 0x83c8e2, emissive: 0x298ac7, emissiveIntensity: 0 });
  ring(D.waterInner+0.4,D.waterInner+0.9,D.ground-0.11,D.ground-0.11,blue);
  ring(D.waterOuter-0.9,D.waterOuter-0.4,D.ground-0.11,D.ground-0.11,blue);
  for (const [material, parts] of batches) {
    const mesh = new THREE.Mesh(mergeGeometries(parts, false), material);
    mesh.name = material === palette.salt ? 'Salt mound (non-walkable)' : material === waterMaterial ? 'Reflecting moat (non-walkable)' : 'Mahatma Mandir exterior';
    mesh.castShadow = material !== waterMaterial && material !== blue;
    mesh.receiveShadow = material !== waterMaterial;
    mesh.userData.noShadow = material === waterMaterial || material === blue;
    mesh.userData.cameraSolid = [palette.salt, palette.sand, palette.concrete, palette.galleryGlass,perimeterMaterials.wall].includes(material);
    g.add(mesh);
    parts.forEach(p => p.dispose());
  }
  return {
    update(time) { waterMaterial.normalMap.offset.set(time*0.006,time*0.003); },
    setNight(on) { blue.emissiveIntensity = on ? 2.2 : 0; },
  };
}
