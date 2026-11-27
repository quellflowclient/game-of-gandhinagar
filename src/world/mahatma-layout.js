// Metres. Local +v follows the mapped Dandi Bridge towards the southeast.
// Geometry and pedestrian collision use this same survey/layout data.
export const MAHATMA = {
  yaw: 1.04,
  coneRadius: 45,
  coneHeight: 40.5,
  courtOuter: 53,
  bermOuter: 73,
  waterInner: 80,
  waterOuter: 94,
  promenadeOuter: 101,
  ground: 0.18,
  gateHalfWidth: 4.5,
  bridgeHalfWidth: 3.8,
  bridge: [[46.5, 0.18], [53, 6.7], [88, 6.7], [215, 12.5], [245, 12.5], [338, 0.18]],
  // Inside edges of Salt Mount Road and KH Road, traced against OSM ways
  // 744514802 / 338768422 / 386749310 and the user's marked museum plot.
  museumPlot: [[-141,162],[-132,104],[-123,30],[-118,-4],[-112,-23],[-103,-41],
    [-91,-59],[-75,-75],[-58,-88],[-37,-98],[-16,-103],[3,-103],
    [26,-101],[47,-96],[68,-87],[86,-74],[100,-58],[111,-36],
    [118,-13],[121,13],[121,54],[121,105],[121,157],
    [101,153],[77,145],[49,136],[24,131],[2,130],[-24,132],[-48,138],[-78,147],[-106,156]],
  conventionPlot: [[-143,188],[-108,181],[-77,175],[-49,166],[-24,162],[1,160],
    [25,162],[50,168],[79,178],[108,185],[123,190],[123,280],
    [107,350],[107,710],[98,720],[-138,722],[-146,710],[-146,188]],
  // OSM way 326048766, projected into the museum/bridge coordinate system.
  convention: [[-93.4,215.8],[-21.1,215.2],[-11.4,391.3],[22.5,393.2],
    [34.8,212.7],[113.2,213],[111.7,262.2],[93.7,282.3],[95.9,340.1],
    [91.1,347.5],[88.9,513.3],[-79.3,514.8],[-80.2,358.3],[-127.4,356.9],
    [-130.4,241.1],[-103.8,240.8],[-101.7,248.2],[-98,249.3],[-101,217.3],[-97.8,215.5]],
};

// These five mapped footprints are already reconstructed by the salt mound
// and its four sloping gallery wings. Drawing the generic OSM boxes as well
// intersects their roofs and blocks the authored pedestrian entrances.
export const MAHATMA_AUTHORED_BUILDINGS=new Set([326048766,338769675,338769676,338769677,338769678,338769679]);
export function mahatmaReplacesBuilding(origin,building){
  return MAHATMA_AUTHORED_BUILDINGS.has(Number(building.id))||building.pts.every(([x,z])=>{const p=worldToSite(origin,x,z);return Math.hypot(p.u,p.v)<MAHATMA.coneRadius+2;});
}

export const CAMPUS_ROAD = {
  width: 22, y: 0.04,
  path: [[-190,178],[-155,177],[-128,175],[-103,169],[-77,161],[-49,151],
    [-25,146],[0,145],[25,147],[49,152],[78,163],[103,168],[128,173],[160,175],[190,175]],
};
export const CAMPUS_GATES = [
  { plot:'museum', u:1,v:-103,width:8,name:'Museum north entrance' },
  { plot:'museum', u:121,v:0,width:8,name:'Salt Mount Road entrance' },
  { plot:'museum', u:-95,v:153,width:7,name:'Museum garden entrance' },
  { plot:'convention', u:0,v:160,width:13,name:'Convention entrance' },
  { plot:'convention', u:-146,v:365,width:12,name:'Convention west gate' },
  { plot:'convention', u:0,v:721,width:8,name:'Gandhi Garden gate' },
];

