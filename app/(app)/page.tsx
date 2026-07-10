import Link from "next/link";
import { requireEnrollment } from "@/lib/auth";
import { Card, PageHeader, Badge, LinkButton } from "@/components/ui";
import { JOB_ROLE_MAP, jobRoleName, teamName } from "@/lib/constants";

export default async function Dashboard() {
  const { supabase, userId, enrollment } = await requireEnrollment();

  if (enrollment.class_role === "instructor") {
    return <InstructorHome supabase={supabase} name={enrollment.display_name} />;
  }

  // 學員首頁
  const { data: response } = await supabase
    .schema("elite")
    .from("questionnaire_responses")
    .select("suggested_role, submitted_at, locked")
    .eq("user_id", userId)
    .maybeSingle();

  const role = enrollment.job_role ? JOB_ROLE_MAP[enrollment.job_role] : null;
  const submitted = !!response?.submitted_at;
  const reopened = submitted && response?.locked === false;

  return (
    <div>
      <PageHeader
        title={`歡迎，${enrollment.display_name ?? "同學"}`}
        subtitle="希望學院．菁英班投資團隊"
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">我的職務</h2>
            <Badge tone="indigo">{teamName(enrollment.team_id)}</Badge>
          </div>
          {role ? (
            <>
              <p className="text-lg font-bold text-slate-900">
                {role.name}
                <span className="ml-2 text-sm font-normal text-slate-400">
                  {role.tag}
                </span>
              </p>
              <p className="mt-1 text-sm text-slate-500">{role.oneLiner}</p>
              <p className="mt-2 text-xs text-slate-400">
                對應框架：{role.frame}　·　參考邏輯：{role.skill}
              </p>
            </>
          ) : (
            <p className="text-sm text-slate-500">
              職務尚未指派。請先完成職務適性問卷，講師會依結果分流。
            </p>
          )}
        </Card>

        <Card>
          <h2 className="mb-2 font-semibold text-slate-800">職務適性問卷</h2>
          {reopened ? (
            <>
              <Badge tone="amber">講師已開放重填</Badge>
              <p className="mt-2 text-sm text-slate-500">
                你可以修改先前的作答並重新送出（送出後會再次鎖定）。
              </p>
              <div className="mt-3">
                <LinkButton href="/questionnaire">前往修改作答</LinkButton>
              </div>
            </>
          ) : submitted ? (
            <>
              <Badge tone="green">已完成</Badge>
              <p className="mt-2 text-sm text-slate-500">
                系統建議：
                <span className="font-medium text-slate-700">
                  {jobRoleName(response.suggested_role)}
                </span>
                <br />
                問卷已鎖定，如需修改請洽講師開放重填。
              </p>
              <div className="mt-3">
                <LinkButton href="/questionnaire" variant="ghost">
                  查看我的作答
                </LinkButton>
              </div>
            </>
          ) : (
            <>
              <Badge tone="amber">尚未填寫</Badge>
              <p className="mt-2 text-sm text-slate-500">
                共 25 題、約 15 分鐘。憑第一直覺作答最準。
              </p>
              <div className="mt-3">
                <LinkButton href="/questionnaire">開始填寫</LinkButton>
              </div>
            </>
          )}
        </Card>
      </div>

      <div className="mt-4">
        <Card>
          <h2 className="mb-1 font-semibold text-slate-800">團隊運轉紀錄</h2>
          <p className="mb-3 text-sm text-slate-500">
            每週例會、模擬決策台帳、覆盤紀錄 — 把「憑感覺做」變成「有紀錄、可檢驗、可改進」。
          </p>
          <LinkButton href="/team">進入團隊工作區</LinkButton>
        </Card>
      </div>
    </div>
  );
}

async function InstructorHome({
  supabase,
  name,
}: {
  supabase: Awaited<ReturnType<typeof import("@/lib/auth").getSessionContext>>["supabase"];
  name: string | null;
}) {
  const [{ count: studentCount }, { count: qCount }, { count: assessCount }] =
    await Promise.all([
      supabase
        .schema("elite")
        .from("enrollments")
        .select("*", { count: "exact", head: true })
        .eq("class_role", "student"),
      supabase
        .schema("elite")
        .from("questionnaire_responses")
        .select("*", { count: "exact", head: true }),
      supabase
        .schema("elite")
        .from("assessments")
        .select("*", { count: "exact", head: true }),
    ]);

  const stats = [
    { label: "在班學員", value: studentCount ?? 0, href: "/admin/roster" },
    { label: "已交問卷", value: qCount ?? 0, href: "/admin/results" },
    { label: "驗收紀錄", value: assessCount ?? 0, href: "/admin/assessments" },
  ];

  const panels = [
    { href: "/admin/roster", title: "名冊與分組", desc: "從 QBC 會員挑人，指派職務與隊伍" },
    { href: "/admin/results", title: "問卷分流結果", desc: "查看全體計分與職務建議" },
    { href: "/admin/assessments", title: "成果驗收評分", desc: "個人與團隊層級驗收（僅講師可見）" },
    { href: "/admin/teams", title: "團隊運轉紀錄", desc: "兩隊的例會、台帳、覆盤" },
    { href: "/admin/process-notes", title: "孵化過程紀錄", desc: "萃取 2.0 藍本的觀察筆記（僅講師可見）" },
    { href: "/admin/schedule", title: "兩天課程流程", desc: "7/18–19 逐環節流程表" },
  ];

  return (
    <div>
      <PageHeader
        title={`講師後台　${name ?? ""}`}
        subtitle="孵化系統 1.0 · 第一屆實跑"
      />
      <div className="mb-6 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="text-center transition hover:border-indigo-300">
              <div className="text-2xl font-bold text-indigo-600">{s.value}</div>
              <div className="mt-1 text-xs text-slate-500">{s.label}</div>
            </Card>
          </Link>
        ))}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {panels.map((p) => (
          <Link key={p.href} href={p.href}>
            <Card className="h-full transition hover:border-indigo-300">
              <h3 className="font-semibold text-slate-800">{p.title}</h3>
              <p className="mt-1 text-sm text-slate-500">{p.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
