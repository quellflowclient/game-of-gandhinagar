import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
const assets=[];
const anchors=[],pools=[];
export function installParkedModel(root,i){
  root.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(root),size=b.getSize(new THREE.Vector3()),scale=(i?2.05:1.85)/Math.max(size.x,size.z);
  const wrapper=new THREE.Group();root.position.sub(new THREE.Vector3((b.min.x+b.max.x)/2,b.min.y,(b.min.z+b.max.z)/2));wrapper.add(root);wrapper.scale.setScalar(scale);assets[i]=wrapper;
}
export async function preloadParkedModels(renderer){
  const ktx=new KTX2Loader().setTranscoderPath('/models/vehicles/basis/').detectSupport(renderer);
  const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).setKTX2Loader(ktx);
  await Promise.all(['scooter','motorcycle'].map(async(type,i)=>{
    const gltf=await loader.loadAsync(`/models/vehicles/${type}-parking.glb`);
    gltf.scene.traverse(o=>{for(const m of [].concat(o.material||[]))if(m.map)m.map.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());});
    installParkedModel(gltf.scene,i);
  }));
  ktx.dispose();
}
export function parkedTwoWheeler(g,x,z,yaw,color){
  if(!assets.length)throw new Error('Vehicle assets must load before building the campus');
  const index=Math.abs(Math.round(x*3+z))%3===0?1:0;
  const anchor=new THREE.Group();anchor.userData.parking=true;anchor.position.set(x,0.018,z);anchor.rotation.y=yaw;g.add(anchor);anchors.push({anchor,index});return anchor;
}
export function updateParkedVehicles(scene,position){
 if(!pools.length)for(const [type,root] of assets.entries()){
   root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;const geometry=o.geometry.clone();for(const [name,a] of Object.entries(geometry.attributes))if(a.normalized||a.isInterleavedBufferAttribute){const data=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)data[i*a.itemSize+j]=a.getComponent(i,j);geometry.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));}geometry.applyMatrix4(o.matrixWorld);
     const mesh=new THREE.InstancedMesh(geometry,o.material,512);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=mesh.receiveShadow=true;mesh.name=`GLB parking ${type}`;scene.add(mesh);pools.push({mesh,type});});
 }
 const visible=anchors.filter(a=>{a.anchor.updateWorldMatrix(true,false);const p=new THREE.Vector3().setFromMatrixPosition(a.anchor.matrixWorld);return Math.hypot(p.x-position.x,p.z-position.z)<85;});
 for(const {mesh,type} of pools){let count=0;for(const a of visible)if(a.index===type&&count<512)mesh.setMatrixAt(count++,a.anchor.matrixWorld);mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;if(count){mesh.computeBoundingSphere();mesh.computeBoundingBox();}}
}
