-- Guarded v3 -> v2 rollback. Refuse any divergence that could change visibility.
begin;
set local lock_timeout = '5s';
lock table elite.course_videos, elite.video_courses, elite.course_grants in access exclusive mode;

do $$ begin
  if to_regnamespace('elite_videos_v3_backup') is null
     or to_regclass('elite_videos_v3_backup.videos') is null
     or to_regclass('elite_videos_v3_backup.audiences') is null
     or to_regclass('elite.video_audiences') is not null then
    raise exception 'Videos v3 rollback baseline missing or v2 audiences already exist';
  end if;
  if (select count(*) from elite_videos_v3_backup.videos) <> 10
     or (select count(*) from elite_videos_v3_backup.audiences) <> 10
     or (select count(*) from elite.course_videos) <> 10
     or (select count(*) from elite.video_courses) <> 1
     or (select count(*) from elite.video_courses
         where title='2026 第一期菁英班課程影片' and note is null) <> 1
     or (select count(*) from elite.course_grants) <> 1
     or (select count(*) from elite.course_grants g join elite.video_courses c on c.id=g.course_id
         where g.kind='cohort' and g.cohort_code='2026-1' and g.target_user_id is null) <> 1 then
    raise exception 'Videos v3 course/grant baseline changed; forward repair required';
  end if;
  if exists (
    select 1 from elite.course_videos v full join elite_videos_v3_backup.videos b using(id)
    where v.id is null or b.id is null or
      v.title is distinct from b.title or v.url is distinct from b.url or
      v.category is distinct from b.category or v.note is distinct from b.note or
      v.created_by is distinct from b.created_by or v.created_at is distinct from b.created_at or
      v.published_at is distinct from b.published_at or
      v.course_id is distinct from (select id from elite.video_courses)
  ) then
    raise exception 'Videos v3 videos changed; rollback would alter visibility';
  end if;
  if exists (select 1 from elite_videos_v3_backup.audiences
      where kind<>'cohort' or cohort_code<>'2026-1' or target_user_id is not null) then
    raise exception 'Videos v2 audience backup differs';
  end if;
end $$;

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
revoke all on elite.video_audiences from public, anon, authenticated;
revoke all on sequence elite.video_audiences_id_seq from public, anon, authenticated;
create unique index video_audiences_cohort_unique on elite.video_audiences(video_id,cohort_code) where kind='cohort';
create unique index video_audiences_user_unique on elite.video_audiences(video_id,target_user_id) where kind='user';
create unique index video_audiences_all_unique on elite.video_audiences(video_id) where kind='all';
create index video_audiences_video_idx on elite.video_audiences(video_id);
insert into elite.video_audiences(video_id,kind,cohort_code,target_user_id)
  select video_id,kind,cohort_code,target_user_id from elite_videos_v3_backup.audiences;
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

drop function elite.video_course_create(text,text);
drop function elite.video_course_update(uuid,text,text);
drop function elite.video_course_set_grants(uuid,text[],uuid[]);
drop function elite.video_course_delete(uuid);
drop function elite.course_video_create(uuid,text,text,text,text);
drop function elite.course_video_publish(uuid,boolean);
drop function elite.course_video_move(uuid,uuid);
drop function elite.course_video_delete(uuid);
drop policy video_courses_select on elite.video_courses;
drop function elite.course_grant_matches(uuid);
drop index elite.course_videos_course_order_idx;
alter table elite.course_videos drop constraint course_videos_course_fk;
alter table elite.course_videos drop column course_id;
drop table elite.course_grants;
drop table elite.video_courses;

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

revoke all on function elite.video_audience_matches(uuid),
  elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean),
  elite.video_apply_category(uuid,text[],boolean,uuid[],boolean),
  elite.video_create(text,text,text,text), elite.video_delete(uuid) from public,anon,authenticated;
grant execute on function elite.video_audience_matches(uuid),
  elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean),
  elite.video_apply_category(uuid,text[],boolean,uuid[],boolean),
  elite.video_create(text,text,text,text), elite.video_delete(uuid) to authenticated;

do $$ begin
  if (select count(*) from elite.video_audiences) <> 10
     or (select count(*) from elite.course_videos) <> 10
     or to_regclass('elite.video_courses') is not null
     or has_table_privilege('authenticated','elite.video_audiences','INSERT')
     or has_table_privilege('authenticated','elite.video_audiences','UPDATE')
     or has_table_privilege('authenticated','elite.video_audiences','DELETE') then
    raise exception 'Videos v3 rollback postcheck failed';
  end if;
end $$;
drop schema elite_videos_v3_backup cascade;
commit;
