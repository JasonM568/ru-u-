/**
 * 五層作業流控制台的純邏輯測試。
 * 跑法：npx tsx scripts/test-flow.ts
 *
 * 涵蓋：CCC 兩種合計規則與 33% 硬閘門、分段結構（教材原分段／自訂分段／
 * 只用教材原表）、指令變數代入、證偽條件完成度提示。
 */

import { computeCcc, toNum } from "../lib/flow/ccc";
import { cardIsEmpty, cardToRow, rowToCard, sanitizeCard, type ThesisCardRow } from "../lib/flow/cloud";
import { reconcile, reconcileFromStrings, sanitizeChecks } from "../lib/flow/reconcile";
import { applySplitConfig, buildSplitConfig, sanitizeSplitConfig } from "../lib/flow/config";
import { SEGMENTS, GROUPS } from "../lib/flow/segments";
import * as P from "../lib/flow/prompts";
import {
  activeSubs,
  blankState,
  falsifierStatus,
  layout,
  rosterText,
  seedCustomSplit,
  seedStock,
  stockCount,
  subNames,
  type FlowState,
} from "../lib/flow/state";

type Case = { name: string; run: () => boolean; detail?: () => string };

const cases: Case[] = [];
const add = (name: string, run: () => boolean, detail?: () => string) =>
  cases.push({ name, run, detail });

/* ---------- CCC ---------- */
// 教材範例：現價 100、L3 確認價 105、L4 確認價 108、預期報酬 35%
const ex = { px: 100, p3: 105, p4: 108, expectedReturn: 0.35 };

add("CCC 取較高者：教材範例 → 5.0% / 8.0% / 8.0% / 22.9% / 通過", () => {
  const c = computeCcc({ ...ex, mode: "max" });
  return (
    near(c.l3, 0.05) && near(c.l4, 0.08) && near(c.total, 0.08) && near(c.ratio, 0.2286) && c.pass === true
  );
});

add("CCC 相加：同一組數字 → 13.0% / 37.1% / 本案不成立", () => {
  const c = computeCcc({ ...ex, mode: "sum" });
  return near(c.total, 0.13) && near(c.ratio, 0.3714) && c.pass === false;
});

add("CCC 預期報酬砍到 15% → 取較高者也過不了", () => {
  const c = computeCcc({ ...ex, expectedReturn: 0.15, mode: "max" });
  return c.pass === false;
});

add("CCC 資料不足 → pass 為 null（待填，不是不成立）", () => {
  const c = computeCcc({ px: 100, p3: null, p4: null, expectedReturn: null, mode: "max" });
  return c.pass === null && c.total === null;
});

add("CCC 現價為 0 或空 → 不會算出 Infinity", () => {
  const c = computeCcc({ px: 0, p3: 105, p4: 108, expectedReturn: 0.35, mode: "max" });
  return c.l3 === null && c.l4 === null;
});

add("toNum 擋掉非數字", () => toNum("abc") === null && toNum("") === null && toNum("3.5") === 3.5);

/* ---------- 分段結構 ---------- */
add("教材原分段：電源供應 = 4 子段 13 檔", () => {
  const s = blankState();
  return activeSubs(s).length === 4 && stockCount(s) === 13;
});

add("伺服器結構與散熱含補充個股 = 20 檔；只用教材原表 = 15 檔", () => {
  const s: FlowState = { ...blankState(), groupId: "srv" };
  const withAdded = stockCount(s);
  const originalOnly = stockCount({ ...s, originalOnly: true });
  return withAdded === 20 && originalOnly === 15;
});

add("補充個股一律標「未定」，且不覆蓋教材原表的段位", () => {
  let addedAllUndecided = true;
  let originalUntouched = true;
  for (const seg of Object.values(SEGMENTS)) {
    for (const st of seg.stocks) {
      if (st.added && st.prior !== "未定") addedAllUndecided = false;
      if (!st.added && st.prior === "未定") originalUntouched = false;
    }
  }
  return addedAllUndecided && originalUntouched;
});

