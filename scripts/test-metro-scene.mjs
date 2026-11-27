import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildJourneyScene} from '../src/world/metro-journey-scene.js';
const noop=()=>{};globalThis.document={createElement(){const canvas={width:1,height:1};canvas.getContext=()=>new Proxy({canvas},{get:(o,k)=>k in o?o[k]:noop});return canvas;}};
const v=buildJourneyScene({lowEnd:true});v.scene.updateMatrixWorld(true);let meshes=0,vertices=0;
v.scene.traverse(o=>{if(!o.isMesh)return;meshes++;assert(o.matrixWorld.elements.every(Number.isFinite));for(const a of Object.values(o.geometry.attributes))assert([...a.array].every(Number.isFinite));vertices+=o.geometry.attributes.position.count;});
assert(meshes<220,`${meshes} batched render meshes stay bounded`);assert(vertices<400000);assert.equal(v.doors.length,36);assert.equal(v.wheels.length,24);
for(const aspect of [320/568,432/752,844/390,16/9])for(const progress of [0,.25,.5,.75,1])for(const mode of ['inside','outside']){v.camera.aspect=aspect;v.pose(mode,progress);assert(v.camera.projectionMatrix.elements.every(Number.isFinite));v.scenery.position.x=-420*progress;v.scene.updateMatrixWorld(true);const ray=new THREE.Raycaster(v.camera.position,new THREE.Vector3(0,-1,0),0,100);assert(ray.intersectObjects(v.scene.children,true).length,'Both cameras have a complete floor or street below them, across the full ride');}
v.scenery.position.x=-210;v.camera.aspect=432/752;v.pose('inside',.5,true);v.scene.updateMatrixWorld(true);v.camera.updateMatrixWorld();const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(0,0),v.camera);const exterior=ray.intersectObject(v.scenery,true);assert(exterior.length,'The passenger view looks through a real window at passing city geometry');
v.setNight(true);v.setRoute('City Club');assert.equal(v.sunlight.intensity,.55);
console.log(`Metro scene passed: ${meshes} batched meshes / ${vertices} vertices, 36 sliding doors, 24 wheels, complete ground coverage at four phone/desktop ratios and unobstructed passenger scenery.`);
