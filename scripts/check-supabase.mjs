import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';
import {PUBLIC_SUPABASE_PROJECT as project} from '../src/backend/project.js';
const sb=createClient(project.url,project.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
const health=await sb.rpc('game_health');assert.ifError(health.error);assert.equal(health.data.schema,2);
const players=await sb.rpc('online_players');assert(players.error,'anonymous presence RPC must be denied');
const profiles=await sb.from('public_profiles').select('id').limit(1);assert(profiles.error,'anonymous profiles must be denied');
const move=await sb.rpc('update_player_presence',{px:0,py:0,pz:0,ph:0,pv:'walk',pp:'ldrp'});assert(move.error,'anonymous movement must be denied');
const chat=await sb.from('messages').select('id').limit(1);assert(!chat.data?.length,'anonymous must not see chats');
for(const table of ['voice_calls','voice_signals','city_seats']){const r=await sb.from(table).select('*').limit(1);assert(r.error,'Anonymous access must be denied: '+table);}
console.log('Live Supabase passed: schema v2 reachable; anonymous profiles, online players, movement, private messages, calls, signals and table state denied.');
