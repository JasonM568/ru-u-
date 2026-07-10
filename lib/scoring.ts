// 計分與分流引擎 — 實作文件 01「計分與分流邏輯」第一~五步。
// 純函式、無副作用，方便單元測試與 server action 重算。

import type { JobRole } from "@/lib/constants";
import { JOB_ROLE_MAP } from "@/lib/constants";

export type Answers = Record<string, string | number>;

export type Scores = {
  part1: {
    MA: number; // 總經
    MK: number; // 市場
    EQ: number; // 標的
    ST: number; // 策略
    top: "MA" | "MK" | "EQ" | "ST";
  };
  part2: {
    A: number; // 分析反思
    B: number; // 果斷執行
    lean: "analysis" | "execution" | "balanced";
  };
  part3: {
    LD: number; // 主導整合 總分（滿分 20）
    IN: number; // 獨立鑽研 總分（滿分 15）
    GK: number; // 流程把關 總分（滿分 20）
    avgLD: number;
    avgIN: number;
    avgGK: number;
    top: "LD" | "IN" | "GK";
  };
  fit: Record<JobRole, number>; // 五職務適配分（越高越適合）
  suggestedRole: JobRole;
  suggestedRoleName: string;
  reasons: string[];
};

const PART1_MAP: Record<string, "MA" | "MK" | "EQ" | "ST"> = {
  A: "MA",
  B: "MK",
  C: "EQ",
  D: "ST",
};

const LD_ITEMS = ["q15", "q18", "q21", "q24"];
const IN_ITEMS = ["q16", "q19", "q22"];
const GK_ITEMS = ["q17", "q20", "q23", "q25"];

function sumLikert(answers: Answers, ids: string[]): number {
  return ids.reduce((acc, id) => acc + (Number(answers[id]) || 0), 0);
}

export function computeScores(answers: Answers): Scores {
  // ── 第一步：第一部分（Q1–7）統計軌道 ──
  const p1 = { MA: 0, MK: 0, EQ: 0, ST: 0 };
  for (let i = 1; i <= 7; i++) {
    const choice = String(answers[`q${i}`] ?? "").toUpperCase();
    const track = PART1_MAP[choice];
    if (track) p1[track] += 1;
  }
  const p1Top = (Object.keys(p1) as (keyof typeof p1)[]).reduce((a, b) =>
    p1[a] >= p1[b] ? a : b,
  );

  // ── 第二步：第二部分（Q8–14）數 A/B ──
  let a2 = 0;
  let b2 = 0;
  for (let i = 8; i <= 14; i++) {
    const choice = String(answers[`q${i}`] ?? "").toUpperCase();
    if (choice === "A") a2 += 1;
    else if (choice === "B") b2 += 1;
  }
  const lean: Scores["part2"]["lean"] =
    a2 > b2 ? "analysis" : b2 > a2 ? "execution" : "balanced";

  // ── 第三步：第三部分（Q15–25）軌道加總 → 每題平均 ──
  const LD = sumLikert(answers, LD_ITEMS);
  const IN = sumLikert(answers, IN_ITEMS);
  const GK = sumLikert(answers, GK_ITEMS);
  const avgLD = LD / LD_ITEMS.length;
  const avgIN = IN / IN_ITEMS.length;
  const avgGK = GK / GK_ITEMS.length;
  const p3Pairs: [Scores["part3"]["top"], number][] = [
    ["LD", avgLD],
    ["IN", avgIN],
    ["GK", avgGK],
  ];
  const p3Top = p3Pairs.reduce((a, b) => (a[1] >= b[1] ? a : b))[0];

  // ── 第四步：五職務適配分（以第一部分為骨幹，二、三修正）──
  // 每項訊號權重反映文件「典型訊號組合」；part1 主傾向為最重骨幹。
  const leanA = lean === "analysis";
  const leanB = lean === "execution";

  // 骨幹說明：macro/equity/market/pm 以第一部分主傾向為骨幹（×1.5，滿分 10.5）；
  // risk 的骨幹是第三部分 GK（×2.2，滿分 11），因為文件規定風控由「GK 最高」判定。
  const fit: Record<JobRole, number> = {
    macro: p1.MA * 1.5 + (leanA ? 1.0 : 0) + avgIN * 0.6,
    equity: p1.EQ * 1.5 + (leanA ? 0.8 : 0) + avgIN * 1.0,
    market: p1.MK * 1.5 + (leanB ? 2.0 : 0),
    pm: p1.ST * 1.5 + avgLD * 1.4 + (leanB ? 0.6 : 0),
    risk: avgGK * 2.2 + (leanA ? 0.8 : 0),
  };

  const suggestedRole = (Object.keys(fit) as JobRole[]).reduce((a, b) =>
    fit[a] >= fit[b] ? a : b,
  );

  const reasons = buildReasons(
    { ...p1, top: p1Top },
    { A: a2, B: b2, lean },
    { avgLD, avgIN, avgGK, top: p3Top },
    suggestedRole,
  );

  return {
    part1: { ...p1, top: p1Top },
    part2: { A: a2, B: b2, lean },
    part3: { LD, IN, GK, avgLD, avgIN, avgGK, top: p3Top },
    fit,
    suggestedRole,
    suggestedRoleName: JOB_ROLE_MAP[suggestedRole].name,
    reasons,
  };
}

const TRACK_LABEL: Record<string, string> = {
  MA: "總經（環境）",
  MK: "市場（盤面）",
  EQ: "標的（個股）",
  ST: "策略（整合）",
  LD: "主導整合",
  IN: "獨立鑽研",
  GK: "流程把關",
};

const LEAN_LABEL: Record<string, string> = {
  analysis: "分析反思型",
  execution: "果斷執行型",
  balanced: "分析／執行均衡",
};

function buildReasons(
  p1: Scores["part1"],
  p2: Omit<Scores["part2"], never>,
  p3: Pick<Scores["part3"], "avgLD" | "avgIN" | "avgGK" | "top">,
  role: JobRole,
): string[] {
  const r: string[] = [];
  r.push(`第一部分主傾向：${TRACK_LABEL[p1.top]}（MA ${p1.MA}／MK ${p1.MK}／EQ ${p1.EQ}／ST ${p1.ST}）`);
  r.push(`第二部分：${LEAN_LABEL[p2.lean]}（分析 ${p2.A}／執行 ${p2.B}）`);
  r.push(
    `第三部分最高：${TRACK_LABEL[p3.top]}（主導 ${p3.avgLD.toFixed(2)}／鑽研 ${p3.avgIN.toFixed(2)}／把關 ${p3.avgGK.toFixed(2)}，每題平均）`,
  );
  r.push(`綜合判讀 → 建議職務：${JOB_ROLE_MAP[role].name}`);
  return r;
}

/** 驗證作答是否完整（25 題全填）。回傳缺答的題號。 */
export function missingAnswers(answers: Answers): string[] {
  const missing: string[] = [];
  for (let i = 1; i <= 14; i++) {
    if (!answers[`q${i}`]) missing.push(`q${i}`);
  }
  for (let i = 15; i <= 25; i++) {
    const v = Number(answers[`q${i}`]);
    if (!v || v < 1 || v > 5) missing.push(`q${i}`);
  }
  return missing;
}
