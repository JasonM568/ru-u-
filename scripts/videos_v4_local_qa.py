#!/usr/bin/env python3
"""Disposable, synthetic v4 migration/RLS rehearsal. Never connects to a linked project."""
import json
import os
from pathlib import Path
import subprocess
import time

ROOT = Path(__file__).resolve().parents[1]
DB = f"videos_v4_qa_{os.getpid()}"
BASE = ["psql", "-X", "-q", "-At", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1",
        "-p", "54522", "-U", "postgres"]
ENV = {**os.environ, "PGPASSWORD": "postgres"}
INSTRUCTOR = "00000000-0000-0000-0000-000000000100"
STUDENT = "00000000-0000-0000-0000-000000000001"
SUSPENDED = "00000000-0000-0000-0000-000000000202"
OTHER = "00000000-0000-0000-0000-000000000201"
checks = []


def sql(statement, db=DB, ok=True):
    result = subprocess.run([*BASE, "-d", db, "-c", statement], env=ENV,
                            text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(f"SQL failed: {statement[:100]}: {result.stderr[-500:]}")
    return result


def file(path, ok=True):
    result = subprocess.run([*BASE, "-d", DB, "-f", str(ROOT / path)], env=ENV,
                            text=True, capture_output=True)
    if ok and result.returncode:
        raise AssertionError(f"{path}: {result.stderr[-500:]}")
    return result


def as_user(uid, statement, role="authenticated", ok=True):
    claim = f"SELECT set_config('request.jwt.claim.sub','{uid}',true);" if uid else ""
    return sql(f"BEGIN; SET LOCAL ROLE {role}; {claim} {statement}; COMMIT;", ok=ok)


def value(statement):
    return sql(statement).stdout.strip().splitlines()[-1]


def assert_check(name, condition, evidence):
    checks.append({"name": name, "pass": bool(condition), "evidence": evidence})
    print(f"{'PASS' if condition else 'FAIL'} {name}: {evidence}")


def visible(uid):
    result = as_user(uid, "SELECT coalesce(json_agg(id::text ORDER BY id),'[]'::json) FROM elite.course_videos")
    return json.loads(result.stdout.strip().splitlines()[-1])


def snapshot():
    rows = sql("SELECT course_id::text||'|'||id::text||'|'||category FROM elite.course_videos "
               "ORDER BY course_id, CASE category WHEN 'pre' THEN 0 WHEN 'day1' THEN 1 "
               "WHEN 'day2' THEN 2 WHEN 'extra' THEN 3 ELSE 4 END,created_at,id").stdout.strip().splitlines()
    return {"rows": rows, "instructor": visible(INSTRUCTOR), "student": visible(STUDENT),
            "other": visible(OTHER), "suspended": visible(SUSPENDED)}


def orders(course):
    return sql(f"SELECT id::text||'|'||sort_order FROM elite.course_videos WHERE course_id='{course}' "
               "ORDER BY CASE category WHEN 'pre' THEN 0 WHEN 'day1' THEN 1 WHEN 'day2' THEN 2 "
               "WHEN 'extra' THEN 3 ELSE 4 END,sort_order,id").stdout.strip().splitlines()


def ids(course):
    return [x.split("|")[0] for x in orders(course)]


def main():
    existing = sql(f"SELECT 1 FROM pg_database WHERE datname='{DB}'", db="postgres").stdout.strip()
    if existing:
        raise SystemExit(f"Refusing to overwrite existing database {DB}")
    sql(f"CREATE DATABASE {DB}", db="postgres")
    sql("CREATE ROLE authenticated NOLOGIN; CREATE ROLE anon NOLOGIN; CREATE SCHEMA auth; "
        "CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS "
        "$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; "
        "GRANT USAGE ON SCHEMA auth TO authenticated; "
        "GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated") if value("SELECT count(*) FROM pg_roles WHERE rolname='authenticated'") == "0" else sql(
        "CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS "
        "$$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; "
        "GRANT USAGE ON SCHEMA auth TO authenticated; "
        "GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated")
    file("scripts/videos_v3_local_baseline.sql")
    file("migrations/20261003_videos_v2_up.sql")
    file("migrations/20261003_videos_v3_up.sql")
    assert_check("default ACL reproduced", value("SELECT has_table_privilege('authenticated','elite.cohorts','INSERT')") == "t",
                 "elite default ACL grants authenticated table INSERT before explicit revokes")
    course1 = value("SELECT id FROM elite.video_courses WHERE title='2026 第一期菁英班課程影片'")
    course2 = as_user(INSTRUCTOR, "SELECT elite.video_course_create('合成第二課','')").stdout.strip().splitlines()[-1]
    as_user(INSTRUCTOR, f"SELECT elite.video_course_set_grants('{course2}',ARRAY['2026-2'],ARRAY[]::uuid[])")
    for title, category, course in [("Pre", "pre", course1), ("Draft", "day1", course1),
                                    ("Extra", "extra", course1), ("Second", "day1", course2)]:
        as_user(INSTRUCTOR, f"SELECT elite.course_video_create('{course}','{title}','https://youtu.be/test','{category}','')")
    before = snapshot()
    file("migrations/20261117_videos_v4_up.sql")
    after = snapshot()
    post_migration_orders = {course: orders(course) for course in (course1, course2)}
    assert_check("AC6 migration 0 diff", before == after, f"{len(before['rows'])} videos, instructor/student/other/suspended visible ID sets identical")
    for course in (course1, course2):
        old = [row.split('|')[1] for row in before['rows'] if row.startswith(course + '|')]
        ranked = orders(course)
        assert_check(f"AC6 contiguous {course[:8]}", [x.split('|')[0] for x in ranked] == old and
                     sorted(int(x.split('|')[1]) for x in ranked) == list(range(len(ranked))),
                     f"{len(ranked)} rows; positions 0..{len(ranked)-1}")
    assert_check("AC6 nonnull nonnegative", value("SELECT count(*) FROM elite.course_videos WHERE sort_order IS NULL OR sort_order<0") == "0", "bad rows=0")
    repeat = file("migrations/20261117_videos_v4_up.sql", ok=False)
    assert_check("repeat guard and rollback", repeat.returncode != 0 and "preflight" in repeat.stderr and
                 value("SELECT count(*) FROM information_schema.columns WHERE table_schema='elite' AND table_name='course_videos' AND column_name='sort_order'") == "1",
                 repeat.stderr.strip().splitlines()[-1] if repeat.stderr.strip() else "no error")
    # Update a published seed and synthetic draft, preserving identity, URL and publication state.
    published = value(f"SELECT id FROM elite.course_videos WHERE course_id='{course1}' AND published_at IS NOT NULL ORDER BY id LIMIT 1")
    draft = value(f"SELECT id FROM elite.course_videos WHERE course_id='{course1}' AND title='Draft'")
    old_meta = value(f"SELECT id::text||'|'||url||'|'||published_at::text FROM elite.course_videos WHERE id='{published}'")
    for video, title in ((published, "已發布新標題"), (draft, "草稿新標題")):
        as_user(INSTRUCTOR, f"SELECT elite.course_video_update('{video}','  {title}  ','  新說明  ')")
        assert_check(f"AC1 edit {title}", value(f"SELECT title||'|'||note FROM elite.course_videos WHERE id='{video}'") == f"{title}|新說明", "title/note persisted")
    empty = as_user(INSTRUCTOR, f"SELECT elite.course_video_update('{draft}','   ','x')", ok=False)
    assert_check("AC1 blank title", empty.returncode != 0 and "video title required" in empty.stderr, "RPC rejected whitespace")
    student_title = as_user(STUDENT, f"SELECT title||'|'||note FROM elite.course_videos WHERE id='{published}'").stdout.strip().splitlines()[-1]
    assert_check("AC1 learner visible update", student_title == "已發布新標題|新說明", student_title)
    assert_check("AC1 identity URL publication", value(f"SELECT id::text||'|'||url||'|'||published_at::text FROM elite.course_videos WHERE id='{published}'") == old_meta,
                 "published video id/url/published_at unchanged")
    for uid, label in ((STUDENT,"student"),(SUSPENDED,"suspended"),(OTHER,"other-cohort")):
        u = as_user(uid, f"SELECT elite.course_video_update('{published}','unauthorized','')", ok=False)
        r = as_user(uid, f"SELECT elite.course_video_reorder('{course1}',ARRAY[]::uuid[])", ok=False)
        assert_check(f"AC4 {label} RPCs", u.returncode != 0 and r.returncode != 0 and
                     "active instructor required" in u.stderr and "active instructor required" in r.stderr,
                     "update/reorder both rejected")
    assert_check("AC4 anon EXECUTE", value("SELECT has_function_privilege('anon','elite.course_video_update(uuid,text,text)','EXECUTE')::text||'|'||has_function_privilege('anon','elite.course_video_reorder(uuid,uuid[])','EXECUTE')") == "false|false", "false|false")
    direct = as_user(INSTRUCTOR, f"UPDATE elite.course_videos SET title='direct' WHERE id='{published}'", ok=False)
    assert_check("AC4 direct UPDATE", direct.returncode != 0 and "permission denied" in direct.stderr, "authenticated direct UPDATE denied")
    assert_check("AC4 direct table ACL", value("SELECT has_table_privilege('authenticated','elite.course_videos','INSERT')::text||'|'||has_table_privilege('authenticated','elite.course_videos','UPDATE')::text||'|'||has_table_privilege('authenticated','elite.course_videos','DELETE')::text") == "false|false|false",
                 "INSERT|UPDATE|DELETE=false|false|false")
    base = ids(course1)
    other_id = ids(course2)[0]
    bad = {"missing": base[:-1], "extra": base+["ffffffff-ffff-ffff-ffff-ffffffffffff"],
           "duplicate": base[:-1]+base[:1], "cross course": base[:-1]+[other_id], "NULL": base[:-1]+[None]}
    for label, candidate in bad.items():
        array = "ARRAY[" + ",".join("NULL" if item is None else f"'{item}'" for item in candidate) + "]::uuid[]"
        prior = orders(course1)
        result = as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{course1}',{array})", ok=False)
        assert_check(f"AC5 {label}", result.returncode != 0 and orders(course1) == prior,
                     "rejected; all original sort_order values unchanged")
    null_array = as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{course1}',NULL::uuid[])", ok=False)
    assert_check("AC5 NULL array", null_array.returncode != 0, "rejected")
    empty_course = as_user(INSTRUCTOR, "SELECT elite.video_course_create('空課程','')").stdout.strip().splitlines()[-1]
    as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{empty_course}',ARRAY[]::uuid[])")
    assert_check("AC5 empty course", value(f"SELECT count(*) FROM elite.course_videos WHERE course_id='{empty_course}'") == "0", "empty array accepted")
    # Same-category moves, matching the UI's full-course ID payload.
    day1 = [x for x in base if value(f"SELECT category FROM elite.course_videos WHERE id='{x}'") == "day1"]
    swapped = base.copy()
    a,b = swapped.index(day1[0]),swapped.index(day1[1]); swapped[a],swapped[b] = swapped[b],swapped[a]
    arr = "ARRAY["+",".join(f"'{x}'" for x in swapped)+"]::uuid[]"
    as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{course1}',{arr})")
    assert_check("AC2/AC3 same-category reorder", ids(course1) == swapped, "DB order persists across fresh SQL sessions")
    new_id = as_user(INSTRUCTOR, f"SELECT elite.course_video_create('{course1}','新影片','https://youtu.be/test','day1','')").stdout.strip().splitlines()[-1]
    new_order = int(value(f"SELECT sort_order FROM elite.course_videos WHERE id='{new_id}'"))
    max_other = int(value(f"SELECT max(sort_order) FROM elite.course_videos WHERE course_id='{course1}' AND id<>'{new_id}'"))
    assert_check("regression create last", new_order == max_other+1, f"new={new_order}, previous max={max_other}")
    as_user(INSTRUCTOR, f"SELECT elite.course_video_publish('{published}',true)")
    as_user(INSTRUCTOR, f"SELECT elite.course_video_move('{published}','{course2}')")
    moved = value(f"SELECT sort_order::text||'|'||(published_at IS NULL)::text FROM elite.course_videos WHERE id='{published}'")
    assert_check("regression move last/draft", moved == f"{len(ids(course2))-1}|true", f"sort_order|draft={moved}")
    delete_id = ids(course1)[0]
    as_user(INSTRUCTOR, f"SELECT elite.course_video_delete('{delete_id}')")
    current = ids(course1)
    arr = "ARRAY["+",".join(f"'{x}'" for x in current)+"]::uuid[]"
    as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{course1}',{arr})")
    assert_check("regression delete/recompact", sorted(int(x.split('|')[1]) for x in orders(course1)) == list(range(len(current))), "positions compacted")
    # Create holds the course row lock through commit. A concurrent reorder with
    # the old ID list must wait, then reject the stale list without partial writes.
    old_ids = ids(course1)
    session_a = (f"BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub','{INSTRUCTOR}',true); "
                 f"SELECT elite.course_video_create('{course1}','併發新增','https://youtu.be/test','day1',''); "
                 "SELECT pg_sleep(1); COMMIT;")
    creator = subprocess.Popen([*BASE,"-d",DB,"-c",session_a],env=ENV,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    time.sleep(0.3)
    stale_array = "ARRAY["+",".join(f"'{x}'" for x in old_ids)+"]::uuid[]"
    stale = as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{course1}',{stale_array})", ok=False)
    creator_out,creator_err = creator.communicate(timeout=10)
    final_orders = orders(course1)
    assert_check("regression concurrent create/reorder", creator.returncode == 0 and stale.returncode != 0 and
                 len(final_orders) == len(old_ids)+1 and len({x.split('|')[1] for x in final_orders}) == len(final_orders),
                 f"create rc={creator.returncode}, stale reorder rc={stale.returncode}, positions unique={len({x.split('|')[1] for x in final_orders}) == len(final_orders)}; {creator_err[-100:]}")
    fresh = ids(course1)
    fresh_array = "ARRAY["+",".join(f"'{x}'" for x in fresh)+"]::uuid[]"
    as_user(INSTRUCTOR, f"SELECT elite.course_video_reorder('{course1}',{fresh_array})")
    assert_check("regression concurrent retry", sorted(int(x.split('|')[1]) for x in orders(course1)) == list(range(len(fresh))), "fresh full list reorders contiguously")
    report = Path("/tmp/videos_v4_qa_20261117.json")
    report.write_text(json.dumps({"database":DB,"before":before,"after":after,
                                  "post_migration_orders":post_migration_orders,
                                  "checks":checks}, ensure_ascii=False, indent=2)+"\n")
    print(f"RESULT {sum(c['pass'] for c in checks)}/{len(checks)} passed; database={DB}; evidence={report}")


if __name__ == "__main__":
    main()
