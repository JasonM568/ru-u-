"use client";

import { useState } from "react";
import { MAX_RUNS, type RunSummary } from "@/lib/flow/runs";

export type SaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

function fmt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("zh-TW", { timeZone: "Asia/Taipei", hour12: false, month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * 作業存檔列：目前開哪一檔、切換、新建、同段換標的、重新命名、刪除、儲存狀態。
 * 狀態與動作都在 FlowConsole；這裡只畫。
 */
export function RunBar({
  runs,
  currentId,
  currentTitle,
  status,
  savedAt,
  errorMsg,
  busy,
  onSwitch,
  onNew,
  onFork,
  onRename,
  onDelete,
  onSaveNow,
}: {
  runs: RunSummary[];
  currentId: string | null;
  currentTitle: string;
  status: SaveStatus;
  savedAt: string | null;
  errorMsg: string;
  busy: boolean;
  onSwitch: (id: string) => void;
  onNew: () => void;
  onFork: () => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onSaveNow: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState("");

  const statusText =
    status === "saving"
      ? "儲存中…"
      : status === "dirty"
        ? "有未存變更"
        : status === "error"
          ? `儲存失敗：${errorMsg}`
          : status === "saved" && savedAt
            ? `已存雲端 ${fmt(savedAt)}`
            : currentId
              ? "已存雲端"
              : "尚未建立存檔（開始填寫會自動建立）";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-[rgba(203,161,75,0.35)] bg-[rgba(203,161,75,0.06)] px-4 py-3">
      <span className="text-sm font-semibold uppercase tracking-wider text-slate-600">作業存檔</span>

      {renaming ? (
        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            onRename(draft.trim());
            setRenaming(false);
          }}
        >
          <input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={80}
            className="min-w-[220px] rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-1.5 text-base text-slate-900 outline-none focus:border-[color:var(--gold)]"
          />
          <button type="submit" className="btn-gold rounded-lg px-3 py-1.5 text-sm">
            確定
          </button>
          <button type="button" className="btn-ghost rounded-lg px-3 py-1.5 text-sm" onClick={() => setRenaming(false)}>
            取消
          </button>
        </form>
      ) : (
        <select
          value={currentId ?? ""}
          disabled={busy}
          onChange={(e) => e.target.value && onSwitch(e.target.value)}
          className="min-w-[240px] rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-1.5 text-base text-slate-900 outline-none focus:border-[color:var(--gold)]"
        >
          {!currentId && <option value="">（新作業，尚未存檔）</option>}
          {runs.map((r) => (
            <option key={r.id} value={r.id}>
              {r.id === currentId ? currentTitle || r.title || "（未命名）" : r.title || "（未命名）"}　·　{fmt(r.updated_at)}
            </option>
          ))}
        </select>
      )}

      <button type="button" disabled={busy} className="btn-ghost rounded-lg px-3 py-1.5 text-sm disabled:opacity-60" onClick={onNew}>
        ＋ 新作業
      </button>
      <button
        type="button"
        disabled={busy}
        title="保留 L0～交集（段層級），清掉 L3、L4 與論點卡，換下一檔標的"
        className="btn-ghost rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
        onClick={onFork}
      >
        同段換標的
      </button>
      {currentId && !renaming && (
        <>
          <button
            type="button"
            disabled={busy}
            className="btn-ghost rounded-lg px-3 py-1.5 text-sm disabled:opacity-60"
            onClick={() => {
              setDraft(currentTitle);
              setRenaming(true);
            }}
          >
            重新命名
          </button>
          <button
            type="button"
            disabled={busy}
            className="rounded-lg px-2 py-1.5 text-sm text-rose-500 hover:underline disabled:opacity-60"
            onClick={onDelete}
          >
            刪除
          </button>
        </>
      )}

      <span className={`ml-auto text-sm ${status === "error" ? "text-rose-500" : "text-slate-400"}`}>
        {statusText}
        {status === "dirty" && (
          <button type="button" className="ml-2 underline underline-offset-2" onClick={onSaveNow}>
            立即儲存
          </button>
        )}
        <span className="ml-3 text-slate-500">
          {runs.length}／{MAX_RUNS} 檔
        </span>
      </span>
    </div>
  );
}
