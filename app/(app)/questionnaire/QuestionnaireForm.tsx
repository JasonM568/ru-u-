"use client";

import { useMemo, useState } from "react";
import {
  PART1,
  PART2,
  PART3,
  LIKERT_LABELS,
  EXPERIENCE_OPTIONS,
  AI_COURSE_OPTIONS,
} from "@/lib/questionnaire";
import { computeScores, missingAnswers, type Answers } from "@/lib/scoring";
import { Card, Field, Input, Select, SectionTitle } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { saveQuestionnaire } from "./actions";

type BasicInfo = {
  full_name?: string;
  contact?: string;
  experience?: string;
  occupation?: string;
  ai_course?: string;
};

export function QuestionnaireForm({
  initialAnswers,
  initialInfo,
}: {
  initialAnswers: Answers;
  initialInfo: BasicInfo;
}) {
  const [answers, setAnswers] = useState<Answers>(initialAnswers);

  const set = (id: string, value: string | number) =>
    setAnswers((a) => ({ ...a, [id]: value }));

  const missing = useMemo(() => missingAnswers(answers), [answers]);
  const preview = useMemo(
    () => (missing.length === 0 ? computeScores(answers) : null),
    [answers, missing.length],
  );

  return (
    <form action={saveQuestionnaire} className="space-y-6">
      <input type="hidden" name="answers" value={JSON.stringify(answers)} />

      {/* 基本資料 */}
      <Card>
        <SectionTitle>基本資料</SectionTitle>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="姓名">
            <Input name="full_name" defaultValue={initialInfo.full_name ?? ""} />
          </Field>
          <Field label="聯絡方式">
            <Input name="contact" defaultValue={initialInfo.contact ?? ""} />
          </Field>
          <Field label="過往投資經驗">
            <Select
              name="experience"
              defaultValue={initialInfo.experience ?? ""}
            >
              <option value="">請選擇</option>
              {EXPERIENCE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="目前職業／背景">
            <Input
              name="occupation"
              defaultValue={initialInfo.occupation ?? ""}
            />
          </Field>
          <Field label="AI agent 課程">
            <Select name="ai_course" defaultValue={initialInfo.ai_course ?? ""}>
              <option value="">請選擇</option>
              {AI_COURSE_OPTIONS.map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
            </Select>
          </Field>
        </div>
      </Card>

      {/* 第一部分 */}
      <Card>
        <SectionTitle hint="判斷你天生偏好分析鏈的哪一端。每題單選，憑直覺。">
          第一部分　認知風格傾向
        </SectionTitle>
        <div className="space-y-5">
          {PART1.map((q, i) => (
            <ChoiceItem
              key={q.id}
              index={i + 1}
              q={q}
              value={answers[q.id] as string | undefined}
              onChange={(v) => set(q.id, v)}
            />
          ))}
        </div>
      </Card>

      {/* 第二部分 */}
      <Card>
        <SectionTitle hint="判斷你偏「謹慎反思的分析型」還是「果斷臨場的執行型」。">
          第二部分　風險與決斷傾向
        </SectionTitle>
        <div className="space-y-5">
          {PART2.map((q, i) => (
            <ChoiceItem
              key={q.id}
              index={i + 8}
              q={q}
              value={answers[q.id] as string | undefined}
              onChange={(v) => set(q.id, v)}
            />
          ))}
        </div>
      </Card>

      {/* 第三部分 */}
      <Card>
        <SectionTitle hint="依平常的你為每句話評分。">
          第三部分　協作角色傾向
        </SectionTitle>
        <div className="mb-4 rounded-lg bg-slate-50 px-3 py-2.5">
          <p className="mb-1.5 text-xs font-medium text-slate-500">評分說明</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-slate-700">
            {LIKERT_LABELS.map((l) => (
              <span key={l.value} className="flex items-center gap-1.5">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 text-xs font-bold text-indigo-700">
                  {l.value}
                </span>
                {l.label}
              </span>
            ))}
          </div>
        </div>
        <div className="space-y-4">
          {PART3.map((q, i) => (
            <LikertItem
              key={q.id}
              index={i + 15}
              text={q.text}
              value={answers[q.id] as number | undefined}
              onChange={(v) => set(q.id, v)}
            />
          ))}
        </div>
      </Card>

      {/* 即時預覽 + 送出 */}
      <Card className="sticky bottom-4 border-indigo-200 bg-indigo-50/70 backdrop-blur">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm">
            {missing.length > 0 ? (
              <span className="text-slate-600">
                還有 <b className="text-rose-600">{missing.length}</b> 題未作答
              </span>
            ) : preview ? (
              <span className="text-slate-700">
                自我檢視結果傾向：
                <b className="text-indigo-700">{preview.suggestedRoleName}</b>
                <span className="ml-1 text-xs text-slate-400">
                  （最終以講師計分為準）
                </span>
              </span>
            ) : null}
          </div>
          <SubmitButton pendingText="送出中…">
            {missing.length > 0 ? "尚未完成" : "送出問卷"}
          </SubmitButton>
        </div>
      </Card>
    </form>
  );
}

function ChoiceItem({
  index,
  q,
  value,
  onChange,
}: {
  index: number;
  q: { id: string; text: string; options: { key: string; text: string }[] };
  value?: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-medium text-slate-800">
        {index}. {q.text}
      </p>
      <div className="space-y-2">
        {q.options.map((o) => {
          const active = value === o.key;
          return (
            <label
              key={o.key}
              className={`flex cursor-pointer items-start gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                active
                  ? "border-indigo-400 bg-indigo-50 text-slate-900"
                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
              }`}
            >
              <input
                type="radio"
                name={`radio_${q.id}`}
                checked={active}
                onChange={() => onChange(o.key)}
                className="mt-0.5"
              />
              <span>
                <b className="mr-1 text-slate-400">{o.key}.</b>
                {o.text}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

function LikertItem({
  index,
  text,
  value,
  onChange,
}: {
  index: number;
  text: string;
  value?: number;
  onChange: (v: number) => void;
}) {
  const selected = LIKERT_LABELS.find((l) => l.value === value);
  return (
    <div className="border-b border-slate-100 pb-4 last:border-0">
      <p className="mb-2 text-sm font-medium text-slate-800">
        {index}. {text}
      </p>
      <div className="flex gap-2">
        {LIKERT_LABELS.map((l) => {
          const active = value === l.value;
          return (
            <button
              key={l.value}
              type="button"
              onClick={() => onChange(l.value)}
              aria-label={`${l.value}：${l.label}`}
              title={l.label}
              className={`flex-1 rounded-lg border py-3 text-center text-xl font-semibold transition ${
                active
                  ? "border-indigo-500 bg-indigo-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-600 hover:border-indigo-300"
              }`}
            >
              {l.value}
            </button>
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-400">
        <span>← 非常不像我</span>
        {selected ? (
          <span className="font-medium text-indigo-600">已選：{selected.label}</span>
        ) : null}
        <span>非常像我 →</span>
      </div>
    </div>
  );
}
