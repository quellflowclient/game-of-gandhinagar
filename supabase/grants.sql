-- New Supabase projects can have restricted default grants. RLS remains enabled.
grant select on public.threads,public.messages,public.waves to authenticated;
grant select,insert on public.world_messages to authenticated;
grant insert on public.profile_views,public.scores to authenticated;
grant select,insert,delete on public.plans,public.plan_members,public.event_interests,public.blocks to authenticated;
grant select,insert,update,delete on public.twins to authenticated;
grant select,delete on public.twin_chats to authenticated;
grant insert on public.suggestions,public.ad_requests to anon,authenticated;
grant usage on sequence public.world_messages_id_seq,public.profile_views_id_seq,public.scores_id_seq to authenticated;
grant usage on sequence public.suggestions_id_seq,public.ad_requests_id_seq to anon,authenticated;
