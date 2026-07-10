"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

export function SubmitButton({
  children,
  pendingText = "處理中…",
  variant = "primary",
}: {
  children: ReactNode;
  pendingText?: string;
  variant?: "primary" | "ghost";
}) {
  const { pending } = useFormStatus();
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50";
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition disabled:opacity-60 ${styles}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
