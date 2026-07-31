import { Fragment } from "react";
import { requireEnrollment } from "@/lib/auth";
import { Card, PageHeader, EmptyState, LinkButton, Badge } from "@/components/ui";
import { teamName } from "@/lib/constants";
import { createTrade, updateTrade } from "../actions";
import { TradeForm } from "./TradeForm";

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

      <div className="mb-4 rounded-lg border border-[color:var(--hairline)] bg-[rgba(203,161,75,0.1)] px-4 py-2 text-center text-xs font-medium text-amber-700">
        ★ 重要紀律：進場前必設停損——無停損不建倉。
      </div>

      {canWrite && (
        <Card className="mb-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              ＋ 新增一筆模擬決策
            </summary>
            <TradeForm action={createTrade} />
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
                <Fragment key={t.id}>
                  <tr className="border-b border-slate-100 align-top">
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
                  {canWrite && (
                    <tr className="border-b border-slate-100">
                      <td colSpan={10} className="py-1.5">
                        <details>
                          <summary className="cursor-pointer text-xs font-semibold text-indigo-600">
                            ✏️ 編輯此筆（同隊皆可修改）
                            {t.updated_at && (
                              <span className="ml-2 font-normal text-slate-400">
                                最後更新：{new Date(t.updated_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
                              </span>
                            )}
                          </summary>
                          <div className="pb-3">
                            <TradeForm action={updateTrade} trade={t} />
                          </div>
                        </details>
                      </td>
                    </tr>
                  )}
                </Fragment>
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
