/**
 * 分段設定（純函式）：控制台「匯出／匯入分段設定」與講師下發共用同一個格式。
 *
 * - buildSplitConfig：從目前狀態產生設定（匯出、下發都用這個）
 * - sanitizeSplitConfig：把任意 JSON 收斂成合法設定，不合法回 null（匯入、server action 都用這個）
 * - applySplitConfig：把設定套進狀態（匯入、套用講師下發都用這個）
 *
 * 只搬「分段結構」：比較群組、自訂子段與分配、只用教材原表、關閉的子段與個股、CCC 合計規則。
 * 不碰交棒卡、論點卡、檢核勾選。
 */

import type { CcMode } from "./ccc";
import { CHAIN_LIMITS, isCustomChainId, sanitizeCustomChain, sanitizeStockList, type CustomChain, type CustomChainStock } from "./chains";
import { GROUPS, groupById } from "./segments";
import { resolveGroup, type CustomSplit, type FlowState } from "./state";

export const SPLIT_CONFIG_VERSION = 2;

export type SplitConfig = {
  /** v1：只有教材群組；v2：可帶自訂產業鏈（chain）與教材子段自建個股（extra）。讀取時兩者都收，輸出一律 v2。 */
  v: 1 | 2;
  /** 教材群組 id 或自訂鏈 id（c_ 開頭） */
  group: string;
  groupName: string;
  /** 自訂產業鏈一律 null */
  custom: CustomSplit | null;
  originalOnly: boolean;
  offSubs: Record<string, boolean>;
  offStocks: Record<string, boolean>;
  /** 全隊須一致的 CCC 合計規則；舊格式沒有這欄，套用時不動 */
  ccMode?: CcMode;
  /** v2：group 是自訂產業鏈時的完整定義（id 必等於 group） */
  chain?: CustomChain;
  /** v2：教材群組各分類的自建個股 */
  extra?: Record<string, CustomChainStock[]>;
};

export function buildSplitConfig(state: FlowState): SplitConfig {
  const rg = resolveGroup(state);
  const cfg: SplitConfig = {
    v: SPLIT_CONFIG_VERSION,
    group: rg.id,
    groupName: rg.name,
    custom: rg.kind === "ai" ? (state.custom[rg.id] ?? null) : null,
    originalOnly: state.originalOnly,
    offSubs: state.offSubs,
    offStocks: state.offStocks,
    ccMode: state.tc.ccMode,
  };
  if (rg.kind === "custom") cfg.chain = rg.custom;
  const extra = state.extraStocks?.[rg.id];
  if (rg.kind === "ai" && extra && Object.keys(extra).length) cfg.extra = extra;
  return cfg;
}

const boolMap = (v: unknown): Record<string, boolean> => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (val === true && k.length <= 100) out[k] = true;
  }
  return out;
};

function sanitizeCustom(v: unknown): CustomSplit | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!Array.isArray(o.subs)) return null;
  const subs: CustomSplit["subs"] = [];
  const ids = new Set<string>();
  for (const s of o.subs) {
    if (!s || typeof s !== "object") continue;
    const { id, name } = s as Record<string, unknown>;
    if (typeof id !== "string" || !id || typeof name !== "string") continue;
    if (ids.has(id)) continue;
    ids.add(id);
    subs.push({ id: id.slice(0, 40), name: name.slice(0, 60) });
  }
  if (subs.length === 0) return null;
  const assign: CustomSplit["assign"] = {};
  if (o.assign && typeof o.assign === "object" && !Array.isArray(o.assign)) {
    for (const [k, val] of Object.entries(o.assign as Record<string, unknown>)) {
      // 只接受指向存在子段的分配；指到不存在的子段等於沒分配，layout 會歸到「未分配」
      if (typeof val === "string" && ids.has(val) && k.length <= 100) assign[k] = val;
    }
  }
  return { subs, assign };
}

/**
 * 不合法回 null。合法：v 是 1 或 2；group 是教材群組，或是自訂鏈 id 且附上合法的 chain 定義（id 相同）。
 * 輸出一律 v2。
 */
export function sanitizeSplitConfig(input: unknown): SplitConfig | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (o.v !== 1 && o.v !== 2) return null;
  if (typeof o.group !== "string") return null;

  const common = {
    originalOnly: o.originalOnly === true,
    offSubs: boolMap(o.offSubs),
    offStocks: boolMap(o.offStocks),
  };
  const ccMode = o.ccMode === "max" || o.ccMode === "sum" ? o.ccMode : undefined;

  if (isCustomChainId(o.group)) {
    const chain = sanitizeCustomChain(o.chain);
    if (!chain || chain.id !== o.group) return null;
    const cfg: SplitConfig = { v: 2, group: chain.id, groupName: chain.name, custom: null, ...common, chain };
    if (ccMode) cfg.ccMode = ccMode;
    return cfg;
  }

  if (!GROUPS.some((g) => g.id === o.group)) return null;
  const group = groupById(o.group);
  const cfg: SplitConfig = {
    v: 2,
    group: group.id,
    groupName: group.name,
    custom: sanitizeCustom(o.custom),
    ...common,
  };
  if (ccMode) cfg.ccMode = ccMode;
  const extra = sanitizeExtra(o.extra, group.subs);
  if (extra) cfg.extra = extra;
  return cfg;
}

/** 教材群組各分類的自建個股：只收該群組的教材分類，每類上限 CHAIN_LIMITS.extraPerSegment。 */
export function sanitizeExtra(v: unknown, subKeys: string[]): Record<string, CustomChainStock[]> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, CustomChainStock[]> = {};
  const seen = new Set<string>();
  for (const key of subKeys) {
    const list = sanitizeStockList((v as Record<string, unknown>)[key], CHAIN_LIMITS.extraPerSegment, seen);
    if (list.length) out[key] = list;
  }
  return Object.keys(out).length ? out : null;
}

/** 套進 draft（給 update() 用）。套用自訂鏈＝以同 id 複製進 draft.chains（會覆蓋同 id 的本地版本）。 */
export function applySplitConfig(draft: FlowState, cfg: SplitConfig): void {
  draft.groupId = cfg.group;
  if (cfg.chain) {
    draft.chains[cfg.chain.id] = structuredClone(cfg.chain);
    if (cfg.chain.wacc) draft.wacc = cfg.chain.wacc;
  }
  if (cfg.custom) draft.custom[cfg.group] = cfg.custom;
  else delete draft.custom[cfg.group];
  if (cfg.extra && Object.keys(cfg.extra).length) draft.extraStocks[cfg.group] = structuredClone(cfg.extra);
  else delete draft.extraStocks[cfg.group];
  draft.originalOnly = cfg.originalOnly;
  draft.offSubs = { ...cfg.offSubs };
  draft.offStocks = { ...cfg.offStocks };
  draft.editSplit = false;
  if (cfg.ccMode) draft.tc.ccMode = cfg.ccMode;
}

/** elite.flow_configs 的一列（page.tsx 會再補 publisher 名字）。 */
export type FlowConfigRow = {
  id: string;
  group_id: string;
  title: string;
  note: string;
  payload: SplitConfig;
  published_by: string;
  created_at: string;
  updated_at: string;
};

export type PublishedConfig = FlowConfigRow & { publisher: string | null };
