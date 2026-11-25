-- People of Gandhinagar · admin panel backend.
-- Run once in Supabase → SQL editor (after schema.sql, multiplayer.sql, voice.sql).
-- 1) Admins are listed in public.admins. Only they can call the admin_* functions.
-- 2) Movement history is append-only (presence_log), sampled every 20 s per player.
-- 3) User data is protected from deletion: profiles, chats, waves, connections and
--    history cannot be deleted through the API by anyone (not even admins).

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete restrict,
  email text not null,
  added_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.admins where user_id = auth.uid());
$$;
grant execute on function public.is_admin() to authenticated;

-- ---------- append-only movement history ----------
create table if not exists public.presence_log (
  id bigserial primary key,
  user_id uuid not null,
  x real not null, z real not null,
  place text, vehicle text,
  at timestamptz not null default now()
);
create index if not exists presence_log_user_at on public.presence_log(user_id, at desc);
create index if not exists presence_log_at on public.presence_log(at desc);
alter table public.presence_log enable row level security;
revoke all on public.presence_log from anon, authenticated;

create or replace function public.log_presence() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.presence_log where user_id = new.id and at > now() - interval '20 seconds') then
    insert into public.presence_log(user_id, x, z, place, vehicle) values (new.id, new.x, new.z, new.place, new.vehicle);
  end if;
  return new;
end $$;
drop trigger if exists presence_history on public.player_presence;
create trigger presence_history after insert or update on public.player_presence
  for each row execute function public.log_presence();

-- ---------- nothing important can be deleted through the API ----------
create or replace function public.forbid_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Deleting % is disabled: Gandhinagar keeps a permanent record.', tg_table_name;
end $$;
do $$ declare t text; begin
  foreach t in array array['profiles','threads','messages','world_messages','waves','presence_log','plans','reports','voice_calls'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop trigger if exists keep_%1$s on public.%1$I', t);
      execute format('create trigger keep_%1$s before delete on public.%1$I for each row execute function public.forbid_delete()', t);
      execute format('revoke delete on public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- ---------- admin read functions ----------
create or replace function public.admin_overview() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin.'; end if;
  return jsonb_build_object(
    'users', (select count(*) from public.profiles),
    'verified', (select count(*) from auth.users where email_confirmed_at is not null),
    'new_today', (select count(*) from public.profiles where created_at > date_trunc('day', now() at time zone 'Asia/Kolkata') at time zone 'Asia/Kolkata'),
    'online', (select count(*) from public.player_presence where updated_at > now() - interval '60 seconds'),
    'connections', (select count(*) from public.threads),
    'accepted', (select count(*) from public.threads where accepted),
    'messages', (select count(*) from public.messages),
    'world_messages', (select count(*) from public.world_messages),
    'waves', (select count(*) from public.waves),
    'calls', (select count(*) from public.voice_calls),
    'history_points', (select count(*) from public.presence_log),
    'at', now());
end $$;

create or replace function public.admin_users() returns table (
  id uuid, email text, name text, role text, one_liner text, resident_no int, visible boolean,
  joined timestamptz, last_sign_in timestamptz, verified boolean,
  online boolean, x real, z real, place text, vehicle text, seen timestamptz,
  connections bigint, messages bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin.'; end if;
  return query
  select p.id, u.email::text, p.name, p.role, p.one_liner, p.resident_no, p.visible,
    p.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
    coalesce(pp.updated_at > now() - interval '60 seconds', false), pp.x, pp.z, pp.place, pp.vehicle,
    greatest(pp.updated_at, p.last_seen),
    (select count(*) from public.threads t where p.id in (t.a, t.b)),
    (select count(*) from public.messages m where m.sender = p.id)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.player_presence pp on pp.id = p.id
  order by coalesce(pp.updated_at, p.last_seen, p.created_at) desc;
end $$;

-- Every pair of players who connected (chat thread) plus wave counts between them.
create or replace function public.admin_connections() returns table (
  a uuid, a_name text, b uuid, b_name text, accepted boolean, started_by uuid,
  since timestamptz, messages bigint, last_message timestamptz, waves bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin.'; end if;
  return query
  select t.a, pa.name, t.b, pb.name, t.accepted, t.started_by, t.created_at,
    (select count(*) from public.messages m where m.thread = t.id),
    (select max(m.created_at) from public.messages m where m.thread = t.id),
    (select count(*) from public.waves w where (w.sender = t.a and w.target = t.b) or (w.sender = t.b and w.target = t.a))
  from public.threads t
  join public.profiles pa on pa.id = t.a
  join public.profiles pb on pb.id = t.b
  order by t.created_at desc;
end $$;

-- Live positions (last 2 minutes) for the admin map.
create or replace function public.admin_live() returns table (
  id uuid, name text, x real, z real, heading real, vehicle text, place text, updated_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin.'; end if;
  return query
  select pp.id, p.name, pp.x, pp.z, pp.heading, pp.vehicle, pp.place, pp.updated_at
  from public.player_presence pp join public.profiles p on p.id = pp.id
  where pp.updated_at > now() - interval '2 minutes';
end $$;

-- Movement history for one player (latest first).
create or replace function public.admin_history(target uuid, max_rows int default 500) returns table (
  x real, z real, place text, vehicle text, at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Not an admin.'; end if;
  return query select l.x, l.z, l.place, l.vehicle, l.at from public.presence_log l
    where l.user_id = target order by l.at desc limit least(greatest(max_rows, 1), 5000);
end $$;

revoke all on function public.admin_overview() from anon;
revoke all on function public.admin_users() from anon;
revoke all on function public.admin_connections() from anon;
revoke all on function public.admin_live() from anon;
revoke all on function public.admin_history(uuid, int) from anon;
grant execute on function public.admin_overview(), public.admin_users(), public.admin_connections(), public.admin_live(), public.admin_history(uuid, int) to authenticated;

-- ---------- make yourself an admin ----------
-- Replace the email below with the email you sign in to the game with, then run:
-- insert into public.admins(user_id, email)
--   select id, email from auth.users where email = 'YOUR_EMAIL_HERE'
--   on conflict (user_id) do nothing;
