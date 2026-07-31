import { Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";

type Member = { display_name: string | null };

type Meeting = {
  id: string;
  meet_date: string | null;
  host: string | null;
  attendees: string | null;
  env_tone: string | null;
  candidate: string | null;
  market_read: string | null;
  timing: string | null;
  allocation: string | null;
  execution: string | null;
  risk_check: {
    stop_loss?: boolean;
    within_limit?: boolean;
    five_rules?: boolean;
  } | null;
  risk_officer_note: string | null;
  decision: string | null;
  decision_reason: string | null;
  invalidation: string | null;
  watch_next: string | null;
};

export function MeetingForm({
  action,
  members,
  meeting,
}: {
  action: (formData: FormData) => Promise<void>;
  members: Member[];
  meeting?: Meeting;
}) {
  const attendeeList = meeting?.attendees
    ? meeting.attendees.split("、").map((s) => s.trim())
    : null;
  const rc = meeting?.risk_check ?? {};

  return (
    <form action={action} className="mt-4 space-y-4">
      {meeting && <input type="hidden" name="id" value={meeting.id} />}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="日期" required>
          <Input
            type="date"
            name="meet_date"
            required
            defaultValue={meeting?.meet_date ?? undefined}
          />
        </Field>
        <Field label="主持">
          <Input name="host" defaultValue={meeting?.host ?? undefined} />
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
                  defaultChecked={
                    attendeeList
                      ? attendeeList.includes(m.display_name ?? "")
                      : true
                  }
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
        <Textarea name="env_tone" defaultValue={meeting?.env_tone ?? undefined} />
      </Field>
      <Field label="2. 標的提報（標的分析師）" hint="候選標的、價值區間、關鍵風險">
        <Textarea name="candidate" defaultValue={meeting?.candidate ?? undefined} />
      </Field>
      <Field label="3. 時機與盤面（市場與操盤）" hint="大盤位置 / 籌碼 / 情緒 / 技術結構重點">
        <Textarea name="market_read" defaultValue={meeting?.market_read ?? undefined} />
      </Field>
      <Field label="本週時機評估">
        <Select name="timing" defaultValue={meeting?.timing ?? ""}>
          <option value="">請選擇</option>
          <option value="attack">偏進攻</option>
          <option value="defense">偏防守</option>
          <option value="watch">觀望</option>
        </Select>
      </Field>
      <Field label="4. 策略整合（投資策略師）" hint="配置草案：買什麼、權重、進場節奏">
        <Textarea name="allocation" defaultValue={meeting?.allocation ?? undefined} />
      </Field>
      <Field label="5. 執行與風控（市場與操盤＋風控長）" hint="進出場規劃">
        <Textarea name="execution" defaultValue={meeting?.execution ?? undefined} />
      </Field>
      <div className="rounded-lg bg-slate-50 p-3">
        <p className="mb-2 text-xs font-medium text-slate-600">風控檢核</p>
        <div className="flex flex-wrap gap-4 text-sm text-slate-700">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="rc_stop_loss" defaultChecked={!!rc.stop_loss} /> 已設停損
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="rc_within_limit" defaultChecked={!!rc.within_limit} /> 未超風險上限
          </label>
          <label className="flex items-center gap-1.5">
            <input type="checkbox" name="rc_five_rules" defaultChecked={!!rc.five_rules} /> 符合五鐵律
          </label>
        </div>
        <div className="mt-3">
          <Field label="風控長意見（如有喊停，註明原因）">
            <Textarea
              name="risk_officer_note"
              defaultValue={meeting?.risk_officer_note ?? undefined}
            />
          </Field>
        </div>
      </div>
      <Field label="6. 本次決策（拍板）" required>
        <Textarea name="decision" required defaultValue={meeting?.decision ?? undefined} />
      </Field>
      <Field label="決策理由（須可證偽）">
        <Textarea
          name="decision_reason"
          defaultValue={meeting?.decision_reason ?? undefined}
        />
      </Field>
      <Field label="失效條件（什麼發生就退出）">
        <Textarea name="invalidation" defaultValue={meeting?.invalidation ?? undefined} />
      </Field>
      <Field label="下週該盯的觀察點">
        <Textarea name="watch_next" defaultValue={meeting?.watch_next ?? undefined} />
      </Field>
      <SubmitButton>{meeting ? "儲存修改" : "儲存例會紀錄"}</SubmitButton>
    </form>
  );
}
