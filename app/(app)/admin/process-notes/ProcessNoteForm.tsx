"use client";

import { useState } from "react";
import { Card, Field, Input, Textarea, Select } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { saveProcessNote } from "../actions";

type FieldDef = { name: string; label: string; type?: "text" | "textarea" };

const KINDS: {
  key: string;
  title: string;
  desc: string;
  fields: FieldDef[];
}[] = [
  {
    key: "segment",
    title: "表一　環節觀察紀錄",
    desc: "兩天課程每個主要環節填一份",
    fields: [
      { name: "segment_name", label: "環節名稱" },
      { name: "module", label: "對應模組（A/B/C/D/E）" },
      { name: "time", label: "時間" },
      { name: "recorder", label: "記錄人" },
      { name: "effective", label: "這個環節「有效」的地方（可標準化）", type: "textarea" },
      { name: "stuck", label: "學員「卡住」的地方", type: "textarea" },
      { name: "rescue", label: "顧及然／講師的「臨場補救」（最重要）", type: "textarea" },
      { name: "can_sop", label: "能否寫成 SOP？（可以／還不行）" },
      { name: "next_version", label: "下一版要怎麼改", type: "textarea" },
    ],
  },
  {
    key: "stuck",
    title: "表二　學員卡點彙整",
    desc: "跨環節，找多數人都卡的地方",
    fields: [
      { name: "point", label: "卡點" },
      { name: "segment", label: "發生在哪個環節" },
      { name: "count", label: "多少人卡" },
      { name: "cause", label: "可能原因（學員／系統？）" },
      { name: "direction", label: "改進方向", type: "textarea" },
    ],
  },
  {
    key: "dependency",
    title: "表三　「還依賴顧及然本人」清單",
    desc: "越短越可複製",
    fields: [
      { name: "item", label: "依賴項（哪個環節還離不開你）" },
      { name: "why", label: "為什麼別人做不了", type: "textarea" },
      { name: "can_sop", label: "能否拆解成 SOP？（能／暫時不能）" },
    ],
  },
  {
    key: "good_moves",
    title: "表四　有效引導動作庫",
    desc: "正向萃取，最該保留的資產",
    fields: [
      { name: "move", label: "有效動作／話術／比喻" },
      { name: "context", label: "用在什麼情境" },
      { name: "effect", label: "效果", type: "textarea" },
    ],
  },
  {
    key: "daily",
    title: "表五　每日總結",
    desc: "兩天各填一份",
    fields: [
      { name: "date", label: "日期（7/18 或 7/19）" },
      { name: "smoothest", label: "今天系統跑得最順的一段", type: "textarea" },
      { name: "surprise", label: "今天最大的意外（好或壞）", type: "textarea" },
      { name: "keep", label: "今天最該記下來、日後一定要保留的一件事", type: "textarea" },
      { name: "gap", label: "今天暴露出「系統還沒到位」的一件事", type: "textarea" },
      { name: "adjust", label: "明天／下一版要調整的", type: "textarea" },
    ],
  },
];

export function ProcessNoteForm() {
  const [kind, setKind] = useState(KINDS[0]);

  return (
    <Card className="mb-6">
      <Field label="紀錄類型">
        <Select
          value={kind.key}
          onChange={(e) =>
            setKind(KINDS.find((k) => k.key === e.target.value) ?? KINDS[0])
          }
        >
          {KINDS.map((k) => (
            <option key={k.key} value={k.key}>
              {k.title}
            </option>
          ))}
        </Select>
      </Field>
      <p className="mt-1 mb-4 text-xs text-slate-400">{kind.desc}</p>

      <form action={saveProcessNote} className="space-y-4">
        <input type="hidden" name="kind" value={kind.key} />
        {kind.fields.map((f) => (
          <Field key={f.name} label={f.label}>
            {f.type === "textarea" ? (
              <Textarea name={`f_${f.name}`} />
            ) : (
              <Input name={`f_${f.name}`} />
            )}
          </Field>
        ))}
        <SubmitButton>儲存紀錄</SubmitButton>
      </form>
    </Card>
  );
}

export const PROCESS_KIND_TITLES: Record<string, string> = Object.fromEntries(
  KINDS.map((k) => [k.key, k.title]),
);
