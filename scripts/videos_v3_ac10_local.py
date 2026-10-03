#!/usr/bin/env python3
"""AC10 rehearsal on a disposable local database: per-student v2 -> v3 visibility."""
from pathlib import Path
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ENV = {**os.environ, "PGPASSWORD": "postgres"}
BASE = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "54522", "-U", "postgres"]
DB = "videos_v3_ac10"


def run(db: str, *args: str) -> str:
    return subprocess.check_output([*BASE, "-d", db, *args], env=ENV, text=True).strip()


def snapshot() -> tuple[list[tuple[str, ...]], list[int]]:
    videos, courses = [], []
    for number in range(1, 12):
        uid = f"00000000-0000-0000-0000-{number:012d}"
        sql = ("BEGIN READ ONLY; SET LOCAL ROLE authenticated; "
               f"SELECT set_config('request.jwt.claim.sub','{uid}',true); "
               "SELECT id::text FROM elite.course_videos ORDER BY id; ROLLBACK;")
        output = run(DB, "-At", "-c", sql)
        videos.append(tuple(line for line in output.splitlines() if line.startswith("10000000-")))
        course_sql = ("BEGIN READ ONLY; SET LOCAL ROLE authenticated; "
                      f"SELECT set_config('request.jwt.claim.sub','{uid}',true); "
                      "SELECT count(*) FROM elite.video_courses "
                      "WHERE title='2026 第一期菁英班課程影片'; ROLLBACK;")
        if run(DB, "-At", "-c", "SELECT to_regclass('elite.video_courses') IS NOT NULL").endswith("t"):
            result = run(DB, "-At", "-c", course_sql)
            courses.append(int(result.splitlines()[-2]))
    return videos, courses


def main() -> None:
    run("postgres", "-c", f"DROP DATABASE IF EXISTS {DB} WITH (FORCE)")
    run("postgres", "-c", f"CREATE DATABASE {DB}")
    run(DB, "-c", "CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE "
        "AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; "
        "GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated")
    run(DB, "-f", str(ROOT / "scripts/videos_v3_local_baseline.sql"))
    run(DB, "-f", str(ROOT / "migrations/20261003_videos_v2_up.sql"))
    before, _ = snapshot()
    run(DB, "-f", str(ROOT / "migrations/20261003_videos_v3_up.sql"))
    after, courses = snapshot()
    assert all(len(ids) == 10 for ids in before), "Before: expected ten videos per student"
    assert before == after, "Per-student video ID sets changed"
    assert courses == [1] * 11, "Expected one named course per first-cohort student"
    print("AC10 local: 11 students × 10 video IDs, before/after diff 0; one named course each")


if __name__ == "__main__":
    main()
