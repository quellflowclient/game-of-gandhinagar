-- Opt-in calls. Only the caller and callee may see a call or its WebRTC signals.
create table if not exists public.voice_calls(
  id uuid primary key default gen_random_uuid(),
  caller uuid not null references public.profiles(id) on delete cascade,
  callee uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'ringing' check(status in ('ringing','accepted','ended','declined')),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check(caller<>callee)
);
alter table public.voice_calls enable row level security;
create policy "call participants read" on public.voice_calls for select to authenticated
  using(auth.uid() in(caller,callee) and not public.is_blocked(caller,callee));
revoke all on public.voice_calls from anon,authenticated;
grant select on public.voice_calls to authenticated;

create table if not exists public.voice_signals(
  id bigserial primary key, call_id uuid not null references public.voice_calls(id) on delete cascade,
  sender uuid not null references public.profiles(id) on delete cascade,
  payload jsonb not null check(octet_length(payload::text)<32000),created_at timestamptz not null default now()
);
alter table public.voice_signals enable row level security;
create policy "call participants read signals" on public.voice_signals for select to authenticated
  using(exists(select 1 from public.voice_calls c where c.id=call_id and auth.uid() in(c.caller,c.callee) and c.status='accepted'));
revoke all on public.voice_signals from anon,authenticated;
grant select on public.voice_signals to authenticated;

create or replace function public.start_voice_call(target uuid) returns public.voice_calls
language plpgsql security definer set search_path=public as $$
declare c voice_calls;
begin
  if auth.uid() is null or not exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null)
    then raise exception 'Verify your email first.'; end if;
  if target=auth.uid() or is_blocked(auth.uid(),target) then raise exception 'Call unavailable.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(least(auth.uid(),target)::text,0));
  perform pg_advisory_xact_lock(hashtextextended(greatest(auth.uid(),target)::text,0));
  if not exists(select 1 from player_presence where id=target and updated_at>now()-interval '45 seconds') then raise exception 'This player is offline.'; end if;
  if (select count(*) from voice_calls where caller=auth.uid() and created_at>now()-interval '1 minute')>=4 then raise exception 'Wait before calling again.'; end if;
  if exists(select 1 from voice_calls where (auth.uid() in(caller,callee) or target in(caller,callee)) and status in('ringing','accepted') and updated_at>now()-interval '60 seconds') then raise exception 'A player is already in a call.'; end if;
  insert into voice_calls(caller,callee)values(auth.uid(),target)returning * into c;return c;
end $$;
create or replace function public.set_voice_call(cid uuid, next_status text) returns public.voice_calls
language plpgsql security definer set search_path=public as $$
declare c voice_calls;
begin
  select * into c from voice_calls where id=cid for update;
  if c.id is null or auth.uid() not in(c.caller,c.callee) then raise exception 'Call unavailable.'; end if;
  if next_status='accepted' and ((c.status='ringing' and auth.uid()<>c.callee) or c.status not in('ringing','accepted') or c.updated_at<now()-interval '60 seconds' or is_blocked(c.caller,c.callee)) then raise exception 'Call cannot be accepted.'; end if;
  if next_status not in('accepted','ended','declined') then raise exception 'Invalid call state.'; end if;
  if next_status='declined' and auth.uid()<>c.callee then raise exception 'Only the receiver can decline.'; end if;
  if c.status in('ended','declined') then return c; end if;
  update voice_calls set status=next_status,updated_at=now() where id=cid returning * into c;return c;
end $$;
create or replace function public.send_voice_signal(cid uuid, signal jsonb) returns void
language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from voice_calls c where c.id=cid and auth.uid() in(c.caller,c.callee) and c.status='accepted' and not is_blocked(c.caller,c.callee)) then raise exception 'Call unavailable.'; end if;
  if signal->>'type' not in('offer','answer','ice') then raise exception 'Invalid voice signal.'; end if;
  if (select count(*) from voice_signals where call_id=cid)>250 then raise exception 'Call signal limit reached.'; end if;
  insert into voice_signals(call_id,sender,payload)values(cid,auth.uid(),signal);
end $$;
revoke all on function public.start_voice_call(uuid),public.set_voice_call(uuid,text),public.send_voice_signal(uuid,jsonb) from public,anon;
grant execute on function public.start_voice_call(uuid),public.set_voice_call(uuid,text),public.send_voice_signal(uuid,jsonb) to authenticated;
do $$ declare n text; begin
 foreach n in array array['voice_calls','voice_signals'] loop
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=n)then
   execute format('alter publication supabase_realtime add table public.%I',n);
  end if;
 end loop;
end $$;
