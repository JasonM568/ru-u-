import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
      {children}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && (
          <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
        )}
      </div>
      {action}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3 border-l-4 border-indigo-500 pl-3">
      <h2 className="text-base font-semibold text-slate-800">{children}</h2>
      {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
  required,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && <span className="ml-0.5 text-rose-500">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

const controlClass =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 disabled:bg-slate-50";

export function Input(props: ComponentProps<"input">) {
  return <input {...props} className={`${controlClass} ${props.className ?? ""}`} />;
}

export function Textarea(props: ComponentProps<"textarea">) {
  return (
    <textarea
      {...props}
      className={`${controlClass} min-h-[80px] ${props.className ?? ""}`}
    />
  );
}

export function Select(props: ComponentProps<"select">) {
  return (
    <select {...props} className={`${controlClass} ${props.className ?? ""}`} />
  );
}

export function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "slate" | "indigo" | "green" | "amber" | "rose";
}) {
  const tones: Record<string, string> = {
    slate: "bg-slate-100 text-slate-600",
    indigo: "bg-indigo-100 text-indigo-700",
    green: "bg-emerald-100 text-emerald-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function LinkButton({
  href,
  children,
  variant = "primary",
}: {
  href: string;
  children: ReactNode;
  variant?: "primary" | "ghost";
}) {
  const styles =
    variant === "primary"
      ? "bg-indigo-600 text-white hover:bg-indigo-700"
      : "bg-white text-slate-700 border border-slate-300 hover:bg-slate-50";
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition ${styles}`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
