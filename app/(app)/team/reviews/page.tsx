import { requireEnrollment } from "@/lib/auth";
import { Card, PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { teamName } from "@/lib/constants";
import { createReview, updateReview } from "../actions";
import { ReviewForm } from "./ReviewForm";

type Pred = { pred?: string | null; actual?: string | null; hit?: boolean };
type Predictions = { env?: Pred; market?: Pred; symbol?: Pred; execution?: Pred };

export default async function ReviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, enrollment } = await requireEnrollment();
  const sp = await searchParams;
  const teamId = enrollment.team_id;

  const { data: reviews } = await supabase
    .schema("elite")
    .from("reviews")
    .select("*")
    .eq("team_id", teamId)
    .order("review_date", { ascending: false });

  const canWrite = enrollment.class_role === "student" && !!teamId;

  return (
    <div>
      <PageHeader
        title="表三　覆盤紀錄"
        subtitle={`${teamName(teamId)}・教訓 → 根因 → 下次護欄`}
        action={<LinkButton href="/team" variant="ghost">← 返回</LinkButton>}
      />

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          覆盤紀錄已儲存。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          儲存失敗：{sp.error}
        </div>
      )}

      {canWrite && (
        <Card className="mb-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              ＋ 新增一次覆盤
            </summary>
            <ReviewForm action={createReview} />
          </details>
        </Card>
      )}

      <div className="space-y-4">
        {reviews && reviews.length > 0 ? (
          reviews.map((r) => {
            const p = (r.predictions ?? {}) as Predictions;
            return (
              <Card key={r.id}>
                <div className="mb-3 flex items-center justify-between">
                  <span className="font-semibold text-slate-800">{r.review_date}</span>
                  <div className="flex items-center gap-2">
                    {r.pnl && <Badge tone="indigo">賺賠 {r.pnl}</Badge>}
                    {r.repeated && <Badge tone="rose">重複犯錯</Badge>}
                  </div>
                </div>
                <div className="mb-3 grid gap-1 text-sm">
                  <PredRow label="環境方向" p={p.env} />
                  <PredRow label="大盤走勢" p={p.market} />
                  <PredRow label="個股標的" p={p.symbol} />
                  <PredRow label="進出場執行" p={p.execution} />
                </div>
                <dl className="grid gap-2 text-sm">
                  <RRow label="歸因" value={r.attribution} />
                  <RRow label="教訓" value={r.lesson} />
                  <RRow label="根本原因" value={r.root_cause} />
                  <RRow label="下次護欄" value={r.guardrail} />
                  {r.repeated && <RRow label="重複犯錯說明" value={r.repeated_note} />}
                </dl>
                {canWrite && (
                  <details className="mt-4 border-t border-slate-200 pt-3">
                    <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                      ✏️ 編輯此紀錄（同隊皆可修改）
                    </summary>
                    <ReviewForm action={updateReview} review={r} />
                  </details>
                )}
                {r.updated_at && (
                  <p className="mt-2 text-right text-xs text-slate-400">
                    最後更新：{new Date(r.updated_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
                  </p>
                )}
              </Card>
            );
          })
        ) : (
          <EmptyState>尚無覆盤紀錄。</EmptyState>
        )}
      </div>
    </div>
  );
}

function PredRow({ label, p }: { label: string; p?: Pred }) {
  if (!p || (!p.pred && !p.actual)) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 text-xs text-slate-400">{label}</span>
      <span className="text-slate-600">{p.pred ?? "—"}</span>
      <span className="text-slate-500">→</span>
      <span className="text-slate-600">{p.actual ?? "—"}</span>
      <span>{p.hit ? "✅" : "❌"}</span>
    </div>
  );
}

function RRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-700">{value}</dd>
    </div>
  );
}
