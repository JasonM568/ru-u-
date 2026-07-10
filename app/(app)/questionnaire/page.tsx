import { redirect } from "next/navigation";
import { requireEnrollment } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { QuestionnaireForm } from "./QuestionnaireForm";
import type { Answers } from "@/lib/scoring";

export default async function QuestionnairePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; missing?: string }>;
}) {
  const { supabase, userId, enrollment } = await requireEnrollment();
  if (enrollment.class_role !== "student") redirect("/admin/results");

  const sp = await searchParams;

  const { data: existing } = await supabase
    .schema("elite")
    .from("questionnaire_responses")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  return (
    <div>
      <PageHeader
        title="職務適性評估問卷 v2"
        subtitle="共三部分、25 題，約 15 分鐘。憑第一直覺作答最準，沒有對錯。"
      />

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          已成功送出！你可以隨時回來修改，最終職務由講師依計分結果指派。
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
        initialAnswers={(existing?.answers as Answers) ?? {}}
        initialInfo={{
          full_name: existing?.full_name ?? "",
          contact: existing?.contact ?? "",
          experience: existing?.experience ?? "",
          occupation: existing?.occupation ?? "",
          ai_course: existing?.ai_course ?? "",
        }}
      />
    </div>
  );
}
