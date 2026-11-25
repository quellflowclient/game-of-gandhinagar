-- Shared, exclusive sitting-table leases. A disconnected player's claim expires.
create table if not exists public.city_seats(
  id text primary key,x real not null,z real not null,yaw real not null,
  home_x real not null,home_z real not null,group_name text,native_occupant text,
  allow_borrow boolean not null default true,
  owner uuid unique references public.profiles(id) on delete set null,
  mode text check(mode in('sit','carry')),expires timestamptz,permission uuid,
  moved boolean not null default false
);
alter table public.city_seats enable row level security;
create policy "members read tables" on public.city_seats for select to authenticated using(true);
revoke all on public.city_seats from anon,authenticated;grant select on public.city_seats to authenticated;
create or replace function public.table_action(sid text,action text,px real default null,pz real default null,ph real default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare s city_seats;p player_presence;
begin
 if auth.uid() is null then raise exception 'Sign in first.';end if;
 select * into p from player_presence where id=auth.uid() and updated_at>now()-interval '45 seconds';
 if p.id is null then raise exception 'Join the city first.';end if;
 perform pg_advisory_xact_lock(hashtextextended('seat-'||auth.uid()::text,0));
 select * into s from city_seats where id=sid for update;
 if s.id is null then raise exception 'Unknown table.';end if;
 if s.owner is not null and s.expires<now() then update city_seats set owner=null,mode=null,expires=null where id=sid;s.owner=null;end if;
 if action in('ask','sit','carry') then
  if sqrt(power(p.x-s.x,2)+power(p.z-s.z,2))>3 then raise exception 'Table ke paas aao.';end if;
  if s.native_occupant is not null or s.owner is not null then raise exception 'Table occupied hai.';end if;
  if action='ask' then
   if not s.allow_borrow then raise exception 'Nahi bhai, hamara dost aa raha hai.';end if;
   update city_seats set permission=auth.uid() where id=sid;return jsonb_build_object('ok',true);
  end if;
  if s.group_name is not null and s.permission is distinct from auth.uid() then raise exception 'Pehle group se permission lo.';end if;
  update city_seats set owner=null,mode=null,expires=null where owner=auth.uid() and expires<now();
  if exists(select 1 from city_seats where owner=auth.uid()) then raise exception 'Pehle current table chhodo.';end if;
  update city_seats set owner=auth.uid(),mode=action,expires=now()+interval '30 seconds' where id=sid;
 elsif action='renew' then
  update city_seats set expires=now()+interval '30 seconds' where id=sid and owner=auth.uid();
 elsif action='stand' then
  update city_seats set owner=null,mode=null,expires=null where id=sid and owner=auth.uid() and mode='sit';
 elsif action='release' then
  update city_seats set owner=null,mode=null,expires=null where id=sid and owner=auth.uid();
 elsif action='drop' then
  if s.owner is distinct from auth.uid() or s.mode<>'carry' then raise exception 'Yeh table tumhare paas nahi hai.';end if;
  if px is null or pz is null or ph is null or abs(ph)>100 or sqrt(power(px-p.x,2)+power(pz-p.z,2))>3 or sqrt(power(px-s.home_x,2)+power(pz-s.home_z,2))>25 then raise exception 'Table ko paas ki sitting area mein rakho.';end if;
  if exists(select 1 from city_seats o where o.id<>sid and coalesce(o.mode,'sit')<>'carry' and sqrt(power(px-o.x,2)+power(pz-o.z,2))<.9) then raise exception 'Yahan doosri table hai.';end if;
  update city_seats set x=px,z=pz,yaw=ph,owner=null,mode=null,expires=null,permission=null,group_name=null,moved=true where id=sid;
 else raise exception 'Invalid table action.';
 end if;
 return jsonb_build_object('ok',true);
end $$;
revoke all on function public.table_action(text,text,real,real,real) from public,anon;
grant execute on function public.table_action(text,text,real,real,real) to authenticated;
