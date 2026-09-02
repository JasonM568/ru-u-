/**
 * T+20 對帳的四象限判定（純函式，server 端重算，前端只做預覽）。
 *
 * 教材原則：對帳看的不是賺賠，是「你當初寫的三個證偽條件，有沒有一個被觸發？
 * 如果觸發了，你有沒有照規則做？」
 *
 *   未觸發 ＋ 賺 ＝ 論點成立
 *   未觸發 ＋ 賠 ＝ 證偽條件設計失敗（重寫條件，不是換標的）
 *   觸發   ＋ 執行   ＝ 紀律及格
 *   觸發   ＋ 未執行 ＝ 紀律失誤（最嚴重）
 */

import { toNum } from "./ccc";

export type Outcome =
  | "thesis_holds"
  | "falsifier_design_failed"
  | "discipline_ok"
  | "discipline_failed";

export type FalsifierCheck = {
  /** null = 尚未判定 */
  triggered: boolean | null;
  note: string;
};

export type ReconcileInput = {
  /** 三個證偽條件的判定 */
  checks: FalsifierCheck[];
  /** 有觸發時：有沒有照規則做。未觸發時忽略。 */
  executed: boolean | null;
  entryPx: number | null;
  checkPx: number | null;
};

export type ReconcileResult = {
  /** true = 至少一條觸發；false = 三條都明確未觸發；null = 有條件還沒判定且沒有任何一條觸發 */
  anyTriggered: boolean | null;
  /** (check - entry) / entry；缺價或進場價 ≤ 0 → null */
  pnl: number | null;
  /** null = 資料不足，尚無法判定 */
  outcome: Outcome | null;
  /** 為什麼還不能判定（outcome 為 null 時） */
  missing: string | null;
};

export const OUTCOME_LABEL: Record<Outcome, string> = {
  thesis_holds: "論點成立",
  falsifier_design_failed: "證偽條件設計失敗",
  discipline_ok: "紀律及格",
  discipline_failed: "紀律失誤",
};

/** 給人看的一句話：這個象限代表什麼、下一步該做什麼。 */
export const OUTCOME_HINT: Record<Outcome, string> = {
  thesis_holds: "三個條件都沒被觸發，而且賺了。論點暫時成立，下次對帳再驗一次。",
  falsifier_design_failed:
    "沒有任何條件被觸發，卻賠了——代表證偽條件沒抓到真正的風險。該做的是重寫條件，不是換標的。",
  discipline_ok: "條件被觸發，而且你照當初寫的規則做了。這筆的賺賠不重要，紀律及格。",
  discipline_failed: "條件被觸發，你卻沒有照規則做。這是四種結果裡最嚴重的一種。",
};

export const OUTCOME_TONE: Record<Outcome, "green" | "amber" | "indigo" | "rose"> = {
  thesis_holds: "green",
  falsifier_design_failed: "amber",
  discipline_ok: "indigo",
  discipline_failed: "rose",
};

/** 把任意輸入收斂成固定三筆的 checks。 */
export function sanitizeChecks(input: unknown): FalsifierCheck[] {
  const arr = Array.isArray(input) ? input : [];
  return [0, 1, 2].map((i) => {
    const c = (arr[i] ?? {}) as Record<string, unknown>;
    const t = c.triggered;
    return {
      triggered: t === true ? true : t === false ? false : null,
      note: typeof c.note === "string" ? c.note.slice(0, 2000) : "",
    };
  });
}

export function reconcile(input: ReconcileInput): ReconcileResult {
  const checks = sanitizeChecks(input.checks);

  const anyTrue = checks.some((c) => c.triggered === true);
  const allFalse = checks.every((c) => c.triggered === false);
  const anyTriggered: boolean | null = anyTrue ? true : allFalse ? false : null;

  const entry = input.entryPx;
  const check = input.checkPx;
  const pnl = entry !== null && entry > 0 && check !== null ? (check - entry) / entry : null;

  if (anyTriggered === null) {
    return { anyTriggered, pnl, outcome: null, missing: "三個證偽條件還沒全部判定是否觸發" };
  }

  if (anyTriggered) {
    if (input.executed === null) {
      return { anyTriggered, pnl, outcome: null, missing: "條件已觸發，還沒填「有沒有照規則做」" };
    }
    return {
      anyTriggered,
      pnl,
      outcome: input.executed ? "discipline_ok" : "discipline_failed",
      missing: null,
    };
  }

  if (pnl === null) {
    return { anyTriggered, pnl, outcome: null, missing: "未觸發的情況要靠賺賠判定，請填進場價與對帳日價格" };
  }
  return {
    anyTriggered,
    pnl,
    outcome: pnl >= 0 ? "thesis_holds" : "falsifier_design_failed",
    missing: null,
  };
}

/** 從 UI 字串直接算（前端預覽與 server action 共用同一個入口）。 */
export function reconcileFromStrings(input: {
  checks: unknown;
  executed: boolean | null;
  entryPx: string;
  checkPx: string;
}): ReconcileResult {
  return reconcile({
    checks: sanitizeChecks(input.checks),
    executed: input.executed,
    entryPx: toNum(input.entryPx),
    checkPx: toNum(input.checkPx),
  });
}
