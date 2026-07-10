"use client";

import { useMemo, useState } from "react";
import { Card, Field, Select, Badge } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { JOB_ROLES, TEAMS } from "@/lib/constants";
import { upsertEnrollment, removeEnrollment } from "../actions";

type Profile = { id: string; display_name: string | null; email: string | null };
type Enrollment = {
  user_id: string;
  class_role: string;
  job_role: string | null;
  team_id: number | null;
  display_name: string | null;
};

function RoleTeamFields({
  classRole,
  jobRole,
  teamId,
}: {
  classRole?: string;
  jobRole?: string | null;
  teamId?: number | null;
}) {
  return (
    <>
      <Field label="身分">
        <Select name="class_role" defaultValue={classRole ?? "student"}>
          <option value="student">學員</option>
          <option value="instructor">講師</option>
        </Select>
      </Field>
      <Field label="隊伍">
        <Select name="team_id" defaultValue={teamId != null ? String(teamId) : ""}>
          <option value="">未分隊</option>
          {TEAMS.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="職務">
        <Select name="job_role" defaultValue={jobRole ?? ""}>
          <option value="">未指派</option>
          {JOB_ROLES.map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </Select>
      </Field>
    </>
  );
}

export function RosterManager({
  profiles,
  enrollments,
}: {
  profiles: Profile[];
  enrollments: Enrollment[];
}) {
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<Profile | null>(null);

  const enrolledIds = useMemo(
    () => new Set(enrollments.map((e) => e.user_id)),
    [enrollments],
  );

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [];
    return profiles
      .filter((p) => !enrolledIds.has(p.id))
      .filter(
        (p) =>
          (p.display_name ?? "").toLowerCase().includes(query) ||
          (p.email ?? "").toLowerCase().includes(query),
      )
      .slice(0, 8);
  }, [q, profiles, enrolledIds]);

  return (
    <div className="space-y-6">
      {/* 新增成員 */}
      <Card>
        <h2 className="mb-3 font-semibold text-slate-800">加入 QBC 會員到本班</h2>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setSelected(null);
          }}
          placeholder="搜尋姓名或 Email…"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200"
        />
        {results.length > 0 && !selected && (
          <div className="mt-2 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {results.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setSelected(p)}
                className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                <span className="font-medium text-slate-700">
                  {p.display_name ?? "（未命名）"}
                </span>
                <span className="text-xs text-slate-400">{p.email}</span>
              </button>
            ))}
          </div>
        )}

        {selected && (
          <form action={upsertEnrollment} className="mt-4 rounded-lg bg-slate-50 p-4">
            <input type="hidden" name="user_id" value={selected.id} />
            <input
              type="hidden"
              name="display_name"
              value={selected.display_name ?? ""}
            />
            <p className="mb-3 text-sm">
              加入：
              <b className="text-slate-800">{selected.display_name}</b>
              <span className="ml-2 text-xs text-slate-400">{selected.email}</span>
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <RoleTeamFields />
            </div>
            <div className="mt-3 flex gap-2">
              <SubmitButton>加入名冊</SubmitButton>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
              >
                取消
              </button>
            </div>
          </form>
        )}
      </Card>

      {/* 現有名冊 */}
      <Card>
        <h2 className="mb-3 font-semibold text-slate-800">
          目前名冊（{enrollments.length}）
        </h2>
        <div className="space-y-3">
          {enrollments.map((e) => (
            <div
              key={e.user_id}
              className="rounded-lg border border-slate-200 p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="font-medium text-slate-800">
                  {e.display_name ?? "（未命名）"}
                </span>
                {e.class_role === "instructor" ? (
                  <Badge tone="amber">講師</Badge>
                ) : (
                  <Badge tone="indigo">學員</Badge>
                )}
              </div>
              <form
                action={upsertEnrollment}
                className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1fr_auto]"
              >
                <input type="hidden" name="user_id" value={e.user_id} />
                <input
                  type="hidden"
                  name="display_name"
                  value={e.display_name ?? ""}
                />
                <RoleTeamFields
                  classRole={e.class_role}
                  jobRole={e.job_role}
                  teamId={e.team_id}
                />
                <SubmitButton variant="ghost">儲存</SubmitButton>
              </form>
              <form action={removeEnrollment} className="mt-2">
                <input type="hidden" name="user_id" value={e.user_id} />
                <button
                  type="submit"
                  className="text-xs text-rose-500 hover:underline"
                >
                  從名冊移除
                </button>
              </form>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
