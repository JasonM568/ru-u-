"use server";

import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";
import { MATERIAL_CATEGORIES } from "@/lib/constants";
import { videoEmbedUrl } from "@/lib/video";
import { inspectVideo } from "@/lib/video-status";

export type AudienceInput = { cohorts: string[]; all: boolean; users: string[] };
export type ActionResult = { error?: string; id?: string };

function refreshVideoPages(ids: string[] = []) {
  revalidatePath("/videos");
  for (const id of ids) revalidatePath(`/videos/${id}`);
}

export async function createVideo(formData: FormData): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const title = String(formData.get("title") ?? "").trim();
  const url = String(formData.get("url") ?? "").trim();
  const category = String(formData.get("category") ?? "").trim();
  const note = String(formData.get("note") ?? "").trim();
  if (!title || !url) return { error: "標題與網址皆必填" };
  if (!MATERIAL_CATEGORIES.some((c) => c.key === category)) return { error: "分類不正確" };
  if (!videoEmbedUrl(url)) return { error: "無法辨識的影片網址，目前支援 YouTube 與 Vimeo" };
  const status = await inspectVideo(url);
  if (status === "private") return { error: "這支 YouTube 影片是私人影片，請改成「不公開」再新增" };
  const { data, error } = await supabase.schema("elite").rpc("video_create", {
    p_title: title, p_url: url, p_category: category, p_note: note,
  });
  if (error) return { error: error.message };
  refreshVideoPages();
  return { id: String(data) };
}

export async function saveVideoAudiences(id: string, audience: AudienceInput, publish: boolean): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  if (!id) return { error: "找不到影片" };
  if (audience.all && audience.cohorts.length) return { error: "「所有期別」不可同時選指定期別" };
  if (publish && !audience.all && !audience.cohorts.length && !audience.users.length)
    return { error: "請至少選擇一個開通對象" };
  const { error } = await supabase.schema("elite").rpc("video_set_audiences", {
    p_video_id: id, p_cohorts: audience.cohorts, p_all: audience.all,
    p_users: audience.users, p_publish: publish,
  });
  if (error) return { error: error.message };
  refreshVideoPages([id]);
  return {};
}

export async function applyCategoryAudiences(id: string, audience: AudienceInput): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  if (!id || (audience.all && audience.cohorts.length) ||
      (!audience.all && !audience.cohorts.length && !audience.users.length))
    return { error: "請先選擇有效的開通對象" };
  const { error } = await supabase.schema("elite").rpc("video_apply_category", {
    p_source_id: id, p_cohorts: audience.cohorts, p_all: audience.all,
    p_users: audience.users, p_publish: true,
  });
  if (error) return { error: error.message };
  refreshVideoPages();
  return {};
}

export async function deleteVideo(id: string): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").rpc("video_delete", { p_video_id: id });
  if (error) return { error: error.message };
  refreshVideoPages([id]);
  return {};
}
