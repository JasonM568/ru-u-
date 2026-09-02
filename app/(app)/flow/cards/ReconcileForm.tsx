"use client";

import { useState } from "react";
import { Field, Input, Textarea } from "@/components/ui";
import { pct } from "@/lib/flow/ccc";
import type { ReconciliationRow } from "@/lib/flow/cloud";
import {
  OUTCOME_HINT,
  OUTCOME_LABEL,
  reconcileFromStrings,
  type FalsifierCheck,
} from "@/lib/flow/reconcile";
import type { ThesisCard } from "@/lib/flow/state";
import { saveReconciliation } from "../actions";

type Tri = "yes" | "no" | "";
const toTri = (v: boolean | null): Tri => (v === true ? "yes" : v === false ? "no" : "");
const fromTri = (v: Tri): boolean | null => (v === "yes" ? true : v === "no" ? false : null);

/**
 * T+20 對帳表單。前端用 lib/flow/reconcile.ts 即時預覽四象限，
 * 送出後 server action 用同一支重算，畫面上的結果只是預覽。
 */
export function ReconcileForm({
  card,
  existing,
}: {
  card: ThesisCard;
  existing: ReconciliationRow | null;
}) {
  const initChecks: FalsifierCheck[] = [0, 1, 2].map((i) => ({
    triggered: existing?.checks?.[i]?.triggered ?? null,
    note: existing?.checks?.[i]?.note ?? "",
  }));
  const [tri, setTri] = useState<Tri[]>(initChecks.map((c) => toTri(c.triggered)));
  const [notes, setNotes] = useState<string[]>(initChecks.map((c) => c.note));
  const [executed, setExecuted] = useState<Tri>(toTri(existing?.executed ?? null));
  const [entryPx, setEntryPx] = useState(existing?.entry_px || card.px || "");
  const [checkPx, setCheckPx] = useState(existing?.check_px ?? "");

  const preview = reconcileFromStrings({
    checks: tri.map((t, i) => ({ triggered: fromTri(t), note: notes[i] })),
    executed: fromTri(executed),
    entryPx,
    checkPx,
  });

  return (
    <form action={saveReconciliation} className="space-y-4">
      <input type="hidden" name="card_id" value={card.id ?? ""} />

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="對帳日期">
          <Input name="checked_on" defaultValue={existing?.checked_on ?? ""} placeholder="2026/09/30" />
        </Field>
        <Field label="當初進場價" hint="預設帶論點卡的現價">
          <Input name="entry_px" inputMode="decimal" value={entryPx} onChange={(e) => setEntryPx(e.target.value)} />
        </Field>
        <Field label="對帳日價格">
          <Input name="check_px" inputMode="decimal" value={checkPx} onChange={(e) => setCheckPx(e.target.value)} placeholder="今天的收盤價" />
        </Field>
      </div>

      <div className="space-y-3">
        {card.falsifiers.map((f, i) => (
          <div key={i} className="rounded-lg border border-slate-200 px-4 py-3">
            <div className="text-base text-slate-800">
              <span className="mr-2 font-semibold text-slate-500">條件 {i + 1}</span>
              若 {f.t || "____"}，本論點失效
              <span className="ml-2 text-sm text-slate-400">
                檢查時點 {f.when || "__"}　·　{f.lvl}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              {(["yes", "no"] as const).map((v) => (
                <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600">
                  <input
                    type="radio"
                    name={`t${i + 1}`}
                    value={v}
                    checked={tri[i] === v}
                    onChange={() => setTri((p) => p.map((x, j) => (j === i ? v : x)))}
                    className="accent-amber-600"
                  />
                  {v === "yes" ? "已觸發" : "未觸發"}
                </label>
              ))}
              <input
                name={`n${i + 1}`}
                value={notes[i]}
                onChange={(e) => setNotes((p) => p.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="實際數字與出處（例：Q3 毛利率 31.2%，法說會 10/28）"
                className="min-w-[240px] flex-1 rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--gold)]"
              />
            </div>
          </div>
        ))}
      </div>

      {preview.anyTriggered && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
          <div className="text-base font-medium text-amber-800">有條件被觸發。你有沒有照當初寫的規則做？</div>
          <div className="mt-2 flex flex-wrap gap-3">
            {(["yes", "no"] as const).map((v) => (
              <label key={v} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600">
                <input
                  type="radio"
                  name="executed"
                  value={v}
                  checked={executed === v}
                  onChange={() => setExecuted(v)}
                  className="accent-amber-600"
                />
                {v === "yes" ? "有，照規則做了" : "沒有"}
              </label>
            ))}
          </div>
        </div>
      )}
      {!preview.anyTriggered && <input type="hidden" name="executed" value="" />}

      <Field label="檢討（自己寫）" hint="對帳看的不是賺賠，是條件有沒有被觸發、觸發了有沒有照規則做">
        <Textarea name="reflection" rows={3} defaultValue={existing?.reflection ?? ""} />
      </Field>

      <div className="rounded-lg border border-slate-200 px-4 py-3">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-base">
          <span className="text-slate-500">
            賺賠 <b className="text-slate-800">{preview.pnl === null ? "—" : pct(preview.pnl)}</b>
          </span>
          <span className="text-slate-500">
            判定{" "}
            <b className="text-slate-800">
              {preview.outcome ? OUTCOME_LABEL[preview.outcome] : "資料不足"}
            </b>
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {preview.outcome ? OUTCOME_HINT[preview.outcome] : preview.missing}
        </p>
      </div>

      <button type="submit" className="btn-gold rounded-lg px-4 py-2 text-base">
        {existing ? "更新對帳" : "送出對帳"}
      </button>
    </form>
  );
}
