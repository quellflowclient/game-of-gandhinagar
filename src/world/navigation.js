// Pedestrian capsule movement, shared by the player, NPCs and presence avatars.
// Swept substeps prevent running/cycling through thin walls and water edges.
export function createNavigation(zones = [],{roads,parks=[]}={}) {
  const obstacles=[];
  const obstacleAt=(x,z,r=0.38)=>obstacles.some(p=>Math.abs(x-p.x)<p.r+r&&Math.abs(z-p.z)<p.r+r&&Math.hypot(x-p.x,z-p.z)<p.r+r);
  const grid=new Map(),cell=50,widths={motorway:26,trunk:22,primary:18,secondary:13,tertiary:10,residential:7,unclassified:7,living_street:6,service:5,pedestrian:6,footway:2.5,path:2,cycleway:3};
  const parkSurfaces=parks.map(p=>({pts:p.pts,minX:Math.min(...p.pts.map(q=>q[0])),maxX:Math.max(...p.pts.map(q=>q[0])),minZ:Math.min(...p.pts.map(q=>q[1])),maxZ:Math.max(...p.pts.map(q=>q[1]))}));
  if(roads)for(const road of roads)for(let i=1;i<road.pts.length;i++) {
    const a=road.pts[i-1],b=road.pts[i],width=road.width||widths[road.kind];if(!width)continue;
    const seg={a,b,width,sides:road.sidewalkSides||[-1,1],sidewalk:['motorway','trunk','primary','secondary','tertiary'].includes(road.kind)};for(let x=Math.floor((Math.min(a[0],b[0])-width)/cell);x<=Math.floor((Math.max(a[0],b[0])+width)/cell);x++)for(let z=Math.floor((Math.min(a[1],b[1])-width)/cell);z<=Math.floor((Math.max(a[1],b[1])+width)/cell);z++){const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(seg);}
  }
  function cycleRoad(x,z,r) {
    return (grid.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[]).some(({a,b,width})=>{const dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz,t=len?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/len)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz)<width/2+1.2-r;});
  }
  function heights(x, z, radius) {
    if(obstacleAt(x,z,radius))return[];
    const zone = zones.find(zon => zon.contains(x, z));
    if(zone)return zone.heights(x,z,radius);
    if(roads&&radius>=0.5&&!cycleRoad(x,z,radius))return[];
    if(!roads)return[0];
    // Same elevations as city.js road ribbons and raised public footpaths.
    let top=-0.05;
    for(const park of parkSurfaces){if(x<park.minX||x>park.maxX||z<park.minZ||z>park.maxZ)continue;let inside=false;const p=park.pts;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])inside=!inside;if(inside)top=Math.max(top,0.06);}
    for(const {a,b,width,sidewalk,sides} of grid.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[]){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0,d=Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz),side=Math.sign((x-a[0])*(-dz)+(z-a[1])*dx);if(d<=width/2)top=Math.max(top,0.2+width*0.004);else if(sidewalk&&sides.includes(side)&&d<=width/2+2.6)top=Math.max(top,0.3+width*0.004);}
    return[top+0.008];
  }
  function surface(x, z, y, radius = 0.38, step = 0.65) {
    return heights(x, z, radius).filter(h => Math.abs(h - y) <= step)
      .sort(step === Infinity ? (a,b) => Math.abs(a-y)-Math.abs(b-y) : (a,b) => b-a)[0];
  }
  function move(pos, dx, dz, radius = 0.38) {
    const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.2));
    const sx = dx / n, sz = dz / n;
    for (let i = 0; i < n; i++) {
      let y = surface(pos.x + sx, pos.z + sz, pos.y, radius);
      if (y !== undefined) { pos.x += sx; pos.z += sz; pos.y = y; continue; }
      // Slide along the obstruction, instead of freezing diagonal input.
      const axes = Math.abs(sx) >= Math.abs(sz) ? [[sx, 0], [0, sz]] : [[0, sz], [sx, 0]];
      for (const [ax, az] of axes) {
        y = surface(pos.x + ax, pos.z + az, pos.y, radius);
        if (y !== undefined) { pos.x += ax; pos.z += az; pos.y = y; }
      }
    }
    return pos;
  }
  function safePoint(x, z, y = 0, radius = 0.38, maxStep = Infinity) {
    let h = surface(x, z, y, radius, maxStep);
    if (h !== undefined) return { x, y: h, z };
    // Travel, old saved positions and malicious presence coordinates must never
    // leave an avatar embedded in the cone, a pool or a closed exhibition hall.
    for (let r = 1; r <= 240; r += 1) {
      const n = Math.max(16, Math.ceil(2 * Math.PI * r / 2));
      for (let i = 0; i < n; i++) {
        const a = i * 2 * Math.PI / n, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
        h = surface(px, pz, y, radius, maxStep);
        if (h !== undefined) return { x: px, y: h, z: pz };
      }
    }
    throw new Error('No pedestrian surface near the requested position');
  }
  function canTravel(from, to, radius = 0.38) {
    const p = { ...from };
    move(p, to.x - from.x, to.z - from.z, radius);
    return Math.hypot(p.x - to.x, p.z - to.z) < 0.3;
  }
  return { move, safePoint, surface, canTravel, zones,obstacleAt,addObstacles(list){obstacles.push(...list);} };
}
