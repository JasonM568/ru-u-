-- Cohort v1. Run as migration owner, in a tested Supabase branch first.
-- Do not run until migrations/README-cohort-v1.md preflight has been completed.
begin;

create schema elite_cohort_v1_backup;
revoke all on schema elite_cohort_v1_backup from public;

create table elite_cohort_v1_backup.policies as
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'elite';
create table elite_cohort_v1_backup.functions as
select p.proname, pg_get_functiondef(p.oid) as definition
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'elite' and p.proname in ('is_enrolled', 'my_team');
create table elite_cohort_v1_backup.enrollments as
select user_id, cohort from elite.enrollments;
create table elite_cohort_v1_backup.video_count as
select count(*)::bigint as row_count from elite.course_videos;
create table elite_cohort_v1_backup.storage_paths as
select name from storage.objects where bucket_id = 'elite-materials';
create table elite_cohort_v1_backup.flow_unique as
select c.conname, pg_get_constraintdef(c.oid) as definition
from pg_constraint c
where c.conrelid = 'elite.flow_configs'::regclass and c.contype = 'u'
  and pg_get_constraintdef(c.oid) like 'UNIQUE (group_id)%';

do $$
begin
  if (select count(*) from elite_cohort_v1_backup.functions where proname = 'is_enrolled') <> 1 then
    raise exception 'Expected exactly one elite.is_enrolled()';
  end if;
  if exists (select 1 from elite.enrollments where cohort <> '1.0') then
    raise exception 'Unexpected existing cohort; inspect before migration';
  end if;
  if (select count(*) from elite.enrollments) <> 14 then
    raise exception 'Expected 14 existing enrollments; inspect live roster first';
  end if;
  if (select count(*) from elite.enrollments where class_role = 'student') <> 11 then
    raise exception 'Expected 11 students; inspect live roster first';
  end if;
  if (select count(*) from elite_cohort_v1_backup.flow_unique) <> 1 then
    raise exception 'Expected one flow_configs(group_id) unique constraint';
  end if;
  if (select count(*) from elite_cohort_v1_backup.policies
      where tablename = 'course_videos' and policyname = 'elite_videos_select' and cmd = 'SELECT') <> 1 then
    raise exception 'Expected elite_videos_select SELECT policy';
  end if;
end $$;

create table elite.cohorts (
  code text primary key,
  display_name text not null,
  started_on date,
  is_current boolean not null default false,
  created_at timestamptz not null default now()
);
-- Production has elite-schema default ACL granting authenticated whole-table
-- arwd; remove it before granting only the columns this UI needs.
revoke all on elite.cohorts from public, anon, authenticated;
create unique index cohorts_one_current on elite.cohorts (is_current) where is_current;
insert into elite.cohorts(code, display_name, is_current)
values ('2026-1', '2026 第 1 期', true);
insert into elite.cohorts(code, display_name, is_current)
values ('2026-2', '2026 第 2 期', false);

alter table elite.enrollments add column status text not null default 'active';
alter table elite.enrollments add constraint enrollments_status_check
  check (status in ('active', 'suspended'));
update elite.enrollments set cohort = '2026-1' where cohort = '1.0';
alter table elite.enrollments alter column cohort drop default;
alter table elite.enrollments add constraint enrollments_cohort_fk
  foreign key (cohort) references elite.cohorts(code);

create or replace function elite.current_cohort() returns text
language sql stable security definer set search_path = ''
as $$ select code from elite.cohorts where is_current $$;
create or replace function elite.my_cohort() returns text
language sql stable security definer set search_path = ''
as $$ select cohort from elite.enrollments
       where user_id = auth.uid() and status = 'active' limit 1 $$;
create or replace function elite.my_enrollment_status() returns text
language sql stable security definer set search_path = ''
as $$ select status from elite.enrollments where user_id = auth.uid() limit 1 $$;
create or replace function elite.is_enrolled() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists(select 1 from elite.enrollments
       where user_id = auth.uid() and status = 'active') $$;

-- One transaction prevents a visible interval with zero current cohorts.
create or replace function elite.set_current_cohort(p_code text) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not (elite.is_instructor() and elite.is_enrolled()) then raise exception 'active instructor required'; end if;
  perform pg_advisory_xact_lock(hashtext('elite.current_cohort'));
  if not exists(select 1 from elite.cohorts where code = p_code) then
    raise exception 'unknown cohort %', p_code;
  end if;
  update elite.cohorts set is_current = false where is_current;
  update elite.cohorts set is_current = true where code = p_code;
end $$;

alter table elite.cohorts enable row level security;
create policy cohorts_read on elite.cohorts for select to authenticated
using (elite.is_enrolled());
create policy cohorts_insert on elite.cohorts for insert to authenticated
with check (elite.is_enrolled() and elite.is_instructor() and not is_current);
create policy cohorts_update on elite.cohorts for update to authenticated
using (elite.is_enrolled() and elite.is_instructor()) with check (elite.is_enrolled() and elite.is_instructor());
grant select, insert (code, display_name, started_on) on elite.cohorts to authenticated;
grant update (display_name, started_on) on elite.cohorts to authenticated;
revoke execute on function elite.current_cohort(), elite.my_cohort(), elite.my_enrollment_status(), elite.set_current_cohort(text) from public, anon, authenticated;
grant execute on function elite.current_cohort(), elite.my_cohort(), elite.my_enrollment_status(), elite.set_current_cohort(text) to authenticated;

