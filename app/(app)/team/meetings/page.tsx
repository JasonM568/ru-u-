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
} from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { teamName } from "@/lib/constants";
import { createMeeting } from "../actions";

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
            <form action={createMeeting} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="日期" required>
                  <Input type="date" name="meet_date" required />
                </Field>
                <Field label="主持">
                  <Input name="host" />
                </Field>
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-slate-700">
                  出席成員
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                  {members && members.length > 0 ? (
                    members.map((m, i) => (
                      <label
                        key={i}
                        className="flex items-center gap-1.5 text-sm text-slate-700"
                      >
                        <input
                          type="checkbox"
                          name="attendees"
                          value={m.display_name ?? ""}
                          defaultChecked
                        />
                        {m.display_name ?? "—"}
                      </label>
                    ))
                  ) : (
                    <span className="text-xs text-slate-400">
                      此隊尚無成員名單（請講師先於名冊分組）
                    </span>
                  )}
                </div>
              </div>

              <Field label="1. 環境定調（總經分析師）" hint="risk-on / risk-off 與一句話環境定調">
                <Textarea name="env_tone" />
              </Field>
              <Field label="2. 標的提報（標的分析師）" hint="候選標的、價值區間、關鍵風險">
                <Textarea name="candidate" />
              </Field>
              <Field label="3. 時機與盤面（市場與操盤）" hint="大盤位置 / 籌碼 / 情緒 / 技術結構重點">
                <Textarea name="market_read" />
              </Field>
              <Field label="本週時機評估">
                <Select name="timing" defaultValue="">
                  <option value="">請選擇</option>
                  <option value="attack">偏進攻</option>
                  <option value="defense">偏防守</option>
                  <option value="watch">觀望</option>
                </Select>
              </Field>
              <Field label="4. 策略整合（投資策略師）" hint="配置草案：買什麼、權重、進場節奏">
                <Textarea name="allocation" />
              </Field>
              <Field label="5. 執行與風控（市場與操盤＋風控長）" hint="進出場規劃">
                <Textarea name="execution" />
              </Field>
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">風控檢核</p>
                <div className="flex flex-wrap gap-4 text-sm text-slate-700">
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="rc_stop_loss" /> 已設停損
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="rc_within_limit" /> 未超風險上限
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="checkbox" name="rc_five_rules" /> 符合五鐵律
                  </label>
                </div>
                <div className="mt-3">
                  <Field label="風控長意見（如有喊停，註明原因）">
                    <Textarea name="risk_officer_note" />
                  </Field>
                </div>
              </div>
              <Field label="6. 本次決策（拍板）" required>
                <Textarea name="decision" required />
              </Field>
              <Field label="決策理由（須可證偽）">
                <Textarea name="decision_reason" />
              </Field>
              <Field label="失效條件（什麼發生就退出）">
                <Textarea name="invalidation" />
              </Field>
              <Field label="下週該盯的觀察點">
                <Textarea name="watch_next" />
              </Field>
              <SubmitButton>儲存例會紀錄</SubmitButton>
            </form>
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
