-- People of Gandhinagar: database schema for Supabase (Postgres).
-- Run this once in the Supabase SQL editor of a new project.
-- Every table has row-level security on. Limits are enforced in security-definer functions.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create sequence if not exists resident_no_seq start 1001;

create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  resident_no int not null default nextval('resident_no_seq'),
  name text not null default '' check (char_length(name) <= 40),
  role text not null default '' check (char_length(role) <= 80),
  one_liner text not null default '' check (char_length(one_liner) <= 120),
  open_to text not null default 'walk',
  interests text[] not null default '{}',
  reasons text[] not null default '{}',
  links jsonb not null default '{}',
  look text not null default 'casual',
  skin int not null default 11037511,
  home text not null default '',
  hours text[] not null default '{}',
  about jsonb not null default '{}',
  visible boolean not null default true,
  email_alerts boolean not null default true,
  last_x real, last_z real,
  last_seen timestamptz default now(),
  created_at timestamptz not null default now(),
  constraint max_interests check (cardinality(interests) <= 6),
  constraint max_reasons check (cardinality(reasons) <= 3)
);
alter table profiles enable row level security;
-- Visible profiles are readable, but only the public columns (links are never readable
-- directly; they come through public_profiles, which hides them from blocked people).
create policy "visible profiles read" on profiles for select to authenticated using (visible or id = auth.uid());
create policy "own profile write" on profiles for update using (id = auth.uid());
revoke select on profiles from anon, authenticated;
grant select (id, resident_no, name, role, one_liner, open_to, interests, reasons, look, skin, home, hours, about,
  visible, last_x, last_z, last_seen) on profiles to authenticated;
grant update (name, role, one_liner, open_to, interests, reasons, links, look, skin, home, hours, about,
  visible, email_alerts, last_x, last_z) on profiles to authenticated;

-- Your own full profile, including links and alert settings.
create or replace function my_profile() returns profiles language sql stable security definer set search_path = public as $$
  select * from profiles where id = auth.uid();
$$;

-- New sign-ups get an empty profile.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id) values (new.id) on conflict do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

-- ---------- blocks (needed by the public view) ----------
create table if not exists blocks (
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  who uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (by, who)
);
alter table blocks enable row level security;
create policy "own blocks" on blocks for all using (by = auth.uid()) with check (by = auth.uid());

create or replace function is_blocked(x uuid, y uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from blocks where (by = x and who = y) or (by = y and who = x));
$$;

-- What other people may see. Never the email or phone (those live in auth.users).
-- Links are only shown to signed-in people who are not blocked.
create or replace view public_profiles with (security_barrier) as
  select id, resident_no, name, role, one_liner, open_to, interests, reasons,
    case when auth.uid() is not null and not is_blocked(auth.uid(), id) then links else '{}'::jsonb end as links,
    look, skin, home, hours, about, last_x, last_z, last_seen
  from profiles
  where visible and name <> '' and (auth.uid() is null or not is_blocked(auth.uid(), id));
revoke all on public_profiles from anon;
grant select on public_profiles to authenticated;

