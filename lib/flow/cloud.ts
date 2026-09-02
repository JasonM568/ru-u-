/**
 * 論點卡上雲（階段二）：前端 ThesisCard ⇄ elite.thesis_cards 資料列 的純函式。
 *
 * 原則（比照 lib/scoring.ts）：
 * - server action 收到的是前端序列化的 JSON，先用 sanitizeCard 收斂成合法的 ThesisCard，
 *   再用 cardToRow 產生資料列；cc_* 五欄一律在這裡用 lib/flow/ccc.ts 重算，
 *   不信任前端傳來的任何數字。
 * - rowToCard 把資料列還原成 ThesisCard，給「我的論點卡」頁與「載入到控制台」用。
 */

import { computeCcc, toNum, type CcMode } from "./ccc";
import {
  FALSIFIER_LEVELS,
  blankThesisCard,
  type Evidence,
  type Falsifier,
  type FalsifierLevel,
  type ThesisCard,
} from "./state";

/** elite.thesis_cards 的一列（欄位名 = 資料表欄位名）。 */
export type ThesisCardRow = {
  id: string;
  user_id: string;
  group_id: string | null;
  as_of: string | null;
  code: string;
  name: string;
  sub: string;
  cls: string;
  filled_on: string;
  thesis: string;
  evidence: Evidence[];
  falsifiers: Falsifier[];
  bomb: string;
  px: string;
  p3: string;
  p4: string;
  expected_return: string;
  cc_mode: CcMode;
  cc_l3: number | null;
  cc_l4: number | null;
  cc_total: number | null;
  cc_ratio: number | null;
  cc_pass: boolean | null;
  position_form: string;
  band_low: string;
  band_high: string;
  tr1: string;
  tr2: string;
  tr3: string;
  position_cap: string;
  crs_up1: string;
  crs_up2: string;
  weakness: string;
  created_at: string;
  updated_at: string;
};

/** 寫入用（不含 id／時間戳，由資料庫決定）。 */
export type ThesisCardInsert = Omit<ThesisCardRow, "id" | "created_at" | "updated_at">;

const MAX_TEXT = 4000;

const str = (v: unknown, max = MAX_TEXT): string =>
  typeof v === "string" ? v.slice(0, max) : v === null || v === undefined ? "" : String(v).slice(0, max);

const isLevel = (v: unknown): v is FalsifierLevel =>
  typeof v === "string" && (FALSIFIER_LEVELS as readonly string[]).includes(v);

/**
 * 把前端傳來的任意 JSON 收斂成合法的 ThesisCard：
 * 缺的欄位補空字串、證據與證偽條件固定三筆、ccMode 與涵蓋層次只接受合法值。
 * 多出來的欄位一律丟掉。
 */
export function sanitizeCard(input: unknown): ThesisCard {
  const base = blankThesisCard();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;

  const ev = Array.isArray(o.evidence) ? o.evidence : [];
  const fz = Array.isArray(o.falsifiers) ? o.falsifiers : [];

  const evidence = base.evidence.map((blank, i) => {
    const e = (ev[i] ?? {}) as Record<string, unknown>;
    return { t: str(e.t), src: str(e.src, 200), per: str(e.per, 100) } satisfies Evidence;
  }) as ThesisCard["evidence"];

  const falsifiers = base.falsifiers.map((blank, i) => {
    const f = (fz[i] ?? {}) as Record<string, unknown>;
    return { t: str(f.t), when: str(f.when, 200), lvl: isLevel(f.lvl) ? f.lvl : blank.lvl } satisfies Falsifier;
  }) as ThesisCard["falsifiers"];

  const card: ThesisCard = {
    ...base,
    id: typeof o.id === "string" && o.id ? o.id : undefined,
    code: str(o.code, 20).trim(),
    name: str(o.name, 100).trim(),
    sub: str(o.sub, 100),
    cls: str(o.cls, 50),
    date: str(o.date, 50),
    thesis: str(o.thesis),
    evidence,
    falsifiers,
    bomb: str(o.bomb),
    px: str(o.px, 50),
    p3: str(o.p3, 50),
    p4: str(o.p4, 50),
    expectedReturn: str(o.expectedReturn, 50),
    ccMode: o.ccMode === "sum" ? "sum" : "max",
    positionForm: str(o.positionForm, 50),
    bandLow: str(o.bandLow, 50),
    bandHigh: str(o.bandHigh, 50),
    tr1: str(o.tr1, 200),
    tr2: str(o.tr2, 200),
    tr3: str(o.tr3, 200),
    positionCap: str(o.positionCap, 50),
    crsUp1: str(o.crsUp1),
    crsUp2: str(o.crsUp2),
    weakness: str(o.weakness),
  };
  if (card.id === undefined) delete card.id;
  return card;
}

/** ThesisCard → 資料列。cc_* 在這裡重算，前端的數字只當輸入不當結果。 */
export function cardToRow(
  tc: ThesisCard,
  ctx: { userId: string; groupId?: string | null; asOf?: string | null },
): ThesisCardInsert {
  const c = computeCcc({
    px: toNum(tc.px),
    p3: toNum(tc.p3),
    p4: toNum(tc.p4),
    expectedReturn: toNum(tc.expectedReturn),
    mode: tc.ccMode,
  });
  return {
    user_id: ctx.userId,
    group_id: ctx.groupId ?? null,
    as_of: ctx.asOf ?? null,
    code: tc.code,
    name: tc.name,
    sub: tc.sub,
    cls: tc.cls,
    filled_on: tc.date,
    thesis: tc.thesis,
    evidence: tc.evidence,
    falsifiers: tc.falsifiers,
    bomb: tc.bomb,
    px: tc.px,
    p3: tc.p3,
    p4: tc.p4,
    expected_return: tc.expectedReturn,
    cc_mode: tc.ccMode,
    cc_l3: c.l3,
    cc_l4: c.l4,
    cc_total: c.total,
    cc_ratio: c.ratio,
    cc_pass: c.pass,
    position_form: tc.positionForm,
    band_low: tc.bandLow,
    band_high: tc.bandHigh,
    tr1: tc.tr1,
    tr2: tc.tr2,
    tr3: tc.tr3,
    position_cap: tc.positionCap,
    crs_up1: tc.crsUp1,
    crs_up2: tc.crsUp2,
    weakness: tc.weakness,
  };
}

/** 資料列 → ThesisCard（帶 id）。經過 sanitizeCard，所以舊資料缺欄也安全。 */
export function rowToCard(row: ThesisCardRow): ThesisCard {
  return sanitizeCard({
    id: row.id,
    code: row.code,
    name: row.name,
    sub: row.sub,
    cls: row.cls,
    date: row.filled_on,
    thesis: row.thesis,
    evidence: row.evidence,
    falsifiers: row.falsifiers,
    bomb: row.bomb,
    px: row.px,
    p3: row.p3,
    p4: row.p4,
    expectedReturn: row.expected_return,
    ccMode: row.cc_mode,
    positionForm: row.position_form,
    bandLow: row.band_low,
    bandHigh: row.band_high,
    tr1: row.tr1,
    tr2: row.tr2,
    tr3: row.tr3,
    positionCap: row.position_cap,
    crsUp1: row.crs_up1,
    crsUp2: row.crs_up2,
    weakness: row.weakness,
  });
}

/** 存雲端前的最低門檻：至少要有代號或名稱，否則存進去只是一張空卡。 */
export function cardIsEmpty(tc: ThesisCard): boolean {
  return !tc.code.trim() && !tc.name.trim() && !tc.thesis.trim();
}
