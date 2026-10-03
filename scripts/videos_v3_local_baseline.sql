-- Synthetic, isolated PostgreSQL fixture. No real learner data.
create schema elite;
grant usage on schema elite to authenticated;
alter default privileges in schema elite grant select,insert,update,delete on tables to authenticated;
create table elite.cohorts(code text primary key,display_name text not null,is_current boolean not null default false);
insert into elite.cohorts values('2026-1','2026 第 1 期',true),('2026-2','2026 第 2 期',false),('2026-3','2026 第 3 期',false);
create table elite.enrollments(
  user_id uuid primary key, class_role text not null, cohort text not null references elite.cohorts(code),
  status text not null default 'active', team_id int, display_name text,job_role text
);
insert into elite.enrollments(user_id,class_role,cohort,team_id)
select ('00000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,'student','2026-1',1
from generate_series(1,11) i;
insert into elite.enrollments values('00000000-0000-0000-0000-000000000100','instructor','2026-1','active',null,'合成講師',null);
insert into elite.enrollments values('00000000-0000-0000-0000-000000000201','student','2026-2','active',1,'合成二期學員',null);
insert into elite.enrollments values('00000000-0000-0000-0000-000000000202','student','2026-2','suspended',1,'合成停權學員',null);
create function elite.is_enrolled() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from elite.enrollments where user_id=auth.uid() and status='active') $$;
create function elite.is_instructor() returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from elite.enrollments where user_id=auth.uid() and class_role='instructor' and status='active') $$;
create function elite.my_cohort() returns text language sql stable security definer set search_path=''
as $$ select cohort from elite.enrollments where user_id=auth.uid() and status='active' $$;
grant execute on function elite.is_enrolled(),elite.is_instructor(),elite.my_cohort() to authenticated;
create table elite.course_videos(
  id uuid primary key default gen_random_uuid(), category text not null, title text not null,
  url text not null, note text, created_by uuid not null, created_at timestamptz default now(),
  updated_at timestamptz,
  cohort text not null default elite.my_cohort() references elite.cohorts(code),
  all_cohorts boolean not null default false
);
create index course_videos_cohort_idx on elite.course_videos(cohort);
-- Match Cohort v1's named constraint, RLS and restrictive active gate.
alter table elite.course_videos rename constraint course_videos_cohort_fkey to course_videos_cohort_fk;
alter table elite.course_videos enable row level security;
create policy elite_videos_select on elite.course_videos for select to authenticated
using (elite.is_instructor() or (elite.is_enrolled() and (cohort=elite.my_cohort() or all_cohorts)));
create policy elite_videos_insert on elite.course_videos for insert to authenticated
with check (elite.is_instructor());
create policy cohort_v1_active_gate on elite.course_videos as restrictive for all to authenticated
using (elite.is_enrolled()) with check (elite.is_enrolled());
insert into elite.course_videos(id,category,title,url,created_by,cohort)
select ('10000000-0000-0000-0000-' || lpad(i::text,12,'0'))::uuid,
  case when i<=6 then 'day1' else 'day2' end,'Video '||i,'https://youtu.be/test',
  '00000000-0000-0000-0000-000000000100','2026-1'
from generate_series(1,10) i;
