-- People of Gandhinagar · 500-player scaling + consented live location.
-- Run AFTER schema.sql, multiplayer.sql, voice.sql, admin.sql. Safe to re-run.
--
-- Why: the old setup published player_presence / chat tables through Realtime
-- "postgres_changes". Every 1 s position write woke ALL clients, each ran RLS and
-- then re-downloaded the whole online list => O(players^2) load. At 500 players
-- that is ~250k permission checks/s and thousands of RPC calls/s.
--
-- New model:
--   * positions: clients write at most ~1/s (server throttled), and READ a compact,
--     CDN-cached area snapshot (api/positions.js -> positions_snapshot). DB cost is
--     per map area per second, not per player.
--   * roster (names/looks): nearest 80 players, refreshed every ~20 s per client.
--   * DMs, waves, calls, voice signals: DB triggers push to the private Realtime
--     topic "user:<id>" of only the 2 people involved (no fan-out to everyone).
--   * world chat: snapshot carries the latest world message id; clients fetch new
--     messages only when it changes.

-- ---------- 1. stop the O(n^2) postgres_changes fan-out ----------
do $$ declare n text; begin
  foreach n in array array['player_presence','messages','world_messages','plans','waves','voice_calls','voice_signals'] loop
    if exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=n) then
      execute format('alter publication supabase_realtime drop table public.%I',n);
    end if;
  end loop;
end $$;

create index if not exists player_presence_place_updated on public.player_presence(place, updated_at desc);
create index if not exists blocks_by_who on public.blocks(by, who);
create index if not exists blocks_who_by on public.blocks(who, by);

-- ---------- 2. throttled position write ----------
create or replace function public.update_player_presence(px real, py real, pz real, ph real, pv text, pp text)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- Cheap server-side throttle: at most ~1 write/s per player, whatever the client does.
  if exists(select 1 from player_presence where id=auth.uid() and updated_at > now()-interval '800 milliseconds') then return; end if;
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    then raise exception 'Verify your email to join multiplayer.'; end if;
  if not exists(select 1 from profiles where id=auth.uid() and visible and name <> '') then return; end if;
  if px is null or py is null or pz is null or ph is null or abs(px)>15000 or abs(pz)>15000 or abs(py)>100
    or abs(ph)>100 or pv not in ('walk','cycle','car','auto') or pp not in ('ldrp','dandi') or pp is null
    then raise exception 'Invalid player position.'; end if;
  insert into player_presence(id,x,y,z,heading,vehicle,place) values(auth.uid(),px,py,pz,ph,pv,pp)
  on conflict(id) do update set x=excluded.x,y=excluded.y,z=excluded.z,heading=excluded.heading,
    vehicle=excluded.vehicle,place=excluded.place,updated_at=now();
end $$;

-- ---------- 3. compact area snapshot (CDN cached, no names) ----------
-- 160 m cells; returns players in the 3x3 cells around (cx,cz), max 150, as
-- [residentNo, x, y, z, heading, vehicle]. Names/looks come from the roster below,
-- which applies visibility + block rules, so blocked players are never drawn.
create or replace function public.positions_snapshot(pp text, cx int, cz int) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    't', (extract(epoch from now())*1000)::bigint,
    'w', (select coalesce(max(id),0) from world_messages),
    'p', coalesce((select jsonb_agg(jsonb_build_array(r.n, r.x, r.y, r.z, r.h, r.v)) from (
        select p.resident_no as n, round(s.x::numeric,1) as x, round(s.y::numeric,1) as y, round(s.z::numeric,1) as z,
          round(s.heading::numeric,2) as h, s.vehicle as v
        from player_presence s join profiles p on p.id=s.id
        where s.place=pp and s.updated_at > now()-interval '30 seconds' and p.visible and p.name <> ''
          and s.x >= (cx-1)*160 and s.x < (cx+2)*160 and s.z >= (cz-1)*160 and s.z < (cz+2)*160
        order by s.updated_at desc limit 150) r), '[]'::jsonb));
$$;

-- ---------- 4. nearby roster + per-place counts ----------
create or replace function public.online_players_near(pp text, px real, pz real) returns jsonb
language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'counts', coalesce((select jsonb_object_agg(place, n) from (
        select s.place, count(*) n from player_presence s join profiles p on p.id=s.id
        where s.updated_at > now()-interval '45 seconds' and p.visible and p.name <> '' group by s.place) c), '{}'::jsonb),
    'players', coalesce((select jsonb_agg(row_to_json(t)) from (
        select s.id as "userId", s.id as key, p.resident_no as "residentNo", p.name, p.role, p.one_liner as "oneLiner",
          p.open_to as "openTo", p.look, p.skin, s.x, s.y, s.z, s.heading, s.vehicle, s.place, s.updated_at as "updatedAt"
        from player_presence s join profiles p on p.id=s.id
        where s.updated_at > now()-interval '45 seconds' and p.visible and p.name <> ''
          and (pp is null or s.place = pp) and not is_blocked(auth.uid(), p.id)
        order by case when s.place = pp then (s.x-coalesce(px,0))^2 + (s.z-coalesce(pz,0))^2 else 1e12 end
        limit 80) t), '[]'::jsonb)) end;
$$;

revoke all on function public.positions_snapshot(text,int,int), public.online_players_near(text,real,real) from public;
grant execute on function public.positions_snapshot(text,int,int) to anon, authenticated;
grant execute on function public.online_players_near(text,real,real) to authenticated;

