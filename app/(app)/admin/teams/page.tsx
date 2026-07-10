import { requireInstructor } from "@/lib/auth";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { TEAMS, teamName, jobRoleName } from "@/lib/constants";

export default async function AdminTeamsPage() {
  const { supabase } = await requireInstructor();

  const [{ data: members }, { data: meetings }, { data: trades }, { data: reviews }] =
    await Promise.all([
      supabase.schema("elite").from("enrollments").select("display_name, job_role, team_id").eq("class_role", "student"),
      supabase.schema("elite").from("team_meetings").select("team_id, meet_date, decision").order("meet_date", { ascending: false }),
      supabase.schema("elite").from("trade_ledger").select("team_id, trade_date, symbol, direction, result").order("trade_date", { ascending: false }),
      supabase.schema("elite").from("reviews").select("team_id, review_date, pnl, lesson").order("review_date", { ascending: false }),
    ]);

  const byTeam = <T extends { team_id: number | null }>(
    arr: T[] | null,
    id: number,
  ): T[] => (arr ?? []).filter((x) => x.team_id === id);

  return (
    <div>
      <PageHeader
        title="團隊運轉紀錄"
        subtitle="兩隊的例會、決策台帳與覆盤（唯讀彙整）"
      />
      <div className="grid gap-4 lg:grid-cols-2">
        {TEAMS.map((t) => {
          const tm = byTeam(members, t.id);
          const mtg = byTeam(meetings, t.id);
          const trd = byTeam(trades, t.id);
          const rev = byTeam(reviews, t.id);
          return (
            <Card key={t.id}>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-bold text-slate-800">{teamName(t.id)}</h2>
                <div className="flex gap-1">
                  <Badge>例會 {mtg.length}</Badge>
                  <Badge>台帳 {trd.length}</Badge>
                  <Badge>覆盤 {rev.length}</Badge>
                </div>
              </div>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {tm.length ? (
                  tm.map((m, i) => (
                    <span key={i} className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                      {m.display_name ?? "—"}・{jobRoleName(m.job_role)}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-400">尚無成員</span>
                )}
              </div>

              <Section title="最近例會">
                {mtg.slice(0, 3).map((m, i) => (
                  <li key={i} className="text-slate-600">
                    <span className="text-slate-400">{m.meet_date}</span>
                    {m.decision ?? "（無決策）"}
                  </li>
                ))}
              </Section>
              <Section title="最近決策台帳">
                {trd.slice(0, 3).map((m, i) => (
                  <li key={i} className="text-slate-600">
                    <span className="text-slate-400">{m.trade_date}</span>
                    {m.symbol}（{m.direction === "sell" ? "賣" : "買"}）
                    {m.result ? `　${m.result}` : ""}
                  </li>
                ))}
              </Section>
              <Section title="最近覆盤">
                {rev.slice(0, 3).map((m, i) => (
                  <li key={i} className="text-slate-600">
                    <span className="text-slate-400">{m.review_date}</span>
                    {m.pnl ? `賺賠 ${m.pnl}　` : ""}
                    {m.lesson ?? ""}
                  </li>
                ))}
              </Section>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const items = Array.isArray(children) ? children : [children];
  return (
    <div className="mt-3">
      <p className="mb-1 text-xs font-medium text-slate-400">{title}</p>
      {items.length > 0 && items.some(Boolean) ? (
        <ul className="space-y-1 text-sm">{children}</ul>
      ) : (
        <p className="text-xs text-slate-300">尚無</p>
      )}
    </div>
  );
}
