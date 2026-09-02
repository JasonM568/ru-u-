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
import { GROUPS, groupById } from "./segments";
import type { CustomSplit, FlowState } from "./state";

export const SPLIT_CONFIG_VERSION = 1;

export type SplitConfig = {
  v: 1;
  group: string;
  groupName: string;
  custom: CustomSplit | null;
  originalOnly: boolean;
  offSubs: Record<string, boolean>;
  offStocks: Record<string, boolean>;
  /** 全隊須一致的 CCC 合計規則；舊格式沒有這欄，套用時不動 */
  ccMode?: CcMode;
};

export function buildSplitConfig(state: FlowState): SplitConfig {
  const group = groupById(state.groupId);
  return {
    v: SPLIT_CONFIG_VERSION,
    group: group.id,
    groupName: group.name,
    custom: state.custom[group.id] ?? null,
    originalOnly: state.originalOnly,
    offSubs: state.offSubs,
    offStocks: state.offStocks,
    ccMode: state.tc.ccMode,
  };
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

/** 不合法回 null。合法的定義：v=1、group 是已知比較群組、其餘欄位型別正確。 */
export function sanitizeSplitConfig(input: unknown): SplitConfig | null {
  if (!input || typeof input !== "object") return null;
  const o = input as Record<string, unknown>;
  if (o.v !== SPLIT_CONFIG_VERSION) return null;
  if (typeof o.group !== "string" || !GROUPS.some((g) => g.id === o.group)) return null;
  const group = groupById(o.group);
  const cfg: SplitConfig = {
    v: 1,
    group: group.id,
    groupName: group.name,
    custom: sanitizeCustom(o.custom),
    originalOnly: o.originalOnly === true,
    offSubs: boolMap(o.offSubs),
    offStocks: boolMap(o.offStocks),
  };
  if (o.ccMode === "max" || o.ccMode === "sum") cfg.ccMode = o.ccMode;
  return cfg;
}

/** 套進 draft（給 update() 用）。 */
export function applySplitConfig(draft: FlowState, cfg: SplitConfig): void {
  draft.groupId = cfg.group;
  if (cfg.custom) draft.custom[cfg.group] = cfg.custom;
  else delete draft.custom[cfg.group];
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
