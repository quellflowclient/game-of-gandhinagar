import * as THREE from 'three';

// Bicycle contact points, in the avatar's metre-sized, forward +Z frame.
// Anatomical left is +X on both Rocketbox rigs.
export const CYCLE = {
  saddle: new THREE.Vector3(0,0.9,-0.25),
  pelvis: new THREE.Vector3(0,0.99,-0.23),
  barY:1.14, barZ:0.37, gripX:0.255,
  crankY:0.36, crankRadius:0.165, pedalX:0.14,
};
export function pedalPosition(sign,phase) {
  const angle=phase+(sign<0?Math.PI:0);
  return new THREE.Vector3(sign*CYCLE.pedalX,CYCLE.crankY+Math.cos(angle)*CYCLE.crankRadius,Math.sin(angle)*CYCLE.crankRadius);
}

export function aim(start,end,target) {
  const a=start.getWorldPosition(new THREE.Vector3()),b=end.getWorldPosition(new THREE.Vector3());
  const delta=new THREE.Quaternion().setFromUnitVectors(b.sub(a).normalize(),target.clone().sub(a).normalize());
  const desired=delta.multiply(start.getWorldQuaternion(new THREE.Quaternion()));
  start.quaternion.copy(start.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(desired));
  start.updateWorldMatrix(false,true);
}
export function orient(bone,worldQuaternion) {
  bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQuaternion));
  bone.updateWorldMatrix(false,true);
}
export function solve(start,mid,end,target,hint) {
  const a=start.getWorldPosition(new THREE.Vector3()),b=mid.getWorldPosition(new THREE.Vector3()),c=end.getWorldPosition(new THREE.Vector3());
  const l1=a.distanceTo(b),l2=b.distanceTo(c),dir=target.clone().sub(a);
  const distance=THREE.MathUtils.clamp(dir.length(),Math.abs(l1-l2)+0.001,l1+l2-0.001);dir.normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),across=Math.sqrt(Math.max(0,l1*l1-along*along));
  const bend=hint.clone().addScaledVector(dir,-hint.dot(dir)).normalize();
  aim(start,mid,a.clone().addScaledVector(dir,along).addScaledVector(bend,across));
  aim(mid,end,target);
}

export function createCyclingPose(root,model,bones) {
  const get=name=>bones[`mixamorig${name}`];
  const neutralFeet={};
  root.updateWorldMatrix(true,true);
  const inverseRoot=root.getWorldQuaternion(new THREE.Quaternion()).invert();
  for(const side of ['Left','Right'])neutralFeet[side]=inverseRoot.clone().multiply(get(`${side}Foot`).getWorldQuaternion(new THREE.Quaternion()));
  return {
    apply(phase) {
      // Tilt around the pelvis, then place it above the saddle. Tilting around
      // the model's floor origin pushes a rider forward off the seat.
      model.rotation.x=0.52;
      root.updateWorldMatrix(true,true);
      const hips=root.worldToLocal(get('Hips').getWorldPosition(new THREE.Vector3()));
      model.position.add(CYCLE.pelvis.clone().sub(hips));
      root.updateWorldMatrix(true,true);
      const direction=v=>v.transformDirection(root.matrixWorld);
      const rootQ=root.getWorldQuaternion(new THREE.Quaternion());
      // This rig parents both shoulders to Neck. Correct Head alone before
      // solving contacts; turning Neck afterwards moves the solved arms.
      const gaze=new THREE.Quaternion().setFromAxisAngle(direction(new THREE.Vector3(1,0,0)),-0.36);
      orient(get('Head'),gaze.multiply(get('Head').getWorldQuaternion(new THREE.Quaternion())));
      for(const [side,sign] of [['Left',1],['Right',-1]]) {
        const pedal=pedalPosition(sign,phase);
        // Foot bones are at the ankle; the sole is lower and farther forward.
        const ankle=pedal.clone().add(new THREE.Vector3(0,0.085,-0.065));
        solve(get(`${side}UpLeg`),get(`${side}Leg`),get(`${side}Foot`),root.localToWorld(ankle),direction(new THREE.Vector3(sign*0.12,0,1)));
        orient(get(`${side}Foot`),rootQ.clone().multiply(neutralFeet[side]));
        const wrist=new THREE.Vector3(sign*CYCLE.gripX,CYCLE.barY+0.005,CYCLE.barZ-0.07);
        const hand=get(`${side}Hand`);
        solve(get(`${side}Arm`),get(`${side}ForeArm`),hand,root.localToWorld(wrist),direction(new THREE.Vector3(sign*0.7,-0.35,-0.1)));
        // Put the palm over its own grip, with the fingers curving around it.
        const middle=get(`${side}HandMiddle1`);
        if(middle) {
          const palm=hand.getWorldPosition(new THREE.Vector3()).add(direction(new THREE.Vector3(0,-0.2,1)).multiplyScalar(0.1));
          aim(hand,middle,palm);
          for(const finger of ['Index','Middle','Ring','Pinky'])for(let joint=1;joint<=3;joint++) {
            const bone=get(`${side}Hand${finger}${joint}`),next=bone?.children.find(c=>c.isBone);
            if(!next)continue;
            const d=joint===1?new THREE.Vector3(0,-0.85,0.53):joint===2?new THREE.Vector3(0,-0.65,-0.76):new THREE.Vector3(0,0.2,-1);
            aim(bone,next,bone.getWorldPosition(new THREE.Vector3()).add(direction(d)));
          }
        }
      }
      root.updateWorldMatrix(true,true);
    },
  };
}
