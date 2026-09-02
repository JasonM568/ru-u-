"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  applySplitConfig,
  buildSplitConfig,
  type PublishedConfig,
} from "@/lib/flow/config";
import { chainStockCount } from "@/lib/flow/chains";
import { resolveGroup, type FlowState } from "@/lib/flow/state";
import { publishFlowConfig, unpublishFlowConfig } from "./actions";

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * 講師下發的分段設定。
 * - 全班：看得到每個比較群組目前下發的設定，一鍵套用（等同匯入）。
 * - 講師：把自己控制台目前的分段設定下發給全班（一個群組一份，重下發＝覆蓋），或撤回。
 * 設定資料由 page.tsx（server component）撈好傳進來；下發／撤回後 router.refresh() 重新撈。
 */
export function PublishedConfigs({
  configs,
  isInstructor,
  state,
  update,
  notify,
}: {
  configs: PublishedConfig[];
  isInstructor: boolean;
  state: FlowState;
  update: (fn: (draft: FlowState) => void) => void;
  notify: (msg: string) => void;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [title, setTitle] = useState("");
  const rg = resolveGroup(state);
  const group = { id: rg.id, name: rg.name };
  const current = configs.find((c) => c.group_id === group.id) ?? null;
  const others = configs.filter((c) => c.group_id !== group.id);

  const apply = (c: PublishedConfig) => {
    const overwrites = !!(c.payload.chain && state.chains?.[c.payload.chain.id]);
    update((d) => applySplitConfig(d, c.payload));
    notify(
      `已套用講師下發的「${c.title || c.payload.groupName}」${overwrites ? "（同 id 的自訂產業鏈已被覆蓋）" : ""}`,
    );
  };

  const publish = () =>
    start(async () => {
      const res = await publishFlowConfig({
        title: title.trim() || `${group.name}　${new Date().toLocaleDateString("zh-TW")}`,
        note: "",
        config: JSON.stringify(buildSplitConfig(state)),
      });
      if (!res.ok) {
        notify(`下發失敗：${res.error}`);
        return;
      }
      notify(current ? `已覆蓋「${group.name}」的下發設定` : `已下發「${group.name}」的分段設定給全班`);
      setTitle("");
      router.refresh();
    });

  const unpublish = (c: PublishedConfig) =>
    start(async () => {
      if (!window.confirm(`撤回「${c.title || c.payload.groupName}」？學員將看不到這份設定（已套用的不受影響）。`)) return;
      const res = await unpublishFlowConfig(c.group_id);
      if (!res.ok) {
        notify(`撤回失敗：${res.error}`);
        return;
      }
      notify("已撤回");
      router.refresh();
    });

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-slate-300 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">講師下發的分段設定</h3>
        <span className="text-sm text-slate-400">
          {configs.length === 0 ? "講師尚未下發" : "按「套用」就和全班用同一套分段與 CCC 規則"}
        </span>
      </div>

      {current && <ConfigRow c={current} highlight isInstructor={isInstructor} pending={pending} onApply={apply} onUnpublish={unpublish} />}
      {others.map((c) => (
        <ConfigRow key={c.id} c={c} highlight={false} isInstructor={isInstructor} pending={pending} onApply={apply} onUnpublish={unpublish} />
      ))}

      {isInstructor && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-slate-200 pt-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`標題（例：9 月例會　${group.name}）`}
            className="min-w-[260px] flex-1 rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-1.5 text-sm text-slate-900 outline-none placeholder:text-slate-500 focus:border-[color:var(--gold)]"
          />
          <button
            type="button"
            disabled={pending}
            className="btn-gold rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
            onClick={publish}
          >
            {pending ? "處理中…" : current ? `覆蓋下發「${group.name}」` : `下發目前分段給全班`}
          </button>
          <span className="text-sm text-slate-400">
            下發的是你現在這頁的分段：
            {rg.kind === "custom"
              ? `自訂產業鏈「${rg.name}」（${rg.custom!.subs.length} 子段 ${chainStockCount(rg.custom!)} 檔）`
              : `${state.custom[group.id] ? "自訂分段" : "教材原分段"}、${state.originalOnly ? "只用教材原表" : "含補充個股"}`}
            、CCC {state.tc.ccMode === "sum" ? "相加" : "取較高者"}
          </span>
        </div>
      )}
    </div>
  );
}

function ConfigRow({
  c,
  highlight,
  isInstructor,
  pending,
  onApply,
  onUnpublish,
}: {
  c: PublishedConfig;
  highlight: boolean;
  isInstructor: boolean;
  pending: boolean;
  onApply: (c: PublishedConfig) => void;
  onUnpublish: (c: PublishedConfig) => void;
}) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 rounded-lg border px-3 py-2 ${
        highlight ? "border-[rgba(203,161,75,0.5)] bg-[rgba(203,161,75,0.08)]" : "border-slate-200"
      }`}
    >
      <div className="text-sm">
        <span className="font-medium text-slate-800">{c.title || c.payload.groupName}</span>
        <span className="ml-2 text-slate-400">
          {c.payload.groupName}
          {c.payload.chain
            ? `　·　自訂產業鏈・${c.payload.chain.subs.length} 子段・${chainStockCount(c.payload.chain)} 檔`
            : c.payload.custom
              ? `　·　${c.payload.custom.subs.length} 子段（自訂）`
              : "　·　教材原分段"}
          {c.payload.ccMode && `　·　CCC ${c.payload.ccMode === "sum" ? "相加" : "取較高者"}`}
        </span>
        <span className="ml-2 text-slate-500">
          {c.publisher ?? "講師"}　{fmt(c.updated_at)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" className="btn-gold rounded-lg px-3 py-1.5 text-sm" onClick={() => onApply(c)}>
          套用
        </button>
        {isInstructor && (
          <button
            type="button"
            disabled={pending}
            className="rounded-lg px-2 py-1.5 text-sm text-rose-500 hover:underline disabled:opacity-60"
            onClick={() => onUnpublish(c)}
          >
            撤回
          </button>
        )}
      </div>
    </div>
  );
}
