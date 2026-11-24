import * as THREE from "three";
import { createAvatar } from "./avatar.js";
import {cameraMode as modeDefinition} from './camera-modes.js';
import {VEHICLES,drivingSpeed} from './driving.js';
import {createVehicleModel} from './vehicle-models.js';

// Player character, keyboard and touch input, and the third-person follow camera.
// Desktop: WASD / arrows to walk, drag to look, Shift to run, C to toggle the cycle.
// Phone: left thumb joystick to walk, drag anywhere else to look.
export function createPlayer({ scene, camera, dom, joystickEl, bounds, navigation, cameraObstacles = [],driving,playArea }) {
  let avatar = createAvatar("casual");
  scene.add(avatar.root);
  const pos = new THREE.Vector3(); // source of truth; copied onto the avatar each frame

  let yaw = Math.PI;      // camera yaw around the player
  let pitch = 0.32;       // camera pitch
  let heading = Math.PI;  // direction the character faces
  let cycling = false;
  let vehicle='walk',vehicleRoot=null,vehicleModel=null,driveSpeed=0,areaLocked=false;
  const withinArea=(x,z)=>!areaLocked||playArea(x,z);
  function removeVehicle(){if(vehicleRoot){scene.remove(vehicleRoot);vehicleRoot.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose();}});}vehicleRoot=null;vehicleModel=null;driveSpeed=0;}
  function setVehicle(type){
    if(!(type in VEHICLES))return{error:'Unknown vehicle'};
    if(sitting||carrying)return{error:'Pehle table se utho ya table rakh do.'};
    if(type===vehicle)return{ok:true};
    if(type==='car'||type==='auto'){
      if(navigation?.zones.some(z=>z.id==='ldrp-campus'&&z.contains(pos.x,pos.z)))return{error:'Campus ke andar car/auto allowed nahi. Gate ke bahar road par jao.'};
      const pose=driving?.nearest(pos.x,pos.z,heading,type,14);
      if(!pose||!withinArea(pose.x,pose.z))return{error:'Car/auto ke liye public road ke paas jao (14 m ke andar).'};
      removeVehicle();vehicle=type;cycling=false;avatar.setCycling(false);avatar.root.visible=false;
      vehicleModel=createVehicleModel(type==='car'?'sedan':'auto');vehicleRoot=new THREE.Group();vehicleRoot.name=`Player ${type}`;
      for(const p of vehicleModel.parts){const mesh=new THREE.Mesh(p.geometry,p.material);if(p.paint)p.material.color.setHex(type==='car'?0x648b99:0x36764e);mesh.castShadow=mesh.receiveShadow=true;vehicleRoot.add(mesh);}scene.add(vehicleRoot);
      pos.set(pose.x,pose.y,pose.z);heading=pose.yaw;speedNow=0;return{ok:true};
    }
    if(vehicleRoot){
      let exit=null;
      for(const side of [-1,1]){const x=pos.x+Math.cos(heading)*side*1.9,z=pos.z-Math.sin(heading)*side*1.9,y=navigation?.surface(x,z,pos.y,.38);if(y!==undefined&&withinArea(x,z)){exit={x,y,z};break;}}
      if(!exit)return{error:'Yahan utarne ki jagah nahi. Thoda aage clear road par jao.'};
      pos.set(exit.x,exit.y,exit.z);removeVehicle();
    }
    vehicle=type;cycling=type==='cycle';avatar.root.visible=true;avatar.setCycling(cycling);speedNow=0;return{ok:true};
  }
  let frozen = false;
  let speedNow = 0;
  let actualSpeed = 0;
  let distanceCycled = 0;
  let sitting=null,carrying=false,runToggle=false,eatTime=0,foodProp=null,payTime=0,sitAnim=null,payProp=null;
  const listeners = { move: [] };

  // ---------- keyboard ----------
  const keys = new Set();
  window.addEventListener("keydown", (e) => {
    if (isTyping(e)) return;
    keys.add(e.code);
  });
  window.addEventListener("keyup", (e) => keys.delete(e.code));
  window.addEventListener("blur", () => keys.clear());

  // ---------- touch joystick ----------
  const joy = { x: 0, y: 0, id: null };
  if (joystickEl) {
    const knob = joystickEl.querySelector(".knob");
    const r = 45;
    const start = (e) => {
      joy.id = e.pointerId;
      joystickEl.setPointerCapture(e.pointerId);
      moveJoy(e);
    };
    const moveJoy = (e) => {
      if (e.pointerId !== joy.id) return;
      const b = joystickEl.getBoundingClientRect();
      let dx = e.clientX - (b.left + b.width / 2), dy = e.clientY - (b.top + b.height / 2);
      const len = Math.hypot(dx, dy);
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
    yaw -= dx * 0.005;
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

  function update(dt) {
    actualSpeed = 0;
    if(navigation&&!sitting&&!vehicleRoot){const h=navigation.surface(pos.x,pos.z,pos.y,cycling?0.52:0.38);if(h!==undefined)pos.y=h;}
    let ix = 0, iz = 0;
    if (!frozen) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) iz -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) iz += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
      ix += joy.x; iz += joy.y;
    }
    if(sitting||payTime>0){ix=0;iz=0;speedNow=0;}
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const run = runToggle||Math.hypot(joy.x,joy.y)>0.88||keys.has("ShiftLeft") || keys.has("ShiftRight");
    const maxSpeed = carrying?1.2:cycling ? 10 : run ? 5.2 : 1.8;
    const target = Math.min(len, 1) * maxSpeed;
    speedNow += (target - speedNow) * Math.min(1, dt * 6);

    if(vehicleRoot){
      const oldX=pos.x,oldZ=pos.z;
      driveSpeed=drivingSpeed(driveSpeed,frozen?0:-iz,dt,vehicle);
      const turn=ix*dt*0.95*Math.min(1,driveSpeed/3)/(1+driveSpeed*.045),steps=Math.max(1,Math.ceil(driveSpeed*dt/.15));
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
      const step = speedNow * dt, oldX = pos.x, oldZ = pos.z;
      let nx = pos.x + (mx / ml) * step, nz = pos.z + (mz / ml) * step;
      if (bounds) { nx = THREE.MathUtils.clamp(nx, bounds.minX, bounds.maxX); nz = THREE.MathUtils.clamp(nz, bounds.minZ, bounds.maxZ); }
      if (navigation) navigation.move(pos, nx-pos.x, nz-pos.z, cycling ? 0.52 : 0.38);
      else { pos.x = nx; pos.z = nz; }
      if(!withinArea(pos.x,pos.z)){pos.x=oldX;pos.z=oldZ;}
      const moved = Math.hypot(pos.x-oldX, pos.z-oldZ);
      actualSpeed = dt > 0 ? moved / dt : 0;
      const want = Math.atan2(mx, mz);
      let d = want - heading;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      heading += d * Math.min(1, dt * 10);
      avatar.root.rotation.y = heading;
      if (cycling) distanceCycled += moved;
      if (moved > 0) for (const fn of listeners.move) fn(moved, pos);
    }
    avatar.root.position.copy(pos);
    if(sitAnim){sitAnim.time+=dt;if(sitAnim.time<0.55)avatar.root.position.lerpVectors(sitAnim.from,pos,sitAnim.time/0.55);else sitAnim=null;}
    eatTime=Math.max(0,eatTime-dt);
    payTime=Math.max(0,payTime-dt);
    avatar.setActivity(payTime>0?'pay':eatTime>0?(sitting?'eat':'eat-standing'):sitting&&!sitAnim?'sit':carrying?'carry':null);
    avatar.update(dt, sitAnim?1.4:actualSpeed);
    if(foodProp){foodProp.visible=eatTime>0;foodProp.position.copy(avatar.socket('LeftHand'));}
    if(payProp){payProp.visible=payTime>0;payProp.position.copy(avatar.socket('RightHand'));}

    // Follow camera.
    camTarget.set(pos.x, pos.y + 1.6, pos.z);
    if(viewMode==='eyes') {
      const eye=vehicleRoot?(vehicle==='car'?1.13:1.28):sitting?1.24:avatar.gender==='female'?1.53:1.63;
      tmp.set(pos.x-Math.sin(yaw)*0.12,pos.y+eye,pos.z-Math.cos(yaw)*0.12);camera.position.lerp(tmp,Math.min(1,dt*16));
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
    get position() { return pos; },
    get heading() { return heading; },
    get cycling() { return cycling; },
    get vehicle(){return vehicle;},get speedKmh(){return actualSpeed*3.6;},get areaLocked(){return areaLocked;},setVehicle,
    setNight(on){vehicleModel?.setNight(on);},
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
    sit(seat){if(vehicleRoot)return false;if(cycling){vehicle='walk';cycling=false;avatar.setCycling(false);}sitAnim={from:pos.clone(),time:0};sitting=seat.id;pos.set(seat.x,seat.y??0.04,seat.z);heading=seat.yaw;avatar.root.rotation.y=heading;return true;},
    stand(){if(!sitting)return;const safe=navigation?.safePoint(pos.x,pos.z,0,0.38)||pos;pos.set(safe.x,safe.y,safe.z);sitting=null;sitAnim=null;},
    get speed() { return actualSpeed; },
    get distanceCycled() { return distanceCycled; },
    get wasDrag() { return dragDist > 8; },
    update,
    onMove(fn) { listeners.move.push(fn); },
    // faceYaw 0 = camera south of the player looking north, toward the landmark.
    teleport(x, z, faceYaw = 0, height = 0) {
      if(sitting||carrying)return false;
      removeVehicle();vehicle='walk';cycling=false;avatar.setCycling(false);avatar.root.visible=true;areaLocked=!!playArea?.(x,z);
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
    freeze(on) { frozen = on; if (on) {keys.clear();driveSpeed=0;} },
    keys,
  };
}

export function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
