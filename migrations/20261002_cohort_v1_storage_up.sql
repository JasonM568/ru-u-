-- Run AFTER the main Cohort v1 up migration through the Storage policy owner
-- or an equivalent privileged migration channel. This is a separate transaction.
begin;

do $$
begin
  if (select count(*) from pg_policies
      where schemaname = 'storage' and tablename = 'objects'
        and policyname = 'elite_materials_storage_select' and cmd = 'SELECT') <> 1 then
    raise exception 'Expected one elite_materials_storage_select SELECT policy';
  end if;
  if not exists (select 1 from information_schema.columns
                 where table_schema = 'elite' and table_name = 'course_materials'
                   and column_name = 'all_cohorts') then
    raise exception 'Apply main Cohort v1 migration first';
  end if;
  if to_regclass('elite_cohort_v1_backup.storage_paths') is null then
    raise exception 'Storage baseline is missing';
  end if;
  if exists (select 1 from elite.course_materials m
             where not exists (select 1 from storage.objects o
                               where o.bucket_id = 'elite-materials' and o.name = m.storage_path)) then
    raise exception 'Material metadata and Storage paths differ';
  end if;
  if exists (select 1 from storage.objects o where o.bucket_id = 'elite-materials'
             and not exists (select 1 from elite.course_materials m where m.storage_path = o.name)) then
    raise exception 'Untracked material Storage object exists';
  end if;
end $$;

alter policy elite_materials_storage_select on storage.objects using (
  bucket_id = 'elite-materials'
  and (
    elite.is_instructor()
    or exists (
      select 1 from elite.course_materials m
      where m.storage_path = storage.objects.name
        and elite.is_enrolled()
        and (m.all_cohorts or m.cohort = elite.my_cohort())
    )
  )
);
commit;