// 一覽表說的「74 檔」是不重複代號數；實際有 77 列，因為台積電、群聯、
// 臻鼎-KY 各被刻意放進兩個分類（它們同時屬於兩段）。補充個股 16 檔。
add("教材原表 = 74 個不重複代號／77 列，補充 16 檔", () => {
  const orig = new Set<string>();
  const added = new Set<string>();
  let rows = 0;
  for (const seg of Object.values(SEGMENTS)) {
    for (const st of seg.stocks) {
      if (st.added) added.add(st.code);
      else {
        orig.add(st.code);
        rows++;
      }
    }
  }
  return orig.size === 74 && rows === 77 && added.size === 16;
});

add("跨段重複的就是那三檔，沒有多也沒有少", () => {
  const seen = new Map<string, string[]>();
  for (const seg of Object.values(SEGMENTS)) {
    for (const st of seg.stocks) {
      seen.set(st.code, [...(seen.get(st.code) ?? []), seg.short]);
    }
  }
  const dups = [...seen].filter(([, v]) => v.length > 1).map(([k]) => k).sort();
  return dups.join(",") === "2330,4958,8299";
});

add("每個比較群組的子段都存在於 SEGMENTS，沒有拼錯的鍵", () =>
  GROUPS.every((g) => g.subs.every((k) => !!SEGMENTS[k])));

add("16 個分類全部被某個比較群組涵蓋，沒有孤兒", () => {
  const covered = new Set(GROUPS.flatMap((g) => g.subs));
  return Object.keys(SEGMENTS).every((k) => covered.has(k));
});

add("自訂分段：把高力與廣運拆進新子段，指令名單跟著變", () => {
  const s: FlowState = { ...blankState(), groupId: "srv" };
  s.custom["srv"] = seedCustomSplit(s);
  const custom = s.custom["srv"];
  const newId = "liquid";
  custom.subs.push({ id: newId, name: "液冷與 CDU" });
  custom.assign["散熱|8996"] = newId;
  custom.assign["散熱|6125"] = newId;

  const names = subNames(s);
  const roster = rosterText(s);
  return (
    names.includes("液冷與 CDU") &&
    roster.includes("液冷與 CDU：8996 高力、6125 廣運") &&
    !roster.split("\n").find((l) => l.startsWith("散熱："))?.includes("8996")
  );
});

add("自訂子段跨原分類時，沒有單一門檻可沿用（thresholds = null）", () => {
  const s: FlowState = { ...blankState(), groupId: "srv" };
  s.custom["srv"] = seedCustomSplit(s);
  const mixId = "mix";
  s.custom["srv"].subs.push({ id: mixId, name: "混合段" });
  s.custom["srv"].assign["散熱|8996"] = mixId;
  s.custom["srv"].assign["機殼與導軌|2059"] = mixId;
  const mixed = layout(s).find((l) => l.id === mixId);
  return !!mixed && mixed.thresholds === null && mixed.origins.length === 2;
});

add("自訂子段來源單一時，沿用該分類的門檻", () => {
  const s: FlowState = { ...blankState(), groupId: "srv" };
  s.custom["srv"] = seedCustomSplit(s);
  const id = "liquid";
  s.custom["srv"].subs.push({ id, name: "液冷" });
  s.custom["srv"].assign["散熱|8996"] = id;
  const sub = layout(s).find((l) => l.id === id);
  return !!sub && sub.thresholds === SEGMENTS["散熱"].th;
});

add("取消勾選的個股不會出現在指令名單裡", () => {
  const s = blankState();
  const sub = layout(s)[0];
  const target = sub.stocks[0];
  s.offStocks[`${sub.key}|${target.origin}|${target.code}`] = true;
  return !rosterText(s).includes(`${target.code} ${target.name}`) && stockCount(s) === 12;
});

add("代號查得到就帶出候選標的；查不到回 null", () => {
  const hit: FlowState = { ...blankState(), ticker: "1519" };
  const miss: FlowState = { ...blankState(), ticker: "2603" };
  return seedStock(hit)?.name === "華城" && seedStock(miss) === null;
});

add("只用教材原表時，補充個股查不到（3483 力致）", () => {
  const s: FlowState = { ...blankState(), groupId: "srv", ticker: "3483" };
  return seedStock(s)?.name === "力致" && seedStock({ ...s, originalOnly: true }) === null;
});

