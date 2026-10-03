-- Videos v3: one course owns the ten published first-cohort videos.
-- Apply only with video writes frozen and after the read-only preflight.
begin;
set local lock_timeout = '5s';
lock table elite.course_videos, elite.video_audiences in access exclusive mode;

do $$ begin
  if to_regnamespace('elite_videos_v3_backup') is not null
     or to_regclass('elite.video_courses') is not null
     or to_regclass('elite.course_grants') is not null
     or exists (select 1 from information_schema.columns
                where table_schema='elite' and table_name='course_videos' and column_name='course_id') then
    raise exception 'Videos v3 objects already exist';
  end if;
  if (select count(*) from elite.course_videos) <> 10
     or (select count(*) from elite.course_videos where category='day1') <> 6
     or (select count(*) from elite.course_videos where category='day2') <> 4
     or exists (select 1 from elite.course_videos where published_at is null) then
    raise exception 'Expected ten published videos: six Day 1 and four Day 2';
  end if;
  if (select count(*) from elite.video_audiences) <> 10
     or exists (select 1 from elite.video_audiences
                where kind <> 'cohort' or cohort_code <> '2026-1' or target_user_id is not null)
     or exists (select 1 from elite.course_videos v where
       (select count(*) from elite.video_audiences a where a.video_id=v.id) <> 1) then
    raise exception 'Expected one 2026-1 audience per video';
  end if;
  if (select count(*) from elite.enrollments
      where class_role='student' and cohort='2026-1' and status='active') <> 11
     or not exists (select 1 from elite.cohorts where code='2026-1') then
    raise exception 'First-cohort roster or master differs';
  end if;
  if (select count(*) from pg_policies where schemaname='elite' and tablename='course_videos'
      and policyname='elite_videos_select') <> 1
     or (select count(*) from pg_policies where schemaname='elite' and tablename='course_videos'
         and policyname='cohort_v1_active_gate' and permissive='RESTRICTIVE') <> 1
     or to_regprocedure('elite.video_audience_matches(uuid)') is null
     or to_regprocedure('elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean)') is null
     or to_regprocedure('elite.video_apply_category(uuid,text[],boolean,uuid[],boolean)') is null
     or to_regprocedure('elite.video_create(text,text,text,text)') is null
     or to_regprocedure('elite.video_delete(uuid)') is null then
    raise exception 'Videos v2 policies or RPCs differ';
  end if;
end $$;

create schema elite_videos_v3_backup;
revoke all on schema elite_videos_v3_backup from public, anon, authenticated;
create table elite_videos_v3_backup.videos as
  select id,title,url,category,note,created_by,created_at,updated_at,published_at
  from elite.course_videos;
create table elite_videos_v3_backup.audiences as
  select video_id,kind,cohort_code,target_user_id from elite.video_audiences;
revoke all on all tables in schema elite_videos_v3_backup from public, anon, authenticated;

create table elite.video_courses (
  id uuid primary key default gen_random_uuid(),
  title text not null check (btrim(title) <> ''),
  note text,
  created_at timestamptz not null default now()
);
-- elite's production default ACL grants authenticated arwd to every new table.
revoke all on elite.video_courses from public, anon, authenticated;
alter table elite.video_courses enable row level security;
create policy cohort_v1_active_gate on elite.video_courses as restrictive
  for all to authenticated using (elite.is_enrolled()) with check (elite.is_enrolled());
grant select on elite.video_courses to authenticated;

create table elite.course_grants (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references elite.video_courses(id) on delete cascade,
  kind text not null check (kind in ('cohort','user')),
  cohort_code text references elite.cohorts(code) on delete restrict,
  target_user_id uuid references elite.enrollments(user_id) on delete cascade,
  constraint course_grant_one_target check (
    (kind='cohort' and cohort_code is not null and target_user_id is null) or
    (kind='user' and cohort_code is null and target_user_id is not null)
  )
);
revoke all on elite.course_grants from public, anon, authenticated;
create unique index course_grants_cohort_unique on elite.course_grants(course_id,cohort_code) where kind='cohort';
create unique index course_grants_user_unique on elite.course_grants(course_id,target_user_id) where kind='user';
create index course_grants_course_idx on elite.course_grants(course_id);
alter table elite.course_grants enable row level security;
create policy course_grants_instructor_select on elite.course_grants for select to authenticated
  using (elite.is_enrolled() and elite.is_instructor());
