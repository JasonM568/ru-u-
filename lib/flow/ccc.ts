/**
 * CCC 確認條件成本與 33% 硬閘門。
 *
 * 純函式，前後端共用（比照 lib/scoring.ts）：
 * 前端只做即時預覽，送出時 server action 一定要用這裡的 computeCcc 重算，不信任前端傳來的數字。
 *
 * 合計規則（教材原文）：
 *  - 兩個條件會被同一次上漲同時滿足 → 取較高者
 *  - 兩個條件是先後獨立的兩道關卡   → 相加
 * 不管採哪一種，**全隊必須一致**，否則跨組比較沒有意義。
 */

export type CcMode = "max" | "sum";

export const CC_GATE = 1 / 3;

export type CccInput = {
  /** 現價 */
  px: number | null;
  /** L3 確認價（基本面閘門） */
  p3: number | null;
  /** L4 確認價（技術確認） */
  p4: number | null;
  /** 預期報酬，小數（0.35 = 35%） */
  expectedReturn: number | null;
  mode: CcMode;
};

export type CccResult = {
  l3: number | null;
  l4: number | null;
  total: number | null;
  ratio: number | null;
  /** null = 資料不足尚未判定 */
  pass: boolean | null;
};

/** 把使用者輸入（可能是空字串或亂填）轉成數字或 null。 */
export function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const t = String(v).trim();
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function computeCcc(input: CccInput): CccResult {
  const { px, p3, p4, expectedReturn, mode } = input;

  const cost = (target: number | null): number | null =>
    px !== null && px > 0 && target !== null ? (target - px) / px : null;

  const l3 = cost(p3);
  const l4 = cost(p4);

  let total: number | null = null;
  if (l3 !== null && l4 !== null) {
    total = mode === "sum" ? l3 + l4 : Math.max(l3, l4);
  } else {
    total = l3 !== null ? l3 : l4;
  }

  const ratio =
    total !== null && expectedReturn !== null && expectedReturn > 0
      ? total / expectedReturn
      : null;

  return { l3, l4, total, ratio, pass: ratio === null ? null : ratio <= CC_GATE };
}

/** 顯示用百分比，null 顯示破折號。 */
export function pct(v: number | null, digits = 1): string {
  return v === null ? "—" : `${(v * 100).toFixed(digits)}%`;
}
