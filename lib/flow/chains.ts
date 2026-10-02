/**
 * 自訂產業鏈（階段六）：讓學員把同一套五層作業流套到任何台股。
 *
 * 一條自訂鏈 = 一個比較群組（出現在下拉選單）＋ 自己命名的子段 ＋ 每個子段手打的個股。
 * - 個股一律「段位未定」、門檻空白：先驗判斷是老師的，不代填；門檻沒有教材表，不編。
 * - id 以 `c_` 開頭，永遠不會和教材群組（pwr/sub/int/fab/srv/pas）相撞。
 * - 定義住在 FlowState（跟著作業存檔），也可以走 SplitConfig v2 匯出／匯入／講師下發。
 *
 * 純函式，server／client 共用；所有進資料庫的鏈都經 sanitizeCustomChain。
 */

import { GROUPS } from "./segments";

export const CHAIN_ID_PREFIX = "c_";

export const CHAIN_LIMITS = {
  chainsPerState: 10,
  name: 40,
  chain: 60,
  l2note: 300,
  wacc: 20,
  subs: 12,
  subName: 40,
  stocksPerSub: 40,
  stocksPerChain: 200,
  stockName: 30,
  extraPerSegment: 40,
} as const;

/** 台股代號：4～6 碼數字，可帶一個英文字母（ETF／權證類如 00631L）。 */
export const STOCK_CODE_RE = /^\d{4,6}[A-Z]?$/;
export const CHAIN_ID_RE = /^c_[a-z0-9]{4,12}$/;

export type CustomChainStock = { code: string; name: string };
export type CustomChainSub = { id: string; name: string; stocks: CustomChainStock[] };
export type CustomChain = {
  id: string;
  /** 比較群組名（下拉選單、存檔標題、講師端顯示），例：航運 */
  name: string;
  /** L0 第 ④ 項的產業鏈名稱，例：航運供應鏈；空白時用 name */
  chain: string;
  subs: CustomChainSub[];
  /** L2 指令的產業註記（選填，原樣代入） */
  l2note?: string;
  /** 選這條鏈時帶進參考 WACC（選填） */
  wacc?: string;
};

export const isCustomChainId = (id: string): boolean => id.startsWith(CHAIN_ID_PREFIX);

export const newChainId = (): string => `${CHAIN_ID_PREFIX}${Math.random().toString(36).slice(2, 8)}`;
export const newChainSubId = (): string => `k${Math.random().toString(36).slice(2, 7)}`;

export function blankChain(id: string = newChainId()): CustomChain {
  return {
    id,
    name: "新產業鏈",
    chain: "",
    subs: [{ id: newChainSubId(), name: "子段 1", stocks: [] }],
  };
}

/** 去頭尾空白、全形數字轉半形、英文轉大寫。 */
export function normalizeCode(v: string): string {
  return v
    .trim()
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xff10 + 0x30))
    .toUpperCase();
}

const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/**
 * 收斂一串個股：代號必須符合格式、同一串內去重（留第一個）、名稱截到上限。
 * `seen` 可跨子段共用，讓一條鏈裡同一檔不會出現在兩個子段。
 */
export function sanitizeStockList(v: unknown, max: number, seen: Set<string> = new Set()): CustomChainStock[] {
  const out: CustomChainStock[] = [];
  if (!Array.isArray(v)) return out;
  for (const item of v) {
    if (out.length >= max) break;
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const code = normalizeCode(typeof o.code === "string" ? o.code : "");
    if (!STOCK_CODE_RE.test(code) || seen.has(code)) continue;
    seen.add(code);
    out.push({ code, name: str(o.name, CHAIN_LIMITS.stockName) });
  }
  return out;
}

/** 不合法回 null。合法：id 格式對、有名稱、至少一個有名字的子段。 */
export function sanitizeCustomChain(v: unknown): CustomChain | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (typeof o.id !== "string" || !CHAIN_ID_RE.test(o.id)) return null;
  const name = str(o.name, CHAIN_LIMITS.name);
  if (!name) return null;

  const subs: CustomChainSub[] = [];
  const ids = new Set<string>();
  const seen = new Set<string>();
  let total = 0;
  if (Array.isArray(o.subs)) {
    for (const s of o.subs) {
      if (subs.length >= CHAIN_LIMITS.subs) break;
      if (!s || typeof s !== "object") continue;
      const so = s as Record<string, unknown>;
      const id = typeof so.id === "string" ? so.id.trim().slice(0, 40) : "";
      const subName = str(so.name, CHAIN_LIMITS.subName);
      if (!id || !subName || ids.has(id)) continue;
      ids.add(id);
      const room = Math.min(CHAIN_LIMITS.stocksPerSub, CHAIN_LIMITS.stocksPerChain - total);
      const stocks = room > 0 ? sanitizeStockList(so.stocks, room, seen) : [];
      total += stocks.length;
      subs.push({ id, name: subName, stocks });
    }
  }
  if (subs.length === 0) return null;

  const chain: CustomChain = { id: o.id, name, chain: str(o.chain, CHAIN_LIMITS.chain) || name, subs };
  const l2note = str(o.l2note, CHAIN_LIMITS.l2note);
  const wacc = str(o.wacc, CHAIN_LIMITS.wacc);
  if (l2note) chain.l2note = l2note;
  if (wacc) chain.wacc = wacc;
  return chain;
}

export const chainStockCount = (c: CustomChain): number => c.subs.reduce((n, s) => n + s.stocks.length, 0);

/**
 * 群組顯示名：教材群組 → 名稱；自訂鏈 → 鏈名（找不到定義就「自訂產業鏈」）；其他 → null。
 * 永遠不會像 groupById 那樣回退成電源供應。
 */
export function groupLabel(groupId: string | null | undefined, chains?: Record<string, CustomChain>): string | null {
  if (!groupId) return null;
  const g = GROUPS.find((x) => x.id === groupId);
  if (g) return g.name;
  if (isCustomChainId(groupId)) return chains?.[groupId]?.name ?? "自訂產業鏈";
  return null;
}
