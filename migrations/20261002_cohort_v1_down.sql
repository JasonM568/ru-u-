-- Cohort v1 rollback. Only safe before second-term data or suspension is used.
-- Run as migration owner after the README preflight. Aborts without changes if
-- rollback would expose second-term records under the former single-term RLS.
begin;

do $$
begin
  if to_regnamespace('elite_cohort_v1_backup') is null then
    raise exception 'Cohort v1 backup is missing';
  end if;
  if exists (select 1 from elite.enrollments where cohort <> '2026-1' or status <> 'active') then
    raise exception 'Second-term or suspended roster exists: rollback would expose data';
  end if;
  if exists (select 1 from elite.course_materials where cohort <> '2026-1' or all_cohorts)
     or exists (select 1 from elite.course_videos where cohort <> '2026-1' or all_cohorts)
     or exists (select 1 from elite.flow_configs where cohort <> '2026-1')
     or exists (select 1 from elite.team_meetings where cohort <> '2026-1')
     or exists (select 1 from elite.trade_ledger where cohort <> '2026-1')
     or exists (select 1 from elite.reviews where cohort <> '2026-1') then
    raise exception 'Second-term content exists: rollback would expose data';
  end if;
  if exists (select 1 from elite.enrollments e left join elite_cohort_v1_backup.enrollments b using (user_id)
             where b.user_id is null)
     or exists (select 1 from elite_cohort_v1_backup.enrollments b left join elite.enrollments e using (user_id)
                where e.user_id is null) then
    raise exception 'Roster membership changed; reconcile before rollback';
  end if;
end $$;

-- Remove the gate first. Restore every rewritten policy from its recorded text.
do $$ declare p record; ddl text; t record;
begin
  for t in select tablename from pg_tables where schemaname = 'elite' and tablename <> 'cohorts' loop
    execute format('drop policy cohort_v1_active_gate on elite.%I', t.tablename);
  end loop;
  for p in select * from elite_cohort_v1_backup.policies
           where tablename in ('course_materials','flow_configs','team_meetings','trade_ledger','reviews')
              or (tablename = 'course_videos' and policyname = 'elite_videos_select')
  loop
    execute format('drop policy %I on elite.%I', p.policyname, p.tablename);
    ddl := format('create policy %I on elite.%I as %s for %s to %s',
      p.policyname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(r), ', ') from unnest(p.roles) r));
    if p.qual is not null then ddl := ddl || ' using (' || p.qual || ')'; end if;
    if p.with_check is not null then ddl := ddl || ' with check (' || p.with_check || ')'; end if;
    execute ddl;
  end loop;
end $$;

drop policy cohorts_read on elite.cohorts;
drop policy cohorts_insert on elite.cohorts;
drop policy cohorts_update on elite.cohorts;
alter table elite.enrollments alter column cohort drop default;
do $$ declare t text;
begin
  foreach t in array array['course_materials','course_videos','flow_configs','team_meetings','trade_ledger','reviews'] loop
    execute format('alter table elite.%I alter column cohort drop default', t);
  end loop;
end $$;
drop function elite.set_current_cohort(text);
drop function elite.current_cohort();
drop function elite.my_cohort();
drop function elite.my_enrollment_status();

alter table elite.flow_configs drop constraint flow_configs_cohort_group_unique;
do $$ declare p record;
begin
  for p in select * from elite_cohort_v1_backup.flow_unique loop
    execute format('alter table elite.flow_configs add constraint %I %s', p.conname, p.definition);
  end loop;
end $$;

do $$ declare t text;
begin
  foreach t in array array['course_materials','course_videos','flow_configs','team_meetings','trade_ledger','reviews'] loop
    execute format('drop index elite.%I', t || '_cohort_idx');
    execute format('alter table elite.%I drop constraint %I', t, t || '_cohort_fk');
    execute format('alter table elite.%I drop column cohort', t);
  end loop;
end $$;
alter table elite.course_materials drop column all_cohorts;
alter table elite.course_videos drop column all_cohorts;

alter table elite.enrollments drop constraint enrollments_cohort_fk;
update elite.enrollments e set cohort = b.cohort
from elite_cohort_v1_backup.enrollments b where e.user_id = b.user_id;
alter table elite.enrollments alter column cohort set default '1.0';
alter table elite.enrollments drop constraint enrollments_status_check;

do $$ declare d text;
begin
  select definition into d from elite_cohort_v1_backup.functions where proname = 'is_enrolled';
  execute d;
end $$;
alter table elite.enrollments drop column status;

drop table elite.cohorts;
drop schema elite_cohort_v1_backup cascade;
commit;
