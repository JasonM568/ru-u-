import Link from "next/link";
import Image from "next/image";
import type { Enrollment } from "@/lib/auth";
import { jobRoleName, teamName } from "@/lib/constants";

export function AppNav({
  enrollment,
  email,
}: {
  enrollment: Enrollment;
  email: string | null;
}) {
  const isInstructor = enrollment.class_role === "instructor";

  const links: { href: string; label: string }[] = [{ href: "/", label: "儀表板" }];
  if (!isInstructor) {
    links.push({ href: "/questionnaire", label: "職務問卷" });
    links.push({ href: "/team", label: "團隊運轉" });
    links.push({ href: "/team", label: "團隊工作區" });
  }
  if (isInstructor) {
    links.push({ href: "/admin/roster", label: "名冊" });
    links.push({ href: "/admin/results", label: "問卷分流" });
    links.push({ href: "/questionnaire", label: "填問卷（測試）" });
    links.push({ href: "/admin/assessments", label: "成果驗收" });
    links.push({ href: "/admin/teams", label: "團隊紀錄" });
    links.push({ href: "/admin/process-notes", label: "孵化紀錄" });
    links.push({ href: "/admin/schedule", label: "課程流程" });
  }

  return (
    <header className="border-b border-[color:var(--hairline)] bg-[rgba(9,15,28,0.85)] backdrop-blur">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-y-2 py-3">
          <Link href="/" className="flex items-center gap-2.5">
            <Image
              src="/qec-logo.png"
              alt="QEC"
              width={748}
              height={854}
              className="h-9 w-auto"
            />
            <span className="flex flex-col leading-tight">
              <span className="font-display text-sm font-bold tracking-wide text-gold">
                投資菁英班
              </span>
              <span className="text-[10px] tracking-[0.2em] text-slate-500">
                QUANTUM ELITE CLUB
              </span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-400 sm:inline">
              {enrollment.display_name ?? email}
              {isInstructor
                ? "・講師"
                : `・${teamName(enrollment.team_id)}／${jobRoleName(enrollment.job_role)}`}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-[color:var(--hairline)] px-2.5 py-1 text-xs text-slate-400 transition hover:bg-[rgba(203,161,75,0.1)]"
              >
                登出
              </button>
            </form>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-sm">
          {links.map((l, i) => (
            <Link
              key={`${l.href}-${i}`}
              href={l.href}
              className="py-1 text-slate-400 transition hover:text-[color:var(--gold-bright)]"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