do $$ begin
  if has_table_privilege('authenticated', 'elite.cohorts', 'DELETE')
     or has_column_privilege('authenticated', 'elite.cohorts', 'is_current', 'UPDATE')
     or has_table_privilege('anon', 'elite.cohorts', 'SELECT') then
    raise exception 'cohorts permissions are broader than intended';
  end if;
end $$;

-- New roster inserts inherit the current term; explicit instructor edits remain possible.
alter table elite.enrollments alter column cohort set default elite.current_cohort();

-- Team rows and published content carry their own term. The default keeps old
-- forms operational; the instructor UI must supply an explicit cohort for new content.
alter table elite.course_materials add column cohort text;
alter table elite.course_materials add column all_cohorts boolean not null default false;
alter table elite.course_videos add column cohort text;
alter table elite.course_videos add column all_cohorts boolean not null default false;
alter table elite.flow_configs add column cohort text;
alter table elite.team_meetings add column cohort text;
alter table elite.trade_ledger add column cohort text;
alter table elite.reviews add column cohort text;
update elite.course_materials set cohort = '2026-1';
update elite.course_videos set cohort = '2026-1';
update elite.flow_configs set cohort = '2026-1';
update elite.team_meetings set cohort = '2026-1';
update elite.trade_ledger set cohort = '2026-1';
update elite.reviews set cohort = '2026-1';

do $$ declare n text;
begin
  select conname into n from elite_cohort_v1_backup.flow_unique;
  execute format('alter table elite.flow_configs drop constraint %I', n);
end $$;
alter table elite.flow_configs add constraint flow_configs_cohort_group_unique unique (cohort, group_id);

do $$ declare t text;
begin
  foreach t in array array['course_materials','course_videos','flow_configs','team_meetings','trade_ledger','reviews'] loop
    execute format('alter table elite.%I alter column cohort set not null', t);
    execute format('alter table elite.%I add constraint %I foreign key (cohort) references elite.cohorts(code)', t, t || '_cohort_fk');
    execute format('alter table elite.%I alter column cohort set default elite.my_cohort()', t);
    execute format('create index %I on elite.%I (cohort)', t || '_cohort_idx', t);
  end loop;
end $$;

-- Preserve every original policy in the private backup. Recreate only the five
-- affected tables, retaining each policy's command, roles and old expression.
do $$
declare p record; access_expr text; using_expr text; check_expr text; ddl text;
begin
  for p in select * from elite_cohort_v1_backup.policies
           where tablename in ('course_materials','flow_configs','team_meetings','trade_ledger','reviews')
              or (tablename = 'course_videos' and policyname = 'elite_videos_select')
  loop
    if p.tablename in ('course_materials','course_videos') then
      access_expr := '(elite.is_instructor() or (elite.is_enrolled() and (cohort = elite.my_cohort() or all_cohorts)))';
    else
      access_expr := '(elite.is_instructor() or (elite.is_enrolled() and cohort = elite.my_cohort()))';
    end if;
    using_expr := case when p.cmd in ('SELECT','UPDATE','DELETE','ALL')
      then coalesce('(' || p.qual || ') and ', '') || access_expr else null end;
    check_expr := case when p.cmd = 'INSERT' or p.with_check is not null
      then coalesce('(' || p.with_check || ') and ', '') || access_expr else null end;
    -- INSERT policies have only WITH CHECK; command-specific defaults are kept.
    execute format('drop policy %I on elite.%I', p.policyname, p.tablename);
    ddl := format('create policy %I on elite.%I as %s for %s to %s',
      p.policyname, p.tablename, p.permissive, p.cmd,
      (select string_agg(quote_ident(r), ', ') from unnest(p.roles) r));
    if using_expr is not null then ddl := ddl || ' using (' || using_expr || ')'; end if;
    if check_expr is not null then ddl := ddl || ' with check (' || check_expr || ')'; end if;
    execute ddl;
  end loop;
end $$;

-- A restrictive gate applies to every pre-existing elite table. It prevents
-- suspended users reading self-owned rows through policies lacking is_enrolled().
do $$ declare t record;
begin
  for t in select tablename from pg_tables where schemaname = 'elite' and tablename <> 'cohorts' loop
    if t.tablename = 'enrollments' then
      execute 'create policy cohort_v1_active_gate on elite.enrollments as restrictive for all to authenticated using (elite.is_enrolled() and (elite.is_instructor() or cohort = elite.my_cohort())) with check (elite.is_enrolled() and (elite.is_instructor() or cohort = elite.my_cohort()))';
    else
      execute format('create policy cohort_v1_active_gate on elite.%I as restrictive for all to authenticated using (elite.is_enrolled()) with check (elite.is_enrolled())', t.tablename);
    end if;
  end loop;
end $$;

do $$
begin
  if (select count(*) from elite.enrollments where status <> 'active') <> 0 then
    raise exception 'Migration left an inactive member';
  end if;
  if (select count(*) from elite.enrollments where cohort = '2026-1') <> 14 then
    raise exception 'Migration roster mismatch';
  end if;
  if (select count(*) from elite.course_videos) <> (select row_count from elite_cohort_v1_backup.video_count)
     or exists (select 1 from elite.course_videos where cohort <> '2026-1') then
    raise exception 'Migration video backfill mismatch';
  end if;
end $$;
commit;
