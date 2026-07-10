import { requireInstructor } from "@/lib/auth";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { jobRoleName, teamName } from "@/lib/constants";
import type { Scores } from "@/lib/scoring";

const TRACK: Record<string, string> = {
  MA: "總經",
  MK: "市場",
  EQ: "標的",
  ST: "策略",
};

export default async function ResultsPage() {
  const { supabase } = await requireInstructor();

  const [{ data: responses }, { data: enrollments }] = await Promise.all([
    supabase
      .schema("elite")
      .from("questionnaire_responses")
      .select("*")
      .order("submitted_at", { ascending: true }),
    supabase
      .schema("elite")
      .from("enrollments")
      .select("user_id, display_name, job_role, team_id, class_role"),
  ]);

  const enrollMap = new Map(
    (enrollments ?? []).map((e) => [e.user_id, e]),
  );

  return (
    <div>
      <PageHeader
        title="問卷分流結果"
        subtitle="以第一部分主傾向為骨幹、二三部分為修正。系統建議僅供參考，最終由講師拍板。"
      />

      {!responses || responses.length === 0 ? (
        <EmptyState>目前沒有任何已交問卷。</EmptyState>
      ) : (
        <div className="space-y-4">
          {responses.map((r) => {
            const scores = r.scores as Scores | null;
            const enr = enrollMap.get(r.user_id);
            const assigned = enr?.job_role ?? null;
            const suggested = r.suggested_role as string | null;
            const match = assigned && suggested && assigned === suggested;

            return (
              <Card key={r.user_id}>
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="font-semibold text-slate-800">
                      {r.full_name ?? enr?.display_name ?? "（未命名）"}
                    </span>
                    {enr?.team_id && (
                      <span className="ml-2 text-xs text-slate-400">
                        {teamName(enr.team_id)}
                      </span>
                    )}
                    {r.experience && (
                      <span className="ml-2 text-xs text-slate-400">
                        投資經驗：{r.experience}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone="indigo">建議：{jobRoleName(suggested)}</Badge>
                    <Badge tone={match ? "green" : assigned ? "amber" : "slate"}>
                      已指派：{jobRoleName(assigned)}
                    </Badge>
                  </div>
                </div>

                {scores ? (
                  <div className="grid gap-3 text-sm sm:grid-cols-3">
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-1 text-xs font-medium text-slate-400">
                        第一部分（軌道統計）
                      </p>
                      <p className="text-slate-700">
                        {(["MA", "MK", "EQ", "ST"] as const).map((k) => (
                          <span key={k} className="mr-2">
                            {TRACK[k]}
                            <b
                              className={
                                scores.part1.top === k
                                  ? "text-indigo-600"
                                  : "text-slate-500"
                              }
                            >
                              {scores.part1[k]}
                            </b>
                          </span>
                        ))}
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-1 text-xs font-medium text-slate-400">
                        第二部分（分析 / 執行）
                      </p>
                      <p className="text-slate-700">
                        分析 <b>{scores.part2.A}</b>／執行 <b>{scores.part2.B}</b>
                        <span className="ml-2 text-xs text-slate-400">
                          {scores.part2.lean === "analysis"
                            ? "分析反思型"
                            : scores.part2.lean === "execution"
                              ? "果斷執行型"
                              : "均衡"}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-lg bg-slate-50 p-3">
                      <p className="mb-1 text-xs font-medium text-slate-400">
                        第三部分（每題平均）
                      </p>
                      <p className="text-slate-700">
                        主導 <b>{scores.part3.avgLD.toFixed(1)}</b>／鑽研{" "}
                        <b>{scores.part3.avgIN.toFixed(1)}</b>／把關{" "}
                        <b>{scores.part3.avgGK.toFixed(1)}</b>
                      </p>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400">（此份問卷無計分資料）</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
