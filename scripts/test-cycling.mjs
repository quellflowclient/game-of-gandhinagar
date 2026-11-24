import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import * as THREE from 'three';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {CYCLE,pedalPosition,createCyclingPose} from '../src/world/cycling-pose.js';

// Load the actual shipped skeletons/animations, omitting GPU-only image assets.
globalThis.ProgressEvent ??= class {constructor(type,props){Object.assign(this,props);this.type=type;}};
async function rig(gender) {
  const b=await fs.readFile(new URL(`../public/models/humans/${gender}.glb`,import.meta.url));
  const length=b.readUInt32LE(12),json=JSON.parse(b.subarray(20,20+length).toString()),bin=b.subarray(28+length);
  for(const m of json.materials??[]) {
    delete m.normalTexture;delete m.emissiveTexture;delete m.occlusionTexture;
    if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}
  }
  delete json.images;delete json.textures;delete json.samplers;
  json.buffers=[{byteLength:bin.length,uri:`data:application/octet-stream;base64,${bin.toString('base64')}`}];
  return new GLTFLoader().parseAsync(JSON.stringify(json),'');
}
let contacts=0;
for(const gender of ['male','female']) {
  const gltf=await rig(gender),model=gltf.scene,root=new THREE.Group();root.add(model);
  const mixer=new THREE.AnimationMixer(model);mixer.clipAction(gltf.animations.find(c=>c.name==='Idle')).play();mixer.update(0);model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model,true),scale=(gender==='male'?1.76:1.66)/(bounds.max.y-bounds.min.y);
  model.scale.multiplyScalar(scale);model.position.y-=bounds.min.y*scale;
  const base=model.position.clone(),bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replaceAll(':','')]=o;});
  const pose=createCyclingPose(root,model,bones);
  const local=name=>root.worldToLocal(bones[`mixamorig${name}`].getWorldPosition(new THREE.Vector3()));
  for(const yaw of [0,1.04,Math.PI,-2.4]) {
    root.rotation.y=yaw;root.position.set(-1410.5,12.5,-4203.8);
    for(let i=0;i<180;i++) {
      mixer.update(1/60);model.position.copy(base);model.rotation.x=0;
      const phase=i*Math.PI*2/90;pose.apply(phase);
      assert.ok(local('Hips').distanceTo(CYCLE.pelvis)<0.001,`${gender}: pelvis must stay on saddle`);
      for(const [side,sign] of [['Left',1],['Right',-1]]) {
        const hand=local(`${side}Hand`),elbow=local(`${side}ForeArm`),knee=local(`${side}Leg`),foot=local(`${side}Foot`);
        const wrist=new THREE.Vector3(sign*CYCLE.gripX,CYCLE.barY+0.005,CYCLE.barZ-0.07);
        const ankle=pedalPosition(sign,phase).add(new THREE.Vector3(0,0.085,-0.065));
        assert.ok(hand.distanceTo(wrist)<0.008,`${gender} ${side}: hand off grip ${hand.distanceTo(wrist)}, hand ${hand.toArray()}, elbow ${elbow.toArray()}`);
        assert.ok(foot.distanceTo(ankle)<0.008,`${gender} ${side}: foot off pedal ${foot.distanceTo(ankle)}`);
        assert.ok(sign*hand.x>0.2&&sign*elbow.x>0.1,`${gender} ${side}: crossed arm`);
        assert.ok(sign*knee.x>0.03&&knee.z>CYCLE.pelvis.z+0.02,`${gender} ${side}: knee must bend forward on its own side ${knee.toArray()}`);
        contacts+=2;
      }
    }
  }
  console.log(`${gender}: saddle, hands, feet and limb sides stable across two revolutions and four headings`);
}
console.log(`${contacts} contact checks passed on the shipped male/female rigs.`);
