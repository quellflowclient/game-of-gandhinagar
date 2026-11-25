import * as THREE from 'three';
import { createTrafficSimulation,roadPose } from './traffic-routes.js';
import { createVehicleModel } from './vehicle-models.js';
import {damageVehicle} from './vehicle-damage.js';
import {overlaps} from './collision.js';

export function createTraffic(scene,map,{count=40,zones=[]}={}) {
  const simulation=createTrafficSimulation(map,zones,{count});
  const palette=[0xe8e5db,0xa6b0b6,0x374b5c,0x743c36,0x33586d,0x565c60,0x242a2b,0xb6aea0];
  const models=new Map(),entries=new Map();
  const hidden=new THREE.Matrix4().makeScale(0,0,0);
  for(const type of new Set(simulation.vehicles.map(v=>v.type))) {
    const members=simulation.vehicles.filter(v=>v.type===type),model=createVehicleModel(type),instances=[];
    for(const part of model.parts) {
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,members.length);
      mesh.name=`Road traffic ${type}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
      mesh.userData.paint=part.paint;
      members.forEach((vehicle,i)=>{mesh.setMatrixAt(i,hidden);if(part.paint)mesh.setColorAt(i,new THREE.Color(type==='auto'?0x58714b:type==='bus'?0x52776d:palette[vehicle.id%palette.length]));});
      scene.add(mesh);instances.push(mesh);
    }
    members.forEach((v,i)=>entries.set(v.id,{i,instances}));models.set(type,model);
  }
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(1,1,1);
  function update(dt,center) {
    simulation.update(dt,center);
    render();
  }
  function render() {
    for(const v of simulation.vehicles) {
      const {i,instances}=entries.get(v.id);
      if(v.damageRoot&&(!v.pose||(v.damageLast&&Math.hypot(v.pose.x-v.damageLast.x,v.pose.z-v.damageLast.z)>25))){scene.remove(v.damageRoot);v.damageRoot.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});v.damageRoot=null;}
      if(v.pose&&v.damageRoot){v.damageRoot.position.set(v.pose.x,v.pose.y,v.pose.z);v.damageRoot.rotation.y=v.pose.yaw;v.damageRoot.rotation.z=v.crashTime>20?Math.sin(v.crashTime*35)*.025*Math.min(1,(v.crashTime-20)/4):0;v.damageLast={...v.pose};matrix.copy(hidden);}
      else if(v.pose){position.set(v.pose.x,v.pose.y,v.pose.z);rotation.setFromAxisAngle(up,v.pose.yaw);matrix.compose(position,rotation,scale);}
      else matrix.copy(hidden);
      for(const mesh of instances)mesh.setMatrixAt(i,matrix);
      const damaged=(v.crashTime||0)>0;
      if(damaged!==v.damageRendered){v.damageRendered=damaged;for(const mesh of instances)if(mesh.userData.paint){mesh.setColorAt(i,new THREE.Color(damaged?0x59534e:v.type==='auto'?0x58714b:v.type==='bus'?0x52776d:palette[v.id%palette.length]));mesh.instanceColor.needsUpdate=true;}}
    }
    for(const {instances} of entries.values())for(const mesh of instances)mesh.instanceMatrix.needsUpdate=true;
  }
  return {update,render,
    hold(id,seconds=24){const v=simulation.vehicles.find(v=>v.id===id);if(v){v.crashTime=seconds;v.speed=0;}},
    resume(id,delay=0){const v=simulation.vehicles.find(v=>v.id===id);if(v){v.crashTime=delay;v.resumeOnExpiry=delay>0;v.speed=0;}},
    backAway(id,distance){const v=simulation.vehicles.find(v=>v.id===id);if(!v?.route)return;const s=v.s-v.direction*distance,p=roadPose(v.route,s,v.direction,v,zones);if(p&&!simulation.vehicles.some(o=>o!==v&&o.pose&&overlaps({...p,width:v.width,length:v.length},{...o.pose,width:o.width,length:o.length}))){v.s=s;v.pose=p;}},
    damage(id,severity=1){const v=simulation.vehicles.find(v=>v.id===id);if(!v||v.damageRoot)return;const root=new THREE.Group(),model=createVehicleModel(v.type);for(const p of model.parts){const mesh=new THREE.Mesh(p.geometry,p.material);if(p.paint)p.material.color.setHex(v.type==='auto'?0x58714b:palette[v.id%palette.length]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}damageVehicle(root,severity);scene.add(root);v.damageRoot=root;v.damageLast=v.pose?{...v.pose}:null;},
    stop(id,pose){const v=simulation.vehicles.find(v=>v.id===id);if(!v)return;v.pose={...pose};v.speed=0;v.crashTime=Math.max(v.crashTime||0,6);},
    setNight(on){for(const model of models.values())model.setNight(on);},
    get stats(){return {active:simulation.vehicles.filter(v=>v.pose).length,insideCompounds:simulation.vehicles.filter(v=>v.pose&&zones.some(z=>z.forbidsVehicles?.(v.pose.x,v.pose.z))).length};},
    get vehicles(){return simulation.vehicles;},
  };
}
