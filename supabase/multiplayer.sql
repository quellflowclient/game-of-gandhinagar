-- Verified-email multiplayer. Position identity is always assigned by auth.uid().
create table if not exists public.player_presence (
  id uuid primary key references public.profiles(id) on delete cascade,
  x real not null, y real not null default 0, z real not null,
  heading real not null default 0,
  vehicle text not null default 'walk' check (vehicle in ('walk','cycle','car','auto')),
  place text check (place in ('ldrp','dandi','gift','swagat')),
  updated_at timestamptz not null default now()
);
alter table public.player_presence enable row level security;
create policy "verified members see online players" on public.player_presence for select to authenticated
  using (exists(select 1 from public.profiles p where p.id = player_presence.id and p.visible and p.name <> '')
    and not public.is_blocked(auth.uid(), id));
revoke all on public.player_presence from anon, authenticated;
grant select on public.player_presence to authenticated;

create or replace function public.update_player_presence(px real, py real, pz real, ph real, pv text, pp text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    then raise exception 'Verify your email to join multiplayer.'; end if;
  if not exists(select 1 from profiles where id=auth.uid() and visible and name <> '') then return; end if;
  if px is null or py is null or pz is null or ph is null or abs(px)>15000 or abs(pz)>15000 or abs(py)>100
    or abs(ph)>100 or pv not in ('walk','cycle','car','auto') or pp not in ('ldrp','dandi','gift','swagat') or pp is null
    then raise exception 'Invalid player position.'; end if;
  insert into player_presence(id,x,y,z,heading,vehicle,place) values(auth.uid(),px,py,pz,ph,pv,pp)
  on conflict(id) do update set x=excluded.x,y=excluded.y,z=excluded.z,heading=excluded.heading,
    vehicle=excluded.vehicle,place=excluded.place,updated_at=now();
end $$;

create or replace function public.leave_city() returns void language sql security definer set search_path=public as $$
  delete from player_presence where id=auth.uid();
$$;
create or replace function public.online_players() returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(row_to_json(t)), '[]'::jsonb) from (
    select s.id as "userId", s.id as key, p.name, p.role, p.one_liner as "oneLiner", p.open_to as "openTo",
      p.look,p.skin,s.x,s.y,s.z,s.heading,s.vehicle,s.place,s.updated_at as "updatedAt"
    from player_presence s join profiles p on p.id=s.id
    where auth.uid() is not null and exists(select 1 from auth.users u where u.id=auth.uid() and u.email_confirmed_at is not null)
      and p.visible and p.name <> '' and not is_blocked(auth.uid(),p.id)
      and s.updated_at > now()-interval '45 seconds'
    order by s.updated_at desc limit 200
  ) t;
$$;
create or replace function public.game_health() returns jsonb language sql stable as $$
  select jsonb_build_object('schema',2,'multiplayer',true);
$$;
revoke all on function public.update_player_presence(real,real,real,real,text,text),public.leave_city(),public.online_players() from public,anon;
grant execute on function public.update_player_presence(real,real,real,real,text,text),public.leave_city(),public.online_players() to authenticated;
grant execute on function public.game_health() to anon,authenticated;

-- Never publish private links, emails, or the full profiles table to Realtime.
do $$ declare n text; begin
  foreach n in array array['messages','world_messages','plans','waves','player_presence'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=n) then
      execute format('alter publication supabase_realtime add table public.%I',n);
    end if;
  end loop;
end $$;