/* ---------- 指令代入 ---------- */
function ctxOf(s: FlowState): P.PromptContext {
  const g = GROUPS.find((x) => x.id === s.groupId)!;
  const seed = seedStock(s);
  return {
    chain: g.chain,
    roster: rosterText(s),
    count: stockCount(s),
    subNames: subNames(s),
    l2note: g.l2note,
    wacc: s.wacc,
    target: seed ? `${seed.code} ${seed.name}` : "（尚未指定標的）",
    cards: s.cards,
    ccMode: s.tc.ccMode,
  };
}

add("L0 指令帶入產業鏈名稱", () => P.l0(ctxOf(blankState())).includes("「AI 電源供應鏈」"));

add("L1 前置帶入完整名單與檔數", () => {
  const t = P.l1Pre(ctxOf(blankState()));
  return t.includes("以下 13 檔") && t.includes("重電：1519 華城、1503 士電、1514 亞力");
});

add("L1 的 SLT 分級行依子段動態產生", () =>
  P.l1(ctxOf(blankState())).includes("SLT 分級：伺服器電源與機櫃 __ BBU __ 重電 __ 電源核心零組件 __"));

add("L2 帶入子段清單與該群組的產業註記", () => {
  const t = P.l2(ctxOf(blankState()));
  return t.includes("彙總到子段：伺服器電源與機櫃／BBU／重電／電源核心零組件") && t.includes("重電屬工程業");
});

add("交棒卡未填時，指令留下明顯佔位符", () =>
  P.l1(ctxOf(blankState())).includes("〔尚未貼入 L0 交棒卡〕"));

add("交棒卡填了就帶進下游指令", () => {
  const s = blankState();
  s.cards.L0 = "【L0 交棒卡】環境判定：risk-on 分數 62/100";
  const t = P.l1(ctxOf(s));
  return t.includes("分數 62/100") && !t.includes("〔尚未貼入 L0 交棒卡〕");
});

add("論點卡起草指令反映目前的合計規則", () => {
  const s = blankState();
  const maxText = P.thesisDraft(ctxOf(s));
  s.tc.ccMode = "sum";
  const sumText = P.thesisDraft(ctxOf(s));
  return maxText.includes("「取較高者」") && sumText.includes("「相加」");
});

add("論點卡起草指令明寫「第七欄我自己寫」", () =>
  P.thesisDraft(ctxOf(blankState())).includes("我可能錯在哪」我自己寫，你不要幫我寫"));

/* ---------- 證偽條件完成度 ---------- */
add("三條沒寫完 → bad", () => falsifierStatus(blankState().tc).tone === "bad");

add("三條都寫但層次重複 → warn", () => {
  const tc = blankState().tc;
  tc.falsifiers.forEach((f, i) => {
    f.t = `條件 ${i + 1}`;
    f.when = "2026/11 財報";
    f.lvl = "公司自身";
  });
  return falsifierStatus(tc).tone === "warn";
});

add("三條齊全且三個層次 → ok", () => {
  const tc = blankState().tc;
  tc.falsifiers.forEach((f, i) => {
    f.t = `條件 ${i + 1}`;
    f.when = "2026/11 財報";
  });
  return falsifierStatus(tc).tone === "ok";
});

add("只寫內容沒寫檢查時點 → 仍算沒寫完", () => {
  const tc = blankState().tc;
  tc.falsifiers.forEach((f, i) => {
    f.t = `條件 ${i + 1}`;
  });
  return falsifierStatus(tc).tone === "bad";
});

/* ---------- runner ---------- */
function near(a: number | null, b: number, eps = 0.001): boolean {
  return a !== null && Math.abs(a - b) < eps;
}

