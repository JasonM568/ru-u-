import { requireInstructor } from "@/lib/auth";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { teamName } from "@/lib/constants";
import { AssessmentForm } from "./AssessmentForm";

export default async function AssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireInstructor();
  const sp = await searchParams;

  const [{ data: students }, { data: assessments }] = await Promise.all([
    supabase
      .schema("elite")
      .from("enrollments")
      .select("user_id, display_name")
      .eq("class_role", "student")
      .order("team_id", { ascending: true }),
    supabase
      .schema("elite")
      .from("assessments")
      .select("*")
      .order("scored_at", { ascending: false }),
  ]);

  const nameMap = new Map(
    (students ?? []).map((s) => [s.user_id, s.display_name]),
  );

  return (
    <div>
      <PageHeader
        title="成果驗收評分"
        subtitle="模組 D：驗證「這套系統真能把素人變成合格投資團隊」的那把尺。僅講師可見。"
      />

      <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
        🔒 本頁與所有驗收紀錄僅講師可見，學員端在資料庫層即被封鎖，無法讀取。
      </div>

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          驗收評分已儲存。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          儲存失敗：{sp.error}
        </div>
      )}

      <AssessmentForm students={students ?? []} />

      <h2 className="mb-3 font-semibold text-slate-800">已完成的驗收</h2>
      {!assessments || assessments.length === 0 ? (
        <EmptyState>尚無驗收紀錄。</EmptyState>
      ) : (
        <div className="space-y-3">
          {assessments.map((a) => {
            const dims = (a.dimensions ?? {}) as Record<string, number>;
            const pass = a.verdict === "pass";
            return (
              <Card key={a.id}>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold text-slate-800">
                    {a.subject_type === "individual"
                      ? (nameMap.get(a.subject_user_id) ?? "學員")
                      : teamName(a.team_id)}
                    <span className="ml-2 text-xs text-slate-400">
                      {a.subject_type === "individual" ? "個人層級" : "團隊層級"}
                      ・{a.eval_date}
                    </span>
                  </span>
                  <div className="flex items-center gap-2">
                    <Badge tone="indigo">{a.subtotal} / 20</Badge>
                    {a.verdict && (
                      <Badge tone={pass ? "green" : "amber"}>
                        {pass ? "孵化成功" : "需補強"}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-slate-600">
                  {Object.entries(dims).map(([k, v]) => (
                    <span key={k} className="rounded bg-slate-100 px-2 py-0.5">
                      {k} {v}
                    </span>
                  ))}
                </div>
                {a.improvement_notes && (
                  <p className="mt-2 text-sm text-slate-600">
                    補強：{a.improvement_notes}
                  </p>
                )}
                {a.notes && (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-500">
                    {a.notes}
                  </p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