-- ---------- 5. targeted realtime pushes (private topic user:<id>) ----------
create or replace function public.rt_push_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare t threads; body jsonb;
begin
  select * into t from threads where id = new.thread;
  body := jsonb_build_object('id',new.id,'thread',new.thread,'from',new.sender,'text',new.body,
    'at',(extract(epoch from new.created_at)*1000)::bigint,'to',case when new.sender=t.a then t.b else t.a end);
  perform realtime.send(body, 'message', 'user:'||t.a::text, true);
  perform realtime.send(body, 'message', 'user:'||t.b::text, true);
  return null;
exception when others then return null; -- never block a chat insert on realtime problems
end $$;
drop trigger if exists rt_message on public.messages;
create trigger rt_message after insert on public.messages for each row execute function public.rt_push_message();

create or replace function public.rt_push_wave() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(jsonb_build_object('from',new.sender,'to',new.target), 'wave', 'user:'||new.target::text, true);
  return null;
exception when others then return null;
end $$;
drop trigger if exists rt_wave on public.waves;
create trigger rt_wave after insert on public.waves for each row execute function public.rt_push_wave();

create or replace function public.rt_push_call() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform realtime.send(to_jsonb(new), 'call', 'user:'||new.caller::text, true);
  perform realtime.send(to_jsonb(new), 'call', 'user:'||new.callee::text, true);
  return null;
exception when others then return null;
end $$;
drop trigger if exists rt_call on public.voice_calls;
create trigger rt_call after insert or update on public.voice_calls for each row execute function public.rt_push_call();

create or replace function public.rt_push_signal() returns trigger
language plpgsql security definer set search_path = public as $$
declare c voice_calls;
begin
  select * into c from voice_calls where id = new.call_id;
  perform realtime.send(to_jsonb(new), 'signal', 'user:'||(case when new.sender=c.caller then c.callee else c.caller end)::text, true);
  return null;
exception when others then return null;
end $$;
drop trigger if exists rt_signal on public.voice_signals;
create trigger rt_signal after insert on public.voice_signals for each row execute function public.rt_push_signal();

-- Only the owner may listen on user:<id>. Nobody may send on it from the browser.
drop policy if exists "own user topic" on realtime.messages;
create policy "own user topic" on realtime.messages for select to authenticated
  using (realtime.topic() = 'user:' || auth.uid()::text);

-- Fallback when the Realtime socket is unavailable: tiny "anything new?" check.
create or replace function public.my_inbox_version() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'm', (select coalesce(max(m.id),0) from messages m join threads t on t.id=m.thread
           where auth.uid() in (t.a,t.b) and m.sender <> auth.uid()),
    'w', (select coalesce(max(id),0) from waves where target = auth.uid()));
$$;
revoke all on function public.my_inbox_version() from public, anon;
grant execute on function public.my_inbox_version() to authenticated;
create index if not exists waves_target_id on public.waves(target, id desc);
create index if not exists messages_thread_id on public.messages(thread, id desc);

-- ---------- 6. consented real-world location (admin-only read) ----------
create table if not exists public.player_locations (
  id uuid primary key references public.profiles(id) on delete cascade,
  lat double precision not null, lng double precision not null, accuracy real,
  consent_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.player_locations enable row level security;
revoke all on public.player_locations from anon, authenticated; -- only via functions below

create or replace function public.update_my_location(plat double precision, plng double precision, pacc real)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Sign in first.'; end if;
  if plat is null or plng is null or abs(plat) > 90 or abs(plng) > 180 or coalesce(pacc,0) < 0 or coalesce(pacc,0) > 100000
    then raise exception 'Invalid location.'; end if;
  if exists(select 1 from player_locations where id=auth.uid() and updated_at > now()-interval '4 seconds') then return; end if;
  if not exists(select 1 from profiles where id=auth.uid()) then return; end if;
  insert into player_locations(id,lat,lng,accuracy) values(auth.uid(),plat,plng,pacc)
  on conflict(id) do update set lat=excluded.lat,lng=excluded.lng,accuracy=excluded.accuracy,updated_at=now();
end $$;
create or replace function public.clear_my_location() returns void
language sql security definer set search_path = public as $$ delete from player_locations where id=auth.uid(); $$;
revoke all on function public.update_my_location(double precision,double precision,real), public.clear_my_location() from public, anon;
grant execute on function public.update_my_location(double precision,double precision,real), public.clear_my_location() to authenticated;

create or replace function public.admin_locations() returns table (
  id uuid, name text, email text, lat double precision, lng double precision, accuracy real,
  updated_at timestamptz, consent_at timestamptz, in_game boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin.'; end if;
  return query
  select l.id, p.name, u.email::text, l.lat, l.lng, l.accuracy, l.updated_at, l.consent_at,
    coalesce(pp.updated_at > now()-interval '60 seconds', false)
  from player_locations l join profiles p on p.id=l.id join auth.users u on u.id=l.id
  left join player_presence pp on pp.id=l.id
  order by l.updated_at desc;
end $$;
revoke all on function public.admin_locations() from public, anon;
grant execute on function public.admin_locations() to authenticated;

create or replace function public.game_health() returns jsonb language sql stable as $$
  select jsonb_build_object('schema',3,'multiplayer',true,'scale',500,'location',true);
$$;
