import {CONTENT} from '../systems/game-content.js';
import * as THREE from "three";
import { createAvatar } from "./avatar.js";
import {cameraMode as modeDefinition} from './camera-modes.js';
import {VEHICLES,drivingSpeed} from './driving.js';
import {createVehicleModel} from './vehicle-models.js';
import {damageVehicle} from './vehicle-damage.js';
import {createRideTwoWheeler} from './parked-models.js';

// Player character, keyboard and touch input, and the third-person follow camera.
// Desktop: WASD / arrows to walk, drag to look, Shift to run, C to toggle the cycle.
// Phone: left thumb joystick to walk, drag anywhere else to look.
export function createPlayer({ scene, camera, dom, joystickEl, bounds, navigation, cameraObstacles = [],driving,playArea }) {
  let avatar = createAvatar("casual");
  scene.add(avatar.root);
  const pos = new THREE.Vector3(); // Ground position used by navigation.
  const airbornePosition=new THREE.Vector3();let jumpHeight=0,jumpVelocity=0;

  let yaw = Math.PI;      // camera yaw around the player
  let pitch = 0.32;       // camera pitch
  let heading = Math.PI;  // direction the character faces
  let cycling = false;
  let vehicle='walk',vehicleRoot=null,vehicleModel=null,driveSpeed=0,areaLocked=false,steeringNow=0,lastLookAt=0;
  let helmetMesh=null,mountT=2,mountFrom=null,gesture=null,gestureTime=0,sittingGround=false;
  const withinArea=(x,z)=>!areaLocked||playArea(x,z);
  function removeVehicle(){if(vehicleRoot){scene.remove(vehicleRoot);vehicleRoot.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}vehicleRoot=null;vehicleModel=null;driveSpeed=0;}
  function setVehicle(type){
    if(jumpHeight>0)return{error:'Pehle zameen par land hone do.'};
    if(crashed)return{error:'Accident ke baad pehle safe jagah recover karo.'};
    if(!(type in VEHICLES))return{error:'Unknown vehicle'};
    if(sitting||carrying)return{error:'Pehle table se utho ya table rakh do.'};
    if(type===vehicle)return{ok:true};
    if(['car','auto','bike','scooter'].includes(type)){
      const two=['bike','scooter'].includes(type);
      if(!two&&navigation?.zones.some(z=>z.id==='ldrp-campus'&&z.contains(pos.x,pos.z)))return{error:'Guard: Gaadi bahar parking ma muki ne aavo. Campus mein car/auto allowed nahi.'};
      const pose=driving?.nearest(pos.x,pos.z,heading,type,two?6:14);
      if(!pose||!withinArea(pose.x,pose.z))return{error:'Car/auto ke liye public road ke paas jao (14 m ke andar).'};
      mountFrom=pos.clone();mountT=two?0:2;removeVehicle();vehicle=type;cycling=false;avatar.setCycling(false);avatar.setMotorcycle(false);avatar.root.visible=two;
      if(two){vehicleRoot=createRideTwoWheeler(type);vehicleModel=null;}
      else{vehicleModel=createVehicleModel(type==='car'?'premium':'auto');vehicleRoot=new THREE.Group();for(const p of vehicleModel.parts){const mesh=new THREE.Mesh(p.geometry,p.material);if(p.paint)p.material.color.setHex(type==='car'?0x233341:0x36764e);mesh.castShadow=mesh.receiveShadow=true;vehicleRoot.add(mesh);}}
      vehicleRoot.name=`Player ${type}`;scene.add(vehicleRoot);
      pos.set(pose.x,pose.y,pose.z);heading=pose.yaw;yaw=heading+Math.PI;steeringNow=0;speedNow=0;return{ok:true};
    }
    if(vehicleRoot){
      let exit=null;
      for(const side of [-1,1]){const offset=['bike','scooter'].includes(vehicle)?.9:1.9,x=pos.x+Math.cos(heading)*side*offset,z=pos.z-Math.sin(heading)*side*offset,y=navigation?.surface(x,z,pos.y,.38);if(y!==undefined&&withinArea(x,z)){exit={x,y,z};break;}}
      if(!exit)return{error:'Yahan utarne ki jagah nahi. Thoda aage clear road par jao.'};
      const two=['bike','scooter'].includes(vehicle);mountFrom=pos.clone();mountT=two?0:2;pos.set(exit.x,exit.y,exit.z);removeVehicle();avatar.setMotorcycle(false);if(helmetMesh)helmetMesh.visible=false;
    }
    vehicle=type;cycling=type==='cycle';avatar.root.visible=true;avatar.setCycling(cycling);speedNow=0;return{ok:true};
  }
  let frozen = false,crashed=false,fall=null,fallenBike=null,wreck=null,wreckAge=0;
  function clearFallenBike(){if(fallenBike){scene.remove(fallenBike);if(fallenBike.userData.owned)fallenBike.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}fallenBike=null;}
  function launch(hit){
    avatar.setFirstPerson(false);
    if(cycling){fallenBike=avatar.cloneCycle();if(fallenBike){fallenBike.position.copy(pos);fallenBike.position.y+=.35;fallenBike.rotation.set(0,heading,1.35);scene.add(fallenBike);const box=new THREE.Box3().setFromObject(fallenBike);fallenBike.position.y+=Math.max(0,pos.y+.02-box.min.y);}cycling=false;vehicle='walk';avatar.setCycling(false);}
    const force=hit?.direction||{x:Math.sin(heading),z:Math.cos(heading)};
    fall={t:0,duration:.9,dx:force.x*Math.min(4,1+(hit?.speed||3)*.15),dz:force.z*Math.min(4,1+(hit?.speed||3)*.15),rise:null};
    avatar.root.rotation.y=Math.atan2(force.x,force.z);heading=avatar.root.rotation.y;avatar.setActivity(null);
  }
  let speedNow = 0;
  let actualSpeed = 0;
  let distanceCycled = 0;
  let sitting=null,carrying=false,runToggle=false,eatTime=0,foodProp=null,payTime=0,sitAnim=null,payProp=null;
  const listeners = { move: [] };

  // ---------- keyboard ----------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (isTyping(e)) return;
    if(e.code==='Space'&&!e.repeat&&vehicle==='walk'){e.preventDefault();jump();}
    if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code))e.preventDefault();
    keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  // ---------- touch joystick ----------
  const driveInput = {steer:0, throttle:0, brake:0, gear:1};
  const joy = { x: 0, y: 0, id: null };
  if (joystickEl) {
    const knob = joystickEl.querySelector(".knob");
    const radius = () => Math.max(18,(joystickEl.clientWidth-44)/2);
    const start = (e) => {
      if(joy.id!==null)return;
      joy.id = e.pointerId;
      joystickEl.setPointerCapture(e.pointerId);
      moveJoy(e);
    };
    const moveJoy = (e) => {
      if (e.pointerId !== joy.id) return;
      const b = joystickEl.getBoundingClientRect();
      let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
      const r=radius(),len = Math.hypot(dx, dy);
      if (len > r) { dx = (dx / len) * r; dy = (dy / len) * r; }
      joy.x = dx / r; joy.y = dy / r;
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
    };
    const end = (e) => {
      if (e.pointerId !== joy.id) return;
      joy.id = null; joy.x = joy.y = 0;
      knob.style.transform = "";
    };
    joystickEl.addEventListener("pointerdown", start);
    joystickEl.addEventListener("pointermove", moveJoy);
    joystickEl.addEventListener("pointerup", end);
    joystickEl.addEventListener("pointercancel", end);
    joystickEl.addEventListener("lostpointercapture", end);
  }

  // ---------- drag to look ----------
  let dragId = null, lastX = 0, lastY = 0, dragDist = 0,pinchDistance=null;
  const pointers=new Map();
  dom.addEventListener("pointerdown", (e) => {
    pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});dom.setPointerCapture(e.pointerId);
    if(pointers.size>1){const p=[...pointers.values()];pinchDistance=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);return;}
    dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; dragDist = 0;
  });
  dom.addEventListener("pointermove", (e) => {
    if(pointers.has(e.pointerId))pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(pointers.size>1){const p=[...pointers.values()],d=Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y);if(pinchDistance&&d>10){camDist=THREE.MathUtils.clamp(camDist*pinchDistance/d,3,45);dragDist=20;}pinchDistance=d;return;}
    if (e.pointerId !== dragId) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragDist += Math.abs(dx) + Math.abs(dy);
    lastLookAt=performance.now();yaw -= dx * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, viewMode==='eyes'?-0.85:0.05, viewMode==='eyes'?1.05:1.2);
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = (e) => {pointers.delete(e.pointerId);pinchDistance=null;if(e.pointerId===dragId)dragId=null;if(pointers.size===1){const [id,p]=[...pointers.entries()][0];dragId=id;lastX=p.x;lastY=p.y;}};
  dom.addEventListener("pointerup", endDrag);
  dom.addEventListener("pointercancel", endDrag);
  dom.addEventListener("wheel", (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.02, 3, 60); }, { passive: true });

  let camDist = 6.5;
  let viewMode='follow';
  function setCameraMode(id){const m=modeDefinition(id);viewMode=m.id;camDist=m.distance||6.5;pitch=m.id==='eyes'?0:0.26;camera.fov=m.fov;camera.near=m.id==='eyes'?0.06:0.18;camera.updateProjectionMatrix();avatar.setFirstPerson(m.id==='eyes');}
  const camTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const cameraRay = new THREE.Raycaster();
  const rayDirection = new THREE.Vector3();

  function jump(){
    if(frozen||crashed||sitting||carrying||vehicle!=='walk'||jumpHeight>0||jumpVelocity>0)return false;
    jumpVelocity=4.2;jumpHeight=.001;return true;
  }
  function update(dt) {
    actualSpeed = 0;
    if(!frozen&&(jumpHeight>0||jumpVelocity>0)){jumpVelocity-=9.8*dt;jumpHeight=Math.max(0,jumpHeight+jumpVelocity*dt);if(jumpHeight===0)jumpVelocity=0;}
    mountT=Math.min(2,mountT+dt);gestureTime=Math.max(0,gestureTime-dt);
    const twoWheeler=['bike','scooter'].includes(vehicle);
    if(twoWheeler)avatar.setMotorcycle(mountT>.6);
    if(wreck){wreckAge+=dt;if(wreckAge>65){scene.remove(wreck.root);wreck.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});wreck=null;}}
    if(fall){
      fall.t+=dt;
      if(fall.t>=fall.duration&&fall.rise===null&&(keys.has('KeyW')||keys.has('Space')||Math.hypot(joy.x,joy.y)>.3))fall.rise=0;
      if(fall.t<fall.duration){const factor=Math.max(0,1-fall.t/fall.duration);const oldX=pos.x,oldZ=pos.z;navigation?.move(pos,fall.dx*factor*dt,fall.dz*factor*dt,.38);if(!withinArea(pos.x,pos.z)){pos.x=oldX;pos.z=oldZ;}}
      if(fall.rise!==null){fall.rise=Math.min(1,fall.rise+dt/.65);avatar.setFall((1-fall.rise)*Math.PI/2,0);if(fall.rise>=1){fall=null;avatar.setFall();avatar.setFirstPerson(viewMode==='eyes');crashed=false;clearFallenBike();}}
      else avatar.setFall(Math.min(1,fall.t/.65)*Math.PI/2,Math.max(0,Math.sin(Math.min(1,fall.t/fall.duration)*Math.PI))*.95);
    }
    if(navigation&&!sitting&&!vehicleRoot){const h=navigation.surface(pos.x,pos.z,pos.y,cycling?0.52:0.38);if(h!==undefined)pos.y=h;else{const p=navigation.safePoint(pos.x,pos.z,pos.y,cycling?0.52:0.38,.65);if(withinArea(p.x,p.z))pos.set(p.x,p.y,p.z);}}
    let ix = 0, iz = 0;
    if (!frozen && !crashed && mountT>1.1) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) iz -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) iz += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
      ix += joy.x; iz += joy.y;
      if(vehicleRoot){ix += driveInput.steer; iz += driveInput.brake-driveInput.throttle;}
    }
    if(sitting||payTime>0){ix=0;iz=0;speedNow=0;}
    const len = Math.hypot(ix, iz);
    if (len > 1) { if(vehicleRoot){ix=THREE.MathUtils.clamp(ix,-1,1);iz=THREE.MathUtils.clamp(iz,-1,1);}else{ix /= len; iz /= len;} }
    const run = runToggle||Math.hypot(joy.x,joy.y)>0.88||keys.has("ShiftLeft") || keys.has("ShiftRight");
    const maxSpeed = carrying?1.2:cycling ? VEHICLES.cycle.maxKmh/3.6 : run ? 5.2 : 1.8;
    const target = Math.min(len, 1) * maxSpeed;
    speedNow += (target - speedNow) * Math.min(1, dt * 6);

    if(vehicleRoot){
      const oldX=pos.x,oldZ=pos.z;
      const forward=driveInput.throttle>0||keys.has('KeyW')||keys.has('ArrowUp');
      const backward=driveInput.brake>0||keys.has('KeyS')||keys.has('ArrowDown');
      const braking=keys.has('Space')||(forward&&backward);
      driveSpeed=crashed||frozen?0:braking?Math.sign(driveSpeed)*Math.max(0,Math.abs(driveSpeed)-VEHICLES[vehicle].brake*dt):drivingSpeed(driveSpeed,-iz,dt,vehicle);
      steeringNow+=(THREE.MathUtils.clamp(ix,-1,1)-steeringNow)*Math.min(1,dt*12);
      if(twoWheeler&&navigation?.zones.some(z=>z.id==='ldrp-campus'&&z.contains(pos.x,pos.z)))driveSpeed=Math.min(driveSpeed,CONTENT.gameplay.campusMaxKmh/3.6);
      // Bicycle-model steering: yaw rate follows signed speed, so the vehicle
      // only turns while rolling, turns tighter when slow and the nose swings
      // the opposite way when reversing, like a real car or bike.
      const sp=Math.abs(driveSpeed),wheelbase=vehicle==='car'?2.6:vehicle==='auto'?1.9:1.35,maxSteer=vehicle==='car'?.55:vehicle==='auto'?.6:.7;
      // In this coordinate frame, positive yaw turns left when driving forward.
      // Right input therefore reduces yaw; reverse naturally turns the nose back.
      const steer=steeringNow*maxSteer/(1+sp*.25),turn=-Math.sign(driveSpeed)*sp/wheelbase*Math.tan(steer)*dt,steps=Math.max(1,Math.ceil(sp*dt/.15));
      for(let i=0;i<steps;i++){
        const angle=heading+turn/steps,x=pos.x+Math.sin(angle)*driveSpeed*dt/steps,z=pos.z+Math.cos(angle)*driveSpeed*dt/steps;
        const pose=withinArea(x,z)&&driving.pose(x,z,angle,vehicle);
        if(!pose){driveSpeed=0;break;}pos.set(x,pose.y,z);heading=angle;
      }
      actualSpeed=Math.hypot(pos.x-oldX,pos.z-oldZ)/Math.max(dt,.001);vehicleRoot.position.copy(pos);vehicleRoot.rotation.y=heading;
      if(actualSpeed>0)for(const fn of listeners.move)fn(actualSpeed*dt,pos);
    } else if (len > 0.05) {
      // Move relative to where the camera is looking.
      const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
      const rx = Math.cos(yaw), rz = -Math.sin(yaw);
      const mx = fx * -iz + rx * ix, mz = fz * -iz + rz * ix;
      const ml = Math.hypot(mx, mz) || 1;
      let step = speedNow * dt, dirX = mx / ml, dirZ = mz / ml;
      const oldX = pos.x, oldZ = pos.z;
      if (cycling) {
        // A bicycle rolls along its heading and turns in an arc (min ~2.2 m
        // radius); it slows to turn sharply instead of sliding sideways.
        let d = Math.atan2(Math.sin(Math.atan2(mx, mz) - heading), Math.cos(Math.atan2(mx, mz) - heading));
        const rate = Math.max(.9, speedNow / 2.2) * dt;
        heading += Math.max(-rate, Math.min(rate, d));
        step *= Math.max(.25, Math.cos(Math.min(Math.abs(d), 1.3)));
        dirX = Math.sin(heading); dirZ = Math.cos(heading);
      }
      let nx = pos.x + dirX * step, nz = pos.z + dirZ * step;
      if (bounds) { nx = THREE.MathUtils.clamp(nx, bounds.minX, bounds.maxX); nz = THREE.MathUtils.clamp(nz, bounds.minZ, bounds.maxZ); }
      if (navigation) navigation.move(pos, nx-pos.x, nz-pos.z, cycling ? 0.52 : 0.38);
      else { pos.x = nx; pos.z = nz; }
      if(!withinArea(pos.x,pos.z)){pos.x=oldX;pos.z=oldZ;}
      const moved = Math.hypot(pos.x-oldX, pos.z-oldZ);
      actualSpeed = dt > 0 ? moved / dt : 0;
      if (!cycling) {
        const want = Math.atan2(mx, mz);
        let d = want - heading;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        heading += d * Math.min(1, dt * 10);
      }
      avatar.root.rotation.y = heading;
      if (cycling) distanceCycled += moved;
      if (moved > 0) for (const fn of listeners.move) fn(moved, pos);
    }
    avatar.root.position.copy(pos);
    if(mountT<1.1&&mountFrom)avatar.root.position.lerpVectors(mountFrom,pos,Math.min(1,mountT/1.1));
    avatar.root.position.y+=jumpHeight;
    if(sitAnim){sitAnim.time+=dt;if(sitAnim.time<0.55)avatar.root.position.lerpVectors(sitAnim.from,pos,sitAnim.time/0.55);else sitAnim=null;}
    eatTime=Math.max(0,eatTime-dt);
    payTime=Math.max(0,payTime-dt);
    avatar.setActivity(jumpHeight>0?'jump':mountT<.6?'helmet':gestureTime>0?gesture:payTime>0?'pay':eatTime>0?(sitting?'eat':'eat-standing'):sitting&&!sitAnim?(sittingGround?'ground-sit':'sit'):carrying?'carry':null);
    avatar.update(dt, sitAnim?1.4:actualSpeed);
    if(twoWheeler&&mountT>.55){if(!helmetMesh){helmetMesh=new THREE.Mesh(new THREE.SphereGeometry(.14,18,12,0,Math.PI*2,0,Math.PI*.65),new THREE.MeshStandardMaterial({color:0x252e30,roughness:.38}));avatar.root.add(helmetMesh);}helmetMesh.visible=true;helmetMesh.position.copy(avatar.socket('Head')).add(new THREE.Vector3(0,.15,0));}else if(helmetMesh)helmetMesh.visible=false;
    if(foodProp){foodProp.visible=eatTime>0;foodProp.position.copy(avatar.socket('LeftHand'));}
    if(payProp){payProp.visible=payTime>0;payProp.position.copy(avatar.socket('RightHand'));}

    // Re-centre behind a moving vehicle after the player finishes looking.
    // This keeps on-screen left/right consistent with the vehicle's front.
    if(vehicleRoot&&Math.abs(driveSpeed)>.15&&dragId===null&&performance.now()-lastLookAt>1400&&['follow','wide','eyes'].includes(viewMode)){
      const delta=Math.atan2(Math.sin(heading+Math.PI-yaw),Math.cos(heading+Math.PI-yaw));
      yaw+=delta*Math.min(1,dt*(viewMode==='eyes'?7:3));
    }
    // Follow camera.
    camTarget.set(pos.x, pos.y + jumpHeight + 1.6, pos.z);
    if(viewMode==='eyes') {
      const eye=vehicleRoot?(vehicle==='car'?1.13:1.28):sitting?1.24:avatar.gender==='female'?1.53:1.63;
      tmp.set(pos.x-Math.sin(yaw)*0.12,pos.y+jumpHeight+eye,pos.z-Math.cos(yaw)*0.12);camera.position.lerp(tmp,Math.min(1,dt*16));
      camera.lookAt(camera.position.x-Math.sin(yaw)*Math.cos(pitch),camera.position.y-Math.sin(pitch),camera.position.z-Math.cos(yaw)*Math.cos(pitch));return;
    }
    const dist = camDist + (vehicleRoot?4:cycling ? 1.5 : 0),cameraYaw=viewMode==='front'?heading:yaw;
    tmp.set(
      camTarget.x + Math.sin(cameraYaw) * Math.cos(pitch) * dist,
      camTarget.y + Math.sin(pitch) * dist,
      camTarget.z + Math.cos(cameraYaw) * Math.cos(pitch) * dist
    );
    camera.position.lerp(tmp, Math.min(1, dt * 8));
    camera.position.y=Math.max(pos.y+0.2,camera.position.y);
    if (cameraObstacles.length) {
      rayDirection.copy(camera.position).sub(camTarget);
      const length = rayDirection.length();
      cameraRay.set(camTarget, rayDirection.normalize());
      cameraRay.far = length;
      const hit = cameraRay.intersectObjects(cameraObstacles, false)[0];
      if (hit) camera.position.copy(camTarget).addScaledVector(rayDirection, Math.max(0.4, hit.distance-0.3));
    }
    camera.lookAt(camTarget);
  }

  return {
    get crashed(){return crashed;},
    get canGetUp(){return !!fall&&fall.t>fall.duration&&fall.rise===null;},
    get fallen(){return !!fall;},get wreck(){return wreck;},
    getUp(){if(!fall||fall.t<fall.duration)return false;fall.rise=0;return true;},
    recoverAt(point){
      removeVehicle();clearFallenBike();if(wreck){scene.remove(wreck.root);wreck.root.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});wreck=null;}
      crashed=false;fall=null;vehicle='walk';cycling=false;speedNow=actualSpeed=driveSpeed=0;mountT=2;mountFrom=null;
      keys.clear();joy.x=joy.y=0;joy.id=null;driveInput.steer=driveInput.throttle=driveInput.brake=0;
      avatar.setFall();avatar.setMotorcycle(false);avatar.setCycling(false);avatar.setActivity(null);avatar.setFirstPerson(viewMode==='eyes');avatar.root.visible=true;if(helmetMesh)helmetMesh.visible=false;
      if(point)pos.set(point.x,point.y,point.z);avatar.root.position.copy(pos);
    },
    poseWreck(p){if(!wreck)return;Object.assign(wreck,p);wreck.root.position.set(p.x,p.y,p.z);wreck.root.rotation.y=p.yaw;},
    resumeAfterAccident(){if(fall)return;crashed=false;avatar.root.visible=true;},
    leaveWreck(hide=false){if(!vehicleRoot)return false;const type=vehicle,root=vehicleRoot;wreck={root,x:pos.x,y:pos.y,z:pos.z,yaw:heading,type};wreckAge=0;vehicleRoot=null;vehicleModel=null;vehicle='walk';cycling=false;avatar.root.visible=!hide;const x=pos.x+Math.cos(heading)*1.8,z=pos.z-Math.sin(heading)*1.8,p=navigation?.safePoint(x,z,pos.y,.38,3)||{x,y:pos.y,z};pos.set(p.x,p.y,p.z);avatar.root.position.copy(pos);return true;},
    stopAt(p){pos.set(p.x,(p.y||0)-jumpHeight,p.z);heading=p.yaw??heading;speedNow=actualSpeed=driveSpeed=0;avatar.root.position.copy(pos);if(vehicleRoot){vehicleRoot.position.copy(pos);vehicleRoot.rotation.y=heading;}},
    hit(info){if(crashed)return;jumpHeight=jumpVelocity=0;crashed=true;speedNow=actualSpeed=driveSpeed=0;keys.clear();if(vehicleRoot&&['bike','scooter'].includes(vehicle)){fallenBike=vehicleRoot;fallenBike.userData.owned=true;fallenBike.position.copy(pos);fallenBike.rotation.set(0,heading,1.3);const box=new THREE.Box3().setFromObject(fallenBike);fallenBike.position.y+=Math.max(0,pos.y+.02-box.min.y);vehicleRoot=null;vehicleModel=null;vehicle='walk';avatar.setMotorcycle(false);avatar.root.visible=true;launch(info);}else if(vehicleRoot){vehicleRoot.rotation.z=.025;damageVehicle(vehicleRoot,Math.min(1.5,(info?.speed||5)/8));}else launch(info);},
    get position() { airbornePosition.copy(pos);airbornePosition.y+=jumpHeight;return airbornePosition; },
    get heading() { return heading; },
    get cycling() { return cycling; },
    get vehicle(){return vehicle;},get driveDirection(){return driveSpeed<-.02?'R':driveSpeed>.02?'D':'STOP';},get speedKmh(){return actualSpeed*3.6;},get areaLocked(){return areaLocked;},setVehicle,
    get soleHeight(){return avatar.soleHeight;},
    setNight(on){vehicleModel?.setNight(on);},
    gesture(kind,seconds=1.8){gesture=kind;gestureTime=seconds;},
    boardParked(record){const before=pos.clone();if(record.type!=='cycle'&&!driving.pose(record.x,record.z,record.yaw,record.type))return{error:'Vehicle ke paas khuli jagah chahiye.'};pos.set(record.x,record.y,record.z);const result=setVehicle(record.type);if(result.error)pos.copy(before);else{heading=record.yaw;mountFrom=before;mountT=0;}return result;},
    get cameraMode(){return viewMode;},get cameraFov(){return camera.fov;},setCameraMode,
    setCameraFov(value){camera.fov=THREE.MathUtils.clamp(value,45,90);camera.updateProjectionMatrix();},
    get sitting(){return sitting;},get carrying(){return carrying;},get running(){return runToggle;},
    toggleRun(){runToggle=!runToggle;return runToggle;},
    setCarrying(on){carrying=on;if(on&&cycling){vehicle='walk';cycling=false;avatar.setCycling(false);}},
    eat(item=''){
      eatTime=10;if(foodProp){avatar.root.remove(foodProp);foodProp.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});}
      foodProp=new THREE.Group();avatar.root.add(foodProp);
      const tea=/chai|coffee|soda/i.test(item),mat=new THREE.MeshStandardMaterial({color:tea?0xd9cdb1:0xb5bfbc,metalness:tea?0:0.7,roughness:0.5});
      const dish=new THREE.Mesh(new THREE.CylinderGeometry(tea?0.045:0.18,tea?0.032:0.18,tea?0.08:0.015,20),mat);dish.position.y=0.02;foodProp.add(dish);
      const food=new THREE.Mesh(new THREE.CylinderGeometry(tea?0.038:0.08,tea?0.038:0.08,0.015,16),new THREE.MeshStandardMaterial({color:tea?0x815837:0x9b5d2f}));food.position.set(tea?0:-0.04,tea?0.065:0.04,0);foodProp.add(food);
    },
    pay(){payTime=2.5;if(!payProp){payProp=new THREE.Mesh(new THREE.BoxGeometry(0.09,0.003,0.045),new THREE.MeshStandardMaterial({color:0xb0bc8f,roughness:1}));avatar.root.add(payProp);}},
    sit(seat){if(vehicleRoot||jumpHeight>0)return false;if(cycling){vehicle='walk';cycling=false;avatar.setCycling(false);}sitAnim={from:pos.clone(),time:0};sitting=seat.id;sittingGround=seat.kind==='ground';pos.set(seat.x,seat.y??0.04,seat.z);heading=seat.yaw;avatar.root.rotation.y=heading;return true;},
    stand(){if(!sitting)return;const safe=navigation?.safePoint(pos.x,pos.z,0,0.38)||pos;pos.set(safe.x,safe.y,safe.z);sitting=null;sitAnim=null;sittingGround=false;},
    get speed() { return actualSpeed; },
    get distanceCycled() { return distanceCycled; },
    get wasDrag() { return dragDist > 8; },
    update,
    jump,
    onMove(fn) { listeners.move.push(fn); },
    // faceYaw 0 = camera south of the player looking north, toward the landmark.
    teleport(x, z, faceYaw = 0, height = 0) {
      if(sitting||carrying)return false;
      jumpHeight=jumpVelocity=0;crashed=false;fall=null;avatar.setFall();clearFallenBike();removeVehicle();vehicle='walk';cycling=false;avatar.setCycling(false);avatar.root.visible=true;areaLocked=!!playArea?.(x,z);
      const safe = navigation ? navigation.safePoint(x, z, height) : { x, y: 0, z };
      pos.set(safe.x, safe.y, safe.z);
      speedNow = actualSpeed = 0;
      avatar.root.position.copy(pos);
      yaw = faceYaw; heading = faceYaw + Math.PI;
      avatar.root.rotation.y = heading;
      camera.position.set(pos.x + Math.sin(yaw) * 8, pos.y + 5, pos.z + Math.cos(yaw) * 8);
    },
    setLook(lookId, skin) {
      scene.remove(avatar.root);
      avatar.dispose?.();
      avatar = createAvatar(lookId, skin);
      if(helmetMesh)avatar.root.add(helmetMesh);
      avatar.root.position.copy(pos);
      avatar.root.rotation.y = heading;
      avatar.setCycling(cycling);
      avatar.setFirstPerson(viewMode==='eyes');
      avatar.root.visible=!vehicleRoot;
      scene.add(avatar.root);
    },
    // Camera distance and pitch (also used for the "photo" overview of a place).
    setView(dist, p) { camDist = dist; if (p != null) pitch = p; },
    toggleCycle(on = !cycling) {
      setVehicle(on?'cycle':'walk');return cycling;
    },
    wave() { avatar.wave(); },
    setDriveInput(input) { Object.assign(driveInput,input); },
    resetInput(){keys.clear();joy.x=joy.y=0;joy.id=null;driveInput.steer=driveInput.throttle=driveInput.brake=0;steeringNow=0;if(joystickEl)joystickEl.querySelector(".knob").style.transform="";},
    freeze(on) { frozen = on; if (on) {keys.clear();joy.x=joy.y=0;driveInput.steer=driveInput.throttle=driveInput.brake=0;driveSpeed=0;if(joystickEl)joystickEl.querySelector(".knob").style.transform="";} },
    keys,
  };
}

export function isTyping(e) {
  const t = e.target;
  return t && (t.closest?.("input,textarea,select,[contenteditable=true]") || t.isContentEditable);
}
