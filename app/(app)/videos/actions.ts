"use server";

import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";
import { MATERIAL_CATEGORIES } from "@/lib/constants";
import { videoEmbedUrl } from "@/lib/video";
import { inspectVideo } from "@/lib/video-status";

export type GrantInput = { cohorts: string[]; users: string[] };
export type ActionResult = { error?: string; id?: string };

function refresh(courseIds: string[] = [], videoIds: string[] = []) {
  revalidatePath("/videos");
  for (const id of courseIds) revalidatePath(`/videos/courses/${id}`);
  for (const id of videoIds) revalidatePath(`/videos/${id}`);
}

export async function createCourse(form: FormData): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const title = String(form.get("title") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (!title) return { error: "請輸入課程名稱" };
  const { data, error } = await supabase.schema("elite").rpc("video_course_create", {
    p_title: title, p_note: note,
  });
  if (error) return { error: error.message };
  refresh();
  return { id: String(data) };
}

export async function updateCourse(id: string, title: string, note: string): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  if (!title.trim()) return { error: "請輸入課程名稱" };
  const { error } = await supabase.schema("elite").rpc("video_course_update", {
    p_course_id: id, p_title: title.trim(), p_note: note.trim(),
  });
  if (error) return { error: error.message };
  refresh([id]);
  return {};
}

export async function setCourseGrants(id: string, grants: GrantInput): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").rpc("video_course_set_grants", {
    p_course_id: id, p_cohorts: grants.cohorts, p_users: grants.users,
  });
  if (error) return { error: error.message };
  refresh([id]);
  return {};
}

export async function deleteCourse(id: string): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").rpc("video_course_delete", { p_course_id: id });
  if (error) return { error: error.message };
  refresh([id]);
  return {};
}

export async function createVideo(form: FormData): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const courseId = String(form.get("course_id") ?? "").trim();
  const title = String(form.get("title") ?? "").trim();
  const url = String(form.get("url") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();
  const note = String(form.get("note") ?? "").trim();
  if (!courseId || !title || !url) return { error: "課程、影片標題與網址皆必填" };
  if (!MATERIAL_CATEGORIES.some((c) => c.key === category)) return { error: "分段不正確" };
  if (!videoEmbedUrl(url)) return { error: "無法辨識的影片網址，目前支援 YouTube 與 Vimeo" };
  if (await inspectVideo(url) === "private")
    return { error: "這支 YouTube 影片是私人影片，請改成「不公開」再新增" };
  const { data, error } = await supabase.schema("elite").rpc("course_video_create", {
    p_course_id: courseId, p_title: title, p_url: url, p_category: category, p_note: note,
  });
  if (error) return { error: error.message };
  refresh([courseId]);
  return { id: String(data) };
}

export async function publishVideo(id: string, courseId: string, publish: boolean): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").rpc("course_video_publish", {
    p_video_id: id, p_publish: publish,
  });
  if (error) return { error: error.message };
  refresh([courseId], [id]);
  return {};
}

export async function moveVideo(id: string, oldCourseId: string, newCourseId: string): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").rpc("course_video_move", {
    p_video_id: id, p_course_id: newCourseId,
  });
  if (error) return { error: error.message };
  refresh([oldCourseId, newCourseId], [id]);
  return {};
}

export async function deleteVideo(id: string, courseId: string): Promise<ActionResult> {
  const { supabase } = await requireInstructor();
  const { error } = await supabase.schema("elite").rpc("course_video_delete", { p_video_id: id });
  if (error) return { error: error.message };
  refresh([courseId], [id]);
  return {};
}
