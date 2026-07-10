import { requireInstructor } from "@/lib/auth";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { TEAMS, teamName, jobRoleName } from "@/lib/constants";

const TIMING_LABEL: Record<string, string> = {
  attack: "偏進攻",
  defense: "偏防守",
  watch: "觀望",
};

export default async function AdminTeamsPage() {
  const { supabase } = await requireInstructor();

  const [{ data: members }, { data: meetings }, { data: trades }, { data: reviews }] =
    await Promise.all([
      supabase
        .schema("elite")
        .from("enrollments")
        .select("display_name, job_role, team_id")
        .eq("class_role", "student"),
      supabase
        .schema("elite")
        .from("team_meetings")
        .select("*")
        .order("meet_date", { ascending: false }),
      supabase
        .schema("elite")
        .from("trade_ledger")
        .select("*")
        .order("trade_date", { ascending: false }),
      supabase
        .schema("elite")
        .from("reviews")
        .select("*")
        .order("review_date", { ascending: false }),
    ]);

  const byTeam = <T extends { team_id: number | null }>(
    arr: T[] | null,
    id: number,
  ): T[] => (arr ?? []).filter((x) => x.team_id === id);

  return (
    <div>
      <PageHeader
        title="團隊運轉紀錄"
        subtitle="兩隊的例會、決策台帳與覆盤（唯讀彙整，講師檢視用）"
      />
      <div className="space-y-6">
        {TEAMS.map((t) => {
          const tm = byTeam(members, t.id);
          const mtg = byTeam(meetings, t.id);
          const trd = byTeam(trades, t.id);
          const rev = byTeam(reviews, t.id);
          return (
            <Card key={t.id}>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-bold text-slate-800">
                  {teamName(t.id)}
                </h2>
                <div className="flex gap-1">
                  <Badge tone="indigo">例會 {mtg.length}</Badge>
                  <Badge tone="indigo">台帳 {trd.length}</Badge>
                  <Badge tone="indigo">覆盤 {rev.length}</Badge>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap gap-1.5">
                {tm.length ? (
                  tm.map((m, i) => (
                    <span
                      key={i}
                      className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                    >
                      {m.display_name ?? "—"}・{jobRoleName(m.job_role)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">尚無成員</span>
                )}
              </div>

              {/* 會議紀錄 */}
              <SubHead>會議紀錄</SubHead>
              {mtg.length ? (
                <div className="mb-4 space-y-3">
                  {mtg.map((m) => (
                    <div
                      key={m.id}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">
                          {m.meet_date}
                        </span>
                        <span className="text-xs text-slate-400">
                          主持：{m.host ?? "—"}
                          {m.timing && `・${TIMING_LABEL[m.timing] ?? m.timing}`}
                        </span>
                      </div>
                      {m.attendees && (
                        <p className="mb-1 text-xs text-slate-400">
                          出席：{m.attendees}
                        </p>
                      )}
                      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        <Row label="環境定調" value={m.env_tone} />
                        <Row label="標的提報" value={m.candidate} />
                        <Row label="時機盤面" value={m.market_read} />
                        <Row label="策略整合" value={m.allocation} />
                        <Row label="執行風控" value={m.execution} />
                        <Row label="本次決策" value={m.decision} />
                        <Row label="決策理由" value={m.decision_reason} />
                        <Row label="失效條件" value={m.invalidation} />
                        <Row label="下週觀察" value={m.watch_next} />
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mb-4">
                  <EmptyState>尚無例會紀錄</EmptyState>
                </div>
              )}

              {/* 決策台帳 */}
              <SubHead>決策台帳</SubHead>
              {trd.length ? (
                <div className="mb-4 overflow-x-auto">
                  <table className="w-full min-w-[640px] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-left text-xs text-slate-400">
                        <th className="py-1.5 pr-3">日期</th>
                        <th className="pr-3">標的</th>
                        <th className="pr-3">方向</th>
                        <th className="pr-3">進場</th>
                        <th className="pr-3">停損</th>
                        <th className="pr-3">倉位</th>
                        <th className="pr-3">理由</th>
                        <th className="pr-3">結果</th>
                        <th>歸因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trd.map((x) => (
                        <tr
                          key={x.id}
                          className="border-b border-slate-100 align-top"
                        >
                          <td className="py-1.5 pr-3 whitespace-nowrap">
                            {x.trade_date}
                          </td>
                          <td className="pr-3 font-medium">{x.symbol}</td>
                          <td className="pr-3">
                            {x.direction === "sell" ? "賣" : "買"}
                          </td>
                          <td className="pr-3">{x.entry ?? "—"}</td>
                          <td className="pr-3 text-rose-600">
                            {x.stop_loss ?? "—"}
                          </td>
                          <td className="pr-3">
                            {x.position_pct != null ? `${x.position_pct}%` : "—"}
                          </td>
                          <td className="max-w-[200px] pr-3 text-slate-600">
                            {x.rationale ?? "—"}
                          </td>
                          <td className="pr-3">{x.result ?? "—"}</td>
                          <td className="text-slate-500">{x.attribution ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="mb-4">
                  <EmptyState>尚無決策台帳</EmptyState>
                </div>
              )}

              {/* 覆盤紀錄 */}
              <SubHead>覆盤紀錄</SubHead>
              {rev.length ? (
                <div className="space-y-3">
                  {rev.map((x) => (
                    <div
                      key={x.id}
                      className="rounded-lg border border-slate-200 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="font-medium text-slate-800">
                          {x.review_date}
                        </span>
                        <div className="flex gap-1">
                          {x.pnl && <Badge tone="indigo">賺賠 {x.pnl}</Badge>}
                          {x.repeated && <Badge tone="rose">重複犯錯</Badge>}
                        </div>
                      </div>
                      <dl className="grid gap-x-6 gap-y-1.5 text-sm sm:grid-cols-2">
                        <Row label="歸因" value={x.attribution} />
                        <Row label="教訓" value={x.lesson} />
                        <Row label="根本原因" value={x.root_cause} />
                        <Row label="下次護欄" value={x.guardrail} />
                      </dl>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState>尚無覆盤紀錄</EmptyState>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function SubHead({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-2 border-l-4 border-indigo-400 pl-2 text-sm font-semibold text-slate-700">
      {children}
    </h3>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="whitespace-pre-wrap text-slate-700">{value}</dd>
    </div>
  );
}
