/**
 * 論點卡的純文字輸出與 CCC 計算（純函式，server／client 共用）。
 * 從 ThesisCardForm.tsx 抽出來，因為「我的論點卡」是 server component，
 * 不能從 "use client" 模組 import 一般函式。
 */

import { computeCcc, pct, toNum, type CccResult } from "./ccc";
import type { ThesisCard } from "./state";

export function cccOf(tc: ThesisCard): CccResult {
  return computeCcc({
    px: toNum(tc.px),
    p3: toNum(tc.p3),
    p4: toNum(tc.p4),
    expectedReturn: toNum(tc.expectedReturn),
    mode: tc.ccMode,
  });
}

/** 論點卡純文字版，給「複製整張卡」、匯出與雲端列表用。 */
export function thesisText(tc: ThesisCard): string {
  const c = cccOf(tc);
  const L: string[] = [];
  L.push("【投資論點卡】");
  L.push(`標的：${tc.name || "____"}　　代號：${tc.code || "____"}`);
  L.push(`子段：${tc.sub || "____"}　　填寫日期：${tc.date || "____"}`);
  L.push(`分類：${tc.cls || "____"}`);
  L.push("");
  L.push("━━ 一、核心論點 ━━");
  L.push(`${tc.thesis || "____"}　（${[...tc.thesis].length} 字）`);
  L.push("");
  L.push("━━ 二、三個支撐證據 ━━");
  tc.evidence.forEach((e, i) => {
    L.push(`證據 ${i + 1}：${e.t || "____"}`);
    L.push(`　來源：${e.src || "____"}　期別：${e.per || "____"}`);
  });
  L.push("");
  L.push("━━ 三、三個證偽條件 ━━");
  tc.falsifiers.forEach((f, i) => {
    L.push(`條件 ${i + 1}：若 ${f.t || "____"}，本論點失效`);
    L.push(`　檢查時點：${f.when || "____"}　涵蓋層次：${f.lvl}`);
  });
  L.push("");
  L.push("━━ 四、最大單一雷點 ━━");
  L.push(tc.bomb || "____");
  L.push("");
  L.push("━━ 五、確認條件成本（CCC）━━");
  L.push(`現價：${tc.px || "__"}　L3 確認價：${tc.p3 || "__"}　成本：${pct(c.l3)}`);
  L.push(`L4 確認價：${tc.p4 || "__"}　成本：${pct(c.l4)}`);
  L.push(
    `合計確認成本：${pct(c.total)}（${tc.ccMode === "sum" ? "相加" : "取較高者"}）　預期報酬：${
      tc.expectedReturn ? `${(Number(tc.expectedReturn) * 100).toFixed(1)}%` : "__"
    }`,
  );
  L.push(
    `合計 ÷ 預期報酬 ＝ ${pct(c.ratio)}　→ ${
      c.pass === null ? "待填" : c.pass ? "通過（≤33%）" : "本案不成立（>33%）"
    }`,
  );
  L.push("");
  L.push("━━ 六、部位規劃 ━━");
  L.push(`形式：${tc.positionForm || "____"}`);
  L.push(`進場價帶：${tc.bandLow || "__"} ～ ${tc.bandHigh || "__"}`);
  L.push(`第一段 ${tc.tr1 || "__"}　第二段 ${tc.tr2 || "__"}　第三段 ${tc.tr3 || "__"}`);
  L.push(`部位上限：佔總資金 ${tc.positionCap || "__"}`);
  L.push(`CRS 升一級時：${tc.crsUp1 || "____"}`);
  L.push(`CRS 升兩級時：${tc.crsUp2 || "____"}`);
  L.push("");
  L.push("━━ 七、我可能錯在哪 ━━");
  L.push(tc.weakness || "____");
  return L.join("\n");
}
