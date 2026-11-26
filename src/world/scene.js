import {lightingSchedule} from '../systems/clock.js';
import * as THREE from "three";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import {hdPixelRatio} from './render-quality.js';

// Realistic rendering: physically based sky with a sun that follows the real path over
// Gujarat, image-based lighting from that sky, soft shadows that follow the player,
// ACES filmic tone mapping, stars at night.
export function createScene(container) {
  const lowEnd = /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent)||matchMedia('(pointer:coarse)').matches||window.innerWidth<700;
  const renderer = new THREE.WebGLRenderer({ antialias: !lowEnd, powerPreference: "low-power" });
  renderer.setPixelRatio(hdPixelRatio(window.innerWidth,window.innerHeight,window.devicePixelRatio,lowEnd));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.9;
  renderer.shadowMap.enabled = !lowEnd;
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
  // Deeper Gujarat-noon blue: the stock shader washes out under ACES at our exposure.
  sky.material.fragmentShader = 'uniform float nightAmount;\n'+sky.material.fragmentShader.replace("gl_FragColor = vec4( retColor, 1.0 );", "float up = smoothstep(0.0, 0.45, direction.y); retColor = mix(vec3(dot(retColor, vec3(.299,.587,.114))), retColor, 1.45) * 0.66; retColor = mix(retColor, retColor * vec3(.62,.8,1.18), up * .75); vec3 nightSky=mix(vec3(.075,.105,.16),vec3(.012,.027,.065),up); retColor=mix(retColor,nightSky,nightAmount); gl_FragColor = vec4( retColor, 1.0 );");
  sky.material.uniforms.nightAmount={value:0};sky.renderOrder=-20;
  sky.scale.setScalar(3000);
  const su = sky.material.uniforms;
  su.turbidity.value = 3.2;
  su.rayleigh.value = 2.3;
  su.mieCoefficient.value = 0.004;
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
  stars.renderOrder=-18;
  // Small procedural sky textures: three draw calls, no bloom pass or download.
  function discTexture(kind){
    const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const c=canvas.getContext('2d');
    if(kind==='halo'){const glow=c.createRadialGradient(64,64,0,64,64,64);glow.addColorStop(0,'rgba(255,224,155,.65)');glow.addColorStop(.22,'rgba(255,201,112,.24)');glow.addColorStop(1,'rgba(255,188,96,0)');c.fillStyle=glow;c.fillRect(0,0,128,128);}
    else{
      c.beginPath();c.arc(64,64,60,0,Math.PI*2);c.clip();
      const fill=c.createRadialGradient(43,39,4,64,64,76);
      fill.addColorStop(0,kind==='moon'?'#edf0e8':'#fffef0');fill.addColorStop(.7,kind==='moon'?'#bcc5c6':'#fff1b8');fill.addColorStop(1,kind==='moon'?'#697e8c':'#ffc65f');c.fillStyle=fill;c.fillRect(0,0,128,128);
      if(kind==='moon')for(let i=0;i<21;i++){const x=16+(i*37%94),y=18+(i*53%92),r=3+(i*7%10);c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle='rgba(79,99,115,.13)';c.fill();c.beginPath();c.arc(x-1,y-1,r*.72,0,Math.PI*2);c.fillStyle='rgba(235,240,232,.1)';c.fill();}
    }
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;return texture;
  }
  const celestial=(name,kind,size,order)=>{
    const material=new THREE.SpriteMaterial({map:discTexture(kind),transparent:true,depthWrite:false,fog:false,toneMapped:false});
    const sprite=new THREE.Sprite(material);sprite.name=name;sprite.scale.set(size,size,1);sprite.renderOrder=order;sprite.frustumCulled=false;scene.add(sprite);return sprite;
  };
  const sunHalo=celestial('Warm sun halo','halo',180,-17),sunDisc=celestial('Visible daylight sun','sun',42,-16),moonDisc=celestial('Soft cratered moon','moon',48,-16);


  const hemi = new THREE.HemisphereLight(0xdfeaff, 0x5b5a48, 0.9);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.0);
  sun.castShadow = !lowEnd;
  sun.shadow.mapSize.set(lowEnd ? 512 : 1024, lowEnd ? 512 : 1024);
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
  envSky.material.fragmentShader=sky.material.fragmentShader;envSky.material.uniforms.nightAmount={value:0};
  envScene.add(envSky);
  let envTarget = null, lastEnvHour = -99;

  const visibilityFill=new THREE.AmbientLight(0xe1ecff,0);scene.add(visibilityFill);
  const sunDir = new THREE.Vector3();
  const moonDir = new THREE.Vector3(-0.35, 0.8, 0.45).normalize();
  const fogDay = new THREE.Color(0xbcd1e8), fogDusk = new THREE.Color(0xe9b98f), fogNight = new THREE.Color(0x63758a);

  function setHour(hour) {
    const sunrise=6.5,sunset=19;
    // Sun rises in the east (+x) and arcs through the southern sky (+z) over Gujarat.
    const t = (hour - sunrise) / (sunset-sunrise);
    const elev = Math.sin(Math.PI * t) * 72 * (Math.PI / 180); // up to ~72° at noon
    const az = Math.PI * t; // east -> south -> west
    sunDir.set(Math.cos(az), Math.sin(elev), Math.sin(az) * 0.55).normalize();
    const {night,dusk,lightsOn,sunVisible}=lightingSchedule(hour);
    if (night) sunDir.set(-0.3, -0.25, 0.4).normalize();
    // A visual moon arc for the game's fixed night schedule, not lunar ephemeris.
    const moonT=((hour>=19?hour-19:hour+5)/11.5),moonAz=-Math.PI*.8+moonT*Math.PI*1.6;
    moonDir.set(Math.cos(moonAz),.22+Math.sin(Math.PI*moonT)*.72,Math.sin(moonAz)*.75).normalize();
    sunDisc.visible=sunHalo.visible=sunVisible;moonDisc.visible=night;
    sunDisc.material.color.set(sunDir.y<.2?0xffd28a:0xfff7dc);
    sunHalo.material.opacity=sunDir.y<.2?.55:.3;
    su.nightAmount.value=night?1:0;envSky.material.uniforms.nightAmount.value=night?1:0;

    su.sunPosition.value.copy(sunDir);
    envSky.material.uniforms.sunPosition.value.copy(sunDir);
    for (const k of ["turbidity", "rayleigh", "mieCoefficient", "mieDirectionalG"]) envSky.material.uniforms[k].value = su[k].value;

    const height = Math.max(0, sunDir.y);

    sun.intensity = night ? .28 : dusk ? 1.1+height*1.5 : 1.45 + height * 2.0; // moonlight at night
    if (night) sun.color.set(0x9fb4ff); else sun.color.setHSL(0.09, dusk ? 0.85 : 0.4, dusk ? 0.68 : 0.93);
    hemi.intensity = night ? 1.65 : dusk ? 1.15 : .8 + height * .25;
    hemi.color.set(night ? 0xc7daeb : 0xdfeaff);
    hemi.groundColor.set(night ? 0x77887c : 0x5b5a48);
    renderer.toneMappingExposure = night ? 1.03 : dusk ? .92 : .9;
    stars.material.opacity = night ? .65 : 0;
    stars.visible=night;
    sky.visible = true;

    const fog = scene.fog.color;
    if (night) fog.copy(fogNight); else if (dusk) fog.copy(fogDusk).lerp(fogDay, height * 4); else fog.copy(fogDay);
    scene.fog.near = 650;
    visibilityFill.intensity=night?.5:dusk?.2:.12;
    renderer.setClearColor(fog);

    if (!lowEnd && Math.abs(hour - lastEnvHour) > 0.5) {
      lastEnvHour = hour;
      envTarget?.dispose();
      envTarget = pmrem.fromScene(envScene);
      scene.environment = envTarget.texture;
      scene.environmentIntensity = night ? .75 : 0.3 + height * 0.25;
    }
    return { night, evening: hour >= 18 && hour < 19, dusk, lightsOn };
  }

  // Keep sky, stars and the shadow frustum centred on the player.
  function follow(target) {
    sky.position.copy(target);
    stars.position.copy(target);
    sunDisc.position.copy(target).addScaledVector(sunDir,2200);
    sunHalo.position.copy(sunDisc.position);
    moonDisc.position.copy(target).addScaledVector(moonDir,2200);
    const d = sunDir.y > 0 ? sunDir : moonDir;
    sun.position.copy(target).addScaledVector(d, 400);
    sun.target.position.copy(target);
  }

  window.addEventListener("resize", () => {
    renderer.setPixelRatio(hdPixelRatio(window.innerWidth,window.innerHeight,window.devicePixelRatio,lowEnd));
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  return { renderer, scene, camera, setHour, follow, lowEnd };
}
