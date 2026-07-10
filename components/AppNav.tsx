import Link from "next/link";
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

  const links: { href: string; label: string }[] = [
    { href: "/", label: "儀表板" },
  ];
  if (!isInstructor) {
    links.push({ href: "/questionnaire", label: "職務問卷" });
    links.push({ href: "/team", label: "團隊運轉" });
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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex flex-wrap items-center justify-between gap-y-2 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="font-bold text-slate-900">菁英班孵化系統</span>
            <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-medium text-indigo-600">
              1.0
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-500 sm:inline">
              {enrollment.display_name ?? email}
              {isInstructor
                ? "・講師"
                : `・${teamName(enrollment.team_id)}／${jobRoleName(enrollment.job_role)}`}
            </span>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
              >
                登出
              </button>
            </form>
          </div>
        </div>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 pb-2 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="py-1 text-slate-600 hover:text-indigo-600"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
