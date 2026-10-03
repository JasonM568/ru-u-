"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";
import { MATERIAL_CATEGORIES } from "@/lib/constants";
import { videoEmbedUrl } from "@/lib/video";

export async function createVideo(formData: FormData) {
  const { supabase, userId } = await requireInstructor();

  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim() || null;
  const selectedCohort = String(formData.get("target_cohort") ?? "");

  if (!selectedCohort.trim()) redirect("/videos?error=" + encodeURIComponent("請選擇目標期別"));
  if (!title || !url) redirect("/videos?error=" + encodeURIComponent("標題與網址皆必填"));
  if (!MATERIAL_CATEGORIES.some((c) => c.key === category))
    redirect("/videos?error=" + encodeURIComponent("分類不正確"));
  if (!videoEmbedUrl(url))
    redirect(
      "/videos?error=" +
        encodeURIComponent("無法辨識的影片網址，目前支援 YouTube 與 Vimeo 連結"),
    );
  const { data: cohorts, error: cohortError } = await supabase.schema("elite")
    .from("cohorts").select("code, is_current");
  if (cohortError) redirect("/videos?error=" + encodeURIComponent("無法取得期別"));
  const allCohorts = selectedCohort === "__all__";
  const targetCohort = allCohorts
    ? cohorts?.find((c) => c.is_current)?.code
    : cohorts?.find((c) => c.code === selectedCohort)?.code;
  if (!targetCohort) redirect("/videos?error=" + encodeURIComponent("目標期別不正確"));

  const { error } = await supabase
    .schema("elite")
    .from("course_videos")
    .insert({ category, title, url, note, cohort: targetCohort, all_cohorts: allCohorts, created_by: userId });
  if (error) redirect(`/videos?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/videos");
  redirect("/videos?saved=1");
}

export async function deleteVideo(formData: FormData) {
  const { supabase } = await requireInstructor();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/videos");

  const { error } = await supabase
    .schema("elite")
    .from("course_videos")
    .delete()
    .eq("id", id);
  if (error) redirect(`/videos?error=${encodeURIComponent(error.message)}`);

  revalidatePath("/videos");
  redirect("/videos?deleted=1");
}
