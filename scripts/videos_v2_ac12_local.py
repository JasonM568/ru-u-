#!/usr/bin/env python3
"""Rehearse the 11-person video visibility snapshot on disposable local Postgres."""
from pathlib import Path
import os
import subprocess

ROOT = Path(__file__).resolve().parents[1]
ENV = {**os.environ, "PGPASSWORD": "postgres"}
BASE = ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-h", "127.0.0.1", "-p", "55433", "-U", "postgres"]


def run(db: str, *args: str) -> str:
    return subprocess.check_output([*BASE, "-d", db, *args], env=ENV, text=True).strip()


def snapshot() -> list[tuple[str, ...]]:
    rows = []
    for number in range(1, 12):
        uid = f"00000000-0000-0000-0000-{number:012d}"
        sql = ("BEGIN READ ONLY; SET LOCAL ROLE authenticated; "
               f"SELECT set_config('request.jwt.claim.sub','{uid}',true); "
               "SELECT id::text FROM elite.course_videos ORDER BY id; ROLLBACK;")
        output = run("videos_v2_ac12", "-At", "-c", sql)
        ids = tuple(line for line in output.splitlines() if line.startswith("10000000-"))
        rows.append(ids)
    return rows


def main() -> None:
    # Fixed localhost port, fixed synthetic fixture, dedicated database only.
    run("postgres", "-c", "DROP DATABASE IF EXISTS videos_v2_ac12 WITH (FORCE)")
    run("postgres", "-c", "CREATE DATABASE videos_v2_ac12")
    run("videos_v2_ac12", "-c", "CREATE SCHEMA auth; CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; GRANT USAGE ON SCHEMA auth TO authenticated; GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated")
    run("videos_v2_ac12", "-f", str(ROOT / "scripts/videos_v2_local_baseline.sql"))
    before = snapshot()
    run("videos_v2_ac12", "-f", str(ROOT / "migrations/20261003_videos_v2_up.sql"))
    after = snapshot()
    assert all(len(ids) == 10 for ids in before), "Baseline must be 10 for each student"
    assert before == after, "AC12 first-cohort video ID sets differ"
    print("AC12 local rehearsal: 11 students × 10 video IDs, before/after diff 0")


if __name__ == "__main__":
    main()