-- ---------- profile views ----------
create table if not exists profile_views (
  id bigserial primary key,
  by uuid not null default auth.uid() references profiles(id) on delete cascade,
  who uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table profile_views enable row level security;
create policy "insert own views" on profile_views for insert with check (by = auth.uid());

create or replace function views_this_week() returns setof public_profiles language sql stable security definer set search_path = public as $$
  select pp.* from public_profiles pp
  where pp.id in (select distinct by from profile_views where who = auth.uid() and created_at > now() - interval '7 days');
$$;

-- ---------- waves ----------
create table if not exists waves (
  id bigserial primary key,
  sender uuid not null references profiles(id) on delete cascade,
  target uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table waves enable row level security;
create policy "see own waves" on waves for select using (sender = auth.uid() or target = auth.uid());

create or replace function send_wave(target uuid) returns waves language plpgsql security definer set search_path = public as $$
declare w waves;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if is_blocked(auth.uid(), target) then raise exception 'You cannot wave at this person.'; end if;
  if (select count(*) from waves where sender = auth.uid() and created_at > now() - interval '1 day') >= 30 then
    raise exception 'That is enough waves for today.'; end if;
  if exists (select 1 from waves where sender = auth.uid() and waves.target = send_wave.target and created_at > now() - interval '1 day') then
    raise exception 'You already waved at them today.'; end if;
  insert into waves (sender, target) values (auth.uid(), target) returning * into w;
  return w;
end $$;

-- ---------- threads and messages ----------
create table if not exists threads (
  id uuid primary key default gen_random_uuid(),
  a uuid not null references profiles(id) on delete cascade,
  b uuid not null references profiles(id) on delete cascade,
  started_by uuid not null references profiles(id) on delete cascade,
  accepted boolean not null default false,
  created_at timestamptz not null default now(),
  unique (a, b),
  check (a < b)
);
alter table threads enable row level security;
create policy "members read threads" on threads for select using (auth.uid() in (a, b));

create table if not exists messages (
  id bigserial primary key,
  thread uuid not null references threads(id) on delete cascade,
  sender uuid not null references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);
alter table messages enable row level security;
create policy "members read messages" on messages for select
  using (exists (select 1 from threads t where t.id = thread and auth.uid() in (t.a, t.b)));

create or replace function has_contact_details(t text) returns boolean language sql immutable as $$
  select t ~* '(\+?\d[\d\s-]{7,}\d)|([\w.+-]+@[\w-]+\.[\w.]+)|(https?://|www\.)';
$$;

-- Sends a message, creating the thread (a connect request) if needed.
-- Up to 3 messages before the other person replies; their first reply accepts the request.
create or replace function send_message(target uuid, body text) returns messages language plpgsql security definer set search_path = public as $$
declare t threads; m messages; lo uuid; hi uuid; sent int;
begin
  if auth.uid() is null then raise exception 'Please sign in first.'; end if;
  if is_blocked(auth.uid(), target) then raise exception 'You cannot message this person.'; end if;
  if has_contact_details(body) then raise exception 'No phone numbers, emails or links, please.'; end if;
  lo := least(auth.uid(), target); hi := greatest(auth.uid(), target);
  select * into t from threads where a = lo and b = hi;
  if not found then
    if (select count(*) from threads where started_by = auth.uid() and created_at > now() - interval '1 day') >= 20 then
      raise exception 'That is enough new requests for today.'; end if;
    insert into threads (a, b, started_by) values (lo, hi, auth.uid()) returning * into t;
  end if;
  if not t.accepted then
    if t.started_by <> auth.uid() then
      update threads set accepted = true where id = t.id;
    else
      select count(*) into sent from messages where thread = t.id and sender = auth.uid();
      if sent >= 3 then raise exception 'Wait for them to reply before sending more.'; end if;
    end if;
  end if;
  insert into messages (thread, sender, body) values (t.id, auth.uid(), body) returning * into m;
  return m;
end $$;

-- ---------- world chat ----------
create table if not exists world_messages (
  id bigserial primary key,
  sender uuid not null default auth.uid() references profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 280 and not has_contact_details(body)),
  created_at timestamptz not null default now()
);
alter table world_messages enable row level security;
create policy "anyone reads world" on world_messages for select to authenticated using (not is_blocked(auth.uid(), sender));
create policy "signed in posts world" on world_messages for insert with check (sender = auth.uid());

-- ---------- plans ----------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  host uuid not null default auth.uid(),
  cat text not null default 'other',
  title text not null check (char_length(title) between 3 and 100 and not has_contact_details(title)),
  when_text text not null default '',
  where_text text not null default '',
  created_at timestamptz not null default now(),
  constraint plans_host_fkey foreign key (host) references profiles(id) on delete cascade
);
alter table plans enable row level security;
create policy "anyone reads plans" on plans for select using (created_at > now() - interval '3 days');
create policy "host writes plans" on plans for insert with check (host = auth.uid());
create policy "host deletes plans" on plans for delete using (host = auth.uid());

create table if not exists plan_members (
  plan uuid not null references plans(id) on delete cascade,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  primary key (plan, user_id)
);
alter table plan_members enable row level security;
create policy "anyone reads plan members" on plan_members for select using (true);
create policy "join plans" on plan_members for insert with check (user_id = auth.uid());
create policy "leave plans" on plan_members for delete using (user_id = auth.uid());

