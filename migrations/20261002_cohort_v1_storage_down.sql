-- Run BEFORE the main Cohort v1 down migration through the same owner channel.
-- Restores the production policy expression captured by the 2026-10-03 catalog read.
begin;
do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'elite_materials_storage_select' and cmd = 'SELECT') <> 1 then
    raise exception 'Expected one elite_materials_storage_select SELECT policy';
  end if;
  if exists (select 1 from elite.enrollments where cohort <> '2026-1' or status <> 'active')
     or exists (select 1 from elite.course_materials where cohort <> '2026-1' or all_cohorts)
     or exists (select 1 from elite.course_videos where cohort <> '2026-1' or all_cohorts)
     or exists (select 1 from elite.flow_configs where cohort <> '2026-1')
     or exists (select 1 from elite.team_meetings where cohort <> '2026-1')
     or exists (select 1 from elite.trade_ledger where cohort <> '2026-1')
     or exists (select 1 from elite.reviews where cohort <> '2026-1') then
    raise exception 'Second-term or suspended data exists: restoring broad Storage access is unsafe';
  end if;
end $$;
alter policy elite_materials_storage_select on storage.objects
  using ((bucket_id = 'elite-materials'::text) and elite.is_enrolled());
commit;
