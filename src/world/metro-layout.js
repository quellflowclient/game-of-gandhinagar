// OSM stores the two tracks as parallel ways. Build one viaduct and one row
// of supports on their centreline instead of doubling the whole bridge.
function nearest(p,path){let best={d:Infinity};for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/l)):0,x=a[0]+dx*t,z=a[1]+dz*t,d=Math.hypot(x-p[0],z-p[1]);if(d<best.d)best={d,x,z,dx,dz};}return best;}
export function metroCenterlines(input){
 const lines=input.filter(l=>l.elevated&&l.pts.length>1),used=new Set(),out=[];
 for(let i=0;i<lines.length;i++){
  if(used.has(i))continue;const line=lines[i],step=Math.max(1,Math.floor(line.pts.length/12)),samples=line.pts.filter((_,k)=>k%step===0);let pair=-1,score=Infinity;
  for(let j=i+1;j<lines.length;j++)if(!used.has(j)){
   let hits=0,sum=0;for(const p of samples){const n=nearest(p,lines[j].pts);if(n.d<7){hits++;sum+=n.d;}}
   if(hits>=Math.ceil(samples.length*0.65)&&sum/hits<score){pair=j;score=sum/hits;}
  }
  used.add(i);
  if(pair<0){out.push(line);continue;}
  used.add(pair);out.push({...line,trackIds:[line.id,lines[pair].id],pts:line.pts.map(p=>{const n=nearest(p,lines[pair].pts);return n.d<9?[(p[0]+n.x)/2,(p[1]+n.z)/2]:p;})});
 }
 return out;
}
export function singleRowPiers(input){const out=[];for(const p of input){let near=null,d=14;for(const q of out){const dist=Math.hypot(p[0]-q[0],p[1]-q[1]);if(dist<d&&Math.abs(Math.cos(p[2]-q[2]))>0.85){d=dist;near=q;}}if(near){near[0]=(near[0]+p[0])/2;near[1]=(near[1]+p[1])/2;}else out.push([...p]);}return out;}
