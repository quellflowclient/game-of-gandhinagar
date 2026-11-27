import * as THREE from 'three';

// The real photograph becomes a gently curved, moving cinematic backdrop.
// The existing game renderer is borrowed until entry; no second WebGL context.
export function createArrivalScene({host,button,root,renderer,lowEnd}){
 const canvas=renderer.domElement,parent=canvas.parentElement;
 const original={ratio:renderer.getPixelRatio(),shadows:renderer.shadowMap.enabled,width:canvas.style.width,height:canvas.style.height};
 const scene=new THREE.Scene();
 const camera=new THREE.PerspectiveCamera(38,1,.1,100);
 const geometry=new THREE.PlaneGeometry(1,1,48,32);
 const uniforms={photo:{value:null},time:{value:0},motion:{value:1}};
 const material=new THREE.ShaderMaterial({uniforms,toneMapped:false,
  vertexShader:`varying vec2 vUv;
   void main(){vUv=uv;vec3 p=position;p.z=pow(1.0-uv.y,3.0)*1.1;
    gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);}`,
  fragmentShader:`uniform sampler2D photo;uniform float time;uniform float motion;varying vec2 vUv;
   void main(){vec2 uv=vUv;
    float water=(1.0-smoothstep(.37,.49,uv.y))*smoothstep(.02,.12,uv.y);
    uv.x+=sin(uv.y*150.0+time*.7)*.00045*water*motion;
    uv.y+=(sin(uv.x*110.0+time*.55)+sin(uv.y*95.0-time*.4))*.00025*water*motion;
    gl_FragColor=texture2D(photo,uv);
    #include <colorspace_fragment>
   }`});
 const plane=new THREE.Mesh(geometry,material);scene.add(plane);
 let loaded=false,disposed=false,elapsed=0,visible=true,px=0,py=0,tx=0,ty=0,drag=null;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)');let paused=reduced.matches;
 host.append(canvas);canvas.setAttribute('aria-hidden','true');
 renderer.shadowMap.enabled=false;renderer.setPixelRatio(Math.min(devicePixelRatio||1,lowEnd?1:1.5));
 const texture=new THREE.TextureLoader().load('/art/mahatma-mandir-1920.webp',tex=>{
  if(disposed){tex.dispose();return;}tex.colorSpace=THREE.SRGBColorSpace;uniforms.photo.value=tex;loaded=true;host.dataset.ready='true';
 });
 function sync(){button.textContent=paused?'Play scene':'Pause scene';button.setAttribute('aria-pressed',String(paused));root.dataset.motion=paused?'paused':'playing';}
 const toggle=()=>{paused=!paused;sync();};button.addEventListener('click',toggle);sync();
 const preference=()=>{paused=reduced.matches;sync();};reduced.addEventListener('change',preference);
 const move=e=>{
  if(reduced.matches||paused)return;
  if(e.pointerType==='touch'&&!drag)return;
  const r=host.getBoundingClientRect();tx=Math.max(-1,Math.min(1,(e.clientX-r.left)/r.width*2-1));ty=Math.max(-1,Math.min(1,(e.clientY-r.top)/r.height*2-1));
 };
 const down=e=>{drag=e.pointerId;move(e);};
 const release=()=>{drag=null;tx=0;ty=0;};
 host.addEventListener('pointermove',move);host.addEventListener('pointerdown',down);host.addEventListener('pointerup',release);host.addEventListener('pointercancel',release);host.addEventListener('pointerleave',release);
 const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;});observer.observe(host);
 let lastPose='';
 return{
  render(dt){
   if(disposed||!loaded||!visible)return;
   if(!paused){elapsed+=dt;px+=(tx-px)*Math.min(1,dt*4);py+=(ty-py)*Math.min(1,dt*4);}
   const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;
   const pose=[w,h,elapsed.toFixed(3),px.toFixed(3),py.toFixed(3)].join(':');if(pose===lastPose)return;lastPose=pose;
   const dpr=renderer.getPixelRatio();if(canvas.width!==Math.floor(w*dpr)||canvas.height!==Math.floor(h*dpr))renderer.setSize(w,h,false);
   camera.aspect=w/h;camera.updateProjectionMatrix();
   const viewHeight=2*Math.tan(THREE.MathUtils.degToRad(19))*30;
   const photoWidth=Math.max(viewHeight*camera.aspect,viewHeight*4/3)*1.12,photoHeight=photoWidth*.75;
   plane.scale.set(photoWidth,photoHeight,1);plane.position.y=-(photoHeight-viewHeight)*.42;
   const x=Math.sin(elapsed*.13)*.6+px*1.2,y=Math.cos(elapsed*.11)*.18+py*.4;
   camera.position.set(x,y,30+Math.sin(elapsed*.08)*.3);camera.lookAt(px*.16,py*.08,0);uniforms.time.value=elapsed;uniforms.motion.value=paused?0:1;
   renderer.render(scene,camera);host.dataset.cameraX=x.toFixed(3);
  },
  dispose(){
   if(disposed)return;disposed=true;observer.disconnect();button.removeEventListener('click',toggle);reduced.removeEventListener('change',preference);
   host.removeEventListener('pointermove',move);host.removeEventListener('pointerdown',down);host.removeEventListener('pointerup',release);host.removeEventListener('pointercancel',release);host.removeEventListener('pointerleave',release);
   parent.append(canvas);canvas.removeAttribute('aria-hidden');canvas.style.width=original.width;canvas.style.height=original.height;
   renderer.shadowMap.enabled=original.shadows;renderer.setPixelRatio(original.ratio);renderer.setSize(innerWidth,innerHeight);
   texture.dispose();material.dispose();geometry.dispose();scene.clear();
  }
 };
}
