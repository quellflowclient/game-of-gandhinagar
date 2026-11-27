// Shared metre-coordinate geometry. Rendering, coverage audits and collision
// consume the same source polygons without rescaling or relocating footprints.
export function pointInRing(x,z,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
export function segmentDistance(x,z,a,b){const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);}
export function ringDistance(x,z,ring){let d=Infinity;for(let i=0;i<ring.length;i++)d=Math.min(d,segmentDistance(x,z,ring[i],ring[(i+1)%ring.length]));return d;}
export const insideWithMargin=(x,z,ring,margin=0)=>pointInRing(x,z,ring)&&(margin<=0||ringDistance(x,z,ring)>=margin);
export function buildingBlocks(x,z,building,r=.38){
  if(!pointInRing(x,z,building.pts)&&ringDistance(x,z,building.pts)>=r)return false;
  return !(building.holes||[]).some(hole=>insideWithMargin(x,z,hole,r));
}
export function polygonIndex(polygons,{cell=40,points=p=>p.pts}={}){
  const grid=new Map();for(const polygon of polygons){const ring=points(polygon),xs=ring.map(p=>p[0]),zs=ring.map(p=>p[1]);
    for(let x=Math.floor((Math.min(...xs)-2)/cell);x<=Math.floor((Math.max(...xs)+2)/cell);x++)for(let z=Math.floor((Math.min(...zs)-2)/cell);z<=Math.floor((Math.max(...zs)+2)/cell);z++){const key=`${x},${z}`;if(!grid.has(key))grid.set(key,[]);grid.get(key).push(polygon);}}
  return (x,z)=>grid.get(`${Math.floor(x/cell)},${Math.floor(z/cell)}`)||[];
}