export function distanceToSegment(u,v,a,b) {
  const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz;
  const t=l?Math.max(0,Math.min(1,((u-a[0])*dx+(v-a[1])*dz)/l)):0;
  return Math.hypot(u-a[0]-t*dx,v-a[1]-t*dz);
}
function fenceSections(outline,gates) {
  const starts=[0];
  for(let i=0;i<outline.length;i++)starts.push(starts.at(-1)+Math.hypot(outline[(i+1)%outline.length][0]-outline[i][0],outline[(i+1)%outline.length][1]-outline[i][1]));
  const total=starts.at(-1),openings=[];
  for(const gate of gates) {
    let best=0,dist=Infinity;
    for(let i=0;i<outline.length;i++) {
      const d=distanceToSegment(gate.u,gate.v,outline[i],outline[(i+1)%outline.length]);
      if(d<dist){dist=d;best=i;}
    }
    const a=outline[best],b=outline[(best+1)%outline.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
    const t=((gate.u-a[0])*dx+(gate.v-a[1])*dz)/(len*len);
    const center=starts[best]+Math.max(0,Math.min(1,t))*len;
    for(const shift of [-total,0,total])openings.push([center-gate.width/2+shift,center+gate.width/2+shift]);
  }
  const result=[];
  for(let i=0;i<outline.length;i++) {
    const a=outline[i],b=outline[(i+1)%outline.length],start=starts[i],end=starts[i+1];let cursor=start;
    const intervals=openings.filter(([lo,hi])=>hi>start&&lo<end).map(([lo,hi])=>[Math.max(start,lo),Math.min(end,hi)]).sort((x,y)=>x[0]-y[0]);
    const at=k=>{const t=(k-start)/(end-start);return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
    for(const [lo,hi] of [...intervals,[end,end]]) {
      if(lo>cursor)result.push({a:at(cursor),b:at(lo)});
      cursor=Math.max(cursor,hi);
    }
  }
  return result;
}
export const CAMPUS_FENCES = [
  ...fenceSections(MAHATMA.museumPlot,CAMPUS_GATES.filter(g=>g.plot==='museum')),
  ...fenceSections(MAHATMA.conventionPlot,CAMPUS_GATES.filter(g=>g.plot==='convention')),
].map(s=>({...s,minU:Math.min(s.a[0],s.b[0]),maxU:Math.max(s.a[0],s.b[0]),minV:Math.min(s.a[1],s.b[1]),maxV:Math.max(s.a[1],s.b[1])}));
export function insideCompound(u,v,margin=0) {
  return margin ? nearPolygon(u,v,MAHATMA.museumPlot,margin)||nearPolygon(u,v,MAHATMA.conventionPlot,margin)
    : pointInPolygon(u,v,MAHATMA.museumPlot)||pointInPolygon(u,v,MAHATMA.conventionPlot);
}
export function onCampusRoad(u,v,extra=0) {
  return CAMPUS_ROAD.path.some((a,i)=>i>0&&distanceToSegment(u,v,CAMPUS_ROAD.path[i-1],a)<=CAMPUS_ROAD.width/2+extra);
}

let c = Math.cos(MAHATMA.yaw), s = Math.sin(MAHATMA.yaw);
export function siteToWorld(origin, u, v) {
  return { x: origin.x + c * u + s * v, z: origin.z - s * u + c * v };
}
export function worldToSite(origin, x, z) {
  const dx = x - origin.x, dz = z - origin.z;
  return { u: c * dx - s * dz, v: s * dx + c * dz };
}
export function pointInPolygon(x, z, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, az] = points[i], [bx, bz] = points[j];
    if ((az > z) !== (bz > z) && x < (bx - ax) * (z - az) / (bz - az) + ax) inside = !inside;
  }
  return inside;
}
const polygonBounds=new WeakMap();
function nearPolygon(x, z, points, radius) {
  let bounds=polygonBounds.get(points);
  if(!bounds){bounds={minX:Math.min(...points.map(p=>p[0])),maxX:Math.max(...points.map(p=>p[0])),minZ:Math.min(...points.map(p=>p[1])),maxZ:Math.max(...points.map(p=>p[1]))};polygonBounds.set(points,bounds);}
  if(x<bounds.minX-radius||x>bounds.maxX+radius||z<bounds.minZ-radius||z>bounds.maxZ+radius)return false;
  if (pointInPolygon(x, z, points)) return true;
  for (let i = 0; i < points.length; i++) {
    const [ax, az] = points[i], [bx, bz] = points[(i + 1) % points.length];
    const dx = bx - ax, dz = bz - az;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1)));
    if (Math.hypot(x - ax - t * dx, z - az - t * dz) < radius) return true;
  }
  return false;
}
export function bridgeHeight(v) {
  const p = MAHATMA.bridge;
  if (v < p[0][0] || v > p.at(-1)[0]) return null;
  for (let i = 1; i < p.length; i++) if (v <= p[i][0]) {
    const [a, h] = p[i - 1], [b, k] = p[i];
    return h + (k - h) * (v - a) / (b - a);
  }
  return null;
}

