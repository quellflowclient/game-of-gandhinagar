import * as THREE from 'three';
import {solve,orient,aim} from './cycling-pose.js';

export function createActivityPose(root,model,bones) {
  const b=n=>bones[`mixamorig${n}`],feet={};
  root.updateWorldMatrix(true,true);
  const inverse=root.getWorldQuaternion(new THREE.Quaternion()).invert();
  for(const side of ['Left','Right'])feet[side]=inverse.clone().multiply(b(`${side}Foot`).getWorldQuaternion(new THREE.Quaternion()));
  function arm(side,target) {
    const sign=side==='Left'?1:-1,hand=b(`${side}Hand`),middle=b(`${side}HandMiddle1`);
    solve(b(`${side}Arm`),b(`${side}ForeArm`),hand,root.localToWorld(target),new THREE.Vector3(sign*0.7,-0.3,0).transformDirection(root.matrixWorld));
    if(middle)aim(hand,middle,hand.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0,-0.02,0.12).transformDirection(root.matrixWorld)));
  }
  return {apply(kind,t) {
    const seated=['sit','eat','cash','sell'].includes(kind);
    model.rotation.x=kind==='cook'||kind==='tea'?0.12:0;
    root.updateWorldMatrix(true,true);
    if(seated) {
      const hip=root.worldToLocal(b('Hips').getWorldPosition(new THREE.Vector3()));
      model.position.add(new THREE.Vector3(0,0.57,-0.05).sub(hip));root.updateWorldMatrix(true,true);
      const q=root.getWorldQuaternion(new THREE.Quaternion());
      for(const [side,sign] of [['Left',1],['Right',-1]]) {
        solve(b(`${side}UpLeg`),b(`${side}Leg`),b(`${side}Foot`),root.localToWorld(new THREE.Vector3(sign*0.12,0.09,0.43)),new THREE.Vector3(sign*0.1,0,1).transformDirection(root.matrixWorld));
        orient(b(`${side}Foot`),q.clone().multiply(feet[side]));
      }
    }
    const head=root.worldToLocal(b('Head').getWorldPosition(new THREE.Vector3()));
    let left=new THREE.Vector3(0.19,seated?0.88:1.02,0.3),right=new THREE.Vector3(-0.18,seated?0.88:1.02,0.3);
    if(kind==='cook'){right.set(-0.13+Math.sin(t*2.5)*0.09,1.0,0.37+Math.cos(t*2.5)*0.065);left.set(0.22,0.97,0.3);}
    if(kind==='tea'){right.set(-0.14,1.06+Math.sin(t*1.8)*0.07,0.32);left.set(0.16,0.99,0.32);}
    if(kind==='serve'){left.set(0.15,1.02,0.35);right.set(-0.15,1.02,0.35);}
    if(kind==='cash'){right.set(-0.12,0.91+Math.sin(t*2)*0.025,0.38);left.set(0.16,0.86,0.28);}
    if(kind==='eat'||kind==='eat-standing'){const bite=(t%7)>4;right=bite?head.clone().add(new THREE.Vector3(-0.06,-0.12,0.13)):new THREE.Vector3(-0.12,seated?0.88:1.04,0.35);left.set(0.15,seated?0.84:1.03,0.34);}
    if(kind==='carry'){left.set(0.29,1.0,0.38);right.set(-0.29,1.0,0.38);}
    if(kind==='smoke'){right=(t%9)<3?head.clone().add(new THREE.Vector3(-0.07,-0.13,0.14)):new THREE.Vector3(-0.23,0.99,0.15);left.set(0.16,0.98,0.12);}
    if(kind==='rub'){const phase=t%14;if(phase<9){left.set(0.025,1.03,0.29);right.set(-0.025,1.06,0.29+Math.sin(t*12)*0.035);}else if(phase<11){left.set(0.1,1.04,0.3);right.set(-0.1,1.05,0.32);}else{right=head.clone().add(new THREE.Vector3(-0.05,-0.12,0.14));left.set(0.16,1.04,0.3);}}
    if(kind==='stern'){left.set(-0.08,1.16,0.17);right.set(0.08,1.12,0.19);}
    arm('Left',left);arm('Right',right);root.updateWorldMatrix(true,true);
  }};
}
