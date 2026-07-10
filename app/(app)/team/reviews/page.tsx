import { requireEnrollment } from "@/lib/auth";
import {
  Card,
  PageHeader,
  Field,
  Input,
  Textarea,
  EmptyState,
  LinkButton,
  Badge,
} from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { teamName } from "@/lib/constants";
import { createReview } from "../actions";

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
            <form action={createReview} className="mt-4 space-y-4">
              <Field label="覆盤日期" required>
                <Input type="date" name="review_date" required />
              </Field>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  1. 預測 vs 實際
                </p>
                <div className="space-y-3">
                  {[
                    { k: "env", label: "環境方向" },
                    { k: "market", label: "大盤走勢" },
                    { k: "symbol", label: "個股／標的" },
                    { k: "exec", label: "進出場執行" },
                  ].map((row) => (
                    <div key={row.k} className="grid items-center gap-2 sm:grid-cols-[90px_1fr_1fr_auto]">
                      <span className="text-xs text-slate-500">{row.label}</span>
                      <Input name={`${row.k}_pred`} placeholder="當初預測" />
                      <Input name={`${row.k}_actual`} placeholder="實際結果" />
                      <label className="flex items-center gap-1 text-xs text-slate-500">
                        <input type="checkbox" name={`${row.k}_hit`} /> 命中
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="本期賺賠（模擬）">
                  <Input name="pnl" />
                </Field>
                <Field label="真正原因拆解" hint="環境 / 選股 / 時機 / 執行">
                  <Input name="attribution" />
                </Field>
              </div>

              <Field label="這次的教訓">
                <Textarea name="lesson" />
              </Field>
              <Field label="根本原因">
                <Textarea name="root_cause" />
              </Field>
              <Field label="下次的護欄" hint="要新增什麼規則來避免重犯">
                <Textarea name="guardrail" />
              </Field>

              <div className="rounded-lg bg-slate-50 p-3">
                <label className="flex items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" name="repeated" /> 是否重複犯了同樣的錯？（勾選＝之前也發生過，代表護欄沒建好）
                </label>
                <div className="mt-2">
                  <Textarea name="repeated_note" placeholder="說明" />
                </div>
              </div>

              <SubmitButton>儲存覆盤</SubmitButton>
            </form>
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
