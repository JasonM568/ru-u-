# Cohort v1 SQL handoff (draft; no database has been changed)

Files: `20261002_cohort_v1_up.sql` and `20261002_cohort_v1_down.sql`. Both are transactional. The down script deliberately aborts if second-term or suspended data exists, since returning to single-term RLS would disclose that data. In that case restore from the pre-migration database backup or prepare a data-preserving forward repair; do not force the down script.

## Technical choices

1. Add `cohort` to each of `team_meetings`, `trade_ledger`, and `reviews`. The existing team number remains local to a cohort; `(cohort, team_id)` is the logical team key. This changes fewer app paths than adding a global teams table. Team queries and writes must be filtered by both fields. The RLS rules enforce both fields regardless of frontend filters.
2. Add `all_cohorts boolean` to `course_materials`. Ordinary materials match one `cohort`; a common item is visible to every active cohort. This matches the requested pre-class shared material use case, with one UI checkbox. Upgrade to a mapping table only if specific subsets of terms become necessary.

`flow_configs` currently has a unique `group_id` and the app upserts on that key. The migration changes uniqueness to `(cohort, group_id)`. Before deploying the app, change publish/unpublish to target an explicit cohort and the composite key, otherwise a second-term publish can overwrite the first term. The SQL guard requires the old unique constraint to be present. The existing three team forms also need a cohort value from the active member; current column defaults cover inserts, while their update/delete paths must add cohort filters. Roster writes need cohort and status controls in the UI. These app changes are outside this B/C handoff.

The specification places `course_videos` in the later video v2 project. Therefore AC3's video isolation cannot pass from these SQL files alone. Do not admit second-term students until video v2 RLS is active, or explicitly gate the video route and table. The separate `storage.objects` policies for private course files must also be inspected: signed URL issuance should confirm visibility through `course_materials`, and an already issued signed URL remains valid until expiry.

## Preflight on a Supabase branch

1. Clone the production schema/data into a Supabase branch. Confirm the migration account owns the existing `elite.is_enrolled()` function and the affected tables. Use read-only catalog queries to capture policy names, roles, commands, expressions, RLS enabled/forced flags, column types/defaults and the `flow_configs(group_id)` constraint. Compare the actual policy count and expressions with the script's captured backup. Do not assume the PRD's “18” remains exact.
2. Count the roster: exactly 14 rows, 11 students, all cohort `1.0`. The up script aborts if these invariants differ. Check there are no existing `elite_cohort_v1_backup` or `elite.cohorts` objects. Record row counts for all five content tables.
3. Take a database backup and a separate export of the original RLS definitions. Run the up script on the branch. Inspect `elite_cohort_v1_backup.policies`, verify every old policy has a corresponding rewritten policy, and run the AC checks. Test the down script on a fresh branch clone before production planning.

## AC1: exact first-term visibility comparison

Use the 11 existing student UUIDs from the branch roster. For **each** student, run the same read set once before and once after the migration, under `SET LOCAL ROLE authenticated` and `SET LOCAL request.jwt.claim.sub = '<student UUID>'` inside a transaction. Export sorted JSON rows per table and compare files byte for byte after removing only newly added `cohort`, `all_cohorts`, and `status` fields. Read `course_materials`, `flow_configs`, `team_meetings`, `trade_ledger`, `reviews`, `enrollments`, `course_videos`, `questionnaire_responses`, `thesis_cards`, `thesis_reconciliations`, and `flow_runs`; also inspect page queries at `/materials`, `/videos`, `/team/*`, `/flow`. Use primary-key order for stable output. For every user/table pair, compare the **set of row IDs and old column values**, not merely counts. Verify all 14 enrollment statuses are `active` and all 14 cohorts are `2026-1` before allowing app traffic.

Then use two authenticated test users with the same `team_id` in different cohorts. Direct SQL reads and insert/update/delete attempts under their JWT context must prove that first-term content is hidden from the second-term student. Verify a suspended student gets zero rows from every elite table and cannot write; verify reactivation restores the exact original row sets. Verify instructors see both terms. Verify a common material appears for both terms. Verify concurrent `set_current_cohort()` calls never result in two current rows. Test a completely empty new term.

## Rollback window

Run the down script only while all records still belong to `2026-1`, no material is marked common, no member is suspended, and roster membership matches the snapshot. The script restores saved policy and `is_enrolled()` definitions, original roster cohorts, original `flow_configs` uniqueness, and drops new columns/functions. If any guard fails, leave the database untouched and restore the snapshot or write a forward repair that preserves second-term data.
