-- Run after supabase/admin.sql. No passwords or service-role key are needed in the browser.
begin;
create sequence if not exists public.game_content_revision;
create table if not exists public.game_content (
 id text primary key check (id in ('published','draft')),
 config jsonb not null, revision bigint not null default nextval('public.game_content_revision'),
 updated_at timestamptz not null default now(), updated_by uuid references auth.users(id)
);
create table if not exists public.game_content_history (
 revision bigint primary key, target text not null, config jsonb not null,
 updated_at timestamptz not null, updated_by uuid references auth.users(id)
);
alter table public.game_content enable row level security;
alter table public.game_content_history enable row level security;
revoke all on public.game_content,public.game_content_history from anon,authenticated;
grant select on public.game_content to anon,authenticated;
drop policy if exists game_content_read on public.game_content;
create policy game_content_read on public.game_content for select using(id='published' or public.is_admin());
create or replace function public.admin_read_game_content() returns jsonb
language plpgsql security definer set search_path=public as $$
begin
 if not public.is_admin() then raise exception 'Not an admin.'; end if;
 return jsonb_build_object('published',(select to_jsonb(c) from public.game_content c where id='published'),'draft',(select to_jsonb(c) from public.game_content c where id='draft'),'history',coalesce((select jsonb_agg(h) from (select * from public.game_content_history order by revision desc limit 20) h),'[]'::jsonb));
end $$;
create or replace function public.admin_save_game_content(payload jsonb, expected_revision bigint, make_live boolean default false) returns jsonb
language plpgsql security definer set search_path=public as $$
declare target text; current_revision bigint; result public.game_content;
begin
 if not public.is_admin() then raise exception 'Not an admin.'; end if;
 if jsonb_typeof(payload)<>'object' or octet_length(payload::text)>500000 or (payload->>'version') is distinct from '1' then raise exception 'Invalid content payload.'; end if;
 if not(payload ?& array['labels','stalls','dialogues','voices','campus','gameplay','music','geometry','textOverrides']) then raise exception 'Missing content sections.'; end if;
 if jsonb_typeof(payload->'stalls')<>'array' or jsonb_array_length(payload->'stalls')<>8 then raise exception 'Expected eight stable stalls.'; end if;
 target:=case when make_live then 'published' else 'draft' end;
 -- Serializes first-time inserts as well as updates, preventing stale overwrite.
 perform pg_advisory_xact_lock(hashtext('gog-content-'||target));
 select revision into current_revision from public.game_content where id=target for update;
 if coalesce(current_revision,0)<>coalesce(expected_revision,0) then raise exception 'Content changed in another admin session. Reload before saving.'; end if;
 insert into public.game_content(id,config,updated_by) values(target,payload,auth.uid())
 on conflict(id) do update set config=excluded.config,revision=nextval('public.game_content_revision'),updated_at=now(),updated_by=auth.uid() returning * into result;
 insert into public.game_content_history(revision,target,config,updated_at,updated_by) values(result.revision,result.id,result.config,result.updated_at,result.updated_by);
 return to_jsonb(result);
end $$;
revoke all on function public.admin_read_game_content(),public.admin_save_game_content(jsonb,bigint,boolean) from public,anon;
grant execute on function public.admin_read_game_content(),public.admin_save_game_content(jsonb,bigint,boolean) to authenticated;
commit;
