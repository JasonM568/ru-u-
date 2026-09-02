import { requireInstructor } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { TEAMS, teamName } from "@/lib/constants";
import { pct } from "@/lib/flow/ccc";
import { rowToCard, type ReconciliationRow, type ThesisCardRow } from "@/lib/flow/cloud";
import { OUTCOME_LABEL, OUTCOME_TONE, type Outcome } from "@/lib/flow/reconcile";
import { groupById } from "@/lib/flow/segments";
import { thesisText } from "@/lib/flow/thesis";

export const metadata = {
  title: "論點卡總覽 — 菁英班孵化系統",
};

const OUTCOMES: Outcome[] = ["thesis_holds", "falsifier_design_failed", "discipline_ok", "discipline_failed"];

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("zh-TW", { timeZone: "Asia/Taipei" });
}

export default async function AdminThesisCardsPage() {
  const { supabase } = await requireInstructor();

  // 講師 RLS：thesis_cards / thesis_reconciliations 可 select 全部；平行撈、JS 端 Map join
  const [{ data: cards }, { data: recons }, { data: members }] = await Promise.all([
    supabase.schema("elite").from("thesis_cards").select("*").order("updated_at", { ascending: false }),
    supabase.schema("elite").from("thesis_reconciliations").select("*"),
    supabase.schema("elite").from("enrollments").select("user_id, display_name, team_id, class_role"),
  ]);

  const nameOf = new Map((members ?? []).map((m) => [m.user_id as string, m.display_name as string | null]));
  const teamOf = new Map((members ?? []).map((m) => [m.user_id as string, m.team_id as number | null]));
  const reconOf = new Map(((recons ?? []) as ReconciliationRow[]).map((r) => [r.card_id, r]));
  const all = (cards ?? []) as ThesisCardRow[];

  const counts: Record<Outcome, number> = { thesis_holds: 0, falsifier_design_failed: 0, discipline_ok: 0, discipline_failed: 0 };
  let pending = 0;
  for (const c of all) {
    const r = reconOf.get(c.id);
    if (r?.outcome) counts[r.outcome] += 1;
    else pending += 1;
  }

  const byTeam = (id: number | null) => all.filter((c) => (teamOf.get(c.user_id) ?? null) === id);
  const sections: { id: number | null; title: string }[] = [
    ...TEAMS.map((t) => ({ id: t.id as number | null, title: teamName(t.id) })),
    { id: null, title: "未分隊" },
  ];

  return (
    <div className="flow-console">
      <PageHeader
        title="論點卡總覽"
        subtitle="全班存到雲端的投資論點卡與 T+20 對帳（唯讀，講師檢視用；卡與對帳都只有學員本人能改）"
      />

      <Card className="mb-4">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="indigo">論點卡 {all.length}</Badge>
          {OUTCOMES.map((o) => (
            <Badge key={o} tone={OUTCOME_TONE[o]}>
              {OUTCOME_LABEL[o]} {counts[o]}
            </Badge>
          ))}
          <Badge tone="slate">尚未對帳 {pending}</Badge>
        </div>
      </Card>

      {all.length === 0 ? (
        <EmptyState>還沒有任何學員把論點卡存到雲端。</EmptyState>
      ) : (
        <div className="space-y-6">
          {sections.map((sec) => {
            const list = byTeam(sec.id);
            if (list.length === 0) return null;
            return (
              <div key={String(sec.id)}>
                <h2 className="font-display mb-2 text-lg font-bold text-slate-800">
                  {sec.title}　<span className="text-sm font-normal text-slate-400">{list.length} 張</span>
                </h2>
                <div className="space-y-3">
                  {list.map((row) => {
                    const tc = rowToCard(row);
                    const r = reconOf.get(row.id) ?? null;
                    const group = row.group_id ? groupById(row.group_id) : null;
                    return (
                      <Card key={row.id}>
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-sm text-slate-400">
                              {nameOf.get(row.user_id) ?? "（不在名冊）"}　·　更新 {fmt(row.updated_at)}
                            </div>
                            <h3 className="font-display mt-0.5 text-lg font-semibold text-slate-800">
                              {tc.code || "____"} {tc.name || "（未填名稱）"}
                            </h3>
                            <p className="mt-0.5 text-sm text-slate-400">
                              {[group?.name, tc.sub, tc.cls].filter(Boolean).join("　·　") || "尚未填子段與分類"}
                              {tc.date && `　·　${tc.date}`}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            {row.cc_pass === null ? (
                              <Badge tone="slate">CCC 待填</Badge>
                            ) : row.cc_pass ? (
                              <Badge tone="green">CCC {pct(row.cc_ratio)} 通過</Badge>
                            ) : (
                              <Badge tone="rose">CCC {pct(row.cc_ratio)} 不成立</Badge>
                            )}
                            {r?.outcome ? (
                              <Badge tone={OUTCOME_TONE[r.outcome]}>
                                T+20 {OUTCOME_LABEL[r.outcome]}
                                {r.pnl_pct !== null && `　${pct(r.pnl_pct)}`}
                              </Badge>
                            ) : (
                              <Badge tone="slate">{r ? "對帳未完成" : "尚未對帳"}</Badge>
                            )}
                          </div>
                        </div>

                        {tc.thesis && (
                          <p className="mt-3 text-base leading-relaxed text-slate-700">{tc.thesis}</p>
                        )}

                        <div className="mt-3 space-y-1">
                          {tc.falsifiers.map((f, i) => {
                            const chk = r?.checks?.[i];
                            return (
                              <div key={i} className="flex flex-wrap items-baseline gap-2 text-sm">
                                <span className="text-slate-500">條件 {i + 1}</span>
                                <span className="text-slate-700">若 {f.t || "____"}</span>
                                <span className="text-slate-400">
                                  {f.when || "__"}　·　{f.lvl}
                                </span>
                                {chk && chk.triggered !== null && (
                                  <Badge tone={chk.triggered ? "rose" : "green"}>
                                    {chk.triggered ? "已觸發" : "未觸發"}
                                  </Badge>
                                )}
                                {chk?.note && <span className="text-slate-500">{chk.note}</span>}
                              </div>
                            );
                          })}
                        </div>

                        {r && (
                          <div className="mt-3 rounded-lg border border-slate-200 px-4 py-3 text-sm text-slate-600">
                            <div className="flex flex-wrap gap-x-6 gap-y-1">
                              <span>對帳日 {r.checked_on || "—"}</span>
                              <span>進場 {r.entry_px || "—"} → 對帳 {r.check_px || "—"}</span>
                              {r.any_triggered && (
                                <span>照規則做：{r.executed === null ? "未填" : r.executed ? "有" : "沒有"}</span>
                              )}
                            </div>
                            {r.reflection && <p className="mt-2 whitespace-pre-wrap text-slate-700">{r.reflection}</p>}
                          </div>
                        )}

                        <details className="mt-3">
                          <summary className="cursor-pointer text-sm text-slate-500 hover:text-slate-700">
                            展開整張卡
                          </summary>
                          <pre className="mt-2 max-h-[480px] overflow-auto rounded-lg border border-slate-200 border-l-2 border-l-amber-500 bg-white/40 px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap text-slate-700">
                            {thesisText(tc)}
                          </pre>
                        </details>
                      </Card>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
