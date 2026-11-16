-- Videos v4: editable video metadata and instructor-controlled order within categories.
-- Review and rehearse in an isolated database. Do not apply to production without approval.
begin;
set local lock_timeout = '5s';
lock table elite.course_videos in access exclusive mode;

do $$ begin
  if to_regclass('elite.course_videos') is null
     or to_regclass('elite.video_courses') is null
     or exists (select 1 from information_schema.columns
                where table_schema='elite' and table_name='course_videos' and column_name='sort_order')
     or to_regprocedure('elite.course_video_update(uuid,text,text)') is not null
     or to_regprocedure('elite.course_video_reorder(uuid,uuid[])') is not null
     or to_regprocedure('elite.course_video_create(uuid,text,text,text,text)') is null
     or to_regprocedure('elite.course_video_move(uuid,uuid)') is null then
    raise exception 'Videos v4 preflight: unexpected schema or existing v4 objects';
  end if;
  if (select count(*) from pg_policies where schemaname='elite' and tablename='course_videos') <> 2
     or (select count(*) from pg_policies where schemaname='elite' and tablename='course_videos'
         and ((policyname='elite_videos_select' and cmd='SELECT' and permissive='PERMISSIVE')
           or (policyname='cohort_v1_active_gate' and permissive='RESTRICTIVE'))) <> 2
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE') then
    raise exception 'Videos v4 preflight: video RLS or table ACL differs';
  end if;
end $$;

alter table elite.course_videos add column sort_order integer;

-- Match the old orderedVideos(): fixed category order, then created_at, then id.
-- Number across the full course so reorder can accept every video in one call.
with ranked as (
  select id, (row_number() over (
    partition by course_id
    order by case category when 'pre' then 0 when 'day1' then 1
      when 'day2' then 2 when 'extra' then 3 else 4 end,
      created_at, id
  ) - 1)::integer as position
  from elite.course_videos
)
update elite.course_videos v set sort_order=ranked.position
from ranked where v.id=ranked.id;

alter table elite.course_videos alter column sort_order set default 0;
alter table elite.course_videos alter column sort_order set not null;
alter table elite.course_videos add constraint course_videos_sort_order_nonnegative check (sort_order >= 0);
create index course_videos_course_sort_idx on elite.course_videos(course_id, sort_order desc);

create function elite.course_video_update(p_video_id uuid,p_title text,p_note text) returns void
language plpgsql security definer set search_path=''
as $$ begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  if nullif(btrim(p_title),'') is null then raise exception 'video title required'; end if;
  update elite.course_videos set title=btrim(p_title),note=nullif(btrim(p_note),'')
    where id=p_video_id;
  if not found then raise exception 'video not found'; end if;
end $$;

create function elite.course_video_reorder(p_course_id uuid,p_ordered_ids uuid[]) returns void
language plpgsql security definer set search_path=''
as $$ declare v_count integer; v_updated integer;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  -- Create and move take the same course row lock before changing membership.
  perform 1 from elite.video_courses where id=p_course_id for update;
  if not found then raise exception 'course not found'; end if;
  if p_ordered_ids is null then raise exception 'ordered video ids required'; end if;
  select count(*) into v_count from elite.course_videos where course_id=p_course_id;
  if cardinality(p_ordered_ids) <> v_count
     or exists (select 1 from unnest(p_ordered_ids) x where x is null)
     or (select count(distinct x) from unnest(p_ordered_ids) x) <> v_count
     or exists (
       select 1 from unnest(p_ordered_ids) x
       left join elite.course_videos v on v.id=x and v.course_id=p_course_id
       where v.id is null
     ) then
    raise exception 'ordered video ids must exactly match the course';
  end if;
  update elite.course_videos v set sort_order=(input.ordinality-1)::integer
    from unnest(p_ordered_ids) with ordinality as input(id,ordinality)
    where v.id=input.id and v.course_id=p_course_id;
  get diagnostics v_updated = row_count;
  if v_updated <> v_count then raise exception 'course videos changed during reorder'; end if;
