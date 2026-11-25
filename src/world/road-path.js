// Shared mitred offsets keep adjacent road and pavement segments watertight.
export function offsetPath(points,offset) {
  const closed=points.length>2&&Math.hypot(points[0][0]-points.at(-1)[0],points[0][1]-points.at(-1)[1])<.001;
  const count=closed?points.length-1:points.length;
  const normal=(a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz)||1;return[-dz/l,dx/l];};
  const result=[];
  for(let i=0;i<count;i++) {
    const p=points[i],a=normal(points[i?i-1:closed?count-1:0],p),b=normal(p,points[i<count-1?i+1:closed?0:i]);
    if(!closed&&i===0){a[0]=b[0];a[1]=b[1];}
    if(!closed&&i===count-1){b[0]=a[0];b[1]=a[1];}
    let nx=a[0]+b[0],nz=a[1]+b[1],l=Math.hypot(nx,nz);
    if(l<.001){nx=b[0];nz=b[1];l=1;}
    nx/=l;nz/=l;const scale=offset/Math.max(.5,nx*b[0]+nz*b[1]);
    result.push([p[0]+nx*scale,p[1]+nz*scale]);
  }
  if(closed)result.push([...result[0]]);
  return result;
}
// Interpolates the surveyed closed roundabout; approach roads remain untouched.
export function smoothRoundabout(points,steps=160) {
  const p=points.slice(0,-1),n=p.length,out=[];
  for(let i=0;i<steps;i++) {
    const u=i/steps*n,k=Math.floor(u),t=u-k,t2=t*t,t3=t2*t;
    const a=p[(k+n-1)%n],b=p[k%n],c=p[(k+1)%n],d=p[(k+2)%n];
    out.push([0,1].map(j=>.5*(2*b[j]+(-a[j]+c[j])*t+(2*a[j]-5*b[j]+4*c[j]-d[j])*t2+(-a[j]+3*b[j]-3*c[j]+d[j])*t3)));
  }
  out.push([...out[0]]);return out;
}