create policy cohort_v1_active_gate on elite.course_grants as restrictive
  for all to authenticated using (elite.is_enrolled()) with check (elite.is_enrolled());
grant select on elite.course_grants to authenticated;

alter table elite.course_videos add column course_id uuid;
alter table elite.course_videos add constraint course_videos_course_fk
  foreign key(course_id) references elite.video_courses(id) on delete restrict;
create index course_videos_course_order_idx on elite.course_videos(course_id,category,created_at,id);

do $$ declare v_course_id uuid;
begin
  insert into elite.video_courses(title) values('2026 第一期菁英班課程影片') returning id into v_course_id;
  insert into elite.course_grants(course_id,kind,cohort_code)
    values(v_course_id,'cohort','2026-1');
  update elite.course_videos set course_id=v_course_id;
end $$;
alter table elite.course_videos alter column course_id set not null;

create function elite.course_grant_matches(p_course_id uuid) returns boolean
language sql stable security definer set search_path=''
as $$
  select elite.is_enrolled() and exists (
    select 1 from elite.course_grants g where g.course_id=p_course_id and (
      (g.kind='cohort' and g.cohort_code=elite.my_cohort()) or
      (g.kind='user' and g.target_user_id=auth.uid())
    )
  )
$$;
revoke all on function elite.course_grant_matches(uuid) from public, anon, authenticated;
-- RLS invokes this as the querying authenticated role.
grant execute on function elite.course_grant_matches(uuid) to authenticated;

create policy video_courses_select on elite.video_courses for select to authenticated
  using (elite.is_enrolled() and (elite.is_instructor() or
    (elite.course_grant_matches(id) and exists (
      select 1 from elite.course_videos v
      where v.course_id=video_courses.id and v.published_at is not null
    ))));

drop policy elite_videos_select on elite.course_videos;
create policy elite_videos_select on elite.course_videos for select to authenticated
  using (elite.is_enrolled() and (elite.is_instructor() or
    (published_at is not null and elite.course_grant_matches(course_id))));

drop function elite.video_apply_category(uuid,text[],boolean,uuid[],boolean);
drop function elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean);
drop function elite.video_create(text,text,text,text);
drop function elite.video_delete(uuid);
drop function elite.video_audience_matches(uuid);
drop table elite.video_audiences;

create function elite.video_course_create(p_title text,p_note text) returns uuid
language plpgsql security definer set search_path=''
as $$ declare v_id uuid;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'course title required'; end if;
  insert into elite.video_courses(title,note) values(btrim(p_title),nullif(btrim(p_note),''))
    returning id into v_id;
  return v_id;
end $$;

create function elite.video_course_update(p_course_id uuid,p_title text,p_note text) returns void
language plpgsql security definer set search_path=''
as $$ begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'course title required'; end if;
  update elite.video_courses set title=btrim(p_title),note=nullif(btrim(p_note),'') where id=p_course_id;
  if not found then raise exception 'course not found'; end if;
end $$;

create function elite.video_course_set_grants(p_course_id uuid,p_cohorts text[],p_users uuid[]) returns void
language plpgsql security definer set search_path=''
as $$ declare v_cohorts text[] := coalesce(p_cohorts,array[]::text[]);
        v_users uuid[] := coalesce(p_users,array[]::uuid[]);
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  perform 1 from elite.video_courses where id=p_course_id for update;
  if not found then raise exception 'course not found'; end if;
  if exists (select 1 from unnest(v_cohorts) c where c is null or not exists
      (select 1 from elite.cohorts where code=c)) then raise exception 'unknown cohort'; end if;
  if exists (select 1 from unnest(v_users) u where u is null or not exists
      (select 1 from elite.enrollments where user_id=u)) then raise exception 'unknown enrollment'; end if;
  delete from elite.course_grants where course_id=p_course_id;
  insert into elite.course_grants(course_id,kind,cohort_code)
    select p_course_id,'cohort',x from (select distinct unnest(v_cohorts) x) s;
  insert into elite.course_grants(course_id,kind,target_user_id)
    select p_course_id,'user',x from (select distinct unnest(v_users) x) s;
end $$;

