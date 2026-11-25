import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {createSoleContact} from '../src/world/sole-contact.js';
globalThis.ProgressEvent??=class{constructor(type,props){Object.assign(this,props);this.type=type;}};
let checks=0;
for(const gender of ['male','female']){
 const b=await fs.readFile(new URL(`../public/models/humans/${gender}.glb`,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n);
 j.materials=j.materials.map(()=>({}));delete j.images;delete j.textures;delete j.samplers;j.buffers=[{byteLength:bin.length,uri:`data:application/octet-stream;base64,${bin.toString('base64')}`}];
 for(const outfit of ['casual','formal']){
  const gltf=await new GLTFLoader().parseAsync(JSON.stringify(j),''),model=gltf.scene,root=new THREE.Group();root.add(model);
  const shown=new Set(outfit==='formal'?['Body','Hair','Outfit_formal','Skin_formal']:['Body','Hair','Top_tee','Skin_tee','Trousers','Shoes']);model.traverse(o=>{if(o.isMesh)o.visible=shown.has(o.name);});
  const mixer=new THREE.AnimationMixer(model),idle=mixer.clipAction(gltf.animations.find(c=>c.name==='Idle'));idle.play();mixer.update(0);
  const box=new THREE.Box3().setFromObject(model,true),scale=(gender==='male'?1.76:1.66)/(box.max.y-box.min.y);model.scale.multiplyScalar(scale);model.position.y-=box.min.y*scale;const base=model.position.clone(),sole=createSoleContact(root,model);assert.ok(sole.count>5);
  for(const clip of ['Idle','Walk','Wave']){mixer.stopAllAction();mixer.clipAction(gltf.animations.find(c=>c.name===clip)).play();for(const yaw of [0,1.04,2.6])for(let t=0;t<45;t++){
   root.position.set(-600,.36,-4900);root.rotation.y=yaw;mixer.update(.037);model.position.copy(base);sole.plant();const y=sole.minimum();assert.ok(Math.abs(y-.006)<.002,`${gender}/${outfit}/${clip} sole ${y}`);checks++;
  }}
 }
}
console.log(`Grounding passed: ${checks} actual shoe-sole checks on male/female casual/formal idle, walking and waving poses.`);
