import Link from "next/link";
import { requireEnrollment } from "@/lib/auth";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { teamName, jobRoleName } from "@/lib/constants";

export default async function TeamHub({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { supabase, enrollment } = await requireEnrollment();
  const sp = await searchParams;

  if (enrollment.class_role === "student" && !enrollment.team_id) {
    return (
      <div>
        <PageHeader title="團隊運轉紀錄" />
        <EmptyState>
          你尚未被分配隊伍。完成職務適性問卷後，講師會依結果分組；分組後即可在此填寫團隊紀錄。
        </EmptyState>
      </div>
    );
  }

  const teamId = enrollment.team_id;

  const [{ count: meetings }, { count: trades }, { count: reviews }, { data: members }] =
    await Promise.all([
      supabase.schema("elite").from("team_meetings").select("*", { count: "exact", head: true }).eq("team_id", teamId),
      supabase.schema("elite").from("trade_ledger").select("*", { count: "exact", head: true }).eq("team_id", teamId),
      supabase.schema("elite").from("reviews").select("*", { count: "exact", head: true }).eq("team_id", teamId),
      supabase.schema("elite").from("enrollments").select("display_name, job_role").eq("team_id", teamId).eq("class_role", "student"),
    ]);

  const cards = [
    { href: "/team/meetings", title: "表一　每週例會紀錄", desc: "每次例會填一份：環境定調→標的→時機→配置→執行風控→拍板", count: meetings ?? 0 },
    { href: "/team/ledger", title: "表二　模擬決策台帳", desc: "每做一筆模擬買賣填一列。進場前必設停損——無停損不建倉。", count: trades ?? 0 },
    { href: "/team/reviews", title: "表三　覆盤紀錄", desc: "每次盤後／每週覆盤填一份：預測 vs 實際、賺賠歸因、教訓萃取", count: reviews ?? 0 },
  ];

  return (
    <div>
      <PageHeader
        title="團隊運轉紀錄"
        subtitle="把「憑感覺做」變成「有紀錄、可檢驗、可改進」——這正是專業與業餘的分水嶺。"
        action={<Badge tone="indigo">{teamName(teamId)}</Badge>}
      />

      {sp.error === "noteam" && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          你目前不在任何隊伍，或非學員身分，無法新增紀錄。
        </div>
      )}

      <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
        ⚠️ 法律前提：所有「操作」一律為模擬操作（Paper Trading）或成員各自獨立操作，團隊不集合、不代操任何人資金。本台帳僅供教學研究，不構成投資建議。
      </div>

      {members && members.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            {teamName(teamId)}成員
          </h2>
          <div className="flex flex-wrap gap-2">
            {members.map((m, i) => (
              <Badge key={i}>
                {m.display_name ?? "—"}・{jobRoleName(m.job_role)}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      <div className="space-y-3">
        {cards.map((c) => (
          <Link key={c.href} href={c.href}>
            <Card className="flex items-center justify-between transition hover:border-indigo-300">
              <div>
                <h3 className="font-semibold text-slate-800">{c.title}</h3>
                <p className="mt-1 text-sm text-slate-500">{c.desc}</p>
              </div>
              <div className="ml-4 shrink-0 text-center">
                <div className="text-xl font-bold text-indigo-600">{c.count}</div>
                <div className="text-[11px] text-slate-400">筆</div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
