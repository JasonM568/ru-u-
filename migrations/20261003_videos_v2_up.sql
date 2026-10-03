-- Videos v2. Apply only after the runbook preflight and with video writes frozen.
begin;
lock table elite.course_videos in access exclusive mode;

create schema elite_videos_v2_backup;
revoke all on schema elite_videos_v2_backup from public, anon, authenticated;
create table elite_videos_v2_backup.videos as
  select id, cohort, all_cohorts from elite.course_videos;
create table elite_videos_v2_backup.select_policy as
  select * from pg_policies where schemaname='elite' and tablename='course_videos'
    and policyname='elite_videos_select';

do $$ begin
  if (select count(*) from elite_videos_v2_backup.select_policy) <> 1 then
    raise exception 'Expected exactly one elite_videos_select policy';
  end if;
  if (select count(*) from elite.course_videos) <> 10
     or exists (select 1 from elite.course_videos where cohort <> '2026-1' or all_cohorts) then
    raise exception 'Expected exactly ten 2026-1-only videos; inspect live data';
  end if;
  if (select count(*) from elite.enrollments where class_role='student' and cohort='2026-1' and status='active') <> 11 then
    raise exception 'Expected eleven active first-cohort students';
  end if;
  if not exists (select 1 from elite.cohorts where code='2026-1') then
    raise exception 'First cohort missing';
  end if;
  if not exists (select 1 from pg_policies where schemaname='elite' and tablename='course_videos'
                 and policyname='cohort_v1_active_gate' and permissive='RESTRICTIVE') then
    raise exception 'Cohort v1 active gate missing';
  end if;
  if exists (select 1 from pg_policies where schemaname='elite' and tablename='course_videos'
             and policyname <> 'elite_videos_select' and (coalesce(qual,'') || coalesce(with_check,'')) ~ '\m(cohort|all_cohorts)\M') then
    raise exception 'Another video policy references old audience columns';
  end if;
end $$;

alter table elite.course_videos add column published_at timestamptz;

create table elite.video_audiences (
  id bigint generated always as identity primary key,
  video_id uuid not null references elite.course_videos(id) on delete cascade,
  kind text not null check (kind in ('cohort','user','all')),
  cohort_code text references elite.cohorts(code) on delete restrict,
  target_user_id uuid references elite.enrollments(user_id) on delete cascade,
  constraint video_audience_one_target check (
    (kind='cohort' and cohort_code is not null and target_user_id is null) or
    (kind='user' and cohort_code is null and target_user_id is not null) or
    (kind='all' and cohort_code is null and target_user_id is null)
  )
);
-- Production elite default privileges give authenticated arwd to new tables.
revoke all on elite.video_audiences from public, anon, authenticated;
revoke all on sequence elite.video_audiences_id_seq from public, anon, authenticated;
create unique index video_audiences_cohort_unique on elite.video_audiences(video_id,cohort_code) where kind='cohort';
create unique index video_audiences_user_unique on elite.video_audiences(video_id,target_user_id) where kind='user';
create unique index video_audiences_all_unique on elite.video_audiences(video_id) where kind='all';
create index video_audiences_video_idx on elite.video_audiences(video_id);

insert into elite.video_audiences(video_id,kind,cohort_code)
select id,'cohort','2026-1' from elite.course_videos;
update elite.course_videos set published_at=transaction_timestamp();

alter table elite.video_audiences enable row level security;
create policy video_audiences_instructor_select on elite.video_audiences
  for select to authenticated using (elite.is_instructor() and elite.is_enrolled());
create policy cohort_v1_active_gate on elite.video_audiences as restrictive
  for all to authenticated using (elite.is_enrolled()) with check (elite.is_enrolled());
grant select on elite.video_audiences to authenticated;

create function elite.video_audience_matches(p_video_id uuid) returns boolean
language sql stable security definer set search_path=''
as $$
  select elite.is_enrolled() and exists (
    select 1 from elite.video_audiences a where a.video_id=p_video_id and (
      a.kind='all' or
      (a.kind='cohort' and a.cohort_code=elite.my_cohort()) or
      (a.kind='user' and a.target_user_id=auth.uid())
    )
  )
$$;
revoke all on function elite.video_audience_matches(uuid) from public, anon, authenticated;
grant execute on function elite.video_audience_matches(uuid) to authenticated;

drop policy elite_videos_select on elite.course_videos;
create policy elite_videos_select on elite.course_videos for select to authenticated
  using (elite.is_enrolled() and (elite.is_instructor() or
    (published_at is not null and elite.video_audience_matches(id))));

