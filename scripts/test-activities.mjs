import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createActivityPose} from '../src/world/activity-pose.js';
globalThis.ProgressEvent??=class{constructor(type,props){Object.assign(this,props);this.type=type;}};
async function rig(gender){
 const data=await fs.readFile(new URL(`../public/models/humans/${gender}.glb`,import.meta.url)),n=data.readUInt32LE(12),j=JSON.parse(data.subarray(20,20+n).toString()),bin=data.subarray(28+n);
 for(const m of j.materials||[]){delete m.normalTexture;delete m.emissiveTexture;delete m.occlusionTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
 delete j.images;delete j.textures;delete j.samplers;j.buffers=[{byteLength:bin.length,uri:`data:application/octet-stream;base64,${bin.toString('base64')}`}];return new GLTFLoader().parseAsync(JSON.stringify(j),'');
}
let poses=0;
for(const gender of ['male','female']) {
 const gltf=await rig(gender),model=gltf.scene,root=new THREE.Group();root.add(model);const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')).play();mixer.update(0);model.updateMatrixWorld(true);
 const bounds=new THREE.Box3().setFromObject(model,true),scale=(gender==='male'?1.76:1.66)/(bounds.max.y-bounds.min.y);model.scale.multiplyScalar(scale);model.position.y-=bounds.min.y*scale;
 const base=model.position.clone(),bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replaceAll(':','')]=o;});
 const activity=createActivityPose(root,model,bones),local=n=>root.worldToLocal(bones[`mixamorig${n}`].getWorldPosition(new THREE.Vector3()));
 for(const yaw of [0,Math.PI*5/6,-1.4])for(const role of ['sit','eat','cash','sell','cook','tea','serve','smoke','rub','stern','carry','pay','eat-standing'])for(let i=0;i<25;i++){
  root.position.set(-607,0.04,-4897);root.rotation.y=yaw;mixer.update(1/30);model.position.copy(base);model.rotation.x=0;activity.apply(role,i*0.57);
  for(const bone of Object.values(bones))assert.ok(bone.matrixWorld.elements.every(Number.isFinite),`${gender}/${role} finite joints`);
  if(['sit','eat','cash','sell'].includes(role)) {
    assert.ok(Math.abs(local('Hips').y-0.57)<0.002,`${gender}/${role} pelvis at sitting-table height`);
    for(const side of ['Left','Right'])assert.ok(Math.abs(local(`${side}Foot`).y-0.09)<0.009,`${gender}/${role} feet stay on ground`);
  }
  if(['cook','tea','serve','carry'].includes(role)){
    assert.ok(local('LeftHand').x>0&&local('RightHand').x<0,`${gender}/${role} hands on their own side`);
    assert.ok(local('LeftHand').z>0.1&&local('RightHand').z>0.1,`${gender}/${role} work in front of torso`);
  }
  poses++;
 }
}
console.log(`Activities passed: ${poses} actual male/female rig poses, seated pelvis/feet, cooking/serving/carrying hands and finite joints.`);
