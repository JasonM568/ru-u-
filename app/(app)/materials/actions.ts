"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireInstructor } from "@/lib/auth";
import { MATERIAL_CATEGORIES, MATERIAL_MAX_BYTES, MATERIALS_BUCKET } from "@/lib/constants";

const PATH_RE = /^[0-9a-f-]{36}\.(txt|jpe?g|png|webp|pdf)$/;

export type RegisterMaterialInput = {
  path: string;
  category: string;
  title: string;
  originalName: string;
  mimeType: string;
  sizeBytes: number;
};

/** 瀏覽器直傳 Storage 成功後呼叫，寫入教材 metadata。失敗時補償刪除已上傳的檔案。 */
export async function registerMaterial(
  input: RegisterMaterialInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { supabase, userId } = await requireInstructor();

  if (!PATH_RE.test(input.path)) return { ok: false, error: "檔案路徑格式不正確" };
  if (!MATERIAL_CATEGORIES.some((c) => c.key === input.category))
    return { ok: false, error: "分類不正確" };
  if (input.sizeBytes <= 0 || input.sizeBytes > MATERIAL_MAX_BYTES)
    return { ok: false, error: "檔案大小超過上限" };

  const { error } = await supabase
    .schema("elite")
    .from("course_materials")
    .insert({
      category: input.category,
      title: input.title.trim() || input.originalName,
      original_name: input.originalName,
      storage_path: input.path,
      mime_type: input.mimeType,
      size_bytes: input.sizeBytes,
      uploaded_by: userId,
    });

  if (error) {
    // metadata 沒寫成，把已直傳的孤兒檔清掉；清不掉也無妨（無 metadata 學員不可見）
    await supabase.storage.from(MATERIALS_BUCKET).remove([input.path]);
    return { ok: false, error: error.message };
  }

  revalidatePath("/materials");
  return { ok: true };
}

// ── 刪除教材（先刪資料列，學員視角立即一致，再刪 storage 檔案）──
export async function deleteMaterial(formData: FormData) {
  const { supabase } = await requireInstructor();
  const id = String(formData.get("id") ?? "").trim();
  if (!id) redirect("/materials");

  const { data, error } = await supabase
    .schema("elite")
    .from("course_materials")
    .delete()
    .eq("id", id)
    .select("storage_path")
    .single();
  if (error) redirect(`/materials?error=${encodeURIComponent(error.message)}`);

  const { error: rmError } = await supabase.storage
    .from(MATERIALS_BUCKET)
    .remove([data.storage_path]);

  revalidatePath("/materials");
  if (rmError)
    redirect(`/materials?deleted=1&warn=${encodeURIComponent(rmError.message)}`);
  redirect("/materials?deleted=1");
}