// ── 階段二：論點卡上雲的序列化與 server 端重算 ──
add("sanitizeCard：亂七八糟的輸入會收斂成合法卡，多餘欄位丟掉", () => {
  const tc = sanitizeCard({ code: " 1519 ", name: "華城", ccMode: "bogus", falsifiers: [{ t: "x", lvl: "亂填" }], evil: 1 });
  return (
    tc.code === "1519" && tc.name === "華城" && tc.ccMode === "max" &&
    tc.evidence.length === 3 && tc.falsifiers.length === 3 &&
    tc.falsifiers[0].t === "x" && tc.falsifiers[0].lvl === "公司自身" &&
    !("evil" in tc) && tc.id === undefined
  );
});
add("cardToRow：cc_* 由 server 重算，不信前端（教材範例 100/105/108/0.35 → 22.9% 通過）", () => {
  const tc = sanitizeCard({ code: "1519", px: "100", p3: "105", p4: "108", expectedReturn: "0.35", ccMode: "max" });
  const row = cardToRow(tc, { userId: "u1", groupId: "pwr" });
  return (
    Math.abs((row.cc_l3 ?? 0) - 0.05) < 1e-9 && Math.abs((row.cc_l4 ?? 0) - 0.08) < 1e-9 &&
    Math.abs((row.cc_total ?? 0) - 0.08) < 1e-9 && Math.abs((row.cc_ratio ?? 0) - 0.08 / 0.35) < 1e-9 &&
    row.cc_pass === true && row.user_id === "u1" && row.group_id === "pwr"
  );
});
add("cardToRow：預期報酬 0.15 → 53.3% 本案不成立", () => {
  const row = cardToRow(sanitizeCard({ code: "1519", px: "100", p3: "105", p4: "108", expectedReturn: "0.15" }), { userId: "u1" });
  return row.cc_pass === false && Math.abs((row.cc_ratio ?? 0) - 0.08 / 0.15) < 1e-9;
});
add("rowToCard ∘ cardToRow：來回不掉欄位", () => {
  const src = sanitizeCard({ code: "1519", name: "華城", sub: "重電", cls: "瓶頸段", date: "2026/09/02", thesis: "T", bomb: "B",
    evidence: [{ t: "e1", src: "s", per: "2026Q2" }, { t: "e2", src: "", per: "" }, { t: "", src: "", per: "" }],
    falsifiers: [{ t: "f1", when: "2026/11", lvl: "供給端" }, { t: "", when: "", lvl: "需求端" }, { t: "", when: "", lvl: "公司自身" }],
    px: "100", p3: "105", p4: "108", expectedReturn: "0.35", ccMode: "sum", positionForm: "分批", bandLow: "98", bandHigh: "102",
    tr1: "a", tr2: "b", tr3: "c", positionCap: "10%", crsUp1: "減半", crsUp2: "清倉", weakness: "W" });
  const row = cardToRow(src, { userId: "u1" });
  const back = rowToCard({ ...row, id: "id-1", created_at: "", updated_at: "" } as ThesisCardRow);
  const { id, ...rest } = back;
  return id === "id-1" && JSON.stringify(rest) === JSON.stringify(src);
});
add("cardIsEmpty：空卡不准存；有代號就算有內容", () => cardIsEmpty(sanitizeCard({})) && !cardIsEmpty(sanitizeCard({ code: "1519" })));

let pass = 0;
// ── 階段三：T+20 對帳四象限（server 端重算） ──
const F = (a: boolean | null, b: boolean | null, c: boolean | null) =>
  [a, b, c].map((t) => ({ triggered: t, note: "" }));
add("對帳：未觸發＋賺 ＝ 論點成立", () => reconcile({ checks: F(false, false, false), executed: null, entryPx: 100, checkPx: 110 }).outcome === "thesis_holds");
add("對帳：未觸發＋賠 ＝ 證偽條件設計失敗", () => reconcile({ checks: F(false, false, false), executed: null, entryPx: 100, checkPx: 95 }).outcome === "falsifier_design_failed");
add("對帳：觸發＋執行 ＝ 紀律及格（賺賠不影響）", () => {
  const r1 = reconcile({ checks: F(true, false, false), executed: true, entryPx: 100, checkPx: 80 });
  const r2 = reconcile({ checks: F(false, false, true), executed: true, entryPx: 100, checkPx: 120 });
  return r1.outcome === "discipline_ok" && r2.outcome === "discipline_ok";
});
add("對帳：觸發＋未執行 ＝ 紀律失誤", () => reconcile({ checks: F(false, true, false), executed: false, entryPx: null, checkPx: null }).outcome === "discipline_failed");
add("對帳：有條件未判定且沒有任何一條觸發 → 資料不足", () => {
  const r = reconcile({ checks: F(false, null, false), executed: null, entryPx: 100, checkPx: 110 });
  return r.outcome === null && r.anyTriggered === null && !!r.missing;
});
add("對帳：只要有一條觸發，其他未判定也算觸發", () => reconcile({ checks: F(null, true, null), executed: true, entryPx: null, checkPx: null }).anyTriggered === true);
add("對帳：觸發但沒填有沒有執行 → 待填", () => reconcile({ checks: F(true, false, false), executed: null, entryPx: 100, checkPx: 90 }).outcome === null);
add("對帳：未觸發但沒填價格 → 待填，pnl 為 null", () => { const r = reconcile({ checks: F(false, false, false), executed: null, entryPx: 100, checkPx: null }); return r.outcome === null && r.pnl === null; });
add("對帳：pnl 用 (對帳價−進場價)/進場價；進場價 0 → null", () => Math.abs((reconcile({ checks: F(false, false, false), executed: null, entryPx: 80, checkPx: 100 }).pnl ?? 0) - 0.25) < 1e-9 && reconcile({ checks: F(false, false, false), executed: null, entryPx: 0, checkPx: 100 }).pnl === null);
add("sanitizeChecks：非布林一律 null、固定三筆、note 收字串", () => { const c = sanitizeChecks([{ triggered: "yes", note: 5 }, { triggered: true }]); return c.length === 3 && c[0].triggered === null && c[0].note === "" && c[1].triggered === true && c[2].triggered === null; });
add("reconcileFromStrings：UI 字串入口與數字入口一致", () => reconcileFromStrings({ checks: F(false, false, false), executed: null, entryPx: "100", checkPx: " 110 " }).outcome === "thesis_holds");