// Garden beds and furniture are shared with the renderer, rather than an invisible
// approximation of the entire landmark's bounding box.
export const SITE_BEDS = [];
for (const side of [-1, 1]) for (const [u,v,w,d] of [[66,114,46,20],[105,73,22,40],[70,199,48,14]])
  SITE_BEDS.push({ u: side*u, v, w, d });
export function bedOutline(b) {
  return Array.from({length:40},(_,i) => {
    const a=i*Math.PI/20, bend=1+0.12*Math.sin(2*a);
    return [b.u+Math.cos(a)*b.w/2*bend,b.v+Math.sin(a)*b.d/2];
  });
}
const plantedPolygons = SITE_BEDS.map(bedOutline);
export const SITE_BENCHES = [];
for (let i = 0; i < 16; i++) {
  const a = (i + 0.5) * Math.PI / 8;
  for (const r of [76, 99]) SITE_BENCHES.push({ u: Math.sin(a) * r, v: Math.cos(a) * r, yaw: a, w: 2.4, d: 0.65 });
}
export const SITE_TREES = [];
for (let i = 0; i < 16; i++) {
  const a = (i+0.5)*Math.PI/8;
  const u=Math.sin(a)*112,v=Math.cos(a)*112;
  if(pointInPolygon(u,v,MAHATMA.museumPlot)) SITE_TREES.push({ u,v,k:0.85+(i%3)*0.12 });
  if (i%4 !== 0) SITE_TREES.push({ u: Math.sin(i*Math.PI/8)*74.5, v: Math.cos(i*Math.PI/8)*74.5, k: 0.48, small: true });
}
for(const side of [-1,1])for(const [u,v] of [[114,0],[109,50],[90,118]])SITE_TREES.push({u:u*side,v,k:1,palm:true});

