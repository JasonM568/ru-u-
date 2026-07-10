import { requireEnrollment } from "@/lib/auth";
import {
  Card,
  PageHeader,
  Field,
  Input,
  Textarea,
  Select,
  EmptyState,
  LinkButton,
  Badge,
} from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { teamName } from "@/lib/constants";
import { createTrade } from "../actions";

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, enrollment } = await requireEnrollment();
  const sp = await searchParams;
  const teamId = enrollment.team_id;

  const { data: trades } = await supabase
    .schema("elite")
    .from("trade_ledger")
    .select("*")
    .eq("team_id", teamId)
    .order("trade_date", { ascending: false })
    .order("created_at", { ascending: false });

  const canWrite = enrollment.class_role === "student" && !!teamId;

  return (
    <div>
      <PageHeader
        title="表二　模擬決策台帳"
        subtitle={`${teamName(teamId)}・每筆決策都要有可證偽的理由與失效條件，否則不執行`}
        action={<LinkButton href="/team" variant="ghost">← 返回</LinkButton>}
      />

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          已新增一筆決策紀錄。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          儲存失敗：{sp.error}
        </div>
      )}

      <div className="mb-4 rounded-lg bg-slate-800 px-4 py-2 text-center text-xs font-medium text-amber-200">
        ★ 重要紀律：進場前必設停損——無停損不建倉。
      </div>

      {canWrite && (
        <Card className="mb-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              ＋ 新增一筆模擬決策
            </summary>
            <form action={createTrade} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="日期" required>
                  <Input type="date" name="trade_date" required />
                </Field>
                <Field label="標的" required>
                  <Input name="symbol" placeholder="如 2330 / AAPL" required />
                </Field>
                <Field label="方向">
                  <Select name="direction" defaultValue="buy">
                    <option value="buy">買進</option>
                    <option value="sell">賣出</option>
                  </Select>
                </Field>
                <Field label="進場價">
                  <Input name="entry" type="number" step="any" />
                </Field>
                <Field label="停損" required>
                  <Input name="stop_loss" type="number" step="any" required />
                </Field>
                <Field label="停利">
                  <Input name="take_profit" type="number" step="any" />
                </Field>
                <Field label="倉位 %">
                  <Input name="position_pct" type="number" step="any" />
                </Field>
              </div>
              <Field label="決策理由（可證偽）" hint="須「可被未來數據推翻」，不可寫「我覺得會漲」" required>
                <Textarea name="rationale" required />
              </Field>
              <Field label="失效條件">
                <Textarea name="invalidation" />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="結果（模擬賺賠）">
                  <Input name="result" placeholder="如 +3.2% / -1.5%" />
                </Field>
                <Field label="歸因" hint="環境 / 時機 / 選股 / 執行 哪一環">
                  <Input name="attribution" />
                </Field>
              </div>
              <SubmitButton>新增決策</SubmitButton>
            </form>
          </details>
        </Card>
      )}

      {trades && trades.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                <th className="py-2 pr-3">日期</th>
                <th className="pr-3">標的</th>
                <th className="pr-3">方向</th>
                <th className="pr-3">進場</th>
                <th className="pr-3">停損</th>
                <th className="pr-3">停利</th>
                <th className="pr-3">倉位</th>
                <th className="pr-3">理由 / 失效條件</th>
                <th className="pr-3">結果</th>
                <th>歸因</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((t) => (
                <tr key={t.id} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{t.trade_date}</td>
                  <td className="pr-3 font-medium">{t.symbol}</td>
                  <td className="pr-3">
                    <Badge tone={t.direction === "sell" ? "rose" : "green"}>
                      {t.direction === "sell" ? "賣" : "買"}
                    </Badge>
                  </td>
                  <td className="pr-3">{t.entry ?? "—"}</td>
                  <td className="pr-3 text-rose-600">{t.stop_loss ?? "—"}</td>
                  <td className="pr-3">{t.take_profit ?? "—"}</td>
                  <td className="pr-3">{t.position_pct != null ? `${t.position_pct}%` : "—"}</td>
                  <td className="max-w-[220px] pr-3 text-slate-600">
                    {t.rationale}
                    {t.invalidation && (
                      <div className="mt-1 text-xs text-slate-400">失效：{t.invalidation}</div>
                    )}
                  </td>
                  <td className="pr-3">{t.result ?? "—"}</td>
                  <td className="text-slate-500">{t.attribution ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState>尚無決策紀錄。</EmptyState>
      )}
    </div>
  );
}
