import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { lookById, CHARACTERS } from '../data/content.js';
import { CYCLE, pedalPosition, createCyclingPose,orient } from './cycling-pose.js';
import { createActivityPose } from './activity-pose.js';
import {createSoleContact} from './sole-contact.js';

// Local, licensed Rocketbox people: textured faces/clothes and gender-specific
// captured idle/walk/wave clips, cloned with independent skeletons and mixers.
const templates=new Map();
let loading;
export function preloadAvatarAssets(onProgress) {
  if(!loading) {
    const loader=new GLTFLoader(),bytes={male:[0,4371592],female:[0,6326132]};
    const report=()=>{const done=bytes.male[0]+bytes.female[0],total=bytes.male[1]+bytes.female[1];onProgress?.(Math.min(1,done/total));};
    loading=Promise.all(['male','female'].map(async gender=>{
      const gltf=await loader.loadAsync(`/models/humans/${gender}.glb`,e=>{bytes[gender]=[e.loaded,e.total||bytes[gender][1]];report();});
      for(const clip of gltf.animations) for(const track of clip.tracks) {
        if(/Hips\.position$/.test(track.name)) {
          // Captured walks contain root motion. Navigation owns translation;
          // retain the vertical weight shift but keep the feet inside its capsule.
          for(let i=0;i<track.values.length;i+=3){track.values[i]=0;track.values[i+2]=0;}
        }
      }
      templates.set(gender,gltf);
    }));
  }
  return loading;
}

const bikeMat={frame:new THREE.MeshStandardMaterial({color:0x813b31,metalness:0.65,roughness:0.32}),
  tyre:new THREE.MeshStandardMaterial({color:0x171918,roughness:0.88}),
  metal:new THREE.MeshStandardMaterial({color:0x9da5a4,metalness:0.85,roughness:0.24})};
export function bicycle() {
  const g=new THREE.Group(),wheels=[],pedals=[],cranks=[];
  const tube=(a,b,r,m)=>{const x=new THREE.Vector3(...a),y=new THREE.Vector3(...b),d=y.clone().sub(x);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),8),m);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());mesh.position.copy(x.add(y).multiplyScalar(0.5));g.add(mesh);};
  for(const z of [-0.57,0.57]) {
    const w=new THREE.Group();w.position.set(0,0.35,z);
    const tyre=new THREE.Mesh(new THREE.TorusGeometry(0.32,0.026,9,36),bikeMat.tyre);tyre.rotation.y=Math.PI/2;w.add(tyre);
    const rim=new THREE.Mesh(new THREE.TorusGeometry(0.29,0.009,5,36),bikeMat.metal);rim.rotation.y=Math.PI/2;w.add(rim);
    for(let i=0;i<12;i++) {const a=i*Math.PI/6;const spoke=new THREE.Mesh(new THREE.CylinderGeometry(0.002,0.002,0.59,3),bikeMat.metal);spoke.rotation.x=a;w.add(spoke);}
    g.add(w);wheels.push(w);
  }
  const axle=[0,0.36,0],seat=[0,0.86,-0.25],stem=[0,0.94,0.44],front=[0,0.34,0.57],rear=[0,0.34,-0.57];
  for(const [a,b] of [[rear,seat],[seat,axle],[axle,rear],[seat,stem],[axle,stem],[stem,front]])tube(a,b,0.022,bikeMat.frame);
  tube(stem,[0,CYCLE.barY,CYCLE.barZ],0.022,bikeMat.metal);
  tube([-0.29,CYCLE.barY,CYCLE.barZ],[0.29,CYCLE.barY,CYCLE.barZ],0.016,bikeMat.metal);
  for(const sign of [-1,1]) {
    tube([sign*0.21,CYCLE.barY,CYCLE.barZ],[sign*0.29,CYCLE.barY,CYCLE.barZ],0.023,bikeMat.tyre);
    const crank=new THREE.Mesh(new THREE.CylinderGeometry(0.012,0.012,CYCLE.crankRadius,8),bikeMat.metal);
    const pedal=new THREE.Mesh(new THREE.BoxGeometry(0.115,0.025,0.09),bikeMat.tyre);
    cranks.push({mesh:crank,sign});pedals.push({mesh:pedal,sign});g.add(crank,pedal);
  }
  const saddle=new THREE.Mesh(new THREE.SphereGeometry(0.11,12,8),bikeMat.tyre);saddle.scale.set(0.8,0.25,1.5);saddle.position.set(0,0.9,-0.25);g.add(saddle);
  g.traverse(o=>{if(o.isMesh)o.castShadow=true;});Object.assign(g.userData,{wheels,pedals,cranks});return g;
}

