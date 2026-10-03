"use client";

import type { ReactNode } from "react";

export function ConfirmDialog({ title, children, onCancel, confirm }: {
  title: string;
  children: ReactNode;
  onCancel: () => void;
  confirm: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4">
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-xl border border-amber-700/40 bg-[#101b33] p-6 shadow-2xl">
        <h2 id="confirm-title" className="text-lg font-semibold text-slate-900">{title}</h2>
        <p className="mt-3 text-sm leading-7 text-slate-700">{children}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" autoFocus onClick={onCancel}
            className="rounded-lg border border-slate-500 px-4 py-2 text-sm text-slate-800 hover:bg-slate-100">取消</button>
          {confirm}
        </div>
      </div>
    </div>
  );
}
