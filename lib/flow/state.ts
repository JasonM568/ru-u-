/**
 * 控制台狀態與分段結構的純邏輯。
 * 抽出來的目的：讓「哪些個股在哪個子段」這件事前後端算法一致，元件只負責畫面。
 */

import { GROUPS, SEGMENTS, groupById, type Group, type Prior, type Stock } from "./segments";
import type { CardId } from "./prompts";
import type { CcMode } from "./ccc";

export type Evidence = { t: string; src: string; per: string };
export type Falsifier = { t: string; when: string; lvl: FalsifierLevel };
export const FALSIFIER_LEVELS = ["公司自身", "供給端", "需求端"] as const;
export type FalsifierLevel = (typeof FALSIFIER_LEVELS)[number];

export type ThesisCard = {
  /** 已存進資料庫的話會有 id（階段二用） */
  id?: string;
  code: string;
  name: string;
  sub: string;
  cls: string;
  date: string;
  thesis: string;
  evidence: [Evidence, Evidence, Evidence];
  falsifiers: [Falsifier, Falsifier, Falsifier];
  bomb: string;
  px: string;
  p3: string;
  p4: string;
  expectedReturn: string;
  ccMode: CcMode;
  positionForm: string;
  bandLow: string;
  bandHigh: string;
  tr1: string;
  tr2: string;
  tr3: string;
  positionCap: string;
  crsUp1: string;
  crsUp2: string;
  weakness: string;
};

/** 自訂分段：使用者把個股重新分配到自己命名的子段。 */
export type CustomSplit = {
  subs: { id: string; name: string }[];
  /** key = `${原分類}|${代號}`，value = 子段 id */
  assign: Record<string, string>;
};

export type FlowState = {
  ticker: string;
  groupId: string;
  asOf: string;
  wacc: string;
  /** true = 只用教材原表 74 檔，排除 Claude 補充的個股 */
  originalOnly: boolean;
  custom: Record<string, CustomSplit>;
  editSplit: boolean;
  offSubs: Record<string, boolean>;
  offStocks: Record<string, boolean>;
  cards: Record<CardId, string>;
  checks: Record<string, boolean>;
  gates: Record<string, string>;
  open: Record<string, boolean>;
  tc: ThesisCard;
};

const blankEvidence = (): Evidence => ({ t: "", src: "", per: "" });
const blankFalsifier = (lvl: FalsifierLevel): Falsifier => ({ t: "", when: "", lvl });

export function blankThesisCard(): ThesisCard {
  return {
    code: "",
    name: "",
    sub: "",
    cls: "",
    date: "",
    thesis: "",
    evidence: [blankEvidence(), blankEvidence(), blankEvidence()],
    falsifiers: [
      blankFalsifier("公司自身"),
      blankFalsifier("供給端"),
      blankFalsifier("需求端"),
    ],
    bomb: "",
    px: "",
    p3: "",
    p4: "",
    expectedReturn: "",
    ccMode: "max",
    positionForm: "",
    bandLow: "",
    bandHigh: "",
    tr1: "",
    tr2: "",
    tr3: "",
    positionCap: "",
    crsUp1: "",
    crsUp2: "",
    weakness: "",
  };
}

export function blankState(): FlowState {
  return {
    ticker: "",
    groupId: "pwr",
    asOf: "",
    wacc: "8",
    originalOnly: false,
    custom: {},
    editSplit: false,
    offSubs: {},
    offStocks: {},
    cards: { L0: "", L1: "", L2: "", XS: "", L3: "", L4: "" },
    checks: {},
    gates: {},
    open: {},
    tc: blankThesisCard(),
  };
}

/** 掃描名單裡的一檔，帶著它的原分類出處。 */
export type LaidOutStock = {
  code: string;
  name: string;
  prior: Prior;
  added: boolean;
  /** 原本屬於哪個教材分類 */
  origin: string;
};

export type LaidOutSub = {
  /** 唯一鍵，用於 offSubs */
  key: string;
  /** 自訂子段才有 */
  id?: string;
  name: string;
  stocks: LaidOutStock[];
  /** 這個子段的個股來自哪幾個原分類 */
  origins: string[];
  /** 單一來源才有門檻可沿用；跨分類為 null */
  thresholds: (typeof SEGMENTS)[string]["th"] | null;
  /** 自訂分段下沒被分配到的個股 */
  unassigned?: boolean;
};

const visible = (state: FlowState, s: Stock) => !(state.originalOnly && s.added);

function toLaidOut(s: Stock, origin: string): LaidOutStock {
  return { code: s.code, name: s.name, prior: s.prior, added: !!s.added, origin };
}

