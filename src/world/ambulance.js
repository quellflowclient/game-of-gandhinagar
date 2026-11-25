import * as THREE from 'three';

// Lightweight 108 response van, owned by the short accident cinematic.
export function createAmbulance(){
 const root=new THREE.Group(),white=new THREE.MeshStandardMaterial({color:0xf3f3eb,roughness:.45}),blue=new THREE.MeshStandardMaterial({color:0x176fbd,roughness:.4}),glass=new THREE.MeshStandardMaterial({color:0x294554,metalness:.35,roughness:.16}),tyre=new THREE.MeshStandardMaterial({color:0x20262a,roughness:.9});
 const box=(w,h,d,m,x,y,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return mesh;};
 box(1.85,1.28,4.35,white,0,1.12,0);box(1.76,.55,2.65,white,0,2,-.66);box(1.73,.6,.035,glass,0,1.62,2.19);box(1.8,.12,4.36,blue,0,.9,0);
 for(const side of [-1,1]){box(.025,.5,.95,glass,side*.933,1.64,1.23);box(.025,.42,1.1,glass,side*.934,1.86,-.5);for(const z of [-1.45,1.4]){const wheel=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,.2,16),tyre);wheel.rotation.z=Math.PI/2;wheel.position.set(side*.9,.34,z);root.add(wheel);}}
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle='#f3f3eb';c.fillRect(0,0,512,128);c.fillStyle='#176fbd';c.font='bold 64px sans-serif';c.textAlign='center';c.fillText('108  AMBULANCE',256,83);const tex=new THREE.CanvasTexture(canvas),labelMat=new THREE.MeshBasicMaterial({map:tex});
 for(const side of [-1,1]){const label=new THREE.Mesh(new THREE.PlaneGeometry(2.4,.55),labelMat);label.rotation.y=side*Math.PI/2;label.position.set(side*.94,1.32,-.65);root.add(label);}
 const lamps=[];for(const [i,x]of [-.48,.48].entries()){const mat=new THREE.MeshStandardMaterial({color:i?0x327dff:0xffb144,emissive:i?0x176cff:0xff8d20,emissiveIntensity:3});lamps.push(box(.42,.18,.4,mat,x,2.39,.72));}
 box(1.8,.18,.13,tyre,0,.48,2.2);const head=new THREE.MeshStandardMaterial({color:0xf9f1c9,emissive:0xffeeb1,emissiveIntensity:2});for(const x of [-.61,.61])box(.35,.2,.04,head,x,.91,2.24);
 return{root,update(t){for(const [i,l]of lamps.entries())l.material.emissiveIntensity=Math.sin(t*Math.PI*4+i*Math.PI)>0?4:.5;},dispose(){const geometry=new Set(),materials=new Set();root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)materials.add(o.material);});geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());tex.dispose();}};
}
