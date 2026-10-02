/**
 * 作業存檔（階段五）：整份控制台狀態 ⇄ elite.flow_runs 的純函式。
 *
 * - sanitizeState：把前端傳來的 JSON 收斂成合法且有界的 FlowState
 *   （每張交棒卡最多 MAX_CARD_CHARS 字、分段設定走 sanitizeSplitConfig 的規則、論點卡走 sanitizeCard）
 * - runTitle：自動標題「1519 華城」／群組名
 * - forkForNextTarget：同一段換第二檔標的——保留 L0～交集（段層級），清掉 L3 之後（標的層級）
 * - isBlankState：判斷 localStorage 舊資料值不值得轉成第一個存檔
 */

import { CHAIN_LIMITS, sanitizeCustomChain, type CustomChainStock } from "./chains";
import { sanitizeCard } from "./cloud";
import { sanitizeExtra, sanitizeSplitConfig } from "./config";
import type { CardId } from "./prompts";
import { GROUPS } from "./segments";
import { blankState, blankThesisCard, resolveGroup, seedStock, type FlowState } from "./state";

/** 每人存檔上限（資料庫 trigger 也擋同一個數字） */
export const MAX_RUNS = 30;
/** 每張交棒卡的字數上限。教材要求「只貼交棒卡，最多 10 行」，一萬字已經是整份報告的量。 */
export const MAX_CARD_CHARS = 10000;
const MAX_KEYS = 500;

const CARD_IDS: CardId[] = ["L0", "L1", "L2", "XS", "L3", "L4"];

const str = (v: unknown, max: number): string =>
  typeof v === "string" ? v.slice(0, max) : "";

const boolMap = (v: unknown): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === true && k.length <= 100 && n++ < MAX_KEYS) out[k] = true;
  }
  return out;
};

const strMap = (v: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!v || typeof v !== "object" || Array.isArray(v)) return out;
  let n = 0;
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string" && k.length <= 100 && n++ < MAX_KEYS) out[k] = val.slice(0, 100);
  }
  return out;
};

export function sanitizeState(input: unknown): FlowState {
  const base = blankState();
  if (!input || typeof input !== "object") return base;
  const o = input as Record<string, unknown>;

  // 自訂產業鏈先收斂，groupId 才能指向它
  const chains: FlowState["chains"] = {};
  if (o.chains && typeof o.chains === "object" && !Array.isArray(o.chains)) {
    for (const [id, c] of Object.entries(o.chains as Record<string, unknown>)) {
      if (Object.keys(chains).length >= CHAIN_LIMITS.chainsPerState) break;
      const cc = sanitizeCustomChain(c);
      if (cc && cc.id === id) chains[id] = cc;
    }
  }

  const groupId =
    typeof o.groupId === "string" && (GROUPS.some((g) => g.id === o.groupId) || o.groupId in chains)
      ? o.groupId
      : base.groupId;

  // 教材群組子段的自建個股：只收教材群組與其教材分類
  const extraStocks: FlowState["extraStocks"] = {};
  if (o.extraStocks && typeof o.extraStocks === "object" && !Array.isArray(o.extraStocks)) {
    for (const [gid, v] of Object.entries(o.extraStocks as Record<string, unknown>)) {
      const g = GROUPS.find((x) => x.id === gid);
      if (!g) continue;
      const ex: Record<string, CustomChainStock[]> | null = sanitizeExtra(v, g.subs);
      if (ex) extraStocks[gid] = ex;
    }
  }

  // 自訂分段：每個群組各自走 sanitizeSplitConfig 的 custom 規則
  const custom: FlowState["custom"] = {};
  if (o.custom && typeof o.custom === "object" && !Array.isArray(o.custom)) {
    for (const [gid, c] of Object.entries(o.custom as Record<string, unknown>)) {
      if (!GROUPS.some((g) => g.id === gid)) continue;
      const cfg = sanitizeSplitConfig({ v: 1, group: gid, custom: c });
      if (cfg?.custom) custom[gid] = cfg.custom;
    }
  }

  const cards = { ...base.cards };
  if (o.cards && typeof o.cards === "object") {
    for (const id of CARD_IDS) cards[id] = str((o.cards as Record<string, unknown>)[id], MAX_CARD_CHARS);
  }

  return {
    ticker: str(o.ticker, 20).trim(),
    groupId,
    asOf: str(o.asOf, 50),
    wacc: str(o.wacc, 20) || base.wacc,
    originalOnly: o.originalOnly === true,
    custom,
    editSplit: false,
    offSubs: boolMap(o.offSubs),
    offStocks: boolMap(o.offStocks),
    cards,
    checks: boolMap(o.checks),
    gates: strMap(o.gates),
    open: boolMap(o.open),
    tc: sanitizeCard(o.tc),
    chains,
    extraStocks,
  };
}

/** 自動標題：「1519 華城」＞ 論點卡的代號名稱 ＞ 群組名。 */
export function runTitle(state: FlowState): string {
  const s = seedStock(state);
  if (s) return `${s.code} ${s.name}`;
  if (state.tc.code || state.tc.name) return `${state.tc.code} ${state.tc.name}`.trim();
  if (state.ticker) return state.ticker;
  return resolveGroup(state).name;
}

/**
 * 同一段換下一檔標的：L0～交集是段層級，留著；L3、L4、論點卡、L3 以後的檢核與閘門是標的層級，清掉。
 * 對應月例會「每隊交出 2 檔論點卡」——第二檔不用重跑前四層。
 */
export function forkForNextTarget(state: FlowState): FlowState {
  const next: FlowState = structuredClone(state);
  next.ticker = "";
  next.cards.L3 = "";
  next.cards.L4 = "";
  next.tc = { ...blankThesisCard(), ccMode: state.tc.ccMode };
  for (const k of Object.keys(next.checks)) {
    if (/^(L3|L4|L5|TC)#/.test(k)) delete next.checks[k];
  }
  for (const k of Object.keys(next.gates)) {
    if (k !== "XS") delete next.gates[k];
  }
  next.editSplit = false;
  return next;
}

/** localStorage 的舊資料是不是空白到不值得轉成存檔。 */
export function isBlankState(state: FlowState): boolean {
  const anyCard = CARD_IDS.some((id) => (state.cards[id] ?? "").trim());
  const anyTc = !!(state.tc.code || state.tc.name || state.tc.thesis);
  const anyCustom =
    Object.keys(state.custom).length > 0 ||
    Object.keys(state.chains ?? {}).length > 0 ||
    Object.keys(state.extraStocks ?? {}).length > 0;
  return !state.ticker && !anyCard && !anyTc && !anyCustom;
}

/** elite.flow_runs 的列表用摘要（不含 state）。 */
export type RunSummary = { id: string; title: string; updated_at: string };