create function elite.video_course_delete(p_course_id uuid) returns void
language plpgsql security definer set search_path=''
as $$ declare v_count integer;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  perform 1 from elite.video_courses where id=p_course_id for update;
  if not found then raise exception 'course not found'; end if;
  select count(*) into v_count from elite.course_videos where course_id=p_course_id;
  if v_count>0 then raise exception '請先移出或刪除課程內的 % 支影片',v_count; end if;
  delete from elite.video_courses where id=p_course_id;
end $$;

create function elite.course_video_create(
  p_course_id uuid,p_title text,p_url text,p_category text,p_note text
) returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_url),'') is null then
    raise exception 'title and url required';
  end if;
  if p_category not in ('pre','day1','day2','extra') then raise exception 'invalid category'; end if;
  perform 1 from elite.video_courses where id=p_course_id;
  if not found then raise exception 'course not found'; end if;
  insert into elite.course_videos(course_id,title,url,category,note,created_by,published_at)
    values(p_course_id,btrim(p_title),btrim(p_url),p_category,nullif(btrim(p_note),''),auth.uid(),null)
    returning id into v_id;
  return v_id;
end $$;

create function elite.course_video_publish(p_video_id uuid,p_publish boolean) returns void
language plpgsql security definer set search_path=''
as $$ begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  update elite.course_videos set published_at=case when p_publish then coalesce(published_at,now()) else null end
    where id=p_video_id;
  if not found then raise exception 'video not found'; end if;
end $$;

create function elite.course_video_move(p_video_id uuid,p_course_id uuid) returns void
language plpgsql security definer set search_path=''
as $$ declare v_old_course uuid;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  select course_id into v_old_course from elite.course_videos where id=p_video_id for update;
  if not found then raise exception 'video not found'; end if;
  if v_old_course=p_course_id then raise exception 'video is already in this course'; end if;
  perform 1 from elite.video_courses where id=p_course_id;
  if not found then raise exception 'target course not found'; end if;
  update elite.course_videos set course_id=p_course_id,published_at=null where id=p_video_id;
end $$;

create function elite.course_video_delete(p_video_id uuid) returns void
language plpgsql security definer set search_path=''
as $$ begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  delete from elite.course_videos where id=p_video_id;
  if not found then raise exception 'video not found'; end if;
end $$;

revoke all on function elite.video_course_create(text,text),
  elite.video_course_update(uuid,text,text), elite.video_course_set_grants(uuid,text[],uuid[]),
  elite.video_course_delete(uuid), elite.course_video_create(uuid,text,text,text,text),
  elite.course_video_publish(uuid,boolean), elite.course_video_move(uuid,uuid),
  elite.course_video_delete(uuid) from public,anon,authenticated;
grant execute on function elite.video_course_create(text,text),
  elite.video_course_update(uuid,text,text), elite.video_course_set_grants(uuid,text[],uuid[]),
  elite.video_course_delete(uuid), elite.course_video_create(uuid,text,text,text,text),
  elite.course_video_publish(uuid,boolean), elite.course_video_move(uuid,uuid),
  elite.course_video_delete(uuid) to authenticated;

-- v2 already restricts direct writes; assert it remains so after the new column.
revoke all on elite.course_videos from public,anon,authenticated;
grant select on elite.course_videos to authenticated;

do $$ begin
  if (select count(*) from elite.video_courses) <> 1
     or (select count(*) from elite.video_courses where title='2026 第一期菁英班課程影片') <> 1
     or (select count(*) from elite.course_videos where course_id=(select id from elite.video_courses)
          and published_at is not null) <> 10
     or (select count(*) from elite.course_grants where kind='cohort' and cohort_code='2026-1'
          and course_id=(select id from elite.video_courses)) <> 1
     or (select count(*) from elite.course_grants) <> 1
     or has_table_privilege('authenticated','elite.video_courses','INSERT')
     or has_table_privilege('authenticated','elite.video_courses','UPDATE')
     or has_table_privilege('authenticated','elite.video_courses','DELETE')
     or has_table_privilege('authenticated','elite.course_grants','INSERT')
     or has_table_privilege('authenticated','elite.course_grants','UPDATE')
     or has_table_privilege('authenticated','elite.course_grants','DELETE')
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE')
     or not has_function_privilege('authenticated','elite.course_grant_matches(uuid)','EXECUTE') then
    raise exception 'Videos v3 migration postcheck failed';
  end if;
end $$;
commit;
