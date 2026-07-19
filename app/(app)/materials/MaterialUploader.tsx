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
} from "@/lib/constants";
import { Card, Field, Input, Select, SectionTitle } from "@/components/ui";
import { registerMaterial } from "./actions";

export function MaterialUploader() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSaved(false);

    const fd = new FormData(e.currentTarget);
    const file = fd.get("file") as File | null;
    const category = String(fd.get("category") ?? "");
    const title = String(fd.get("title") ?? "").trim();

    if (!file || file.size === 0) return setError("請選擇檔案");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const mime = MATERIAL_EXT_MIME[ext];
    if (!mime) return setError("僅接受 txt、jpg、png、webp、pdf 檔案");
    if (file.size > MATERIAL_MAX_BYTES) return setError("檔案超過 20 MB 上限");
    if (!category) return setError("請選擇分類");

    setPending(true);
    try {
      const path = `${crypto.randomUUID()}.${ext}`;
      const supabase = createClient();
      const { error: upError } = await supabase.storage
        .from(MATERIALS_BUCKET)
        .upload(path, file, { contentType: mime, upsert: false });
      if (upError) {
        setError(`上傳失敗：${upError.message}`);
        return;
      }

      const result = await registerMaterial({
        path,
        category,
        title: title || file.name,
        originalName: file.name,
        mimeType: mime,
        sizeBytes: file.size,
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

  return (
    <Card className="mb-6">
      <SectionTitle hint="僅講師可見。檔案上限 20 MB，接受 txt／jpg／png／webp／pdf。">
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
            {pending ? "上傳中…" : "上傳"}
          </button>
        </div>
      </form>
    </Card>
  );
}
