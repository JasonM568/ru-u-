import Link from "next/link";
import { requireEnrollment } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { pct } from "@/lib/flow/ccc";
import { rowToCard, type ThesisCardRow } from "@/lib/flow/cloud";
import { thesisText } from "@/lib/flow/thesis";
import { groupById } from "@/lib/flow/segments";
import { CardActions } from "./CardActions";

export const metadata = {
  title: "我的論點卡 — 菁英班孵化系統",
};

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false });
}

export default async function MyThesisCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string }>;
}) {
  const { supabase, userId } = await requireEnrollment();
  const { deleted, error } = await searchParams;

  // RLS 只會回本人的卡（講師這頁也只看自己的；全班的卡在階段三的講師端）
  const { data, error: qErr } = await supabase
    .schema("elite")
    .from("thesis_cards")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  const rows = (data ?? []) as ThesisCardRow[];

  return (
    <div className="flow-console">
      <PageHeader
        title="我的論點卡"
        subtitle="存在雲端的投資論點卡。只有你自己和講師看得到，換裝置登入也在。"
        action={
          <Link href="/flow" className="btn-ghost rounded-lg px-3 py-1.5 text-sm">
            回控制台
          </Link>
        }
      />

      {deleted && (
        <div className="mb-4 rounded-lg border border-emerald-700/40 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          已刪除一張論點卡。
        </div>
      )}
      {(error || qErr) && (
        <div className="mb-4 rounded-lg border border-rose-700/40 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error === "missing" ? "找不到要刪的卡。" : (error ?? qErr?.message)}
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState>
          還沒有存到雲端的論點卡。到控制台填完「交付物：投資論點卡」後，按「儲存到雲端」。
        </EmptyState>
      ) : (
        <div className="space-y-4">
          {rows.map((row) => {
            const tc = rowToCard(row);
            const group = row.group_id ? groupById(row.group_id) : null;
            return (
              <Card key={row.id}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-800">
                      {tc.code || "____"} {tc.name || "（未填名稱）"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {[group?.name, tc.sub, tc.cls].filter(Boolean).join("　·　") || "尚未填子段與分類"}
                      {tc.date && `　·　填寫日期 ${tc.date}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">最後更新 {fmt(row.updated_at)}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {row.cc_pass === null ? (
                      <Badge tone="slate">CCC 待填</Badge>
                    ) : row.cc_pass ? (
                      <Badge tone="green">CCC {pct(row.cc_ratio)} 通過</Badge>
                    ) : (
                      <Badge tone="rose">CCC {pct(row.cc_ratio)} 本案不成立</Badge>
                    )}
                  </div>
                </div>

                {tc.thesis && (
                  <p className="mt-3 text-base leading-relaxed text-slate-700">{tc.thesis}</p>
                )}

                <details className="mt-3">
                  <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                    展開整張卡
                  </summary>
                  <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg border border-slate-200 border-l-2 border-l-amber-500 bg-white/40 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                    {thesisText(tc)}
                  </pre>
                </details>

                <div className="mt-4">
                  <CardActions userId={userId} card={tc} />
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
