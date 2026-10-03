"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";

function str(fd: FormData, k: string): string | null {
  const v = String(fd.get(k) ?? "").trim();
  return v || null;
}
function int(fd: FormData, k: string): number | null {
  const v = String(fd.get(k) ?? "").trim();
  if (!v) return null;
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}

// ── 名冊：新增或更新一位成員 ──
export async function upsertEnrollment(formData: FormData) {
  const { supabase } = await requireInstructor();
  const userId = str(formData, "user_id");
  if (!userId) redirect("/admin/roster?error=nouser");
  let cohort = str(formData, "cohort");
  if (!cohort) {
    const { data: current } = await supabase.schema("elite").from("cohorts").select("code").eq("is_current", true).single();
    cohort = current?.code ?? null;
  }
  if (!cohort) redirect("/admin/roster?error=nocohort");
  const { data: selectedCohort } = await supabase.schema("elite").from("cohorts").select("code").eq("code", cohort).maybeSingle();
  if (!selectedCohort) redirect("/admin/roster?error=invalidcohort");

  const { error } = await supabase
    .schema("elite")
    .from("enrollments")
    .upsert(
      {
        user_id: userId,
        cohort,
        class_role: str(formData, "class_role") ?? "student",
        job_role: str(formData, "job_role"),
        team_id: int(formData, "team_id"),
        display_name: str(formData, "display_name"),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
  if (error) redirect(`/admin/roster?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/roster");
  redirect("/admin/roster?saved=1");
}

export async function setEnrollmentStatus(formData: FormData) {
  const { supabase, userId: me } = await requireInstructor();
  const userId = str(formData, "user_id");
  const status = str(formData, "status");
  if (!userId || !["active", "suspended"].includes(status ?? "") || userId === me)
    redirect("/admin/roster?error=invalidstatus");
  const { data: member } = await supabase.schema("elite").from("enrollments")
    .select("class_role").eq("user_id", userId).maybeSingle();
  if (member?.class_role !== "student") redirect("/admin/roster?error=invalidstatus");
  const { error } = await supabase.schema("elite").from("enrollments")
    .update({ status, updated_at: new Date().toISOString() }).eq("user_id", userId);
  if (error) redirect(`/admin/roster?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/roster");
  redirect("/admin/roster?saved=1");
}

export async function createCohort(formData: FormData) {
  const { supabase } = await requireInstructor();
  const code = str(formData, "code");
  const displayName = str(formData, "display_name");
  if (!code || !/^\d{4}-\d+$/.test(code) || !displayName)
    redirect("/admin/cohorts?error=invalid");
  const { error } = await supabase.schema("elite").from("cohorts").insert({
    code,
    display_name: displayName,
    started_on: str(formData, "started_on"),
  });
  if (error) redirect(`/admin/cohorts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts?saved=1");
}

export async function switchCurrentCohort(formData: FormData) {
  const { supabase } = await requireInstructor();
  const code = str(formData, "code");
  if (!code) redirect("/admin/cohorts?error=invalid");
  const { error } = await supabase.schema("elite").rpc("set_current_cohort", { p_code: code });
  if (error) redirect(`/admin/cohorts?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/cohorts");
  revalidatePath("/admin/roster");
  redirect("/admin/cohorts?current=1");
}

// ── 名冊：移除一位成員 ──
export async function removeEnrollment(formData: FormData) {
  const { supabase, userId: me } = await requireInstructor();
  const userId = str(formData, "user_id");
  if (!userId) redirect("/admin/roster");
  if (userId === me) redirect("/admin/roster?error=self");

  const { error } = await supabase
    .schema("elite")
    .from("enrollments")
    .delete()
    .eq("user_id", userId);
  if (error) redirect(`/admin/roster?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/roster");
  redirect("/admin/roster?removed=1");
}

// ── 問卷：開放某位學員重填（解鎖）──
export async function reopenQuestionnaire(formData: FormData) {
  const { supabase } = await requireInstructor();
  const userId = str(formData, "user_id");
  if (!userId) redirect("/admin/results");

  const { error } = await supabase
    .schema("elite")
    .from("questionnaire_responses")
    .update({ locked: false, updated_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) redirect(`/admin/results?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/results");
  redirect("/admin/results?reopened=1");
}

// ── 成果驗收：儲存一份評分 ──
export async function saveAssessment(formData: FormData) {
  const { supabase, userId } = await requireInstructor();
  const subjectType = str(formData, "subject_type") ?? "individual";

  // 各維度項目分數收成 jsonb
  const dimensions: Record<string, number | string> = {};
  let subtotal = 0;
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("dim_")) {
      const n = Number(v);
      if (Number.isFinite(n) && n > 0) {
        dimensions[k.slice(4)] = n;
        subtotal += n;
      }
    }
  }

  const { error } = await supabase
    .schema("elite")
    .from("assessments")
    .insert({
      subject_type: subjectType,
      subject_user_id: subjectType === "individual" ? str(formData, "subject_user_id") : null,
      team_id: subjectType === "team" ? int(formData, "team_id") : null,
      eval_date: str(formData, "eval_date") ?? new Date().toISOString().slice(0, 10),
      dimensions,
      subtotal,
      verdict: str(formData, "verdict"),
      improvement_notes: str(formData, "improvement_notes"),
      notes: str(formData, "notes"),
      scored_by: userId,
    });
  if (error) redirect(`/admin/assessments?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/assessments");
  redirect("/admin/assessments?saved=1");
}

// ── 孵化過程紀錄：新增一筆 ──
export async function saveProcessNote(formData: FormData) {
  const { supabase, userId } = await requireInstructor();
  const kind = str(formData, "kind") ?? "segment";

  const payload: Record<string, unknown> = {};
  for (const [k, v] of formData.entries()) {
    if (k.startsWith("f_")) payload[k.slice(2)] = String(v);
  }

  const { error } = await supabase
    .schema("elite")
    .from("process_notes")
    .insert({ kind, payload, recorded_by: userId });
  if (error) redirect(`/admin/process-notes?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/admin/process-notes");
  redirect(`/admin/process-notes?saved=1&kind=${kind}`);
}