export function createMahatmaZone(origin) {
  const northApproach=(u,v)=>Math.abs(u)<3.6&&v>-112&&v<-101;
  const inSite = (u,v) => insideCompound(u,v,4)||onCampusRoad(u,v,5)||northApproach(u,v);
  const authoredRoad = (u,v) => insideCompound(u,v)||onCampusRoad(u,v,5);
  const outlineWorld=[...MAHATMA.museumPlot,...MAHATMA.conventionPlot,...CAMPUS_ROAD.path].map(([u,v])=>siteToWorld(origin,u,v));
  const roadBounds={minX:Math.min(...outlineWorld.map(p=>p.x))-20,maxX:Math.max(...outlineWorld.map(p=>p.x))+20,
    minZ:Math.min(...outlineWorld.map(p=>p.z))-20,maxZ:Math.max(...outlineWorld.map(p=>p.z))+20};
  return {
    id: 'mahatma-mandir',
    contains(x, z) { const { u, v } = worldToSite(origin, x, z); return inSite(u, v); },
    // Higher decks and the ground below them are separate surfaces. A pedestrian
    // can only transfer to a surface within step height, so crossing under the
    // bridge never teleports them up onto it, or off its guardrails.
    heights(x, z, radius = 0.38) {
      const { u, v } = worldToSite(origin, x, z), r = Math.hypot(u, v);
      const heights = [];
      const bh = bridgeHeight(v);
      if (bh != null && Math.abs(u) <= MAHATMA.bridgeHalfWidth - radius) heights.push(bh);
      const fenceRadius=radius+0.28;
      if(CAMPUS_FENCES.some(f=>u>=f.minU-fenceRadius&&u<=f.maxU+fenceRadius&&v>=f.minV-fenceRadius&&v<=f.maxV+fenceRadius&&distanceToSegment(u,v,f.a,f.b)<fenceRadius))return heights;
      if (r < MAHATMA.coneRadius + radius) return heights;
      const gate = Math.min(Math.abs(u), Math.abs(v)) <= MAHATMA.gateHalfWidth - radius;
      if (r > MAHATMA.courtOuter - radius && r < MAHATMA.bermOuter + radius && !gate) return heights;
      if (r > MAHATMA.waterInner - radius && r < MAHATMA.waterOuter + radius && !gate) return heights;
      if (nearPolygon(u, v, MAHATMA.convention, radius)) return heights;
      if (plantedPolygons.some(polygon => nearPolygon(u,v,polygon,radius))) return heights;
      if (SITE_BENCHES.some(b => {
        const dx = u - b.u, dz = v - b.v, cb = Math.cos(b.yaw), sb = Math.sin(b.yaw);
        return Math.abs(cb * dx - sb * dz) < b.w / 2 + radius && Math.abs(sb * dx + cb * dz) < b.d / 2 + radius;
      })) return heights;
      if (SITE_TREES.some(t => Math.hypot(u-t.u,v-t.v) < 0.34*t.k+radius)) return heights;
      // Concrete pylon feet, outside the bridge's clear walking width.
      if (Math.abs(Math.abs(u) - 8) < 1.7 + radius && v > 207-radius && v < 230+radius) return heights;
      // Access underneath the rising bridge starts after sufficient headroom.
      if (bh != null && bh > MAHATMA.ground + 0.65 && bh < MAHATMA.ground + 2.3 && Math.abs(u) < 4.4 + radius) return heights;
      const ground=insideCompound(u,v)?MAHATMA.ground:onCampusRoad(u,v)?CAMPUS_ROAD.y:
        insideCompound(u,v,3.4)||northApproach(u,v)?MAHATMA.ground:0;
      heights.push(ground);
      return heights;
    },
    forbidsVehicles(x,z,margin=0) { const {u,v}=worldToSite(origin,x,z);return insideCompound(u,v,margin); },
    roadHeight(x,z) { const {u,v}=worldToSite(origin,x,z);return onCampusRoad(u,v)?CAMPUS_ROAD.y:null; },
    clearing: {
      replacesBuilding:building=>mahatmaReplacesBuilding(origin,building),
      roadBounds,
      contains(x, z) {
        const { u, v } = worldToSite(origin, x, z);
        return authoredRoad(u,v);
      },
      replacesRoad(x,z) { const {u,v}=worldToSite(origin,x,z);return authoredRoad(u,v); },
    },
  };
}

export function configureMahatma({layout,road,gates,beds,benches,trees}){
 Object.assign(MAHATMA,structuredClone(layout));c=Math.cos(MAHATMA.yaw);s=Math.sin(MAHATMA.yaw);Object.assign(CAMPUS_ROAD,structuredClone(road));
 for(const [target,source]of [[CAMPUS_GATES,gates],[SITE_BEDS,beds],[SITE_BENCHES,benches],[SITE_TREES,trees]])target.splice(0,target.length,...structuredClone(source));
 plantedPolygons.splice(0,plantedPolygons.length,...SITE_BEDS.map(bedOutline));
 const fences=[...fenceSections(MAHATMA.museumPlot,CAMPUS_GATES.filter(g=>g.plot==='museum')),...fenceSections(MAHATMA.conventionPlot,CAMPUS_GATES.filter(g=>g.plot==='convention'))];
 CAMPUS_FENCES.splice(0,CAMPUS_FENCES.length,...fences.map(f=>({...f,minU:Math.min(f.a[0],f.b[0]),maxU:Math.max(f.a[0],f.b[0]),minV:Math.min(f.a[1],f.b[1]),maxV:Math.max(f.a[1],f.b[1])})));
}
