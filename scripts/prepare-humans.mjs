// Asset-only preparation. No downloaded JavaScript is executed. Preserve the
// Microsoft/Rocketbox and Avatar Studio MIT notices alongside redistributed GLBs.
import fs from 'node:fs';
import path from 'node:path';
const dir='public/models/humans'; fs.mkdirSync(dir,{recursive:true});
for(const [source,gender] of [['arjun','male'],['priya','female']]) {
  const raw=fs.readFileSync(`data/avatar-sources/${source}.glb`);
  const jsonLength=raw.readUInt32LE(12), g=JSON.parse(raw.toString('utf8',20,20+jsonLength));
  const binStart=20+jsonLength+8, bin=raw.subarray(binStart);
  const keep=new Set(['Body','Hair','Outfit_formal','Skin_formal','Top_shirt','Skin_shirt','Top_tee','Skin_tee','Trousers','Shoes']);
  const meshUsed=new Set();
  for(const node of g.nodes) if(node.mesh!=null) {
    if(keep.has(node.name)) meshUsed.add(node.mesh);
    else { delete node.mesh; delete node.skin; }
    delete node.weights;
  }
  g.animations=g.animations.filter(a=>['Idle','Walk','Wave'].includes(a.name));
  const remap=(items,set)=>{const map=new Map();const list=items.filter((_,i)=>set.has(i)).map((v,i)=>{map.set([...set].sort((a,b)=>a-b)[i],i);return v;});return {list,map};};
  const meshes=remap(g.meshes,meshUsed); g.meshes=meshes.list;
  for(const node of g.nodes) if(node.mesh!=null) node.mesh=meshes.map.get(node.mesh);
  const accUsed=new Set(),matUsed=new Set();
  for(const mesh of g.meshes) {
    const oldNames=mesh.extras?.targetNames||[];
    const blink=oldNames.map((n,i)=>/eyeBlinkLeft|eyeBlinkRight/.test(n)?i:-1).filter(i=>i>=0);
    for(const p of mesh.primitives) {
      if(p.targets) p.targets=blink.map(i=>p.targets[i]);
      if(p.targets?.length===0) delete p.targets;
      Object.values(p.attributes).forEach(i=>accUsed.add(i));
      if(p.indices!=null)accUsed.add(p.indices);
      for(const target of p.targets||[])Object.values(target).forEach(i=>accUsed.add(i));
      if(p.material!=null)matUsed.add(p.material);
    }
    if(mesh.extras?.targetNames)mesh.extras.targetNames=blink.map(i=>oldNames[i]);
    if(mesh.weights)mesh.weights=blink.map(()=>0);
  }
  for(const skin of g.skins||[])if(skin.inverseBindMatrices!=null)accUsed.add(skin.inverseBindMatrices);
  for(const a of g.animations)for(const s of a.samplers){accUsed.add(s.input);accUsed.add(s.output);}
  const acc=remap(g.accessors,accUsed), mats=remap(g.materials,matUsed);
  g.accessors=acc.list;g.materials=mats.list;
  for(const mesh of g.meshes)for(const p of mesh.primitives){
    for(const k of Object.keys(p.attributes))p.attributes[k]=acc.map.get(p.attributes[k]);
    if(p.indices!=null)p.indices=acc.map.get(p.indices);
    if(p.material!=null)p.material=mats.map.get(p.material);
    for(const t of p.targets||[])for(const k of Object.keys(t))t[k]=acc.map.get(t[k]);
  }
  for(const skin of g.skins||[])if(skin.inverseBindMatrices!=null)skin.inverseBindMatrices=acc.map.get(skin.inverseBindMatrices);
  for(const a of g.animations)for(const s of a.samplers){s.input=acc.map.get(s.input);s.output=acc.map.get(s.output);}
  const texUsed=new Set();
  const visitTextures=(o,fn)=>{for(const [k,v] of Object.entries(o||{})){if(v&&typeof v==='object'){if(k.endsWith('Texture')&&v.index!=null)fn(v);else visitTextures(v,fn);}}};
  for(const m of g.materials)visitTextures(m,t=>texUsed.add(t.index));
  const textures=remap(g.textures,texUsed); g.textures=textures.list;
  for(const m of g.materials)visitTextures(m,t=>{t.index=textures.map.get(t.index);});
  const imgUsed=new Set();
  for(const t of g.textures){if(t.source!=null)imgUsed.add(t.source);for(const ext of Object.values(t.extensions||{}))if(ext.source!=null)imgUsed.add(ext.source);}
  const images=remap(g.images,imgUsed);g.images=images.list;
  for(const t of g.textures){if(t.source!=null)t.source=images.map.get(t.source);for(const ext of Object.values(t.extensions||{}))if(ext.source!=null)ext.source=images.map.get(ext.source);}
  const viewUsed=new Set();
  for(const a of g.accessors){if(a.bufferView!=null)viewUsed.add(a.bufferView);if(a.sparse){viewUsed.add(a.sparse.indices.bufferView);viewUsed.add(a.sparse.values.bufferView);}}
  for(const i of g.images)if(i.bufferView!=null)viewUsed.add(i.bufferView);
  const views=remap(g.bufferViews,viewUsed);g.bufferViews=views.list;
  for(const a of g.accessors){if(a.bufferView!=null)a.bufferView=views.map.get(a.bufferView);if(a.sparse){a.sparse.indices.bufferView=views.map.get(a.sparse.indices.bufferView);a.sparse.values.bufferView=views.map.get(a.sparse.values.bufferView);}}
  for(const i of g.images)if(i.bufferView!=null)i.bufferView=views.map.get(i.bufferView);
  const parts=[];let offset=0;
  for(const view of g.bufferViews){
    const aligned=Math.ceil(offset/4)*4;if(aligned>offset)parts.push(Buffer.alloc(aligned-offset));offset=aligned;
    parts.push(bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength));view.byteOffset=offset;view.buffer=0;offset+=view.byteLength;
  }
  const binary=Buffer.concat(parts);const padded=Buffer.concat([binary,Buffer.alloc((4-binary.length%4)%4)]);
  g.buffers=[{byteLength:padded.length}];g.asset.copyright='Microsoft Rocketbox (c) 2020 Microsoft; GLB conversion/outfit fitting by Rohit Biradar (MIT).';
  g.asset.extras={gender,source:`https://github.com/memoriesrohit/avatar-studio/blob/main/models/${source}_${gender==='male'?'smart':'casual'}.glb`};
  const text=Buffer.from(JSON.stringify(g)),json=Buffer.concat([text,Buffer.alloc((4-text.length%4)%4,32)]);
  const header=Buffer.alloc(20);header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(28+json.length+padded.length,8);header.writeUInt32LE(json.length,12);header.writeUInt32LE(0x4e4f534a,16);
  const bh=Buffer.alloc(8);bh.writeUInt32LE(padded.length);bh.writeUInt32LE(0x004e4942,4);
  fs.writeFileSync(path.join(dir,`${gender}.glb`),Buffer.concat([header,json,bh,padded]));
  console.log(`${gender}: ${(raw.length/1e6).toFixed(1)} MB -> ${((28+json.length+padded.length)/1e6).toFixed(1)} MB; ${g.meshes.length} meshes; ${g.animations.map(a=>a.name).join('/')}`);
}
fs.copyFileSync('data/avatar-sources/THIRD_PARTY_NOTICES.md',path.join(dir,'MICROSOFT-LICENSE.md'));
fs.copyFileSync('data/avatar-sources/LICENSE-avatar-studio.txt',path.join(dir,'AVATAR-STUDIO-LICENSE.txt'));
