import {PUBLIC_SUPABASE_PROJECT} from '../src/backend/project.js';

// Authenticated, short-lived relay credentials; long-lived TURN keys stay server-side.
export function createTurnHandler(env=process.env){return async function handler(req,res){
 const reply=(status,data)=>{res.setHeader('Cache-Control','no-store');return res.status(status).json(data);};
 if(req.method!=='GET')return reply(405,{error:'Method not allowed'});
 const auth=req.headers.authorization;if(!auth?.startsWith('Bearer '))return reply(401,{error:'Sign in first'});
 if(!env.TURN_KEY_ID||!env.TURN_KEY_API_TOKEN){res.setHeader('Retry-After','60');return reply(503,{code:'TURN_NOT_CONFIGURED',error:'TURN relay is not configured'});}
 try{
  const url=env.SUPABASE_URL||env.VITE_SUPABASE_URL||PUBLIC_SUPABASE_PROJECT.url;
  const key=env.SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_PUBLISHABLE_KEY||env.VITE_SUPABASE_ANON_KEY||PUBLIC_SUPABASE_PROJECT.publishableKey;
  const user=await fetch(`${url}/auth/v1/user`,{headers:{apikey:key,Authorization:auth},signal:AbortSignal.timeout(8000)});
  if(!user.ok)return reply(401,{error:'Session expired'});
  const profile=await user.json();if(!profile.id||!profile.email_confirmed_at)return reply(403,{error:'Verify your email'});
  const response=await fetch(`https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(env.TURN_KEY_ID)}/credentials/generate-ice-servers`,{method:'POST',headers:{Authorization:`Bearer ${env.TURN_KEY_API_TOKEN}`,'Content-Type':'application/json'},body:JSON.stringify({ttl:3600}),signal:AbortSignal.timeout(8000)});
  if(!response.ok)return reply(502,{error:'Relay credentials could not be issued'});
  const data=await response.json();if(!Array.isArray(data.iceServers))return reply(502,{error:'Invalid relay response'});
  return reply(200,{iceServers:data.iceServers,ttl:3600});
 }catch{return reply(503,{code:'TURN_UNAVAILABLE',error:'Relay temporarily unavailable'});}
};}
export default createTurnHandler();
