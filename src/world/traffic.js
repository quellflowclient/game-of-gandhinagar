import * as THREE from 'three';
import { createTrafficSimulation,roadPose } from './traffic-routes.js';
import { createVehicleModel } from './vehicle-models.js';
import {damageVehicle} from './vehicle-damage.js';
import {overlaps} from './collision.js';
import {createDrivingSurface} from './driving.js';

export function createTraffic(scene,map,{count=40,zones=[]}={}) {
  const simulation=createTrafficSimulation(map,zones,{count}),surface=createDrivingSurface(map.roads,zones);
  const palette=[0xe8e5db,0xa6b0b6,0x374b5c,0x743c36,0x33586d,0x565c60,0x242a2b,0xb6aea0];
  const models=new Map(),entries=new Map();
  const hidden=new THREE.Matrix4().makeScale(0,0,0);
  for(const type of new Set(simulation.vehicles.map(v=>v.type))) {
    const members=simulation.vehicles.filter(v=>v.type===type),model=createVehicleModel(type),instances=[];
    for(const part of model.parts) {
      const mesh=new THREE.InstancedMesh(part.geometry,part.material,members.length);
      mesh.name=`Road traffic ${type}`;mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
      mesh.userData.paint=part.paint;
      members.forEach((vehicle,i)=>{mesh.setMatrixAt(i,hidden);if(part.paint)mesh.setColorAt(i,new THREE.Color(type==='auto'?0x2f7a3c:type==='bus'?0xd6a21e:palette[vehicle.id%palette.length]));});
      scene.add(mesh);instances.push(mesh);
    }
    members.forEach((v,i)=>entries.set(v.id,{i,instances}));models.set(type,model);
  }
  const instanceMeshes=[...new Set([...entries.values()].flatMap(e=>e.instances))];
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),position=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),scale=new THREE.Vector3(1,1,1);
  function update(dt,center,options) {
    simulation.update(dt,center,options);
    if(!options?.deferRender)render();
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
      if(damaged!==v.damageRendered){v.damageRendered=damaged;for(const mesh of instances)if(mesh.userData.paint){mesh.setColorAt(i,new THREE.Color(damaged?0x59534e:v.type==='auto'?0x2f7a3c:v.type==='bus'?0xd6a21e:palette[v.id%palette.length]));mesh.instanceColor.needsUpdate=true;}}
    }
    for(const mesh of instanceMeshes)mesh.instanceMatrix.needsUpdate=true;
  }
  return {update,render,
    recover(id){const v=simulation.vehicles.find(v=>v.id===id);if(!v?.pose)return;
      // Stay visible, straighten back into the lane, then pull away gently.
      v.departure={from:{...v.pose},t:0};v.crashMotion=null;v.crashTime=0;v.resumeOnExpiry=false;v.speed=0;v.departureSlow=3;
    },
    hold(id,seconds=24){const v=simulation.vehicles.find(v=>v.id===id);if(v){v.crashTime=seconds;v.resumeOnExpiry=true;v.speed=0;}},
    impact(id,hit){const v=simulation.vehicles.find(v=>v.id===id);if(!v?.pose)return;
      const from={...v.pose},dx=from.x-hit.x,dz=from.z-hit.z,len=Math.hypot(dx,dz)||1;
      let to={...from};
      const sign=(Math.sin(from.yaw)*dz-Math.cos(from.yaw)*dx)>=0?1:-1;
      for(const factor of [1,.65,.3]){
        const distance=Math.min(1.25,.35+hit.speed*.055)*factor,yaw=from.yaw+sign*Math.min(.42,.15+hit.speed*.013)*factor;
        const q=surface.pose(from.x+dx/len*distance,from.z+dz/len*distance,yaw,v.type==='auto'?'auto':v.type==='bike'?'bike':v.type==='scooter'?'scooter':'car');
        if(q){to={...q};break;}
      }
      v.crashMotion={from,to,t:0};v.resumeOnExpiry=true;
    },
    resume(id,delay=0){const v=simulation.vehicles.find(v=>v.id===id);if(v){v.crashTime=delay;v.resumeOnExpiry=delay>0;v.speed=0;}},
    backAway(id,distance){const v=simulation.vehicles.find(v=>v.id===id);if(!v?.route)return;const s=v.s-v.direction*distance,p=roadPose(v.route,s,v.direction,v,zones);if(p&&!simulation.vehicles.some(o=>o!==v&&o.pose&&overlaps({...p,width:v.width,length:v.length},{...o.pose,width:o.width,length:o.length}))){v.s=s;v.pose=p;}},
    damage(id,severity=1){const v=simulation.vehicles.find(v=>v.id===id);if(!v||v.damageRoot)return;const root=new THREE.Group(),model=createVehicleModel(v.type);for(const p of model.parts){const mesh=new THREE.Mesh(p.geometry,p.material);if(p.paint)p.material.color.setHex(v.type==='auto'?0x2f7a3c:v.type==='bus'?0xd6a21e:palette[v.id%palette.length]);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);}damageVehicle(root,severity);scene.add(root);v.damageRoot=root;v.damageLast=v.pose?{...v.pose}:null;},
    stop(id,pose){const v=simulation.vehicles.find(v=>v.id===id);if(!v)return;v.pose={...pose};v.speed=0;if(!(v.crashTime>0)){v.crashTime=.8;v.resumeOnExpiry=true;}},
    setNight(on){for(const model of models.values())model.setNight(on);},
    get stats(){return {active:simulation.vehicles.filter(v=>v.pose).length,insideCompounds:simulation.vehicles.filter(v=>v.pose&&zones.some(z=>z.forbidsVehicles?.(v.pose.x,v.pose.z))).length};},
    get vehicles(){return simulation.vehicles;},
  };
}
