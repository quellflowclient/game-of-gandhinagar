import fs from 'node:fs/promises';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import {installParkedModel} from '../src/world/parked-models.js';
// Decode shipped mesh data on CPU. Browser QA separately checks KTX textures.
globalThis.ProgressEvent??=class{constructor(type,props){Object.assign(this,props);this.type=type;}};
for(const [i,type] of ['scooter','motorcycle'].entries()){
 const b=await fs.readFile(new URL(`../public/models/vehicles/${type}-parking.glb`,import.meta.url)),n=b.readUInt32LE(12),j=JSON.parse(b.subarray(20,20+n)),bin=b.subarray(28+n);
 delete j.images;delete j.textures;delete j.samplers;
 j.materials=j.materials.map(m=>({name:m.name,pbrMetallicRoughness:{baseColorFactor:m.pbrMetallicRoughness?.baseColorFactor||[.5,.5,.5,1]}}));
 j.extensionsRequired=j.extensionsRequired?.filter(x=>x!=='KHR_texture_basisu');
 j.buffers=[{byteLength:bin.length,uri:`data:application/octet-stream;base64,${bin.toString('base64')}`}];
 const gltf=await new GLTFLoader().setMeshoptDecoder(MeshoptDecoder).parseAsync(JSON.stringify(j),'');installParkedModel(gltf.scene,i);
}
