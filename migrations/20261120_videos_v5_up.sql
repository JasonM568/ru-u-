-- Videos v5: persist "previewed" as a DB flag so the publish gate survives a page
-- refresh or reopening the manage dialog on another device/tab (was client-only React state).
-- Review and rehearse in an isolated database. Do not apply to production without approval.
begin;
set local lock_timeout = '5s';
lock table elite.course_videos in access exclusive mode;

do $$ begin
  if to_regclass('elite.course_videos') is null
     or to_regclass('elite.video_courses') is null
     or exists (select 1 from information_schema.columns
                where table_schema='elite' and table_name='course_videos' and column_name='previewed_at')
     or to_regprocedure('elite.course_video_mark_previewed(uuid)') is not null
     or to_regprocedure('elite.course_video_publish(uuid,boolean)') is null then
    raise exception 'Videos v5 preflight: unexpected schema or existing v5 objects';
  end if;
  if (select count(*) from pg_policies where schemaname='elite' and tablename='course_videos') <> 2
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE') then
    raise exception 'Videos v5 preflight: video RLS or table ACL differs';
  end if;
end $$;

alter table elite.course_videos add column previewed_at timestamptz;

-- Idempotent: repeated preview clicks on an already-previewed draft are a no-op,
-- and a publish does not require re-previewing on every edit.
create function elite.course_video_mark_previewed(p_video_id uuid) returns void
language plpgsql security definer set search_path=''
as $$ begin
  if not (elite.is_enrolled() and elite.is_instructor()) then raise exception 'active instructor required'; end if;
  update elite.course_videos set previewed_at=coalesce(previewed_at,now()) where id=p_video_id;
  if not found then raise exception 'video not found'; end if;
end $$;

revoke all on function elite.course_video_mark_previewed(uuid) from public,anon,authenticated;
grant execute on function elite.course_video_mark_previewed(uuid) to authenticated;

do $$ begin
  if not exists (select 1 from information_schema.columns
                 where table_schema='elite' and table_name='course_videos' and column_name='previewed_at')
     or has_table_privilege('authenticated','elite.course_videos','INSERT')
     or has_table_privilege('authenticated','elite.course_videos','UPDATE')
     or has_table_privilege('authenticated','elite.course_videos','DELETE')
     or not has_function_privilege('authenticated','elite.course_video_mark_previewed(uuid)','EXECUTE')
     or has_function_privilege('anon','elite.course_video_mark_previewed(uuid)','EXECUTE') then
    raise exception 'Videos v5 migration postcheck failed';
  end if;
end $$;
commit;
