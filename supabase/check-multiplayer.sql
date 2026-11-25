-- Transaction-only fixtures: no passwords, no email sent, every fixture rolled back.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_app_meta_data,raw_user_meta_data)values
 ('fe000000-0000-4000-8000-000000000001','gnr-qa-a@example.invalid',now(),'{}','{}'),
 ('fe000000-0000-4000-8000-000000000002','gnr-qa-b@example.invalid',now(),'{}','{}'),
 ('fe000000-0000-4000-8000-000000000003','gnr-qa-c@example.invalid',now(),'{}','{}');
update public.profiles set name='QA fixture' where id in('fe000000-0000-4000-8000-000000000001','fe000000-0000-4000-8000-000000000002','fe000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','fe000000-0000-4000-8000-000000000001',true);
select public.update_player_presence(x,.33,z,0,'walk','ldrp') from public.city_seats where id='masi-seat-6';
select public.table_action('masi-seat-6','sit');
select public.send_message('fe000000-0000-4000-8000-000000000002','Hello from the transactional QA check');
select set_config('request.jwt.claim.sub','fe000000-0000-4000-8000-000000000002',true);
select public.update_player_presence(x,.33,z,0,'walk','ldrp') from public.city_seats where id='masi-seat-6';
do $$begin
 begin perform public.table_action('masi-seat-6','sit');raise exception 'FAILED: double occupancy allowed';
 exception when others then if sqlerrm not like '%occupied%'then raise;end if;end;
 if jsonb_array_length(public.online_players())<2 then raise exception 'FAILED: players missing';end if;
 if not exists(select 1 from public.messages where sender='fe000000-0000-4000-8000-000000000001')then raise exception 'FAILED: recipient cannot read chat';end if;
end$$;
select set_config('request.jwt.claim.sub','fe000000-0000-4000-8000-000000000001',true);
select public.start_voice_call('fe000000-0000-4000-8000-000000000002');
select set_config('request.jwt.claim.sub','fe000000-0000-4000-8000-000000000002',true);
select public.set_voice_call(id,'accepted') from public.voice_calls where caller='fe000000-0000-4000-8000-000000000001';
select public.send_voice_signal(id,'{"type":"ice","candidate":{"candidate":"QA-only"}}') from public.voice_calls where caller='fe000000-0000-4000-8000-000000000001';
select set_config('request.jwt.claim.sub','fe000000-0000-4000-8000-000000000003',true);
do $$begin
 if exists(select 1 from public.messages where sender='fe000000-0000-4000-8000-000000000001')then raise exception 'FAILED: unrelated user reads private chat';end if;
 if exists(select 1 from public.voice_calls where caller='fe000000-0000-4000-8000-000000000001')then raise exception 'FAILED: unrelated user reads calls';end if;
 if exists(select 1 from public.voice_signals where sender='fe000000-0000-4000-8000-000000000002')then raise exception 'FAILED: unrelated user reads signals';end if;
end$$;
rollback;
select 'PASS: authenticated presence, exclusive table claim, recipient chat, private voice signaling; all QA fixtures rolled back' as verification;