end $$;

-- Assign new and moved videos after the current maximum. The course row lock
-- serializes membership/order changes with course_video_reorder.
create or replace function elite.course_video_create(
  p_course_id uuid,p_title text,p_url text,p_category text,p_note text
) returns uuid language plpgsql security definer set search_path=''
as $$ declare v_id uuid; v_order integer;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_url),'') is null then
    raise exception 'title and url required';
  end if;
  if p_category not in ('pre','day1','day2','extra') then raise exception 'invalid category'; end if;
  perform 1 from elite.video_courses where id=p_course_id for update;
  if not found then raise exception 'course not found'; end if;
  select coalesce(max(sort_order)+1,0) into v_order from elite.course_videos where course_id=p_course_id;
  insert into elite.course_videos(course_id,title,url,category,note,created_by,published_at,sort_order)
    values(p_course_id,btrim(p_title),btrim(p_url),p_category,nullif(btrim(p_note),''),auth.uid(),null,v_order)
    returning id into v_id;
  return v_id;
end $$;

create or replace function elite.course_video_move(p_video_id uuid,p_course_id uuid) returns void
language plpgsql security definer set search_path=''
as $$ declare v_old_course uuid; v_locked_course uuid; v_order integer;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  select course_id into v_old_course from elite.course_videos where id=p_video_id;
  if not found then raise exception 'video not found'; end if;
  if v_old_course=p_course_id then raise exception 'video is already in this course'; end if;
  if p_course_id is null then raise exception 'target course not found'; end if;
  -- Lock both course rows in the same order for concurrent moves.
  perform 1 from elite.video_courses where id in (v_old_course,p_course_id) order by id for update;
  if not exists (select 1 from elite.video_courses where id=p_course_id) then
    raise exception 'target course not found';
  end if;
  select course_id into v_locked_course from elite.course_videos where id=p_video_id for update;
  if not found then raise exception 'video not found'; end if;
  if v_locked_course <> v_old_course then raise exception 'video course changed; retry move'; end if;
  select coalesce(max(sort_order)+1,0) into v_order from elite.course_videos where course_id=p_course_id;
  update elite.course_videos set course_id=p_course_id,sort_order=v_order,published_at=null
    where id=p_video_id;
end $$;

revoke all on function elite.course_video_update(uuid,text,text),
  elite.course_video_reorder(uuid,uuid[]),
  elite.course_video_create(uuid,text,text,text,text),
  elite.course_video_move(uuid,uuid) from public,anon,authenticated;
grant execute on function elite.course_video_update(uuid,text,text),
  elite.course_video_reorder(uuid,uuid[]),
  elite.course_video_create(uuid,text,text,text,text),
  elite.course_video_move(uuid,uuid) to authenticated;

-- Production elite default ACL can grant writes: reassert read-only direct access.
revoke all on elite.course_videos from public,anon,authenticated;
grant select on elite.course_videos to authenticated;

do $$ begin
  if exists (select 1 from elite.course_videos where sort_order is null or sort_order < 0)
     or exists (
       select 1 from (
         select id, row_number() over (
           partition by course_id order by
             case category when 'pre' then 0 when 'day1' then 1
               when 'day2' then 2 when 'extra' then 3 else 4 end,
             created_at,id
         ) - 1 as previous_order
         from elite.course_videos
       ) old_order join elite.course_videos v using (id)
       where old_order.previous_order <> v.sort_order
     )
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE')
     or not has_function_privilege('authenticated','elite.course_video_update(uuid,text,text)','EXECUTE')
     or not has_function_privilege('authenticated','elite.course_video_reorder(uuid,uuid[])','EXECUTE')
     or has_function_privilege('anon','elite.course_video_update(uuid,text,text)','EXECUTE')
     or has_function_privilege('anon','elite.course_video_reorder(uuid,uuid[])','EXECUTE') then
    raise exception 'Videos v4 migration postcheck failed';
  end if;
end $$;
commit;
