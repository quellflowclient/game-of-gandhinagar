import {PUBLIC_SUPABASE_PROJECT} from '../src/backend/project.js';

// CDN-cached multiplayer area snapshot. Every player in the same 160 m area hits the
// same URL, so the edge cache serves them all and the database sees ~1 query per
// area per second instead of one per player. No names/emails: just
// [residentNo, x, y, z, heading, vehicle]; the signed-in roster maps them to people.
export function createPositionsHandler(env=process.env){return async function handler(req,res){
 const fail=(status,error)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json({error});};
 if(req.method!=='GET')return fail(405,'Method not allowed');
 const place=String(req.query?.place||''),cx=Number(req.query?.cx),cz=Number(req.query?.cz);
 if(!['ldrp','dandi'].includes(place)||!Number.isInteger(cx)||!Number.isInteger(cz)||Math.abs(cx)>200||Math.abs(cz)>200)return fail(400,'Bad area');
 try{
  const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL||PUBLIC_SUPABASE_PROJECT.url;
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||PUBLIC_SUPABASE_PROJECT.publishableKey;
  const r=await fetch(`${url}/rest/v1/rpc/positions_snapshot`,{method:'POST',headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'},
   body:JSON.stringify({pp:place,cx,cz}),signal:AbortSignal.timeout(4000)});
  if(!r.ok)return fail(r.status===404?501:502,'Snapshot unavailable');
  const data=await r.json();
  // 1 s fresh at the edge, then serve slightly stale while one request refreshes.
  res.setHeader('Cache-Control','public, max-age=0, s-maxage=1, stale-while-revalidate=2');
  res.setHeader('CDN-Cache-Control','public, s-maxage=1, stale-while-revalidate=2');
  return res.status(200).json(data);
 }catch{return fail(503,'Snapshot unavailable');}
};}
export default createPositionsHandler();
