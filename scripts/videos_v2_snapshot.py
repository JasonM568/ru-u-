#!/usr/bin/env python3
"""AC12 read-only production snapshots: exact visible video IDs for the 11 original students."""
import argparse
import json
import os
from pathlib import Path
import subprocess

PROJECT_REF = "qubjpayeopvscrgrvrci"
REPO = Path(__file__).resolve().parents[1]


def query(project_dir: Path, sql: str) -> list[dict]:
    if not sql.startswith("BEGIN READ ONLY;") or not sql.rstrip().endswith("ROLLBACK;"):
        raise ValueError("Every production query must be BEGIN READ ONLY ... ROLLBACK")
    process = subprocess.run(["supabase", "db", "query", "--linked", "--output", "json", sql],
                             cwd=project_dir, capture_output=True, text=True, check=False)
    if process.returncode:
        raise RuntimeError(f"Read-only query failed: {process.stderr[-400:]}")
    return json.loads(process.stdout)["rows"]


def write_private(path: Path, content: object) -> None:
    temp = path.with_suffix(".tmp")
    with temp.open("w", encoding="utf8") as stream:
        json.dump(content, stream, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
        stream.write("\n")
    os.chmod(temp, 0o600)
    temp.replace(path)


def visible_ids(project_dir: Path, uid: str) -> list[str]:
    if not isinstance(uid, str) or len(uid) != 36:
        raise ValueError("Invalid user UUID")
    claims = json.dumps({"sub": uid, "role": "authenticated"}, separators=(",", ":"))
    sql = ("BEGIN READ ONLY; SET LOCAL ROLE authenticated; "
           f"SELECT set_config('request.jwt.claims','{claims}',true), "
           f"set_config('request.jwt.claim.sub','{uid}',true); "
           f"SELECT auth.uid()='{uid}'::uuid AS identity_ok, "
           "coalesce(jsonb_agg(id::text ORDER BY id), '[]'::jsonb) AS video_ids "
           "FROM elite.course_videos; ROLLBACK;")
    rows = query(project_dir, sql)
    if len(rows) != 1 or rows[0]["identity_ok"] is not True:
        raise ValueError("Final SELECT or authenticated identity did not match")
    ids = rows[0]["video_ids"]
    return json.loads(ids) if isinstance(ids, str) else ids


def dry_run_instructor(project_dir: Path) -> None:
    rows = query(project_dir, "BEGIN READ ONLY; SELECT user_id::text AS user_id "
                 "FROM elite.enrollments WHERE class_role='instructor' AND status='active' "
                 "ORDER BY user_id LIMIT 1; ROLLBACK;")
    if len(rows) != 1:
        raise ValueError("No active instructor available for dry run")
    ids = visible_ids(project_dir, rows[0]["user_id"])
    if len(ids) != 10:
        raise ValueError(f"Instructor expected 10 videos, found {len(ids)}")
    print("Instructor read-only dry run: final SELECT returned 10 video IDs")


def capture(project_dir: Path, out: Path, phase: str) -> None:
    if phase == "before":
        rows = query(project_dir, "BEGIN READ ONLY; SELECT user_id::text AS user_id "
                     "FROM elite.enrollments WHERE class_role='student' AND cohort='2026-1' AND status='active' "
                     "ORDER BY user_id; ROLLBACK;")
        users = [row["user_id"] for row in rows]
        if len(users) != 11:
            raise ValueError(f"Expected 11 first-cohort students, found {len(users)}")
        write_private(out / "student_ids.json", users)
    else:
        users = json.loads((out / "student_ids.json").read_text())
    phase_dir = out / phase
    phase_dir.mkdir(mode=0o700, exist_ok=False)
    for index, uid in enumerate(users, start=1):
        write_private(phase_dir / f"student_{index:02}.json", visible_ids(project_dir, uid))
        print(f"{phase}: student {index:02}/{len(users)} captured")


def compare(out: Path) -> int:
    diffs = 0
    for index in range(1, 12):
        name = f"student_{index:02}.json"
        before = json.loads((out / "before" / name).read_text())
        after = json.loads((out / "after" / name).read_text())
        if before != after or len(before) != 10:
            diffs += 1
            print(f"student {index:02}: {len(before)} before / {len(after)} after; match={before == after}")
    if not diffs:
        print("AC12: 11 students, 10 IDs each, zero differences")
    return int(bool(diffs))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("phase", choices=("dry-run-instructor", "before", "after", "compare"))
    parser.add_argument("--project-dir", type=Path, default=Path.home() / "QBC-Hope")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    if args.phase != "compare":
        ref = (args.project_dir / "supabase/.temp/project-ref").read_text().strip()
        if ref != PROJECT_REF:
            raise ValueError("Linked project is not the QBC production project")
    out = args.out.resolve()
    if out == REPO or REPO in out.parents:
        raise ValueError("Private snapshots must be outside this repository")
    out.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(out, 0o700)
    if args.phase == "compare":
        return compare(out)
    if args.phase == "dry-run-instructor":
        dry_run_instructor(args.project_dir.resolve())
        return 0
    capture(args.project_dir.resolve(), out, args.phase)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
