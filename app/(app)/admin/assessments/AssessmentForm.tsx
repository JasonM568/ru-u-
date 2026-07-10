"use client";

import { useState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { TEAMS } from "@/lib/constants";
import { saveAssessment } from "../actions";

type Student = { user_id: string; display_name: string | null };

const INDIVIDUAL_DIMS = [
  { key: "工具組裝力", hint: "骨架填補・鐵律保留・邊界理解（對應模組 B）" },
  { key: "職務勝任力", hint: "產出完整度・決策鏈交接（對應模組 A、C）" },
  { key: "紀律與風控意識", hint: "可證偽習慣・風控自覺（對應模組 C）" },
  { key: "反思與成長", hint: "覆盤能力（對應模組 C、E）" },
];

const TEAM_DIMS = [
  { key: "投資提案品質", hint: "決策鏈完整・論點可證偽・攻防表現" },
  { key: "協作與分工", hint: "角色到位・會議效率" },
  { key: "紀律執行", hint: "風控鐵律・合規紅線" },
  { key: "持續運轉力", hint: "自主運轉・歸因迭代" },
];

const SCORE_HINT = "1＝未達　3＝合格　5＝優秀（中間可給 2、4）";

export function AssessmentForm({ students }: { students: Student[] }) {
  const [type, setType] = useState<"individual" | "team">("individual");
  const dims = type === "individual" ? INDIVIDUAL_DIMS : TEAM_DIMS;

  return (
    <Card className="mb-6">
      <form action={saveAssessment} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="驗收層級">
            <Select
              name="subject_type"
              value={type}
              onChange={(e) => setType(e.target.value as "individual" | "team")}
            >
              <option value="individual">個人層級（滿分 20）</option>
              <option value="team">團隊層級（滿分 20）</option>
            </Select>
          </Field>

          {type === "individual" ? (
            <Field label="受評學員">
              <Select name="subject_user_id" defaultValue="">
                <option value="">請選擇</option>
                {students.map((s) => (
                  <option key={s.user_id} value={s.user_id}>
                    {s.display_name ?? s.user_id.slice(0, 8)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <Field label="受評團隊">
              <Select name="team_id" defaultValue="1">
                {TEAMS.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="評分日期">
            <Input type="date" name="eval_date" />
          </Field>
        </div>

        <div className="rounded-lg bg-slate-50 p-4">
          <p className="mb-3 text-xs text-slate-500">{SCORE_HINT}</p>
          <div className="space-y-3">
            {dims.map((d) => (
              <div
                key={d.key}
                className="grid items-center gap-2 sm:grid-cols-[1fr_120px]"
              >
                <div>
                  <span className="text-sm font-medium text-slate-700">
                    {d.key}
                  </span>
                  <span className="ml-2 text-xs text-slate-400">{d.hint}</span>
                </div>
                <Select name={`dim_${d.key}`} defaultValue="">
                  <option value="">—</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n} 分
                    </option>
                  ))}
                </Select>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="判定" hint="合格門檻：12 分（各維度平均 3 分）">
            <Select name="verdict" defaultValue="">
              <option value="">請選擇</option>
              <option value="pass">孵化成功</option>
              <option value="needs_improvement">需補強</option>
            </Select>
          </Field>
          <Field label="補強項目（如需補強）">
            <Input name="improvement_notes" />
          </Field>
        </div>

        <Field
          label="低分項備註（與模組 E 連動）"
          hint="低分是系統的改進線索：記錄可能原因、當下的臨場補救、下一版該如何調整"
        >
          <Textarea name="notes" />
        </Field>

        <SubmitButton>儲存驗收評分</SubmitButton>
      </form>
    </Card>
  );
}
