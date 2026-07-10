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
    <div className={`qec-card rounded-2xl p-5 ${className}`}>{children}</div>
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
        <h1 className="font-display text-xl font-bold tracking-wide text-gold sm:text-2xl">
          {title}
        </h1>
        {subtitle && <p className="mt-1.5 text-sm text-slate-400">{subtitle}</p>}
        <div className="gold-rule mt-3 w-16" />
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
    <div className="mb-3 border-l-2 border-[color:var(--gold)] pl-3">
      <h2 className="font-display text-base font-semibold text-slate-800">
        {children}
      </h2>
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
  "w-full rounded-lg border border-slate-200 bg-[#0c1730] px-3 py-2 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-500 focus:border-[color:var(--gold)] focus:ring-2 focus:ring-[rgba(203,161,75,0.25)] disabled:opacity-60";

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
    slate: "border-slate-200 bg-slate-100 text-slate-600",
    indigo:
      "border-[rgba(203,161,75,0.4)] bg-[rgba(203,161,75,0.12)] text-[color:var(--gold-bright)]",
    green: "border-emerald-700/40 bg-emerald-50 text-emerald-600",
    amber: "border-amber-200 bg-amber-50 text-amber-700",
    rose: "border-rose-700/40 bg-rose-50 text-rose-600",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}
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
  return (
    <Link
      href={href}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${
        variant === "primary" ? "btn-gold" : "btn-ghost"
      }`}
    >
      {children}
    </Link>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-200 bg-[rgba(255,255,255,0.02)] px-4 py-8 text-center text-sm text-slate-400">
      {children}
    </div>
  );
}
