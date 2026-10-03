-- Guarded rollback. Never restore cohort-v1 visibility if audiences diverged.
begin;
do $$ begin
  if to_regnamespace('elite_videos_v2_backup') is null then raise exception 'v2 backup missing'; end if;
  if exists (select 1 from elite.course_videos v full join elite_videos_v2_backup.videos b using(id)
             where v.id is null or b.id is null or b.cohort <> '2026-1' or b.all_cohorts) then
    raise exception 'Video identity/baseline changed; forward repair required';
  end if;
  if exists (select 1 from elite.course_videos v where v.published_at is null or
    (select count(*) from elite.video_audiences a where a.video_id=v.id) <> 1 or
    not exists (select 1 from elite.video_audiences a where a.video_id=v.id
                and a.kind='cohort' and a.cohort_code='2026-1')) then
    raise exception 'Audiences changed; rollback would expose hidden content';
  end if;
  if (select count(*) from elite_videos_v2_backup.select_policy) <> 1 then raise exception 'Old policy missing'; end if;
end $$;

alter table elite.course_videos add column cohort text;
alter table elite.course_videos add column all_cohorts boolean not null default false;
update elite.course_videos set cohort='2026-1';
alter table elite.course_videos alter column cohort set not null;
alter table elite.course_videos alter column cohort set default elite.my_cohort();
alter table elite.course_videos add constraint course_videos_cohort_fk foreign key(cohort) references elite.cohorts(code);
create index course_videos_cohort_idx on elite.course_videos(cohort);

drop policy elite_videos_select on elite.course_videos;
do $$ declare p record; ddl text;
begin
  select * into p from elite_videos_v2_backup.select_policy;
  ddl := format('create policy %I on elite.course_videos as %s for %s to %s',
    p.policyname,p.permissive,p.cmd,
    (select string_agg(quote_ident(r),', ') from unnest(p.roles) r));
  if p.qual is not null then ddl := ddl || ' using (' || p.qual || ')'; end if;
  if p.with_check is not null then ddl := ddl || ' with check (' || p.with_check || ')'; end if;
  execute ddl;
end $$;

drop function elite.video_apply_category(uuid,text[],boolean,uuid[],boolean);
drop function elite.video_set_audiences(uuid,text[],boolean,uuid[],boolean);
drop function elite.video_create(text,text,text,text);
drop function elite.video_delete(uuid);
drop function elite.video_audience_matches(uuid);
drop table elite.video_audiences;
alter table elite.course_videos drop column published_at;
-- The deployed Cohort v1 UI writes directly under its instructor RLS policies.
revoke all on elite.course_videos from public,anon,authenticated;
grant select,insert,update,delete on elite.course_videos to authenticated;
drop schema elite_videos_v2_backup cascade;
commit;
