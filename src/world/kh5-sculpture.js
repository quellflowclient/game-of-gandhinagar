import * as THREE from 'three';
import * as K from './sites/kit.js';
// Photo references supplied by the user: three interlocking gears and the
// blue/red/yellow figures, slim signal poles, keep-left plaques and chevrons.
export function buildKh5Sculpture(root){
 const group=new THREE.Group();group.name='KH-5 gear sculpture';group.position.y=.70;root.add(group);
 const iron=K.mat(0x69665b,{metalness:.55,roughness:.72}),white=K.mat(0xddd9c9);
 K.cyl(group,1.65,1.8,.18,white,0,0,0,40);
 function gear(x,y,r,hole,teeth){const shape=new THREE.Shape();for(let i=0;i<teeth*4;i++){const a=i*Math.PI*2/(teeth*4),radius=r*(i%4===0||i%4===3?.84:1),px=Math.cos(a)*radius,py=Math.sin(a)*radius;if(!i)shape.moveTo(px,py);else shape.lineTo(px,py);}shape.closePath();const cut=new THREE.Path();cut.absarc(0,0,hole,0,Math.PI*2,true);shape.holes.push(cut);const mesh=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:true,bevelSegments:2,steps:1,bevelSize:.025,bevelThickness:.025,curveSegments:32}),iron);mesh.name='Sculpture gear';mesh.position.set(x,y,-.10);group.add(mesh);mesh.castShadow=mesh.receiveShadow=true;}
 gear(0,1.62,1.22,.79,22);gear(.18,3.28,.85,.29,16);gear(-.30,4.45,.53,.16,12);
 function figure(x,y,scale,color){const g=new THREE.Group();g.position.set(x,y,.13);g.scale.setScalar(scale);group.add(g);const mat=K.mat(color,{roughness:.75,metalness:.15});const beam=(a,b,w)=>{const p=new THREE.Vector3(...a),q=new THREE.Vector3(...b),d=q.clone().sub(p),mesh=new THREE.Mesh(new THREE.BoxGeometry(w,d.length(),.11),mat);mesh.position.copy(p.add(q).multiplyScalar(.5));mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());g.add(mesh);};const head=K.cyl(g,.13,.13,.11,mat,0,.95,0,24);head.rotation.x=Math.PI/2;head.position.y=1.03;beam([0,.8,0],[0,.27,0],.19);beam([0,.72,0],[-.54,1.03,0],.12);beam([0,.72,0],[.5,1.18,0],.12);beam([0,.3,0],[-.24,-.33,0],.12);beam([0,.3,0],[.27,-.33,0],.12);}
 figure(-1.08,.46,1.0,0x303b9a);figure(1.05,.52,.95,0xb83329);figure(-.73,3.08,.62,0xe6b323);
 const lampPositions=[];
 for(const a of [.25,1.85,3.4,5.0]){
  const x=Math.cos(a)*6.5,z=Math.sin(a)*6.5,g=new THREE.Group();g.position.set(x,0,z);g.rotation.y=-a;root.add(g);
  K.cyl(g,.065,.09,7.2,0xb9aa52,0,.25,0,12);
  for(const side of [-1,1]){K.box(g,.36,1.22,.30,0x252b29,side*.23,5.7,0);for(let n=0;n<3;n++){const lens=new THREE.Mesh(new THREE.CylinderGeometry(.105,.105,.04,20),K.mat([0x542b25,0x594b2c,0x274335][n],{roughness:.35}));lens.rotation.x=Math.PI/2;lens.position.set(side*.23,6.7-n*.37,.17);g.add(lens);}}
  const l=new THREE.Group();l.position.set(x*.76,0,z*.76);root.add(l);K.cyl(l,.045,.065,7.5,0xaeb7ae,0,.25,0,10);
  const curve=new THREE.QuadraticBezierCurve3(new THREE.Vector3(0,7.75,0),new THREE.Vector3(.48,8.25,0),new THREE.Vector3(.52,7.55,0));l.add(new THREE.Mesh(new THREE.TubeGeometry(curve,14,.025,6,false),K.mat(0x9da89f,{metalness:.65})));
  const head=K.cyl(l,.08,.11,.20,K.mat(0xeee3c4,{emissive:0xffd9a0,emissiveIntensity:0}),.52,7.35,0,12);head.userData.lamp=true;lampPositions.push([x*.76,7.4,z*.76]);
 }
 for(const yaw of [0,Math.PI/2,Math.PI,Math.PI*1.5]){const sign=new THREE.Group();sign.rotation.y=yaw;root.add(sign);K.textPlane(sign,['❮❮❮❮❮'],{bg:'#d4af42',fg:'#333a36',font:'900 75px sans-serif'},2.3,.43,0,.50,7.39);for(const x of [-1.55,1.55])K.textPlane(sign,['↙'],{bg:'#32608d',fg:'#f3f3e4',font:'900 86px sans-serif'},.62,.43,x,.50,7.4);}
 return{group,lampPositions};
}