-- A single RPC updates recipients and publication in one transaction.
create function elite.video_set_audiences(
  p_video_id uuid, p_cohorts text[], p_all boolean, p_users uuid[], p_publish boolean
) returns void language plpgsql security definer set search_path=''
as $$
declare v_cohorts text[] := coalesce(p_cohorts,array[]::text[]);
        v_users uuid[] := coalesce(p_users,array[]::uuid[]);
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  perform 1 from elite.course_videos where id=p_video_id for update;
  if not found then raise exception 'video not found'; end if;
  if p_all and cardinality(v_cohorts)>0 then raise exception 'all cohorts and selected cohorts are exclusive'; end if;
  if p_publish and not (p_all or cardinality(v_cohorts)>0 or cardinality(v_users)>0) then
    raise exception 'published video requires an audience';
  end if;
  if exists (select 1 from unnest(v_cohorts) c where c is null or not exists
      (select 1 from elite.cohorts where code=c)) then raise exception 'unknown cohort'; end if;
  if exists (select 1 from unnest(v_users) u where u is null or not exists
      (select 1 from elite.enrollments where user_id=u)) then raise exception 'unknown enrollment'; end if;
  delete from elite.video_audiences where video_id=p_video_id;
  if p_publish then
    if p_all then insert into elite.video_audiences(video_id,kind) values(p_video_id,'all'); end if;
    insert into elite.video_audiences(video_id,kind,cohort_code)
      select p_video_id,'cohort',x from (select distinct unnest(v_cohorts) x) s;
    insert into elite.video_audiences(video_id,kind,target_user_id)
      select p_video_id,'user',x from (select distinct unnest(v_users) x) s;
    update elite.course_videos set published_at=coalesce(published_at,now()) where id=p_video_id;
  else
    update elite.course_videos set published_at=null where id=p_video_id;
  end if;
end $$;

create function elite.video_apply_category(
  p_source_id uuid, p_cohorts text[], p_all boolean, p_users uuid[], p_publish boolean
) returns integer language plpgsql security definer set search_path=''
as $$ declare v_category text; v_id uuid; v_count integer := 0;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  select category into v_category from elite.course_videos where id=p_source_id;
  if not found then raise exception 'source video not found'; end if;
  for v_id in select id from elite.course_videos
    where category=v_category and published_at is not null order by id loop
    perform elite.video_set_audiences(v_id,p_cohorts,p_all,p_users,p_publish);
    v_count := v_count + 1;
  end loop;
  return v_count;
end $$;

create function elite.video_create(p_title text,p_url text,p_category text,p_note text)
returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_url),'') is null then
    raise exception 'title and url required';
  end if;
  if p_category not in ('pre','day1','day2','extra') then raise exception 'invalid category'; end if;
  insert into elite.course_videos(title,url,category,note,created_by)
    values(btrim(p_title),btrim(p_url),p_category,nullif(btrim(p_note),''),auth.uid()) returning id into v_id;
  return v_id;
end $$;

create function elite.video_delete(p_video_id uuid) returns void
language plpgsql security definer set search_path=''
as $$ begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  delete from elite.course_videos where id=p_video_id;
  if not found then raise exception 'video not found'; end if;
end $$;

revoke all on function elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean),
  elite.video_apply_category(uuid,text[],boolean,uuid[],boolean),
  elite.video_create(text,text,text,text), elite.video_delete(uuid) from public,anon,authenticated;
grant execute on function elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean),
  elite.video_apply_category(uuid,text[],boolean,uuid[],boolean),
  elite.video_create(text,text,text,text), elite.video_delete(uuid) to authenticated;

-- Remove direct writes, including default whole-table privileges.
revoke all on elite.course_videos from public,anon,authenticated;
grant select on elite.course_videos to authenticated;

alter table elite.course_videos drop constraint course_videos_cohort_fk;
drop index elite.course_videos_cohort_idx;
alter table elite.course_videos drop column cohort;
alter table elite.course_videos drop column all_cohorts;

do $$ begin
  if (select count(*) from elite.video_audiences where kind='cohort' and cohort_code='2026-1') <> 10
     or exists (select 1 from elite.course_videos where published_at is null)
     or has_table_privilege('authenticated','elite.video_audiences','INSERT')
     or has_table_privilege('authenticated','elite.video_audiences','UPDATE')
     or has_table_privilege('authenticated','elite.video_audiences','DELETE')
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE') then
    raise exception 'Videos v2 migration postcheck failed';
  end if;
end $$;
commit;
