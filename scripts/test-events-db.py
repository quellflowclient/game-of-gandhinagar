"""Integration checks in the isolated localhost cluster created for this task.
Never accepts a production host or connection string.
"""
import argparse, concurrent.futures, datetime as dt, json, uuid
from pathlib import Path
import psycopg2
from psycopg2.extras import Json
ROOT=Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description='Reset synthetic fixtures only in an explicitly named task-owned local PostgreSQL cluster.')
parser.add_argument('--port',type=int,default=15437)
parser.add_argument('--data-dir',required=True,help='An initdb directory under this repository tmp/pg-concert-*')
args=parser.parse_args();PORT=args.port
def connect(): return psycopg2.connect(host='127.0.0.1',port=PORT,user='postgres',dbname='postgres',connect_timeout=5)
c=connect();c.autocommit=True
with c.cursor() as q:
 q.execute('show data_directory');data=Path(q.fetchone()[0]).resolve()
 expected=Path(args.data_dir).resolve()
 assert data==expected and data.is_relative_to(ROOT/'tmp') and data.name.startswith('pg-concert-'),'Refusing to modify any database except the explicitly named task-owned local test cluster'
 q.execute('drop schema if exists auth cascade;drop schema public cascade;create schema public;create schema auth;')
 q.execute("do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin;end if;end $$;")
 q.execute("grant usage on schema public,auth to anon,authenticated;create table auth.users(id uuid primary key,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table public.profiles(id uuid primary key references auth.users(id),name text not null,visible boolean not null default true);create table public.admins(id uuid primary key);create function public.is_admin() returns boolean language sql security definer set search_path='' as $$select exists(select 1 from public.admins where id=auth.uid())$$;create function public.is_blocked(a uuid,b uuid) returns boolean language sql as $$select false$$;create table public.player_presence(id uuid primary key references public.profiles(id),x real not null,y real not null default 0,z real not null,heading real not null default 0,vehicle text not null default 'walk',place text check(place in('ldrp','dandi')),updated_at timestamptz not null default now());")
 q.execute((ROOT/'supabase'/'entertainment.sql').read_text(encoding='utf-8'))
ids=[str(uuid.UUID(int=i+1000)) for i in range(16)];admin=ids[0]
with c.cursor() as q:
 for i,id in enumerate(ids):
  q.execute('insert into auth.users values(%s,now());insert into public.profiles values(%s,%s,true);insert into public.player_presence(id,x,z,place) values(%s,3681.24,4212.77,\'gift\')',(id,id,f'Local fixture {i}',id))
 q.execute('insert into public.admins values(%s)',(admin,))
c.close()
def rpc(user,name,args=(),role='authenticated'):
 con=connect();con.autocommit=True
 try:
  with con.cursor() as q:
   q.execute("select set_config('request.jwt.claim.sub',%s,false)",(user or '',));q.execute('set role '+role)
   q.execute('select public.'+name+'('+','.join(['%s']*len(args))+')',tuple(Json(a) if isinstance(a,dict) else a for a in args));row=q.fetchone();return row[0] if row else None
 finally:con.close()
def fails(user,name,args,text):
 try:rpc(user,name,args)
 except psycopg2.Error as e:assert text.lower() in str(e).lower(),str(e);return
 raise AssertionError('Expected rejection: '+name)
now=dt.datetime.now(dt.timezone.utc)
def show(**patch):
 e=dict(title='Local database fixture',artist='Local fixture',starts_at=(now-dt.timedelta(minutes=2)).isoformat(),ends_at=(now+dt.timedelta(minutes=30)).isoformat(),entry_minutes=15,audio_url='/audio/gog-theme.mp3',video_url='',loop_media=True,bpm=120,volume=.8,premium_capacity=4,middle_capacity=1,general_capacity=3,status='published');e.update(patch);return e
assert rpc(None,'entertainment_catalog',role='anon')['events']==[]
fails(ids[1],'admin_entertainment',(),'Not an admin')
fails(admin,'admin_save_concert',(show(audio_url=''),0),'Add concert audio')
fails(admin,'admin_save_concert',(show(audio_url='javascript:alert(1)'),0),'direct HTTPS')
fails(admin,'admin_save_concert',(show(video_url='https://example.com/song.mp3'),0),'MP4 or WebM')
event=rpc(admin,'admin_save_concert',(show(),0));eid=event['id']
assert len(rpc(None,'entertainment_catalog',role='anon')['events'])==1
fails(admin,'admin_save_concert',(show(title='Overlapping'),0),'already uses this time')
fails(ids[1],'admin_save_club',({'club_audio':'','club_enabled':True,'club_bpm':120,'club_volume':.7},1),'Not an admin')
club=rpc(admin,'admin_save_club',({'club_audio':'','club_enabled':True,'club_bpm':120,'club_volume':.7},1));assert club['revision']==2
fails(admin,'admin_save_club',({'club_audio':'','club_enabled':True,'club_bpm':120,'club_volume':.7},1),'changed')
def attempt(user):
 try:return (user,rpc(user,'join_concert',(eid,'premium')),None)
 except psycopg2.Error as e:return (user,None,str(e))
