import * as THREE from 'three';
// Separate crash meshes are deformed; shared traffic geometry stays untouched.
export function damageVehicle(root,severity=1){
  root.updateWorldMatrix(true,true);
  const bounds=new THREE.Box3(),inv=root.matrixWorld.clone().invert();
  root.traverse(o=>{if(o.isMesh){o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld)));}});
  const length=Math.max(1,bounds.max.z-bounds.min.z),front=bounds.max.z;
  root.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position)return;
    o.geometry=o.geometry.clone();const a=o.geometry.attributes.position;
    if(o.material.metalness>.1&&o.material.roughness>.2){
      for(let i=0;i<a.count;i++){const z=a.getZ(i),y=a.getY(i),x=a.getX(i),weight=Math.max(0,(z-(front-length*.27))/(length*.27));if(weight&&y<1.2){a.setZ(i,z-weight*.32*severity);a.setY(i,y+Math.sin(x*9+z*7)*weight*.065*severity);}}
      a.needsUpdate=true;o.geometry.computeVertexNormals();
    }
    o.material=o.material.clone();if(o.material.roughness>.22){o.material.color.multiplyScalar(.8);o.material.roughness=Math.max(.7,o.material.roughness);}
  });
  const lines=[],r=length*.14;
  for(let i=0;i<9;i++){const angle=i*Math.PI*2/9;lines.push(0,1.07,front-length*.27,Math.cos(angle)*r,1.07+Math.sin(angle)*.18,front-length*.27-.015);}
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));const cracks=new THREE.LineSegments(geo,new THREE.LineBasicMaterial({color:0xc5d1ca,transparent:true,opacity:.65}));root.add(cracks);
}
