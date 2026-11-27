import fs from 'node:fs/promises';
const query=await fs.readFile(new URL('../data/destinations.ql',import.meta.url),'utf8');
const endpoint=process.argv[2]||'https://overpass-api.de/api/interpreter';
const response=await fetch(endpoint+'?'+new URLSearchParams({data:query}),{headers:{Accept:'application/json','User-Agent':'GandhinagarWalk/1.0 map verification'},signal:AbortSignal.timeout(115000)});
if(!response.ok)throw Error(`Overpass HTTP ${response.status}: ${(await response.text()).slice(0,300)}`);
const data=await response.json();if(data.remark||!data.elements?.length)throw Error(data.remark||'Empty map response');
await fs.writeFile(new URL('../data/destinations-osm.json',import.meta.url),JSON.stringify(data));
console.log(JSON.stringify({elements:data.elements.length,timestamp:data.osm3s?.timestamp_osm_base}));