/** 目前群組的分段結構：沒有自訂就用教材原分段。 */
export function layout(state: FlowState): LaidOutSub[] {
  const group = groupById(state.groupId);
  const custom = state.custom[group.id];

  if (!custom) {
    return group.subs.map((key) => {
      const seg = SEGMENTS[key];
      const stocks = seg.stocks.filter((s) => visible(state, s)).map((s) => toLaidOut(s, key));
      return {
        key: `o:${key}`,
        name: seg.short,
        stocks,
        origins: [key],
        thresholds: seg.th,
      };
    });
  }

  const out: LaidOutSub[] = custom.subs.map((cs) => ({
    key: `c:${cs.id}`,
    id: cs.id,
    name: cs.name,
    stocks: [],
    origins: [],
    thresholds: null,
  }));
  const byId = new Map(out.map((o) => [o.id!, o]));
  const unassigned: LaidOutStock[] = [];

  for (const key of group.subs) {
    for (const s of SEGMENTS[key].stocks) {
      if (!visible(state, s)) continue;
      const target = custom.assign[`${key}|${s.code}`];
      const bucket = target ? byId.get(target) : undefined;
      if (bucket) bucket.stocks.push(toLaidOut(s, key));
      else unassigned.push(toLaidOut(s, key));
    }
  }

  if (unassigned.length) {
    out.push({
      key: "c:__unassigned",
      id: "__unassigned",
      name: "未分配",
      stocks: unassigned,
      origins: [],
      thresholds: null,
      unassigned: true,
    });
  }

  for (const o of out) {
    o.origins = [...new Set(o.stocks.map((s) => s.origin))];
    o.thresholds = o.origins.length === 1 ? SEGMENTS[o.origins[0]].th : null;
  }
  return out;
}

export const stockKey = (sub: LaidOutSub, s: LaidOutStock) =>
  `${sub.key}|${s.origin}|${s.code}`;

export const activeSubs = (state: FlowState): LaidOutSub[] =>
  layout(state).filter((l) => !state.offSubs[l.key] && !l.unassigned);

export const activeStocks = (state: FlowState, sub: LaidOutSub): LaidOutStock[] =>
  sub.stocks.filter((s) => !state.offStocks[stockKey(sub, s)]);

export function rosterText(state: FlowState): string {
  return activeSubs(state)
    .map((sub) => {
      const list = activeStocks(state, sub)
        .map((s) => `${s.code} ${s.name}`)
        .join("、");
      return `${sub.name}：${list || "（本子段已全部取消勾選）"}`;
    })
    .join("\n");
}

export const stockCount = (state: FlowState): number =>
  activeSubs(state).reduce((n, sub) => n + activeStocks(state, sub).length, 0);

export const subNames = (state: FlowState): string[] =>
  activeSubs(state).map((s) => s.name);

/** 目前群組裡 Claude 補充個股的總數（0 就不顯示出處說明）。 */
export const addedCount = (state: FlowState): number =>
  groupById(state.groupId).subs.reduce(
    (n, key) => n + SEGMENTS[key].stocks.filter((s) => s.added).length,
    0,
  );

/** 依代號找出目前群組裡的 L3 候選標的。 */
export function seedStock(state: FlowState): LaidOutStock | null {
  if (!state.ticker) return null;
  for (const sub of layout(state)) {
    const hit = sub.stocks.find((s) => s.code === state.ticker);
    if (hit) return hit;
  }
  return null;
}

/** 代號在別的群組時，回報它在哪幾段。 */
export function locateTicker(
  state: FlowState,
  code: string,
): { segment: string; short: string; group?: Group }[] {
  const out: { segment: string; short: string; group?: Group }[] = [];
  for (const seg of Object.values(SEGMENTS)) {
    const hit = seg.stocks.find((s) => s.code === code && visible(state, s));
    if (hit) {
      out.push({
        segment: seg.key,
        short: seg.short,
        group: GROUPS.find((g) => g.subs.includes(seg.key)),
      });
    }
  }
  return out;
}

export const newSubId = () => `s${Math.random().toString(36).slice(2, 7)}`;

/** 把教材原分段複製成自訂分段的起點。 */
export function seedCustomSplit(state: FlowState): CustomSplit {
  const group = groupById(state.groupId);
  const subs: CustomSplit["subs"] = [];
  const assign: CustomSplit["assign"] = {};
  for (const key of group.subs) {
    const id = newSubId();
    subs.push({ id, name: SEGMENTS[key].short });
    for (const s of SEGMENTS[key].stocks) assign[`${key}|${s.code}`] = id;
  }
  return { subs, assign };
}

/** 論點卡三個證偽條件的完成度提示。 */
export function falsifierStatus(tc: ThesisCard): {
  tone: "bad" | "warn" | "ok";
  message: string;
} {
  const filled = tc.falsifiers.filter((f) => f.t.trim() && f.when.trim()).length;
  if (filled < 3) {
    return {
      tone: "bad",
      message: `還有 ${3 - filled} 條沒寫完（條件內容與檢查時點都要有）。沒有時點的條件永遠不會被觸發，你永遠可以說「再等等」。`,
    };
  }
  const levels = new Set(tc.falsifiers.filter((f) => f.t.trim()).map((f) => f.lvl));
  if (levels.size < 3) {
    return {
      tone: "warn",
      message: `三條都寫了，但只涵蓋 ${levels.size} 個層次。全部押在同一層，你會漏掉整段租金消散的訊號。`,
    };
  }
  return { tone: "ok", message: "三條齊全，且分別涵蓋公司自身／供給端／需求端。" };
}
