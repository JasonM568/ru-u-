import { requireEnrollment } from "@/lib/auth";
import { Card, PageHeader, EmptyState, LinkButton } from "@/components/ui";
import { teamName } from "@/lib/constants";
import { createMeeting, updateMeeting } from "../actions";
import { MeetingForm } from "./MeetingForm";

const TIMING_LABEL: Record<string, string> = {
  attack: "偏進攻",
  defense: "偏防守",
  watch: "觀望",
};

export default async function MeetingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase, enrollment } = await requireEnrollment();
  const sp = await searchParams;
  const teamId = enrollment.team_id;

  const [{ data: meetings }, { data: members }] = await Promise.all([
    supabase
      .schema("elite")
      .from("team_meetings")
      .select("*")
      .eq("team_id", teamId)
      .order("meet_date", { ascending: false }),
    supabase
      .schema("elite")
      .from("enrollments")
      .select("display_name")
      .eq("team_id", teamId)
      .eq("class_role", "student")
      .order("display_name", { ascending: true }),
  ]);

  const canWrite = enrollment.class_role === "student" && !!teamId;

  return (
    <div>
      <PageHeader
        title="表一　每週例會紀錄"
        subtitle={`${teamName(teamId)}・對應團隊例會 SOP`}
        action={<LinkButton href="/team" variant="ghost">← 返回</LinkButton>}
      />

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          例會紀錄已儲存。
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
              ＋ 新增一次例會紀錄
            </summary>
            <MeetingForm action={createMeeting} members={members ?? []} />
          </details>
        </Card>
      )}

      <div className="space-y-4">
        {meetings && meetings.length > 0 ? (
          meetings.map((m) => (
            <Card key={m.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-semibold text-slate-800">{m.meet_date}</span>
                <span className="text-xs text-slate-400">
                  主持：{m.host ?? "—"}
                  {m.timing && `・${TIMING_LABEL[m.timing] ?? m.timing}`}
                </span>
              </div>
              <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
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
              {canWrite && (
                <details className="mt-4 border-t border-slate-200 pt-3">
                  <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
                    ✏️ 編輯此紀錄（同隊皆可修改）
                  </summary>
                  <MeetingForm
                    action={updateMeeting}
                    members={members ?? []}
                    meeting={m}
                  />
                </details>
              )}
              {m.updated_at && m.created_at && m.updated_at !== m.created_at && (
                <p className="mt-2 text-right text-xs text-slate-400">
                  最後更新：{new Date(m.updated_at).toLocaleString("zh-TW", { timeZone: "Asia/Taipei" })}
                </p>
              )}
            </Card>
          ))
        ) : (
          <EmptyState>尚無例會紀錄。</EmptyState>
        )}
      </div>
    </div>
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
