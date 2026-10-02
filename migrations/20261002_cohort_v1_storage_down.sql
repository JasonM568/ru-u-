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
end $$;
alter policy elite_materials_storage_select on storage.objects
  using ((bucket_id = 'elite-materials'::text) and elite.is_enrolled());
commit;
