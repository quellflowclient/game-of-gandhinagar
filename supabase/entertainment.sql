-- GIFT game venues, scheduled shows and server-ordered standing zones.
-- Apply after schema.sql, multiplayer.sql and admin.sql. No existing records
-- are removed. New account appearance continues using profiles.look/skin.
begin;

create table if not exists public.entertainment_settings(
 id text primary key check(id='global'),club_enabled boolean not null default true,
 club_audio text not null default '',club_bpm int not null default 120 check(club_bpm between 60 and 200),
 club_volume real not null default .7 check(club_volume between 0 and 1),
 revision bigint not null default 1,updated_at timestamptz not null default now()
);
insert into public.entertainment_settings(id) values('global') on conflict do nothing;
create table if not exists public.concert_events(
 id uuid primary key default gen_random_uuid(),title text not null check(length(title) between 1 and 80),
 artist text not null default '' check(length(artist)<=80),description text not null default '' check(length(description)<=500),
 starts_at timestamptz not null,ends_at timestamptz not null,entry_minutes int not null default 15 check(entry_minutes between 0 and 120),
 audio_url text not null default '',video_url text not null default '',loop_media boolean not null default true,
 bpm int not null default 120 check(bpm between 60 and 200),volume real not null default .85 check(volume between 0 and 1),
 premium_capacity int not null default 96 check(premium_capacity between 0 and 192),
 middle_capacity int not null default 144 check(middle_capacity between 0 and 192),
 general_capacity int not null default 192 check(general_capacity between 0 and 192),
 status text not null default 'draft' check(status in('draft','published','cancelled')),
 revision bigint not null default 1,created_by uuid references auth.users(id),updated_at timestamptz not null default now(),
 check(ends_at>starts_at and ends_at<=starts_at+interval '24 hours')
);
create sequence if not exists public.event_arrival_sequence;
create table if not exists public.concert_members(
 event_id uuid not null references public.concert_events(id),user_id uuid not null references public.profiles(id),
 tier text not null check(tier in('premium','middle','general')),
 arrival bigint not null default nextval('public.event_arrival_sequence'),joined_at timestamptz not null default now(),
 lease_until timestamptz not null default now(),left_at timestamptz,blocked boolean not null default false,
 primary key(event_id,user_id)
);
create index if not exists concert_queue_order on public.concert_members(event_id,tier,arrival) where left_at is null and not blocked;
create table if not exists public.venue_presence(
 user_id uuid primary key references public.profiles(id),venue_id text not null check(venue_id in('city-club','gift-live')),
 action text not null default 'idle' check(action in('idle','dance','cheer','clap','wave')),
 event_id uuid references public.concert_events(id),started_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.venue_presence add column if not exists event_id uuid references public.concert_events(id);
alter table public.venue_presence add column if not exists started_at timestamptz not null default now();
alter table public.entertainment_settings enable row level security;
alter table public.concert_events enable row level security;
alter table public.concert_members enable row level security;
alter table public.venue_presence enable row level security;
revoke all on public.entertainment_settings,public.concert_events,public.concert_members,public.venue_presence from anon,authenticated;
grant select on public.venue_presence to authenticated;
drop policy if exists venue_members_read on public.venue_presence;
create policy venue_members_read on public.venue_presence for select to authenticated using(
 exists(select 1 from public.profiles p where p.id=user_id and p.visible and p.name<>'')
 and not public.is_blocked(auth.uid(),user_id)
 and exists(select 1 from public.player_presence p where p.id=auth.uid() and p.place='gift' and p.updated_at>now()-interval '60 seconds')
);

create or replace function public.event_media_url_ok(value text) returns boolean language sql immutable set search_path='' as $$
 select length(coalesce(value,''))<=2048 and (coalesce(value,'')='' or value ~* '^(https://[^[:space:]]+|/(audio|media|events)/[^[:space:]]+)\.(mp3|m4a|aac|ogg|wav|mp4|webm)(\?[^[:space:]]*)?$');
$$;

create or replace function public.entertainment_catalog() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('server_now',floor(extract(epoch from now())*1000),'club',(select to_jsonb(s) from public.entertainment_settings s where id='global'),
 'events',coalesce((select jsonb_agg(to_jsonb(e)-'created_by' order by e.starts_at) from public.concert_events e where e.status<>'draft' and e.ends_at>now()-interval '1 day'),'[]'::jsonb));
$$;

create or replace function public.event_receipt(eid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare m public.concert_members;e public.concert_events;idx bigint;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 select * into e from public.concert_events where id=eid;
 select * into m from public.concert_members where event_id=eid and user_id=auth.uid();
 if e.id is null or e.status<>'published' or now()>=e.ends_at then return jsonb_build_object('active',false,'ended',true);end if;
 if m.user_id is null or m.blocked or m.left_at is not null or m.lease_until<=now() then return jsonb_build_object('active',false,'ended',false);end if;
 select count(*) into idx from public.concert_members q where q.event_id=eid and q.tier=m.tier and not q.blocked and q.left_at is null and q.lease_until>now() and q.arrival<m.arrival;
 return jsonb_build_object('active',true,'event_id',eid,'tier',m.tier,'position',idx,'arrival',m.arrival,'lease_until',m.lease_until,'server_now',floor(extract(epoch from now())*1000));
end $$;

create or replace function public.join_concert(eid uuid,zone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.concert_events;m public.concert_members;p public.player_presence;capacity int;occupied int;
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email first.';end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and visible and name<>'') then raise exception 'Finish your profile and enable visibility first.';end if;
 if zone not in('premium','middle','general') or zone is null then raise exception 'Choose a valid zone.';end if;
 perform pg_advisory_xact_lock(hashtext('gog-concert-user:'||auth.uid()::text));
 -- Every join/zone change for a show is serialized. Client clocks and arrival
 -- indices are never accepted, including two simultaneous joins by one account.
 select * into e from public.concert_events where id=eid for update;
 if e.id is null or e.status<>'published' then raise exception 'This concert is not open.';end if;
 if now()<e.starts_at-make_interval(mins=>e.entry_minutes) then raise exception 'Entry has not opened yet.';end if;
 if now()>=e.ends_at then raise exception 'This concert has ended.';end if;
 select * into m from public.concert_members where event_id=eid and user_id=auth.uid();
 if m.blocked then raise exception 'The organiser has restricted your entry.';end if;
 if exists(select 1 from public.concert_members other where other.user_id=auth.uid() and other.event_id<>eid and other.left_at is null and not other.blocked and other.lease_until>now()) then raise exception 'Leave your current concert first.';end if;
 select * into p from public.player_presence where id=auth.uid() and updated_at>now()-interval '45 seconds' and place='gift';
 if p.id is null then raise exception 'Join GIFT City first.';end if;
 if not((p.x-3681.24)^2+(p.z-4212.77)^2<=3600 or (m.user_id is not null and m.left_at is null and p.x between 3629.24 and 3733.24 and p.z between 4040.77 and 4204.77)) then raise exception 'Go to the concert entrance first.';end if;
 if m.user_id is not null and m.tier=zone and m.left_at is null and m.lease_until>now() then
   update public.concert_members set lease_until=least(e.ends_at,now()+interval '90 seconds') where event_id=eid and user_id=auth.uid();return public.event_receipt(eid);
 end if;
 capacity:=case zone when 'premium' then e.premium_capacity when 'middle' then e.middle_capacity else e.general_capacity end;
 select count(*) into occupied from public.concert_members where event_id=eid and tier=zone and user_id<>auth.uid() and not blocked and left_at is null and lease_until>now();
 if occupied>=capacity then raise exception 'This zone is full. Choose another zone.';end if;
 insert into public.concert_members(event_id,user_id,tier,lease_until) values(eid,auth.uid(),zone,least(e.ends_at,now()+interval '90 seconds'))
 on conflict(event_id,user_id) do update set tier=excluded.tier,arrival=nextval('public.event_arrival_sequence'),joined_at=now(),lease_until=excluded.lease_until,left_at=null;
 return public.event_receipt(eid);
end $$;

create or replace function public.renew_concert(eid uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 update public.concert_members m set lease_until=least(e.ends_at,now()+interval '90 seconds') from public.concert_events e
 where m.event_id=eid and e.id=m.event_id and m.user_id=auth.uid() and not m.blocked and m.left_at is null and m.lease_until>now()
 and e.status='published' and now()<e.ends_at
 and exists(select 1 from public.player_presence p where p.id=auth.uid() and p.place='gift' and p.updated_at>now()-interval '45 seconds' and p.x between 3629.24 and 3733.24 and p.z between 4040.77 and 4204.77);
 return public.event_receipt(eid);
end $$;
create or replace function public.leave_concert(eid uuid) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return;end if;
 perform 1 from public.concert_events where id=eid for update;
 update public.concert_members set left_at=now(),lease_until=now() where event_id=eid and user_id=auth.uid();
 update public.venue_presence set action='idle',event_id=null,started_at=now(),updated_at=now() where user_id=auth.uid();
end $$;

create or replace function public.venue_action(venue text,kind text) returns void language plpgsql security definer set search_path='' as $$
declare p public.player_presence;active_event uuid;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 if venue not in('city-club','gift-live') or kind not in('idle','dance','cheer','clap','wave') or venue is null or kind is null then raise exception 'Invalid venue action.';end if;
 if venue='gift-live' then select m.event_id into active_event from public.concert_members m join public.concert_events e on e.id=m.event_id where m.user_id=auth.uid() and m.left_at is null and not m.blocked and m.lease_until>now() and e.status='published' and now()<e.ends_at;end if;
 if kind='idle' then
  update public.venue_presence set action='idle',event_id=active_event,started_at=case when action='idle' then started_at else now() end,updated_at=now() where user_id=auth.uid() and venue_id=venue;
  if found then return;end if;
 end if;
 select * into p from public.player_presence where id=auth.uid() and place='gift' and updated_at>now()-interval '45 seconds';
 if p.id is null then raise exception 'Go to the venue first.';end if;
 if venue='city-club' and not(p.x between 3526.24 and 3600.24 and p.z between 4069.77 and 4139.77) then raise exception 'Go inside City Club first.';end if;
 if venue='city-club' and kind<>'idle' and not exists(select 1 from public.entertainment_settings where id='global' and club_enabled) then raise exception 'City Club is closed right now.';end if;
 if venue='gift-live' and active_event is null then raise exception 'Take your concert spot first.';end if;
 if exists(select 1 from public.venue_presence where user_id=auth.uid() and updated_at>now()-interval '500 milliseconds') then return;end if;
 insert into public.venue_presence(user_id,venue_id,action,event_id) values(auth.uid(),venue,kind,active_event)
 on conflict(user_id) do update set venue_id=excluded.venue_id,action=excluded.action,event_id=excluded.event_id,
 started_at=case when public.venue_presence.venue_id=excluded.venue_id and public.venue_presence.action=excluded.action and kind in('dance','idle') then public.venue_presence.started_at else now() end,updated_at=now();
end $$;

create or replace function public.venue_people(venue text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return '[]'::jsonb;end if;
 if not exists(select 1 from public.player_presence where id=auth.uid() and place='gift' and updated_at>now()-interval '60 seconds') then return '[]'::jsonb;end if;
 return coalesce((select jsonb_agg(row_to_json(t)) from (
  with active_members as (
   select a.*,row_number() over(partition by a.event_id,a.tier order by a.arrival)-1 as position
   from public.concert_members a join public.concert_events e on e.id=a.event_id and e.status='published' and e.ends_at>now()
   where a.left_at is null and not a.blocked and a.lease_until>now()
  )
  select q.user_id,q.venue_id,q.action,q.started_at,greatest(q.updated_at,pp.updated_at) as updated_at,m.event_id,m.tier,m.position
  from public.venue_presence q join public.profiles p on p.id=q.user_id
  join public.player_presence pp on pp.id=q.user_id and pp.place='gift' and pp.updated_at>now()-interval '45 seconds'
  cross join public.player_presence viewer
  left join active_members m on m.user_id=q.user_id and m.event_id=q.event_id
  where viewer.id=auth.uid() and q.venue_id=venue and p.visible and p.name<>'' and not public.is_blocked(auth.uid(),q.user_id)
  and (q.venue_id='gift-live' and m.event_id is not null or q.venue_id='city-club' and pp.x between 3526.24 and 3600.24 and pp.z between 4069.77 and 4139.77)
  order by (pp.x-viewer.x)^2+(pp.z-viewer.z)^2 limit 60
 ) t),'[]'::jsonb);
end $$;

create or replace function public.admin_entertainment() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if public.is_admin() is not true then raise exception 'Not an admin.';end if;
 return jsonb_build_object('club',(select to_jsonb(s) from public.entertainment_settings s where id='global'),
 'events',coalesce((select jsonb_agg(to_jsonb(e) order by e.starts_at desc) from public.concert_events e),'[]'::jsonb),
 'members',coalesce((select jsonb_agg(jsonb_build_object('event_id',m.event_id,'user_id',m.user_id,'name',p.name,'tier',m.tier,'arrival',m.arrival,'joined_at',m.joined_at,'active',m.left_at is null and m.lease_until>now() and not m.blocked,'blocked',m.blocked)) from public.concert_members m join public.profiles p on p.id=m.user_id),'[]'::jsonb));
end $$;

create or replace function public.admin_save_club(payload jsonb,expected_revision bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.entertainment_settings;
begin
 if public.is_admin() is not true then raise exception 'Not an admin.';end if;
 if not public.event_media_url_ok(payload->>'club_audio') then raise exception 'Use a direct HTTPS or local audio/video media URL.';end if;
 select * into s from public.entertainment_settings where id='global' for update;
 if s.revision is distinct from expected_revision then raise exception 'Settings changed. Reload before saving.';end if;
 update public.entertainment_settings set club_enabled=(payload->>'club_enabled')::boolean,club_audio=coalesce(payload->>'club_audio',''),club_bpm=(payload->>'club_bpm')::int,club_volume=(payload->>'club_volume')::real,revision=revision+1,updated_at=now() where id='global' returning * into s;
 return to_jsonb(s);
end $$;

create or replace function public.admin_save_concert(payload jsonb,expected_revision bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.concert_events;eid uuid;from_time timestamptz;to_time timestamptz;state text;
begin
 if public.is_admin() is not true then raise exception 'Not an admin.';end if;
 if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>20000 then raise exception 'Invalid event.';end if;
 if not public.event_media_url_ok(payload->>'audio_url') or not public.event_media_url_ok(payload->>'video_url') then raise exception 'Use direct HTTPS or local media URLs.';end if;
 if coalesce(payload->>'video_url','')<>'' and (payload->>'video_url') !~* '\.(mp4|webm)(\?[^[:space:]]*)?$' then raise exception 'The stage screen needs a direct MP4 or WebM video.';end if;
 from_time:=(payload->>'starts_at')::timestamptz;to_time:=(payload->>'ends_at')::timestamptz;state:=coalesce(payload->>'status','draft');
 if from_time is null or to_time is null or not isfinite(from_time) or not isfinite(to_time) or to_time<=from_time or to_time>from_time+interval '24 hours' then raise exception 'Choose a valid start and end time.';end if;
 if state='published' and coalesce(payload->>'audio_url','')='' and coalesce(payload->>'video_url','')='' then raise exception 'Add concert audio or video before publishing.';end if;
 perform pg_advisory_xact_lock(hashtext('gog-concert-calendar'));
 eid:=coalesce(nullif(payload->>'id','')::uuid,gen_random_uuid());
 select * into e from public.concert_events where id=eid for update;
 if coalesce(e.revision,0) is distinct from coalesce(expected_revision,0) then raise exception 'Concert changed. Reload before saving.';end if;
 if exists(select 1 from public.concert_members m where m.event_id=eid and m.left_at is null and not m.blocked and m.lease_until>now() group by m.tier having count(*)>coalesce((payload->>(m.tier||'_capacity'))::int,192)) then raise exception 'A zone has more attendees than the new capacity. Keep its capacity at least equal to current attendance.';end if;
 if state='published' and exists(select 1 from public.concert_events where id<>eid and status='published' and starts_at<to_time and ends_at>from_time) then raise exception 'Another concert already uses this time slot.';end if;
 insert into public.concert_events(id,title,artist,description,starts_at,ends_at,entry_minutes,audio_url,video_url,loop_media,bpm,volume,premium_capacity,middle_capacity,general_capacity,status,created_by)
 values(eid,trim(payload->>'title'),coalesce(payload->>'artist',''),coalesce(payload->>'description',''),from_time,to_time,coalesce((payload->>'entry_minutes')::int,15),coalesce(payload->>'audio_url',''),coalesce(payload->>'video_url',''),coalesce((payload->>'loop_media')::boolean,true),coalesce((payload->>'bpm')::int,120),coalesce((payload->>'volume')::real,.85),coalesce((payload->>'premium_capacity')::int,96),coalesce((payload->>'middle_capacity')::int,144),coalesce((payload->>'general_capacity')::int,192),state,auth.uid())
 on conflict(id) do update set title=excluded.title,artist=excluded.artist,description=excluded.description,starts_at=excluded.starts_at,ends_at=excluded.ends_at,entry_minutes=excluded.entry_minutes,audio_url=excluded.audio_url,video_url=excluded.video_url,loop_media=excluded.loop_media,bpm=excluded.bpm,volume=excluded.volume,premium_capacity=excluded.premium_capacity,middle_capacity=excluded.middle_capacity,general_capacity=excluded.general_capacity,status=excluded.status,revision=public.concert_events.revision+1,updated_at=now() returning * into e;
 return to_jsonb(e);
end $$;

create or replace function public.admin_concert_guest(eid uuid,guest uuid,operation text) returns void language plpgsql security definer set search_path='' as $$
begin
 if public.is_admin() is not true then raise exception 'Not an admin.';end if;
 perform 1 from public.concert_events where id=eid for update;
 if operation='block' then update public.concert_members set blocked=true,left_at=now(),lease_until=now() where event_id=eid and user_id=guest;
 update public.venue_presence set action='idle',event_id=null,started_at=now(),updated_at=now() where user_id=guest and event_id=eid;
 elsif operation='allow' then update public.concert_members set blocked=false where event_id=eid and user_id=guest;
 else raise exception 'Unknown guest action.';end if;
end $$;

-- Restore support for all existing game areas in verified multiplayer.
alter table public.player_presence drop constraint if exists player_presence_place_check;
alter table public.player_presence add constraint player_presence_place_check check(place in('ldrp','dandi','gift','swagat'));
create or replace function public.update_player_presence(px real,py real,pz real,ph real,pv text,pp text) returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null) then raise exception 'Verify your email to join multiplayer.';end if;
 if not exists(select 1 from public.profiles where id=auth.uid() and visible and name<>'') then return;end if;
 if px is null or py is null or pz is null or ph is null or pv is null or pp is null or abs(px)>15000 or abs(pz)>15000 or abs(py)>100 or abs(ph)>100 or pv not in('walk','cycle','car','auto') or pp not in('ldrp','dandi','gift','swagat') then raise exception 'Invalid player position.';end if;
 if exists(select 1 from public.player_presence where id=auth.uid() and updated_at>now()-interval '800 milliseconds' and place=pp) then return;end if;
 insert into public.player_presence(id,x,y,z,heading,vehicle,place) values(auth.uid(),px,py,pz,ph,pv,pp) on conflict(id) do update set x=excluded.x,y=excluded.y,z=excluded.z,heading=excluded.heading,vehicle=excluded.vehicle,place=excluded.place,updated_at=now();
end $$;

revoke all on function public.entertainment_catalog(),public.event_receipt(uuid),public.join_concert(uuid,text),public.renew_concert(uuid),public.leave_concert(uuid),public.venue_action(text,text),public.venue_people(text),public.admin_entertainment(),public.admin_save_club(jsonb,bigint),public.admin_save_concert(jsonb,bigint),public.admin_concert_guest(uuid,uuid,text),public.update_player_presence(real,real,real,real,text,text) from public,anon;
grant execute on function public.entertainment_catalog() to anon,authenticated;
grant execute on function public.event_receipt(uuid),public.join_concert(uuid,text),public.renew_concert(uuid),public.leave_concert(uuid),public.venue_action(text,text),public.venue_people(text),public.admin_entertainment(),public.admin_save_club(jsonb,bigint),public.admin_save_concert(jsonb,bigint),public.admin_concert_guest(uuid,uuid,text),public.update_player_presence(real,real,real,real,text,text) to authenticated;

-- Only a refresh hint is broadcast; draft metadata and attendee records remain private.
create or replace function public.notify_entertainment_catalog() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if to_regprocedure('realtime.send(jsonb,text,text,boolean)') is not null then
  perform realtime.send('{"refresh":true}'::jsonb,'update','events:catalog',false);
 end if;
 return null;
end $$;
revoke all on function public.notify_entertainment_catalog() from public,anon,authenticated;
drop trigger if exists event_catalog_changed on public.concert_events;
create trigger event_catalog_changed after insert or update on public.concert_events for each statement execute function public.notify_entertainment_catalog();
drop trigger if exists club_catalog_changed on public.entertainment_settings;
create trigger club_catalog_changed after update on public.entertainment_settings for each statement execute function public.notify_entertainment_catalog();

do $$ begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='venue_presence') then execute 'alter publication supabase_realtime add table public.venue_presence';end if;
 if to_regclass('storage.buckets') is not null then
  execute $q$insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('event-media','event-media',true,52428800,array['audio/mpeg','audio/mp4','audio/aac','audio/ogg','audio/wav','audio/x-wav','video/mp4','video/webm']) on conflict(id) do nothing$q$;
  if not exists(select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='event_media_admin') then execute $q$create policy event_media_admin on storage.objects for all to authenticated using(bucket_id='event-media' and public.is_admin()) with check(bucket_id='event-media' and public.is_admin())$q$;end if;
 end if;
end $$;
notify pgrst,'reload schema';
commit;
