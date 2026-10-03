"use client";

import { useState } from "react";
import { Card, Field, Input } from "@/components/ui";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { SubmitButton } from "@/components/SubmitButton";
import { createCohort, switchCurrentCohort } from "../actions";

type Cohort = { code: string; display_name: string; started_on: string | null; is_current: boolean };

export function CohortManager({ cohorts }: { cohorts: Cohort[] }) {
  const current = cohorts.find((c) => c.is_current);
  const [pendingCohort, setPendingCohort] = useState<Cohort | null>(null);
  return (
    <div className="space-y-5">
      <Card>
        <h2 className="font-semibold text-slate-800">目前當期：{current?.display_name ?? "尚未設定"}</h2>
        <p className="mt-2 text-sm text-slate-600">之後新加入名冊的成員會落在 {current?.display_name ?? "當期設定完成後的期別"}。</p>
        <div className="mt-4 space-y-3">
          {cohorts.map((c) => (
            <div key={c.code} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3">
              <span className="text-sm text-slate-800">{c.display_name}（{c.code}）{c.started_on ? `・${c.started_on}` : ""}{c.is_current ? "・當期" : ""}</span>
              {!c.is_current && (
                <button type="button" onClick={() => setPendingCohort(c)} className="btn-ghost rounded-lg px-4 py-2 text-sm">設為當期</button>
              )}
            </div>
          ))}
        </div>
      </Card>
      {pendingCohort && (
        <ConfirmDialog title={`切換當期為「${pendingCohort.display_name}」？`} onCancel={() => setPendingCohort(null)}
          confirm={<form action={switchCurrentCohort}>
            <input type="hidden" name="code" value={pendingCohort.code} />
            <SubmitButton>確認切換</SubmitButton>
          </form>}>
          之後新加入名冊的成員會落在 {pendingCohort.display_name}。已有成員與內容不會自動改期別。
        </ConfirmDialog>
      )}
      <Card>
        <h2 className="mb-3 font-semibold text-slate-800">新增期別</h2>
        <form action={createCohort} className="grid gap-3 sm:grid-cols-3">
          <Field label="期別代碼" required><Input name="code" required placeholder="2027-1" pattern="[0-9]{4}-[0-9]+" /></Field>
          <Field label="顯示名稱" required><Input name="display_name" required placeholder="2027 第 1 期" /></Field>
          <Field label="開始日期"><Input type="date" name="started_on" /></Field>
          <div className="sm:col-span-3"><SubmitButton>新增期別</SubmitButton></div>
        </form>
      </Card>
    </div>
  );
}
