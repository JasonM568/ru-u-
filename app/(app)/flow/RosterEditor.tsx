"use client";

import { SEGMENTS } from "@/lib/flow/segments";
import { CHAIN_LIMITS } from "@/lib/flow/chains";
import { StockRowsEditor } from "./ChainEditor";
import { applySplitConfig, buildSplitConfig, sanitizeSplitConfig, type PublishedConfig } from "@/lib/flow/config";
import { PublishedConfigs } from "./PublishedConfigs";
import {
  activeStocks,
  addedCount,
  layout,
  newSubId,
  resolveGroup,
  seedCustomSplit,
  stockKey,
  type FlowState,
  type LaidOutSub,
} from "@/lib/flow/state";

const PRIOR_TONE: Record<string, string> = {
  瓶頸: "text-amber-600",
  通過: "text-sky-400",
  被替代: "text-emerald-600",
  循環: "text-violet-400",
  形成期: "text-slate-400",
  未定: "text-slate-400",
};

export function RosterEditor({
  state,
  update,
  notify,
  configs,
  isInstructor,
}: {
  state: FlowState;
  update: (fn: (draft: FlowState) => void) => void;
  notify: (msg: string) => void;
  configs: PublishedConfig[];
  isInstructor: boolean;
}) {
  const rg = resolveGroup(state);
  const group = { id: rg.id, name: rg.name };
  const isCustomChain = rg.kind === "custom";
  const subs = layout(state);
  const edit = state.editSplit && !isCustomChain;
  const targets = subs.filter((s) => !s.unassigned);
  const hasAdded = addedCount(state) > 0;

  const ensureCustom = (draft: FlowState) => {
    if (!draft.custom[draft.groupId]) draft.custom[draft.groupId] = seedCustomSplit(draft);
    return draft.custom[draft.groupId];
  };

  const exportSplit = async () => {
    const payload = buildSplitConfig(state);
    try {
      await navigator.clipboard.writeText(JSON.stringify(payload));
      notify("分段設定已複製，可貼給同學匯入");
    } catch {
      notify("複製失敗，請改用手動選取");
    }
  };

  const importSplit = () => {
    const raw = window.prompt("把分段設定貼在這裡：");
    if (!raw) return;
    try {
      const cfg = sanitizeSplitConfig(JSON.parse(raw));
      if (!cfg) throw new Error("格式不符或找不到這個比較群組");
      update((d) => applySplitConfig(d, cfg));
      notify(`已匯入「${cfg.groupName}」的分段設定`);
    } catch (err) {
      window.alert(
        `匯入失敗：${err instanceof Error ? err.message : "未知錯誤"}\n\n請確認貼的是完整的分段設定字串（由「匯出分段設定」產生）。`,
      );
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {!isCustomChain && (
        <button
          type="button"
          className={edit ? "btn-gold rounded-lg px-3 py-1.5 text-sm" : "btn-ghost rounded-lg px-3 py-1.5 text-sm"}
          onClick={() =>
            update((d) => {
              if (!d.editSplit) ensureCustom(d);
              d.editSplit = !d.editSplit;
            })
          }
        >
          {edit ? "完成分段" : "自訂分段"}
        </button>
        )}
        {edit && (
          <>
            <button
              type="button"
              className="btn-ghost rounded-lg px-3 py-1.5 text-sm"
              onClick={() =>
                update((d) => {
                  const c = ensureCustom(d);
                  c.subs.push({ id: newSubId(), name: `新子段 ${c.subs.length + 1}` });
                })
              }
            >
              ＋ 新增子段
            </button>
            <button
              type="button"
              className="btn-ghost rounded-lg px-3 py-1.5 text-sm"
              onClick={() => {
                if (!window.confirm("還原成教材原分段？你自訂的子段名稱與分配會全部清掉。")) return;
                update((d) => {
                  delete d.custom[d.groupId];
                  d.editSplit = false;
                  d.offSubs = {};
                  d.offStocks = {};
                });
                notify("已還原教材原分段");
              }}
            >
              還原教材分段
            </button>
          </>
        )}
        <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-sm" onClick={exportSplit}>
          匯出分段設定
        </button>
        <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-sm" onClick={importSplit}>
          匯入分段設定
        </button>
        <span className="text-sm text-slate-400">
          {isCustomChain
            ? `目前使用自訂產業鏈「${rg.name}」；子段與個股請在上方「自訂產業鏈」編輯`
            : state.custom[group.id]
              ? "目前使用自訂分段"
              : "目前使用教材原分段"}
        </span>
      </div>

      <PublishedConfigs
        configs={configs}
        isInstructor={isInstructor}
        state={state}
        update={update}
        notify={notify}
      />

      <div className="space-y-3">
        {subs.map((sub) => (
          <SubBlock
            key={sub.key}
            sub={sub}
            state={state}
            update={update}
            edit={edit}
            targets={targets}
            ensureCustom={ensureCustom}
            groupId={group.id}
            isCustomChain={isCustomChain}
          />
        ))}
      </div>

      <p className="text-sm leading-relaxed text-slate-400">
        段位標籤是「先驗」，只是起點，不是結論。實際歸屬要在 L2 用當期財報（毛利率趨勢、ROIC、交期、擴產宣告）驗證後才算數。
        取消勾選的個股與子段不會出現在任何指令裡。
      </p>

      {hasAdded && (
        <div className="flex flex-wrap items-start gap-3 rounded-lg border border-dashed border-slate-300 bg-white/40 px-3 py-3">
          <p className="min-w-[240px] flex-1 text-sm leading-relaxed text-slate-600">
            <b className="text-slate-800">標「補」的個股不是教材原表。</b>
            這些是 Claude 依訓練資料（知識截止 2026-05）補進來的，代號、公司名與所屬子段都
            <b className="text-slate-800">需要自行查證一次</b>
            ，也可能有已下市、改名或分類不符的。段位一律標「未定」——先驗判斷是老師的，不代填；請在 L2 用當期財報驗證後自己歸類。
          </p>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600">
            <input
              type="checkbox"
              checked={state.originalOnly}
              onChange={(e) => {
                const on = e.target.checked;
                update((d) => {
                  d.originalOnly = on;
                });
                notify(on ? "已切回教材原表" : "已含補充個股，記得查證");
              }}
              className="h-4 w-4 accent-amber-600"
            />
            只用教材原表
          </label>
        </div>
      )}
    </div>
  );
}

function SubBlock({
  sub,
  state,
  update,
  edit,
  targets,
  ensureCustom,
  groupId,
  isCustomChain,
}: {
  sub: LaidOutSub;
  state: FlowState;
  update: (fn: (draft: FlowState) => void) => void;
  edit: boolean;
  targets: LaidOutSub[];
  ensureCustom: (draft: FlowState) => { subs: { id: string; name: string }[]; assign: Record<string, string> };
  groupId: string;
  isCustomChain: boolean;
}) {
  const subOn = !state.offSubs[sub.key] && !sub.unassigned;
  const addedHere = sub.stocks.filter((s) => s.added).length;
  const ownHere = sub.stocks.filter((s) => s.own).length;
  // 教材群組、單一原分類、非編輯模式才提供「＋ 加個股」（自建個股掛在該原分類下）
  const canAddExtra = !isCustomChain && !edit && !sub.unassigned && sub.origins.length === 1;
  const extraKey = sub.origins[0];
  const extraRows = (state.extraStocks?.[groupId]?.[extraKey] ?? []);
  const showExtra = !!state.open[`extra:${sub.key}`];

  return (
    <div
      className={`overflow-hidden rounded-xl border bg-white/40 ${
        sub.unassigned ? "border-dashed border-amber-200" : "border-slate-200"
      }`}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
        {!sub.unassigned && !edit && (
          <input
            type="checkbox"
            checked={subOn}
            aria-label={`啟用 ${sub.name}`}
            className="h-4 w-4 accent-amber-600"
            onChange={(e) => {
              const on = e.target.checked;
              update((d) => {
                d.offSubs[sub.key] = !on;
              });
            }}
          />
        )}
        {edit && !sub.unassigned ? (
          <input
            type="text"
            value={sub.name}
            className="font-display max-w-[220px] flex-1 rounded-lg border border-slate-200 bg-[#0c1730] px-2 py-1 text-base font-bold text-slate-900 outline-none focus:border-[color:var(--gold)]"
            onChange={(e) => {
              const name = e.target.value;
              update((d) => {
                const c = ensureCustom(d);
                const target = c.subs.find((x) => x.id === sub.id);
                if (target) target.name = name;
              });
            }}
          />
        ) : (
          <b className="font-display flex-1 text-base text-slate-800">{sub.name}</b>
        )}

        {sub.origins.length > 1 && (
          <span className="text-sm text-amber-600">跨 {sub.origins.length} 個原分類</span>
        )}
        {addedHere > 0 && !state.originalOnly && (
          <span className="text-sm text-slate-400">含補 {addedHere}</span>
        )}
        {ownHere > 0 && !isCustomChain && (
          <span className="text-sm text-amber-600">含自建 {ownHere}</span>
        )}
        <span className="text-sm tabular-nums text-slate-400">
          {sub.unassigned
            ? `${sub.stocks.length} 檔未分配`
            : `${activeStocks(state, sub).length}/${sub.stocks.length} 檔`}
        </span>
        {edit && !sub.unassigned && targets.length > 1 && (
          <button
            type="button"
            className="btn-ghost rounded px-2 py-1 text-sm"
            title="刪除這個子段，個股會移到第一個子段"
            onClick={() =>
              update((d) => {
                const c = ensureCustom(d);
                if (c.subs.length < 2) return;
                const fallback = c.subs.find((x) => x.id !== sub.id)?.id;
                if (!fallback) return;
                for (const k of Object.keys(c.assign)) {
                  if (c.assign[k] === sub.id) c.assign[k] = fallback;
                }
                c.subs = c.subs.filter((x) => x.id !== sub.id);
              })
            }
          >
            刪除
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 px-3 py-3">
        {sub.stocks.length === 0 && (
          <span className="text-sm text-slate-400">（空的子段，指令不會列出它）</span>
        )}
        {sub.stocks.map((s) => {
          const on = !state.offStocks[stockKey(sub, s)];
          const isSeed = state.ticker === s.code;
          return (
            <label
              key={`${s.origin}|${s.code}`}
              title={
                s.own
                  ? "自建個股：段位未定，代號與名稱需自行查證"
                  : `${s.added ? "非教材原表，Claude 補充，需自行查證" : "教材原表"}　原分類：${s.origin}`
              }
              className={`flex items-center gap-2 rounded-full border px-2.5 py-1 text-sm tabular-nums ${
                s.added ? "border-dashed" : ""
              } ${s.own ? "border-amber-400/70" : ""} ${
                isSeed
                  ? "border-amber-400 bg-amber-50 font-semibold text-slate-900"
                  : "border-slate-300 bg-white text-slate-600"
              } ${on ? "" : "opacity-40"}`}
            >
              {!edit && (
                <input
                  type="checkbox"
                  checked={on}
                  disabled={!subOn}
                  className="h-3.5 w-3.5 accent-amber-600"
                  onChange={(e) => {
                    const v = e.target.checked;
                    update((d) => {
                      d.offStocks[stockKey(sub, s)] = !v;
                    });
                  }}
                />
              )}
              <code className="text-sm text-slate-400">{s.code}</code>
              {s.name}
              {s.added && (
                <span className="rounded border border-slate-400 px-1 text-sm leading-tight text-slate-400">
                  補
                </span>
              )}
              {s.own && (
                <span className="rounded border border-amber-400 px-1 text-sm leading-tight text-amber-600">
                  自建
                </span>
              )}
              {edit ? (
                <select
                  value={sub.id ?? ""}
                  className="max-w-[120px] rounded border border-slate-300 bg-[#0c1730] px-1 py-0.5 text-sm text-slate-800"
                  onChange={(e) => {
                    const to = e.target.value;
                    update((d) => {
                      const c = ensureCustom(d);
                      c.assign[`${s.origin}|${s.code}`] = to;
                    });
                  }}
                >
                  {targets.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              ) : (
                <span className={`text-sm ${PRIOR_TONE[s.prior] ?? "text-slate-400"}`}>
                  {s.prior}
                </span>
              )}
            </label>
          );
        })}
      </div>
      {canAddExtra && (
        <div className="border-t border-slate-200 px-3 py-2">
          <button
            type="button"
            className="text-sm text-[color:var(--gold)] underline-offset-2 hover:underline"
            onClick={() =>
              update((d) => {
                d.open[`extra:${sub.key}`] = !showExtra;
              })
            }
          >
            {showExtra ? "▾" : "▸"} ＋ 加個股（自建，段位未定，最多 {CHAIN_LIMITS.extraPerSegment} 檔）
          </button>
          {showExtra && (
            <div className="mt-2">
              <StockRowsEditor
                rows={extraRows}
                max={CHAIN_LIMITS.extraPerSegment}
                onChange={(rows) =>
                  update((d) => {
                    if (!d.extraStocks[groupId]) d.extraStocks[groupId] = {};
                    if (rows.length) d.extraStocks[groupId][extraKey] = rows;
                    else {
                      delete d.extraStocks[groupId][extraKey];
                      if (!Object.keys(d.extraStocks[groupId]).length) delete d.extraStocks[groupId];
                    }
                  })
                }
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** L2 站的分組門檻參考表。跨原分類的自訂子段沒有單一門檻可沿用。 */
export function ThresholdTable({ subs }: { subs: LaidOutSub[] }) {
  if (!subs.length) return null;
  const mixed = subs.some((s) => !s.thresholds);
  return (
    <div className="rounded-lg border border-slate-200 bg-white/40 p-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm tabular-nums">
          <thead>
            <tr className="text-left text-sm uppercase tracking-wider text-slate-400">
              <th className="border-b border-slate-200 px-2 py-1.5">子段</th>
              <th className="border-b border-slate-200 px-2 py-1.5 text-right">營收 YoY ≥</th>
              <th className="border-b border-slate-200 px-2 py-1.5 text-right">營益 YoY ≥</th>
              <th className="border-b border-slate-200 px-2 py-1.5 text-right">營益率 ≥</th>
              <th className="border-b border-slate-200 px-2 py-1.5 text-right">負債比 ≤</th>
              <th className="border-b border-slate-200 px-2 py-1.5 text-right">FCF 正年數 ≥</th>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {subs.map((sub) => (
              <tr key={sub.key}>
                <td className="border-b border-slate-200 px-2 py-1.5 whitespace-nowrap text-slate-800">
                  {sub.name}
                </td>
                {sub.thresholds ? (
                  <>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-right">
                      {(sub.thresholds.revYoY * 100).toFixed(0)}%
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-right">
                      {(sub.thresholds.opYoY * 100).toFixed(0)}%
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-right">
                      {(sub.thresholds.opMargin * 100).toFixed(1)}%
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-right">
                      {(sub.thresholds.debtRatio * 100).toFixed(0)}%
                    </td>
                    <td className="border-b border-slate-200 px-2 py-1.5 text-right">
                      {sub.thresholds.fcfYears}
                    </td>
                  </>
                ) : (
                  <td colSpan={5} className="border-b border-slate-200 px-2 py-1.5 text-amber-600">
                    {sub.origins.length === 0
                      ? "自建子段沒有教材門檻——沒有單一門檻可用，請自己訂或再拆細"
                      : `混合了 ${sub.origins.map((o) => SEGMENTS[o].short).join("、")} 的個股，沒有單一門檻可用——請自行決定，或把它再拆細`}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-400">
        不同產業不能用同一條及格線。這組數字是一覽表的體質分門檻，L2 判讀時可拿來校準「這個毛利率算高還是低」——但它不是本指令的必要輸入。
        {mixed && (
          <>
            <br />
            <b className="text-slate-600">有子段沒有教材門檻可沿用</b>
            ：跨原分類的自訂子段，或自訂產業鏈的自建子段。這通常代表那一段還可以再拆，或是你有意要跨類比較——請自己訂一條門檻，本表不代填。
          </>
        )}
      </p>
    </div>
  );
}
