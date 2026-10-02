"use client";

import { Field, Input, Textarea } from "@/components/ui";
import {
  CHAIN_LIMITS,
  STOCK_CODE_RE,
  blankChain,
  chainStockCount,
  newChainSubId,
  normalizeCode,
  type CustomChain,
  type CustomChainStock,
} from "@/lib/flow/chains";
import { pruneOffKeys, resolveGroup, type FlowState } from "@/lib/flow/state";

/**
 * 自訂產業鏈編輯器：命名、產業鏈名稱、WACC、L2 註記、子段、每個子段手打個股。
 * 所有改動都走 update() 進 FlowState，自動存檔／匯出／下發沿用。
 * 個股一律段位未定、門檻空白——先驗是老師的，不代填。
 */
export function ChainEditor({
  state,
  update,
  notify,
}: {
  state: FlowState;
  update: (fn: (draft: FlowState) => void) => void;
  notify: (msg: string) => void;
}) {
  const rg = resolveGroup(state);
  const chains = Object.values(state.chains ?? {});
  const active = rg.kind === "custom" ? rg.custom! : null;
  const canAdd = chains.length < CHAIN_LIMITS.chainsPerState;

  const addChain = () => {
    if (!canAdd) {
      notify(`最多 ${CHAIN_LIMITS.chainsPerState} 條自訂產業鏈，請先刪掉不用的`);
      return;
    }
    const c = blankChain();
    update((d) => {
      d.chains[c.id] = c;
      d.groupId = c.id;
      d.open.chains = true;
    });
    notify("已建立「新產業鏈」，先改名、填產業鏈名稱，再加子段與個股");
  };

  const edit = (fn: (c: CustomChain, d: FlowState) => void) =>
    update((d) => {
      const c = d.chains[rg.id];
      if (c) fn(c, d);
    });

  const removeChain = () => {
    if (!active) return;
    if (!window.confirm(`刪除自訂產業鏈「${active.name}」？子段與個股會一起刪掉（已存雲端的論點卡不受影響）。`)) return;
    update((d) => {
      const c = d.chains[active.id];
      if (c) pruneOffKeys(d, c.subs.map((s) => s.id));
      delete d.chains[active.id];
      d.groupId = "pwr";
    });
    notify("已刪除自訂產業鏈，切回電源供應");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {chains.length === 0 && (
          <span className="text-base text-slate-500">
            還沒有自訂產業鏈。建一條，就能把同一套五層作業流套到任何台股。
          </span>
        )}
        {chains.map((c) => (
          <button
            key={c.id}
            type="button"
            className={`rounded-full border px-3 py-1.5 text-sm ${
              c.id === rg.id
                ? "border-[rgba(203,161,75,0.6)] bg-[rgba(203,161,75,0.14)] font-semibold text-slate-900"
                : "border-slate-300 bg-white text-slate-600"
            }`}
            onClick={() =>
              update((d) => {
                d.groupId = c.id;
                if (c.wacc) d.wacc = c.wacc;
              })
            }
          >
            {c.name}　<span className="text-slate-400">{c.subs.length} 子段・{chainStockCount(c)} 檔</span>
          </button>
        ))}
        <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-sm" onClick={addChain} disabled={!canAdd}>
          ＋ 新增產業鏈
        </button>
        <span className="text-sm text-slate-400">
          {chains.length}／{CHAIN_LIMITS.chainsPerState} 條
        </span>
      </div>

      {active && (
        <div className="space-y-4 rounded-xl border border-[rgba(203,161,75,0.35)] bg-white/40 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="群組名" hint="出現在比較群組下拉與存檔標題，例：航運">
              <Input
                value={active.name}
                maxLength={CHAIN_LIMITS.name}
                onChange={(e) => {
                  const v = e.target.value;
                  edit((c) => void (c.name = v));
                }}
              />
            </Field>
            <Field label="產業鏈名稱" hint="L0 第 ④ 項用，例：航運供應鏈；空白時用群組名">
              <Input
                value={active.chain}
                maxLength={CHAIN_LIMITS.chain}
                placeholder={`${active.name || "○○"}供應鏈`}
                onChange={(e) => {
                  const v = e.target.value;
                  edit((c) => void (c.chain = v));
                }}
              />
            </Field>
            <Field label="參考 WACC（%，選填）" hint="填了會帶進上方「參考 WACC」，本產業請自行確認">
              <Input
                value={active.wacc ?? ""}
                maxLength={CHAIN_LIMITS.wacc}
                placeholder="8"
                onChange={(e) => {
                  const v = e.target.value;
                  edit((c, d) => {
                    if (v.trim()) {
                      c.wacc = v;
                      d.wacc = v;
                    } else delete c.wacc;
                  });
                }}
              />
            </Field>
            <Field label="L2 產業註記（選填）" hint="會原樣放進 L2 指令。例：註：航運屬強循環，毛利率由運價驅動，請改用正常化獲利評估。">
              <Textarea
                rows={2}
                value={active.l2note ?? ""}
                maxLength={CHAIN_LIMITS.l2note}
                onChange={(e) => {
                  const v = e.target.value;
                  edit((c) => {
                    if (v.trim()) c.l2note = v;
                    else delete c.l2note;
                  });
                }}
              />
            </Field>
          </div>

          <div className="space-y-3">
            {active.subs.map((sub, si) => (
              <div key={sub.id} className="rounded-xl border border-slate-200 bg-white/40">
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
                  <span className="text-sm text-slate-400">子段 {si + 1}</span>
                  <input
                    type="text"
                    value={sub.name}
                    maxLength={CHAIN_LIMITS.subName}
                    className="font-display max-w-[240px] flex-1 rounded-lg border border-slate-200 bg-[#0c1730] px-2 py-1 text-base font-bold text-slate-900 outline-none focus:border-[color:var(--gold)]"
                    onChange={(e) => {
                      const v = e.target.value;
                      edit((c) => {
                        const t = c.subs.find((x) => x.id === sub.id);
                        if (t) t.name = v;
                      });
                    }}
                  />
                  <span className="text-sm tabular-nums text-slate-400">{sub.stocks.length} 檔</span>
                  <button
                    type="button"
                    className="btn-ghost rounded px-2 py-1 text-sm disabled:opacity-40"
                    disabled={active.subs.length < 2}
                    title={active.subs.length < 2 ? "至少要留一個子段" : "刪除這個子段與它的個股"}
                    onClick={() =>
                      edit((c, d) => {
                        if (c.subs.length < 2) return;
                        pruneOffKeys(d, [sub.id]);
                        c.subs = c.subs.filter((x) => x.id !== sub.id);
                      })
                    }
                  >
                    刪除子段
                  </button>
                </div>
                <div className="px-3 py-3">
                  <StockRowsEditor
                    rows={sub.stocks}
                    max={CHAIN_LIMITS.stocksPerSub}
                    takenElsewhere={new Map(
                      active.subs
                        .filter((x) => x.id !== sub.id)
                        .flatMap((x) => x.stocks.map((s) => [s.code, x.name] as const)),
                    )}
                    onChange={(rows) =>
                      edit((c) => {
                        const t = c.subs.find((x) => x.id === sub.id);
                        if (t) t.stocks = rows;
                      })
                    }
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost rounded-lg px-3 py-1.5 text-sm disabled:opacity-40"
              disabled={active.subs.length >= CHAIN_LIMITS.subs}
              onClick={() =>
                edit((c) => {
                  c.subs.push({ id: newChainSubId(), name: `子段 ${c.subs.length + 1}`, stocks: [] });
                })
              }
            >
              ＋ 新增子段
            </button>
            <span className="text-sm text-slate-400">
              最多 {CHAIN_LIMITS.subs} 子段、每子段 {CHAIN_LIMITS.stocksPerSub} 檔。段位一律「未定」、門檻留白——先驗是老師的判斷，這裡不代填。
            </span>
            <button type="button" className="ml-auto rounded-lg px-2 py-1.5 text-sm text-rose-500 hover:underline" onClick={removeChain}>
              刪除這條產業鏈
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * 代號＋名稱的列編輯器。自訂產業鏈的子段與教材群組的「＋ 加個股」共用。
 * 代號格式錯就紅框；同一條鏈裡其他子段已有的代號給琥珀提示（存檔時會被丟掉，留第一個）。
 */
export function StockRowsEditor({
  rows,
  max,
  takenElsewhere,
  onChange,
}: {
  rows: CustomChainStock[];
  max: number;
  /** code → 已在哪個子段 */
  takenElsewhere?: Map<string, string>;
  onChange: (rows: CustomChainStock[]) => void;
}) {
  const set = (i: number, patch: Partial<CustomChainStock>) =>
    onChange(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      {rows.length === 0 && <div className="text-sm text-slate-400">（還沒有個股，按下面「＋ 加個股」）</div>}
      {rows.map((r, i) => {
        const code = normalizeCode(r.code);
        const bad = r.code.trim() !== "" && !STOCK_CODE_RE.test(code);
        const dupHere = rows.findIndex((x) => normalizeCode(x.code) === code) !== i && code !== "";
        const elsewhere = takenElsewhere?.get(code);
        return (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <input
              value={r.code}
              inputMode="numeric"
              placeholder="代號 2603"
              className={`w-32 rounded-lg border bg-[#0c1730] px-3 py-1.5 text-base tabular-nums text-slate-900 outline-none focus:border-[color:var(--gold)] ${
                bad ? "border-rose-400" : "border-slate-200"
              }`}
              onChange={(e) => set(i, { code: e.target.value })}
              onBlur={() => set(i, { code })}
            />
            <input
              value={r.name}
              placeholder="名稱 長榮"
              maxLength={CHAIN_LIMITS.stockName}
              className="min-w-[140px] flex-1 rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-1.5 text-base text-slate-900 outline-none focus:border-[color:var(--gold)]"
              onChange={(e) => set(i, { name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && i === rows.length - 1 && rows.length < max) {
                  e.preventDefault();
                  onChange([...rows, { code: "", name: "" }]);
                }
              }}
            />
            {bad && <span className="text-sm text-rose-500">代號格式：4～6 碼數字，可加一個英文字母</span>}
            {!bad && dupHere && <span className="text-sm text-amber-600">這個子段已有同一檔</span>}
            {!bad && !dupHere && elsewhere && <span className="text-sm text-amber-600">已在「{elsewhere}」，存檔時只留第一個</span>}
            <button
              type="button"
              className="rounded px-2 py-1 text-sm text-rose-500 hover:underline"
              onClick={() => onChange(rows.filter((_, j) => j !== i))}
            >
              刪除
            </button>
          </div>
        );
      })}
      <button
        type="button"
        className="btn-ghost rounded-lg px-3 py-1.5 text-sm disabled:opacity-40"
        disabled={rows.length >= max}
        title={rows.length >= max ? `最多 ${max} 檔` : ""}
        onClick={() => onChange([...rows, { code: "", name: "" }])}
      >
        ＋ 加個股
      </button>
    </div>
  );
}
