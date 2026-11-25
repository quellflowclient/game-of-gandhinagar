import * as THREE from 'three';
// Sample the actual skinned shoe underside, not ankle joint centres. A small
// set of heel/toe/edge vertices keeps this cheap for mobile crowds.
export function createSoleContact(root,model){
 const probes=[],point=new THREE.Vector3();
 function matrices(){root.updateWorldMatrix(true,false);root.updateMatrixWorld(true);}
 matrices();
 model.traverse(mesh=>{
  if(!mesh.isSkinnedMesh||!mesh.visible)return;
  const indices=mesh.geometry.attributes.skinIndex,weights=mesh.geometry.attributes.skinWeight;if(!indices||!weights)return;
  for(const side of ['Left','Right']){
   const footIndices=new Set(mesh.skeleton.bones.map((b,i)=>b.name.includes(`${side}Foot`)||b.name.includes(`${side}Toe`)?i:-1).filter(i=>i>=0)),candidates=[];
   for(let i=0;i<indices.count;i++){let weight=0;for(let j=0;j<4;j++)if(footIndices.has(indices.getComponent(i,j)))weight+=weights.getComponent(i,j);if(weight<.2)continue;mesh.getVertexPosition(i,point);mesh.localToWorld(point);root.worldToLocal(point);if(point.y<.24)candidates.push({i,y:point.y,z:point.z,x:point.x});}
   if(!candidates.length)continue;const low=Math.min(...candidates.map(p=>p.y)),sole=candidates.filter(p=>p.y<low+.018).sort((a,b)=>a.z-b.z);
   for(let k=0;k<Math.min(10,sole.length);k++){const p=sole[Math.round(k*(sole.length-1)/Math.max(1,Math.min(10,sole.length)-1))];probes.push({mesh,index:p.i});}
   for(const sort of [(a,b)=>a.x-b.x,(a,b)=>b.x-a.x,(a,b)=>a.y-b.y]){sole.sort(sort);probes.push({mesh,index:sole[0].i});}
  }
 });
 function minimum(){matrices();let y=Infinity;for(const p of probes){p.mesh.getVertexPosition(p.index,point);p.mesh.localToWorld(point);root.worldToLocal(point);y=Math.min(y,point.y);}return y;}
 return{minimum,count:probes.length,plant(){if(!probes.length)return;const y=minimum();model.position.y+=THREE.MathUtils.clamp(.006-y,-.2,.3);matrices();}};
}
