"use server";

import { redirect } from "next/navigation";
import { requireEnrollment } from "@/lib/auth";
import { computeScores, missingAnswers, type Answers } from "@/lib/scoring";

export async function saveQuestionnaire(formData: FormData) {
  const { supabase, userId, enrollment } = await requireEnrollment();
  // 講師不需填問卷
  if (enrollment.class_role !== "student") redirect("/");

  let answers: Answers = {};
  try {
    answers = JSON.parse(String(formData.get("answers") ?? "{}"));
  } catch {
    redirect("/questionnaire?error=parse");
  }

  const missing = missingAnswers(answers);
  if (missing.length > 0) {
    redirect(`/questionnaire?error=incomplete&missing=${missing.length}`);
  }

  const scores = computeScores(answers);
  const now = new Date().toISOString();

  const { error } = await supabase
    .schema("elite")
    .from("questionnaire_responses")
    .upsert(
      {
        user_id: userId,
        full_name: String(formData.get("full_name") ?? "").trim() || null,
        contact: String(formData.get("contact") ?? "").trim() || null,
        experience: String(formData.get("experience") ?? "") || null,
        occupation: String(formData.get("occupation") ?? "").trim() || null,
        ai_course: String(formData.get("ai_course") ?? "") || null,
        answers,
        scores,
        suggested_role: scores.suggestedRole,
        submitted_at: now,
        updated_at: now,
      },
      { onConflict: "user_id" },
    );

  if (error) {
    redirect(`/questionnaire?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/questionnaire?saved=1");
}