export function createAvatar(lookId,skin=0xa86b47) {
  const look=lookById(lookId);
  const gender=CHARACTERS.female.some(c=>c.id===look.id)?'female':'male';
  const template=templates.get(gender);
  if(!template)throw new Error('Human assets must be preloaded before creating an avatar');
  const root=new THREE.Group(),model=cloneSkeleton(template.scene);root.add(model);
  root.userData.gender=gender;root.userData.asset='Rocketbox';
  const meshes=[],materials=[];
  const formal=['business','suit','jacket','dress'].includes(look.id);
  const shirt=['hoodie','worker','adventurer','punk'].includes(look.id);
  const outfit=formal?'formal':shirt?'shirt':'tee';
  const shown=new Set(outfit==='formal'?['Body','Hair','Outfit_formal','Skin_formal']:['Body','Hair',`Top_${outfit}`,`Skin_${outfit}`,'Trousers','Shoes']);
  model.traverse(o=>{
    if(!o.isMesh)return;
    o.visible=shown.has(o.name);o.frustumCulled=false;o.castShadow=true;o.receiveShadow=true;
    o.material=o.material.clone();materials.push(o.material);meshes.push(o);
    o.material.metalness=0;
    if(o.name==='Hair'){o.material.transparent=false;o.material.alphaTest=0.42;o.material.side=THREE.DoubleSide;o.material.roughness=0.87;}
    if(/^Top_/.test(o.name))o.material.color.setHex(look.top);
    if(o.name==='Trousers')o.material.color.setHex(look.bottom);
    if(/^Body$|^Skin_/.test(o.name)){
      const tint=new THREE.Color(skin),base=new THREE.Color(0xc58c63);
      o.material.color.setRGB(Math.min(1.35,Math.pow(tint.r/base.r,0.35)),Math.min(1.35,Math.pow(tint.g/base.g,0.35)),Math.min(1.35,Math.pow(tint.b/base.b,0.35)));
      o.material.roughness=Math.max(0.48,o.material.roughness);
    }
  });
  const mixer=new THREE.AnimationMixer(model),actions=Object.fromEntries(template.animations.map(c=>[c.name,mixer.clipAction(c)]));
  let current='Idle';actions.Idle.play();mixer.update(0);model.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(model,true),height=bounds.max.y-bounds.min.y;
  const scale=(gender==='male'?1.76:1.66)/height;model.scale.multiplyScalar(scale);model.position.y-=bounds.min.y*scale;
  const basePosition=model.position.clone();
  const bones={};model.traverse(o=>{if(o.isBone)bones[o.name.replaceAll(':','')]=o;});
  const sole=createSoleContact(root,model);
  const cyclePose=createCyclingPose(root,model,bones);
  const activityPose=createActivityPose(root,model,bones);
  let activity=null,activityBlend=1,exitActivity=null,exitBlend=0;
  const boneList=Object.values(bones),seated=k=>['sit','eat','cash','sell','ground-sit'].includes(k);
  let bike=null,cycling=false,waveT=0,time=Math.random()*4,shadow=true,cyclePhase=0,gestureT=0,gestureKind='yes',hitT=0;
  let fallen=null,motorcycle=false;
  const floorBones=['Hips','Spine','Spine2','Head','LeftHand','RightHand','LeftFoot','RightFoot','LeftLeg','RightLeg'].map(n=>bones[`mixamorig${n}`]).filter(Boolean),floorPoint=new THREE.Vector3();
  function play(name){if(name===current)return;actions[current]?.fadeOut(0.22);actions[name].reset().fadeIn(0.22).play();current=name;}
  return {root,look,gender,get soleHeight(){return sole.minimum();},
    setActivity(kind){if(kind===activity)return;if(!kind&&activity){exitActivity=activity;exitBlend=1;}if(kind&&!(seated(kind)&&seated(activity)))activityBlend=0;activity=kind;},
    setFirstPerson(on){for(const mesh of meshes)if(mesh.name==='Body'||mesh.name==='Hair')mesh.visible=!on;},
    socket(name){root.updateWorldMatrix(true,true);return root.worldToLocal(bones[`mixamorig${name}`].getWorldPosition(new THREE.Vector3()));},
    setBuild(k=1){model.scale.x*=k;model.scale.z*=k;},
    setOlder(){for(const mesh of meshes)if(mesh.name==='Hair')mesh.material.color.setHex(0xb8b6aa);},
    setClothes(top,bottom=0x39444c){for(const mesh of meshes){if(/^Top_/.test(mesh.name))mesh.material.color.setHex(top);if(mesh.name==='Trousers')mesh.material.color.setHex(bottom);}},
    setShadow(on){if(on===shadow)return;shadow=on;for(const mesh of meshes)mesh.castShadow=on;},
    setCycling(on){cycling=on;if(on&&!bike){bike=bicycle();root.add(bike);}if(bike)bike.visible=on;},
    setMotorcycle(on){motorcycle=on;cycling=on;if(on&&!bike){bike=bicycle();root.add(bike);}if(bike)bike.visible=cycling&&!motorcycle;},
    wave(){waveT=actions.Wave.getClip().duration;play('Wave');},
    hit(){hitT=2.4;waveT=0;},
    setFall(tilt=null,height=0){fallen=tilt===null?null:{tilt,height};if(fallen){hitT=0;waveT=0;}},
    cloneCycle(){if(!bike)return null;const copy=bike.clone(true);copy.visible=true;return copy;},
    gesture(kind){gestureKind=kind;gestureT=2.2;},
    update(dt,speed){
      time+=dt;waveT=Math.max(0,waveT-dt);
      play(waveT>0?'Wave':!cycling&&speed>0.12?'Walk':'Idle');
      actions.Walk.setEffectiveTimeScale(Math.min(2.2,Math.max(0.4,speed/1.5)));
      mixer.update(dt);model.position.copy(basePosition);model.rotation.x=0;model.rotation.z=0;
      for(const mesh of meshes)if(mesh.visible&&mesh.morphTargetDictionary){
        const pulse=time%4.7,blink=pulse<0.15?Math.sin(pulse/0.15*Math.PI):0;
        for(const name of ['eyeBlinkLeft','eyeBlinkRight']){const i=mesh.morphTargetDictionary[name];if(i!=null)mesh.morphTargetInfluences[i]=blink;}
      }
      if(cycling){
        // Stopped riders hold their pedals still; cadence follows travel speed.
        if(!motorcycle)cyclePhase+=dt*speed/1.7;else cyclePhase=0;
        cyclePose.apply(cyclePhase);
        for(const {mesh,sign} of bike.userData.pedals)mesh.position.copy(pedalPosition(sign,cyclePhase));
        for(const {mesh,sign} of bike.userData.cranks) {
          const axle=new THREE.Vector3(sign*CYCLE.pedalX,CYCLE.crankY,0),pedal=pedalPosition(sign,cyclePhase);
          mesh.position.copy(axle.clone().add(pedal).multiplyScalar(0.5));
          mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),pedal.sub(axle).normalize());
        }
        for(const wheel of bike.userData.wheels)wheel.rotation.x+=dt*speed/0.32;
      }
      else if(activity||exitBlend>0){
        activityBlend=Math.min(1,activityBlend+dt*4);exitBlend=Math.max(0,exitBlend-dt*4);
        const weight=activity?activityBlend:exitBlend,base=weight<1?boneList.map(b=>b.quaternion.clone()):null;
        activityPose.apply(activity||exitActivity,time);
        if(base){for(let i=0;i<boneList.length;i++)boneList[i].quaternion.copy(base[i].slerp(boneList[i].quaternion,weight));model.position.lerp(basePosition,1-weight);model.rotation.x*=weight;root.updateWorldMatrix(true,true);}
      }
      if(hitT>0){hitT=Math.max(0,hitT-dt);const f=Math.min(1,hitT/1.2);model.rotation.x=.32*f;model.rotation.z=Math.sin((2.4-hitT)*8)*.12*f;}
      if(fallen){
        model.rotation.x=-fallen.tilt;model.rotation.z=Math.sin(fallen.tilt)*.1;
        root.updateWorldMatrix(true,true);let low=Infinity;
        for(const bone of floorBones){bone.getWorldPosition(floorPoint);root.worldToLocal(floorPoint);low=Math.min(low,floorPoint.y-(bone.name.includes('Head')?.14:.085));}
        if(Number.isFinite(low))model.position.y+=Math.max(0,.025-low)+fallen.height;
      }
      if(!fallen&&!cycling&&!seated(activity)&&!(exitBlend>0&&seated(exitActivity))) {
        // Captured clips have vertical root motion. Keep the lowest planted
        // foot at the rendered surface instead of letting both soles sink.
        sole.plant();
      }
      if(gestureT>0){gestureT=Math.max(0,gestureT-dt);root.updateWorldMatrix(true,true);const axis=new THREE.Vector3(gestureKind==='yes'?1:0,gestureKind==='no'?1:0,0).transformDirection(root.matrixWorld),q=new THREE.Quaternion().setFromAxisAngle(axis,Math.sin(gestureT*9)*0.16);orient(bones.mixamorigHead,q.multiply(bones.mixamorigHead.getWorldQuaternion(new THREE.Quaternion())));}
    },
    dispose(){mixer.stopAllAction();mixer.uncacheRoot(model);for(const material of materials)material.dispose();if(bike)bike.traverse(o=>o.geometry?.dispose());},
  };
}