-- ---------- events ("I am interested") ----------
create table if not exists event_interests (
  event_id text not null,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  primary key (event_id, user_id)
);
alter table event_interests enable row level security;
create policy "anyone counts interests" on event_interests for select using (true);
create policy "mark interest" on event_interests for insert with check (user_id = auth.uid());
create policy "unmark interest" on event_interests for delete using (user_id = auth.uid());

-- ---------- feedback and advertising leads (write-only from the app) ----------
create table if not exists suggestions (
  id bigserial primary key, by uuid default auth.uid(), kind text not null, body text not null check (char_length(body) <= 2000),
  created_at timestamptz not null default now()
);
alter table suggestions enable row level security;
create policy "anyone suggests" on suggestions for insert with check (true);

create table if not exists ad_requests (
  id bigserial primary key, by uuid default auth.uid(), kind text not null, place text not null default 'Anywhere',
  business text not null, contact text not null, note text not null default '',
  created_at timestamptz not null default now()
);
alter table ad_requests enable row level security;
create policy "anyone requests ads" on ad_requests for insert with check (true);

-- ---------- AI twin ----------
create table if not exists twins (
  owner uuid primary key default auth.uid() references profiles(id) on delete cascade,
  enabled boolean not null default false,
  adult boolean not null default false,
  answers jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  check (not enabled or adult)
);
alter table twins enable row level security;
create policy "own twin" on twins for all using (owner = auth.uid()) with check (owner = auth.uid());

-- Written only by the AI endpoint (service role). Owners can read and delete their own.
create table if not exists twin_chats (
  id bigserial primary key,
  owner uuid not null references profiles(id) on delete cascade,
  asker uuid not null,
  question text not null,
  answer text not null,
  created_at timestamptz not null default now(),
  constraint twin_chats_asker_fkey foreign key (asker) references profiles(id) on delete cascade
);
alter table twin_chats enable row level security;
create policy "owner reads twin chats" on twin_chats for select using (owner = auth.uid());
create policy "owner clears twin chats" on twin_chats for delete using (owner = auth.uid());

-- ---------- reports ----------
create table if not exists reports (
  id bigserial primary key, by uuid not null, who uuid not null, reason text not null default '',
  chat jsonb not null default '[]', created_at timestamptz not null default now()
);
alter table reports enable row level security; -- no policies: only the owner (service role) reads them

create or replace function report_user(target uuid, reason text) returns void language plpgsql security definer set search_path = public as $$
declare lo uuid := least(auth.uid(), target); hi uuid := greatest(auth.uid(), target);
begin
  insert into reports (by, who, reason, chat)
  select auth.uid(), target, reason, coalesce(jsonb_agg(jsonb_build_object('sender', m.sender, 'body', m.body, 'at', m.created_at) order by m.created_at), '[]')
  from messages m join threads t on t.id = m.thread where t.a = lo and t.b = hi;
end $$;

-- ---------- scores ----------
create table if not exists scores (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references profiles(id) on delete cascade,
  game text not null, score int not null check (score between 0 and 100000),
  created_at timestamptz not null default now()
);
alter table scores enable row level security;
create policy "insert own scores" on scores for insert with check (user_id = auth.uid());

create or replace function top_scores(g text) returns table (name text, score int) language sql stable security definer set search_path = public as $$
  select p.name, max(s.score)::int from scores s join profiles p on p.id = s.user_id
  where s.game = g and p.visible group by p.id, p.name order by 2 desc limit 10;
$$;

-- ---------- retention (needs the pg_cron extension, enable it in Database > Extensions) ----------
-- select cron.schedule('twin-chat-retention', '0 3 * * *', $$delete from twin_chats where created_at < now() - interval '14 days'$$);
-- select cron.schedule('expire-requests', '0 3 * * *', $$delete from threads where not accepted and created_at < now() - interval '7 days'$$);

-- Realtime: add messages, world_messages and plans to the supabase_realtime publication.
-- The authenticated game presence schema follows below.
