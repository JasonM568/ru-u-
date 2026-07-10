import { requireEnrollment } from "@/lib/auth";
import { PageHeader, Card, Badge, LinkButton } from "@/components/ui";
import { QuestionnaireForm } from "./QuestionnaireForm";
import { QuestionnaireReview } from "@/components/QuestionnaireReview";
import { jobRoleName } from "@/lib/constants";
import type { Answers } from "@/lib/scoring";

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; missing?: string }>;
}) {
  const { supabase, userId, email, enrollment } = await requireEnrollment();
  const isInstructor = enrollment.class_role === "instructor";
  const studentName = enrollment.display_name ?? email ?? "";

  const sp = await searchParams;

  const { data: existing } = await supabase
    .schema("elite")
    .from("questionnaire_responses")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // 學員填完即鎖定；講師測試填寫不受鎖定限制
  const isLocked = !!existing?.locked && !isInstructor;

  return (
    <div>
      <PageHeader
        title="職務適性評估問卷 v2"
        subtitle="共三部分、25 題，約 15 分鐘。憑第一直覺作答最準，沒有對錯。"
      />

      {isInstructor && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          🧪 你以<b>講師</b>身分填寫，屬系統測試用途，<b>不會列入學員分流結果</b>。
        </div>
      )}

      {isLocked ? (
        // 已送出且鎖定 → 唯讀檢視自己的作答
        <div>
          <Card className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge tone="green">已完成並送出</Badge>
                <p className="mt-2 text-sm text-slate-600">
                  問卷送出後即鎖定，如需修改請洽講師開放重填。
                </p>
              </div>
              {existing?.suggested_role && (
                <div className="text-right text-sm">
                  <span className="text-slate-400">系統建議職務</span>
                  <p className="text-lg font-bold text-indigo-600">
                    {jobRoleName(existing.suggested_role)}
                  </p>
                </div>
              )}
            </div>
          </Card>
          <Card>
            <h2 className="mb-4 font-semibold text-slate-800">你的作答</h2>
            <QuestionnaireReview answers={(existing?.answers as Answers) ?? {}} />
          </Card>
          <div className="mt-4">
            <LinkButton href="/" variant="ghost">
              返回儀表板
            </LinkButton>
          </div>
        </div>
      ) : (
        <>
          {existing && !isInstructor && (
            <div className="mb-4 rounded-lg bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              🔓 講師已開放你<b>重新填寫</b>。可直接修改下方答案，改完請按最底部的
              <b>「送出問卷」</b>；再次送出後問卷會重新鎖定。
            </div>
          )}
          {sp.saved && (
            <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              已成功送出！{isInstructor ? "（測試填寫）" : "問卷已鎖定，如需修改請洽講師。"}
            </div>
          )}
          {sp.error === "incomplete" && (
            <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              尚有 {sp.missing ?? ""} 題未作答，請完成後再送出。
            </div>
          )}
          {sp.error && sp.error !== "incomplete" && (
            <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
              送出時發生問題：{sp.error}
            </div>
          )}

          <QuestionnaireForm
            studentName={studentName}
            initialAnswers={(existing?.answers as Answers) ?? {}}
            initialInfo={{
              full_name: existing?.full_name ?? "",
              contact: existing?.contact ?? "",
              experience: existing?.experience ?? "",
              occupation: existing?.occupation ?? "",
              ai_course: existing?.ai_course ?? "",
            }}
          />
        </>
      )}
    </div>
  );
}