// ── 階段四：講師下發分段設定（匯出／匯入／下發共用格式） ──
add("分段設定：未知群組或版本不對 → null", () => sanitizeSplitConfig({ v: 1, group: "nope" }) === null && sanitizeSplitConfig({ v: 2, group: "pwr" }) === null && sanitizeSplitConfig("x") === null);
add("分段設定：build → sanitize → apply 來回一致（含自訂子段與 ccMode）", () => {
  const st = blankState();
  st.groupId = "pwr";
  st.custom.pwr = seedCustomSplit(st);
  const newId = "s_test1";
  st.custom.pwr.subs.push({ id: newId, name: "新子段" });
  const firstKey = Object.keys(st.custom.pwr.assign)[0];
  st.custom.pwr.assign[firstKey] = newId;
  st.offStocks["pwr|2303"] = true;
  st.tc.ccMode = "sum";
  const cfg = sanitizeSplitConfig(JSON.parse(JSON.stringify(buildSplitConfig(st))));
  if (!cfg) return false;
  const fresh = blankState();
  applySplitConfig(fresh, cfg);
  return (
    fresh.groupId === "pwr" && fresh.custom.pwr?.subs.some((s) => s.id === newId) &&
    fresh.custom.pwr?.assign[firstKey] === newId && fresh.offStocks["pwr|2303"] === true &&
    fresh.tc.ccMode === "sum" && fresh.editSplit === false
  );
});
add("分段設定：assign 指向不存在的子段會被丟掉、offSubs 只收 true", () => {
  const cfg = sanitizeSplitConfig({ v: 1, group: "pwr", custom: { subs: [{ id: "a", name: "A" }], assign: { "k1": "a", "k2": "ghost" } }, offSubs: { x: true, y: false, z: "yes" } });
  return !!cfg && cfg.custom?.assign.k1 === "a" && !("k2" in (cfg.custom?.assign ?? {})) && cfg.offSubs.x === true && !("y" in cfg.offSubs) && !("z" in cfg.offSubs);
});
add("分段設定：沒有 ccMode 的舊格式套用時不動 ccMode", () => { const fresh = blankState(); fresh.tc.ccMode = "sum"; const cfg = sanitizeSplitConfig({ v: 1, group: "pwr" }); if (!cfg) return false; applySplitConfig(fresh, cfg); return fresh.tc.ccMode === "sum" && fresh.custom.pwr === undefined; });

for (const c of cases) {
  let ok = false;
  let err = "";
  try {
    ok = c.run();
  } catch (e) {
    err = e instanceof Error ? e.message : String(e);
  }
  if (ok) pass++;
  const extra = c.detail && !ok ? `  ${c.detail()}` : "";
  console.log(`${ok ? "✓" : "✗"} ${c.name}${err ? `\n   ERROR: ${err}` : ""}${extra}`);
}
console.log(`\n${pass}/${cases.length} passed`);
if (pass !== cases.length) process.exit(1);