with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool: results=list(pool.map(attempt,ids[1:9]))
joined=[(u,r) for u,r,e in results if r];rejected=[e for u,r,e in results if e]
assert len(joined)==4 and len(rejected)==4,results
assert {r['position'] for u,r in joined}=={0,1,2,3},joined
assert all('full' in e for e in rejected)
joined.sort(key=lambda pair:pair[1]['arrival'])
for expected,(user,receipt) in enumerate(joined):assert receipt['position']==expected
user,first=joined[0];again=rpc(user,'join_concert',(eid,'premium'));assert again['arrival']==first['arrival'] and again['position']==0
rpc(user,'venue_action',('gift-live','idle'))
peers=rpc(joined[1][0],'venue_people',('gift-live',));assert any(p['user_id']==user and p['event_id']==eid and p['position']==0 for p in peers)
con=connect();con.autocommit=True
with con.cursor() as q:q.execute("update public.venue_presence set updated_at=now()-interval '1 second' where user_id=%s",(user,))
con.close();rpc(user,'venue_action',('gift-live','dance'));started=next(p['started_at'] for p in rpc(joined[1][0],'venue_people',('gift-live',)) if p['user_id']==user)
con=connect();con.autocommit=True
with con.cursor() as q:q.execute("update public.venue_presence set updated_at=now()-interval '1 second' where user_id=%s",(user,))
con.close();rpc(user,'venue_action',('gift-live','dance'));assert next(p['started_at'] for p in rpc(joined[1][0],'venue_people',('gift-live',)) if p['user_id']==user)==started
rpc(user,'leave_concert',(eid,));assert not rpc(user,'event_receipt',(eid,))['active']
assert not any(p['user_id']==user for p in rpc(joined[1][0],'venue_people',('gift-live',))),'Leaving immediately removes the shared concert pose'
assert rpc(joined[1][0],'event_receipt',(eid,))['position']==0
new_user=next(u for u,r,e in results if e);new=rpc(new_user,'join_concert',(eid,'premium'));assert new['position']==3 and new['arrival']>joined[-1][1]['arrival']
fails(ids[10],'join_concert',(eid,'unknown'),'valid zone')
mid=rpc(ids[10],'join_concert',(eid,'middle'));assert mid['position']==0
fails(ids[11],'join_concert',(eid,'middle'),'full')
fails(ids[11],'admin_concert_guest',(eid,new_user,'block'),'Not an admin')
rpc(admin,'admin_concert_guest',(eid,new_user,'block'));assert not rpc(new_user,'event_receipt',(eid,))['active'];fails(new_user,'join_concert',(eid,'premium'),'restricted')
rpc(admin,'admin_concert_guest',(eid,new_user,'allow'));assert rpc(new_user,'join_concert',(eid,'premium'))['position']==3
con=connect();con.autocommit=True
with con.cursor() as q:q.execute("update public.player_presence set x=0,z=0,place='ldrp' where id=%s",(ids[12],))
con.close();fails(ids[12],'join_concert',(eid,'general'),'GIFT City')
con=connect();con.autocommit=True
with con.cursor() as q:q.execute("update public.concert_members set lease_until=now()-interval '1 second' where user_id=%s and event_id=%s",(new_user,eid))
con.close();assert not rpc(new_user,'renew_concert',(eid,))['active']
future=show(title='Future fixture',starts_at=(now+dt.timedelta(hours=2)).isoformat(),ends_at=(now+dt.timedelta(hours=3)).isoformat());future=rpc(admin,'admin_save_concert',(future,0));fails(ids[11],'join_concert',(future['id'],'general'),'not opened')
updated={**event,'status':'cancelled'};rpc(admin,'admin_save_concert',(updated,event['revision']));assert rpc(joined[1][0],'event_receipt',(eid,))['ended'];fails(ids[11],'join_concert',(eid,'general'),'not open')
for role in ['anon','authenticated']:
 con=connect();con.autocommit=True
 try:
  with con.cursor() as q:
   q.execute('set role '+role)
   try:q.execute('select * from public.concert_members');raise AssertionError('Raw attendance must stay private')
   except psycopg2.errors.InsufficientPrivilege:pass
 finally:con.close()
print('PostgreSQL events passed: real concurrent joins respect capacity and FIFO; duplicate joins are idempotent; leaving compacts order; stale revisions, early entry, invalid tiers, remote entry and non-admin mutations are rejected; block/allow, lease expiry, cancellation and raw-table permissions work.')
