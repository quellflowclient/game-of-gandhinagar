import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {KTX2Loader} from 'three/examples/jsm/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const assets=[];
const anchors=[],pools=[];
export function createRideTwoWheeler(type='scooter'){
 const source=assets[type==='bike'?1:0];if(!source)throw new Error('Two-wheeler model is still loading.');
 const root=source.clone(true);root.traverse(o=>{if(o.isMesh){o.geometry=o.geometry.clone();o.material=o.material.clone();o.castShadow=o.receiveShadow=true;}});
 const size=new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());if(size.x>size.z)root.rotation.y=Math.PI/2;
 return root;
}
export function installParkedModel(root,i){
  root.updateMatrixWorld(true);
  const b=new THREE.Box3().setFromObject(root),size=b.getSize(new THREE.Vector3()),scale=(i?2.05:1.85)/Math.max(size.x,size.z);
  const wrapper=new THREE.Group();root.position.sub(new THREE.Vector3((b.min.x+b.max.x)/2,b.min.y,(b.min.z+b.max.z)/2));wrapper.add(root);wrapper.scale.setScalar(scale);if(size.x>size.z)wrapper.rotation.y=Math.PI/2;assets[i]=wrapper;
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
export function updateParkedVehicles(scene,position,{lowEnd=false}={}){
 if(!pools.length)for(const [type,root] of assets.entries()){
   const materials=new Map();root.updateMatrixWorld(true);root.traverse(o=>{if(!o.isMesh)return;let geometry=o.geometry.clone();for(const [name,a] of Object.entries(geometry.attributes))if(a.normalized||a.isInterleavedBufferAttribute){const data=new Float32Array(a.count*a.itemSize);for(let i=0;i<a.count;i++)for(let j=0;j<a.itemSize;j++)data[i*a.itemSize+j]=a.getComponent(i,j);geometry.setAttribute(name,new THREE.BufferAttribute(data,a.itemSize));}geometry.applyMatrix4(o.matrixWorld);
     for(const key of Object.keys(geometry.attributes))if(!['position','normal','uv'].includes(key))geometry.deleteAttribute(key);
     if(geometry.index){const flat=geometry.toNonIndexed();geometry.dispose();geometry=flat;}
     if(!materials.has(o.material))materials.set(o.material,[]);materials.get(o.material).push(geometry);});
   for(const [material,geometries]of materials){const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
    for(const near of [false,true]){const mesh=new THREE.InstancedMesh(geometry,material,512);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.castShadow=near;mesh.receiveShadow=true;mesh.name=`GLB parking ${type}`;scene.add(mesh);pools.push({mesh,type,near});}
   }
 }
 const visible=anchors.filter(a=>{if(a.anchor.userData.parkingVisible===false)return false;if(!a.worldMatrix){a.anchor.updateWorldMatrix(true,false);a.worldMatrix=a.anchor.matrixWorld.clone();a.x=a.worldMatrix.elements[12];a.z=a.worldMatrix.elements[14];}a.distance=Math.hypot(a.x-position.x,a.z-position.z);return a.distance<(lowEnd?55:85);});
 for(const {mesh,type,near} of pools){let count=0;for(const a of visible)if(a.index===type&&(a.distance<22)===near&&count<512)mesh.setMatrixAt(count++,a.worldMatrix);mesh.count=count;mesh.visible=count>0;mesh.instanceMatrix.needsUpdate=true;if(count){mesh.computeBoundingSphere();mesh.computeBoundingBox();}}
}
