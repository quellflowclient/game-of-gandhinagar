import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import {hdPixelRatio} from './render-quality.js';

// Realistic rendering: physically based sky with a sun that follows the real path over
// Gujarat, image-based lighting from that sky, soft shadows that follow the player,
// ACES filmic tone mapping, stars at night.
export function createScene(container) {
  const lowEnd = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches||window.innerWidth<700;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  renderer.setPixelRatio(hdPixelRatio(window.innerWidth,window.innerHeight,window.devicePixelRatio));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  let lostNotice=null;
  renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();if(lostNotice)return;lostNotice=document.createElement('div');lostNotice.className='graphics-recovery';const message=document.createElement('p');message.textContent='Graphics paused. Give your device a moment, or reload to continue.';const reload=document.createElement('button');reload.textContent='Reload game';reload.onclick=()=>location.reload();lostNotice.append(message,reload);container.append(lostNotice);});
  renderer.domElement.addEventListener('webglcontextrestored',()=>{lostNotice?.remove();lostNotice=null;});

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9d6e2, 350, 2000);

  // Far plane just past the fog: anything further is invisible anyway, so cull it.
  const camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.3, 3200);

  // Physically based sky.
  const sky = new Sky();
  sky.scale.setScalar(3000);
  const su = sky.material.uniforms;
  su.turbidity.value = 6;
  su.rayleigh.value = 1.6;
  su.mieCoefficient.value = 0.006;
  su.mieDirectionalG.value = 0.82;
  scene.add(sky);

  // Stars for the night.
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 1800; i++) {
    const v = new THREE.Vector3().randomDirection();
    if (v.y < 0.05) v.y = Math.abs(v.y) + 0.05;
    v.normalize().multiplyScalar(2800);
    starPos.push(v.x, v.y, v.z);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  const stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0 }));
  scene.add(stars);

  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5b5a48, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(lowEnd ? 1024 : 2048, lowEnd ? 1024 : 2048);
  const S = 110;
  Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 10, far: 900 });
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);

  // Environment map from the sky, refreshed when the sun moves noticeably.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(1000);
  envScene.add(envSky);
  let envTarget = null, lastEnvHour = -99;

  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3(-0.35, 0.8, 0.45).normalize();
  const fogDay = new THREE.Color(0xc9d6e2), fogDusk = new THREE.Color(0xe9b98f), fogNight = new THREE.Color(0x10172a);

  function setHour(hour,{sunrise=6,sunset=18}={}) {
    // Sun rises in the east (+x) and arcs through the southern sky (+z) over Gujarat.
    const t = (hour - sunrise) / (sunset-sunrise);
    const elev = Math.sin(Math.PI * t) * 72 * (Math.PI / 180); // up to ~72° at noon
    const az = Math.PI * t; // east -> south -> west
    sunDir.set(Math.cos(az), Math.sin(elev), Math.sin(az) * 0.55).normalize();
    const day = hour > sunrise-.3 && hour < sunset+.3;
    const night = !day;
    if (night) sunDir.set(-0.3, -0.25, 0.4).normalize();

    su.sunPosition.value.copy(sunDir);
    envSky.material.uniforms.sunPosition.value.copy(sunDir);
    for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"]) envSky.material.uniforms[k].value = su[k].value;

    const height = Math.max(0, sunDir.y);
    const dusk = day && height < 0.25;
    sun.intensity = night ? 0.45 : 0.5 + height * 2.1; // moonlight at night
    if (night) sun.color.set(0x9fb4ff); else sun.color.setHSL(0.09, dusk ? 0.85 : 0.4, dusk ? 0.68 : 0.93);
    hemi.intensity = night ? 0.55 : 0.3 + height * 0.4;
    hemi.color.set(night ? 0x6f86c8 : 0xdfeaff);
    hemi.groundColor.set(night ? 0x2a2a35 : 0x5b5a48);
    renderer.toneMappingExposure = night ? 0.85 : dusk ? 0.72 : 0.78;
    stars.material.opacity = night ? 0.85 : 0;
    sky.visible = true;

    const fog = scene.fog.color;
    if (night) fog.copy(fogNight); else if (dusk) fog.copy(fogDusk).lerp(fogDay, height * 4); else fog.copy(fogDay);
    scene.fog.near = night ? 200 : 350;
    renderer.setClearColor(fog);

    if (Math.abs(hour - lastEnvHour) > 0.5) {
      lastEnvHour = hour;
      envTarget?.dispose();
      envTarget = pmrem.fromScene(envScene);
      scene.environment = envTarget.texture;
      scene.environmentIntensity = night ? 0.12 : 0.3 + height * 0.25;
    }
    return { night, evening: hour >= 17 && hour < 21, dusk };
  }

  // Keep sky, stars and the shadow frustum centred on the player.
  function follow(target) {
    sky.position.copy(target);
    stars.position.copy(target);
    const d = sunDir.y > 0 ? sunDir : moonDir;
    sun.position.copy(target).addScaledVector(d, 400);
    sun.target.position.copy(target);
  }

  window.addEventListener("resize", () => {
    renderer.setPixelRatio(hdPixelRatio(window.innerWidth,window.innerHeight,window.devicePixelRatio));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, setHour, follow, lowEnd };
}
