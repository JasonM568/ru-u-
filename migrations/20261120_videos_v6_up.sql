-- Videos v6: bulk-publish every remaining draft in a course in one call, so a
-- whole batch upload does not require previewing and publishing videos one at a time.
-- Review and rehearse in an isolated database. Do not apply to production without approval.
begin;
set local lock_timeout = '5s';
lock table elite.course_videos in access exclusive mode;

do $$ begin
  if to_regclass('elite.course_videos') is null
     or to_regclass('elite.video_courses') is null
     or to_regprocedure('elite.course_video_publish_all(uuid)') is not null
     or to_regprocedure('elite.course_video_publish(uuid,boolean)') is null then
    raise exception 'Videos v6 preflight: unexpected schema or existing v6 objects';
  end if;
  if (select count(*) from pg_policies where schemaname='elite' and tablename='course_videos') <> 2
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE') then
    raise exception 'Videos v6 preflight: video RLS or table ACL differs';
  end if;
end $$;

create function elite.course_video_publish_all(p_course_id uuid) returns integer
language plpgsql security definer set search_path=''
as $$ declare v_count integer;
begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  perform 1 from elite.video_courses where id=p_course_id;
  if not found then raise exception 'course not found'; end if;
  update elite.course_videos set published_at=now()
    where course_id=p_course_id and published_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke all on function elite.course_video_publish_all(uuid) from public,anon,authenticated;
grant execute on function elite.course_video_publish_all(uuid) to authenticated;

do $$ begin
  if has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE')
     or not has_function_privilege('authenticated','elite.course_video_publish_all(uuid)','EXECUTE')
     or has_function_privilege('anon','elite.course_video_publish_all(uuid)','EXECUTE') then
    raise exception 'Videos v6 migration postcheck failed';
  end if;
end $$;
commit;
