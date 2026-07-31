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

  if (!title || !url) redirect("/videos?error=" + encodeURIComponent("標題與網址皆必填"));
  if (!MATERIAL_CATEGORIES.some((c) => c.key === category))
    redirect("/videos?error=" + encodeURIComponent("分類不正確"));
  if (!videoEmbedUrl(url))
    redirect(
      "/videos?error=" +
        encodeURIComponent("無法辨識的影片網址，目前支援 YouTube 與 Vimeo 連結"),
    );

  const { error } = await supabase
    .schema("elite")
    .from("course_videos")
    .insert({ category, title, url, note, created_by: userId });
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
