#!/usr/bin/env python3
"""Capture and compare Cohort v1 AC1 visibility through read-only Supabase SQL.

All database calls are explicit BEGIN READ ONLY ... ROLLBACK transactions.
Private snapshots must live outside the Git repository.
"""

import argparse
import json
import os
from pathlib import Path
import subprocess
import sys

PROJECT_REF = "qubjpayeopvscrgrvrci"
REPO = Path(__file__).resolve().parents[1]
TABLES = (
    "assessments",
    "course_materials",
    "course_videos",
    "enrollments",
    "flow_configs",
    "flow_runs",
    "process_notes",
    "questionnaire_responses",
    "reviews",
    "team_meetings",
    "thesis_cards",
    "thesis_reconciliations",
    "trade_ledger",
)


def run_query(project_dir: Path, sql: str) -> list[dict]:
    if not sql.startswith("BEGIN READ ONLY;") or not sql.rstrip().endswith("ROLLBACK;"):
        raise ValueError("Every query must be read-only and end with ROLLBACK")
    result = subprocess.run(
        ["supabase", "db", "query", "--linked", "--output", "json", sql],
        cwd=project_dir,
        capture_output=True,
        text=True,
        check=False,
    )
    if result.returncode:
        raise RuntimeError(f"Supabase read-only query failed: {result.stderr[-500:]}")
    return json.loads(result.stdout)["rows"]


def atomic_json(path: Path, value: object) -> None:
    tmp = path.with_suffix(".tmp")
    with tmp.open("w", encoding="utf-8") as stream:
        json.dump(value, stream, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
        stream.write("\n")
    os.chmod(tmp, 0o600)
    tmp.replace(path)


def capture(project_dir: Path, out: Path, phase: str) -> None:
    ref = (project_dir / "supabase/.temp/project-ref").read_text().strip()
    if ref != PROJECT_REF:
        raise ValueError("The linked Supabase project is not the expected production project")
    out = out.resolve()
    if out == REPO or REPO in out.parents:
        raise ValueError("Snapshot directory must be outside the Git repository")
    out.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(out, 0o700)
    before = out / "before"
    if phase == "before":
        users = [r["user_id"] for r in run_query(
            project_dir,
            "BEGIN READ ONLY; SELECT user_id::text AS user_id FROM elite.enrollments "
            "WHERE class_role='student' ORDER BY user_id; ROLLBACK;",
        )]
        if len(users) != 11:
            raise ValueError(f"Expected 11 students; found {len(users)}")
        atomic_json(out / "student_ids.json", users)
    else:
        users = json.loads((out / "student_ids.json").read_text())
    phase_dir = out / phase
    phase_dir.mkdir(mode=0o700, exist_ok=False)

    fields = ",".join(
        "'" + table + "', (SELECT coalesce(jsonb_agg("
        "to_jsonb(t) - ARRAY['cohort','status','all_cohorts'] "
        f"ORDER BY t.{'user_id' if table == 'enrollments' else 'id'}), '[]'::jsonb) "
        f"FROM elite.{table} t)"
        for table in TABLES
    )
    for index, user_id in enumerate(users, start=1):
        # UUIDs come from the private roster manifest, never from command text input.
        claims = json.dumps({"sub": user_id, "role": "authenticated"}, separators=(",", ":"))
        sql = (
            "BEGIN READ ONLY; SET LOCAL ROLE authenticated; "
            f"SELECT set_config('request.jwt.claims', '{claims}', true), "
            f"set_config('request.jwt.claim.sub', '{user_id}', true); "
            f"SELECT auth.uid() = '{user_id}'::uuid AS identity_ok, "
            f"jsonb_build_object({fields}) AS visible_rows; ROLLBACK;"
        )
        rows = run_query(project_dir, sql)
        if len(rows) != 1 or rows[0]["identity_ok"] is not True:
            raise ValueError(f"JWT context failed for student {index}")
        data = rows[0]["visible_rows"]
        if isinstance(data, str):
            data = json.loads(data)
        atomic_json(phase_dir / f"student_{index:02}.json", data)
        print(f"{phase}: captured student {index:02}/{len(users)}", flush=True)


def compare(out: Path) -> int:
    mismatches = 0
    for index in range(1, 12):
        name = f"student_{index:02}.json"
        old = json.loads((out / "before" / name).read_text())
        new = json.loads((out / "after" / name).read_text())
        for table in TABLES:
            if old[table] != new[table]:
                mismatches += 1
                print(f"DIFF student {index:02}, {table}: {len(old[table])} before / {len(new[table])} after")
    if not mismatches:
        print("AC1 visibility snapshot: all 11 students and 13 tables match")
    return int(bool(mismatches))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("before", "after", "compare"))
    parser.add_argument("--project-dir", type=Path, default=Path.home() / "QBC-Hope")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.phase == "compare":
        return compare(args.out.resolve())
    capture(args.project_dir.resolve(), args.out, args.phase)
    return 0


if __name__ == "__main__":
    sys.exit(main())
