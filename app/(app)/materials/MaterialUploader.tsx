"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  MATERIAL_ACCEPT,
  MATERIAL_CATEGORIES,
  MATERIAL_EXT_MIME,
  MATERIAL_MAX_BYTES,
  MATERIALS_BUCKET,
  materialCategoryName,
} from "@/lib/constants";
import { Card, Field, Input, Select, SectionTitle } from "@/components/ui";
import { registerMaterial } from "./actions";

type PendingUpload = {
  file: File;
  category: string;
  title: string;
  mime: string;
  ext: string;
};

type DuplicateInfo = {
  category: string;
  created_at: string;
};

export function MaterialUploader() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [duplicate, setDuplicate] = useState<{
    upload: PendingUpload;
    existing: DuplicateInfo;
  } | null>(null);

  async function doUpload(u: PendingUpload) {
    setPending(true);
    try {
      const path = `${crypto.randomUUID()}.${u.ext}`;
      const supabase = createClient();
      const { error: upError } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .upload(path, u.file, { contentType: u.mime, upsert: false });
      if (upError) {
        setError(`上傳失敗：${upError.message}`);
        return;
      }

      const result = await registerMaterial({
        path,
        category: u.category,
        title: u.title || u.file.name,
        originalName: u.file.name,
        mimeType: u.mime,
        sizeBytes: u.file.size,
      });
      if (!result.ok) {
        setError(`儲存失敗：${result.error}`);
        return;
      }

      formRef.current?.reset();
      setSaved(true);
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    setDuplicate(null);

    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    const category = String(fd.get("category") ?? "");
    const title = String(fd.get("title") ?? "").trim();

    if (!file || file.size === 0) return setError("請選擇檔案");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = MATERIAL_EXT_MIME[ext];
    if (!mime) return setError("僅接受 txt、jpg、png、webp、pdf、zip 檔案");
    if (file.size > MATERIAL_MAX_BYTES) return setError("檔案超過 30 MB 上限");
    if (!category) return setError("請選擇分類");

    // 防呆：同名檔案已存在時先擋下提醒，由講師決定是否仍要上傳
    setPending(true);
    try {
      const supabase = createClient();
      const { data: existing } = await supabase
        .schema("elite")
        .from("course_materials")
        .select("category, created_at")
        .eq("original_name", file.name)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (existing) {
        setDuplicate({
          upload: { file, category, title, mime, ext },
          existing: existing as DuplicateInfo,
        });
        return;
      }
    } finally {
      setPending(false);
    }

    await doUpload({ file, category, title, mime, ext });
  }

  return (
    <Card className="mb-6">
      <SectionTitle hint="僅講師可見。檔案上限 30 MB，接受 txt／jpg／png／webp／pdf／zip。">
        上傳教材
      </SectionTitle>
      {error && (
        <div className="mb-3 rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-700">
          {error}
        </div>
      )}
      {saved && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
          教材已上傳。
        </div>
      )}
      {duplicate && (
        <div className="mb-3 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <p>
            已有同名檔案「{duplicate.upload.file.name}」（分類：
            {materialCategoryName(duplicate.existing.category)}，上傳於{" "}
            {new Date(duplicate.existing.created_at).toLocaleDateString("zh-TW")}
            ）。確定要再上傳一份嗎？若是要更新檔案，建議先刪除舊檔。
          </p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                const u = duplicate.upload;
                setDuplicate(null);
                void doUpload(u);
              }}
              className="rounded-md border border-amber-700/40 px-3 py-1 text-xs font-semibold text-amber-800 transition hover:bg-amber-100"
            >
              仍要上傳
            </button>
            <button
              type="button"
              onClick={() => setDuplicate(null)}
              className="rounded-md border border-slate-300 px-3 py-1 text-xs text-slate-600 transition hover:bg-slate-100"
            >
              取消
            </button>
          </div>
        </div>
      )}
      <form ref={formRef} onSubmit={handleSubmit} className="grid gap-3 sm:grid-cols-2">
        <Field label="檔案" required>
          <Input type="file" name="file" accept={MATERIAL_ACCEPT} required />
        </Field>
        <Field label="分類" required>
          <Select name="category" required defaultValue="">
            <option value="" disabled>
              請選擇分類
            </option>
            {MATERIAL_CATEGORIES.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="標題" hint="留空則使用原始檔名">
          <Input type="text" name="title" placeholder="例：Day 1 講義" />
        </Field>
        <div className="flex items-end">
          <button type="submit" disabled={pending} className="btn-gold w-full rounded-lg px-4 py-2 text-sm font-semibold sm:w-auto">
            {pending ? "處理中…" : "上傳"}
          </button>
        </div>
      </form>
    </Card>
  );
}
