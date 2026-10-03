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
  variant?: "primary" | "ghost" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition disabled:opacity-60 ${
        variant === "primary" ? "btn-gold" : variant === "destructive" ? "bg-rose-600 text-white hover:bg-rose-500" : "btn-ghost"
      }`}
    >
      {pending ? pendingText : children}
    </button>
  );
}
