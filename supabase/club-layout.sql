-- Relocate City Club; preserve concert positions, schedules and all existing records.
-- Apply after entertainment.sql.
begin;
-- Match the relocated lounge's footprint, with five metres of presence tolerance.
create or replace function public.city_club_contains(px real,pz real) returns boolean language sql immutable set search_path='' as $$
 select px between 3446 and 3494 and pz between 3294 and 3346;
$$;
revoke all on function public.city_club_contains(real,real) from public,anon,authenticated;

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
 if venue='city-club' and not public.city_club_contains(p.x,p.z) then raise exception 'Go inside City Club first.';end if;
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
  and (q.venue_id='gift-live' and m.event_id is not null or q.venue_id='city-club' and public.city_club_contains(pp.x,pp.z))
  order by (pp.x-viewer.x)^2+(pp.z-viewer.z)^2 limit 60
 ) t),'[]'::jsonb);
end $$;

notify pgrst,'reload schema';
commit;
