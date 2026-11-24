import * as THREE from "three";
import { createAvatar } from "./avatar.js";

// Player character, keyboard and touch input, and the third-person follow camera.
// Desktop: WASD / arrows to walk, drag to look, Shift to run, C to toggle the cycle.
// Phone: left thumb joystick to walk, drag anywhere else to look.
export function createPlayer({ scene, camera, dom, joystickEl, bounds, navigation, cameraObstacles = [] }) {
  let avatar = createAvatar("casual");
  scene.add(avatar.root);
  const pos = new THREE.Vector3(); // source of truth; copied onto the avatar each frame

  let yaw = Math.PI;      // camera yaw around the player
  let pitch = 0.32;       // camera pitch
  let heading = Math.PI;  // direction the character faces
  let cycling = false;
  let frozen = false;
  let speedNow = 0;
  let actualSpeed = 0;
  let distanceCycled = 0;
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
  let dragId = null, lastX = 0, lastY = 0, dragDist = 0;
  dom.addEventListener("pointerdown", (e) => {
    dragId = e.pointerId; lastX = e.clientX; lastY = e.clientY; dragDist = 0;
  });
  dom.addEventListener("pointermove", (e) => {
    if (e.pointerId !== dragId) return;
    const dx = e.clientX - lastX, dy = e.clientY - lastY;
    dragDist += Math.abs(dx) + Math.abs(dy);
    yaw -= dx * 0.005;
    pitch = THREE.MathUtils.clamp(pitch + dy * 0.004, 0.05, 0.85);
    lastX = e.clientX; lastY = e.clientY;
  });
  const endDrag = (e) => { if (e.pointerId === dragId) dragId = null; };
  dom.addEventListener("pointerup", endDrag);
  dom.addEventListener("pointercancel", endDrag);
  dom.addEventListener("wheel", (e) => { camDist = THREE.MathUtils.clamp(camDist + e.deltaY * 0.02, 3, 60); }, { passive: true });

  let camDist = 6.5;
  const camTarget = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const cameraRay = new THREE.Raycaster();
  const rayDirection = new THREE.Vector3();

  function update(dt) {
    actualSpeed = 0;
    let ix = 0, iz = 0;
    if (!frozen) {
      if (keys.has("KeyW") || keys.has("ArrowUp")) iz -= 1;
      if (keys.has("KeyS") || keys.has("ArrowDown")) iz += 1;
      if (keys.has("KeyA") || keys.has("ArrowLeft")) ix -= 1;
      if (keys.has("KeyD") || keys.has("ArrowRight")) ix += 1;
      ix += joy.x; iz += joy.y;
    }
    const len = Math.hypot(ix, iz);
    if (len > 1) { ix /= len; iz /= len; }
    const run = keys.has("ShiftLeft") || keys.has("ShiftRight");
    const maxSpeed = cycling ? 10 : run ? 5.2 : 1.8;
    const target = Math.min(len, 1) * maxSpeed;
    speedNow += (target - speedNow) * Math.min(1, dt * 6);

    if (len > 0.05) {
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
    avatar.update(dt, actualSpeed);

    // Follow camera.
    camTarget.set(pos.x, pos.y + 1.6, pos.z);
    const dist = camDist + (cycling ? 1.5 : 0);
    tmp.set(
      camTarget.x + Math.sin(yaw) * Math.cos(pitch) * dist,
      camTarget.y + Math.sin(pitch) * dist,
      camTarget.z + Math.cos(yaw) * Math.cos(pitch) * dist
    );
    camera.position.lerp(tmp, Math.min(1, dt * 8));
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
    get speed() { return actualSpeed; },
    get distanceCycled() { return distanceCycled; },
    get wasDrag() { return dragDist > 8; },
    update,
    onMove(fn) { listeners.move.push(fn); },
    // faceYaw 0 = camera south of the player looking north, toward the landmark.
    teleport(x, z, faceYaw = 0, height = 0) {
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
      scene.add(avatar.root);
    },
    // Camera distance and pitch (also used for the "photo" overview of a place).
    setView(dist, p) { camDist = dist; if (p != null) pitch = p; },
    toggleCycle(on = !cycling) {
      if (navigation && on) {
        const safe = navigation.safePoint(pos.x, pos.z, pos.y, 0.52, 0.65);
        pos.set(safe.x, safe.y, safe.z);
      }
      cycling = on; avatar.setCycling(on); return cycling;
    },
    wave() { avatar.wave(); },
    freeze(on) { frozen = on; if (on) keys.clear(); },
    keys,
  };
}

export function isTyping(e) {
  const t = e.target;
  return t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable);
}
