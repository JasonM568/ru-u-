import { requireEnrollment } from "@/lib/auth";
import { MATERIAL_CATEGORIES, MATERIALS_BUCKET } from "@/lib/constants";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { MaterialUploader } from "./MaterialUploader";
import { deleteMaterial } from "./actions";

type Material = {
  id: string;
  category: string;
  title: string;
  original_name: string;
  storage_path: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
};

function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function fileKind(mime: string): string {
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return "圖片";
  return "文字";
}

export default async function MaterialsPage({
  searchParams,
}: {
  searchParams: Promise<{ deleted?: string; error?: string; warn?: string }>;
}) {
  const { supabase, enrollment } = await requireEnrollment();
  const sp = await searchParams;
  const isInstructor = enrollment.class_role === "instructor";

  const { data } = await supabase
    .schema("elite")
    .from("course_materials")
    .select("*")
    .order("created_at", { ascending: false });
  const materials = (data ?? []) as Material[];

  // 批次簽 1 小時效期的下載連結，再逐筆附上原始檔名讓下載落地檔名正確
  const urlByPath = new Map<string, string>();
  if (materials.length > 0) {
    const { data: signed } = await supabase.storage
      .from(MATERIALS_BUCKET)
      .createSignedUrls(
        materials.map((m) => m.storage_path),
        3600,
      );
    for (const s of signed ?? []) {
      if (s.path && s.signedUrl) {
        const m = materials.find((x) => x.storage_path === s.path);
        urlByPath.set(
          s.path,
          `${s.signedUrl}&download=${encodeURIComponent(m?.original_name ?? "")}`,
        );
      }
    }
  }

  // 依固定分類順序分組；不在清單內的舊分類歸到「其他」
  const knownKeys = MATERIAL_CATEGORIES.map((c) => c.key as string);
  const groups: { key: string; name: string; items: Material[] }[] =
    MATERIAL_CATEGORIES.map((c) => ({
      key: c.key,
      name: c.name,
      items: materials.filter((m) => m.category === c.key),
    }));
  const others = materials.filter((m) => !knownKeys.includes(m.category));
  if (others.length > 0) groups.push({ key: "other", name: "其他", items: others });

  return (
    <div>
      <PageHeader
        title="課程教材"
        subtitle={
          isInstructor
            ? "上傳講義與教材，全班學員皆可下載。"
            : "講師提供的講義與教材，點檔名即可下載。"
        }
      />

      {sp.deleted && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          教材已刪除。
        </div>
      )}
      {sp.warn && (
        <div className="mb-4 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800">
          資料已刪除，但檔案清理未完成：{sp.warn}
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          操作失敗：{sp.error}
        </div>
      )}

      {isInstructor && <MaterialUploader />}

      {materials.length === 0 ? (
        <EmptyState>尚無教材。</EmptyState>
      ) : (
        <div className="space-y-6">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.key}>
                <div className="mb-3 border-l-2 border-[color:var(--gold)] pl-3">
                  <h2 className="font-display text-base font-semibold text-slate-800">
                    {g.name}
                  </h2>
                </div>
                <div className="space-y-3">
                  {g.items.map((m) => (
                    <Card key={m.id}>
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <a
                            href={urlByPath.get(m.storage_path) ?? "#"}
                            className="font-medium text-slate-800 underline-offset-2 transition hover:text-[color:var(--gold-bright)] hover:underline"
                          >
                            {m.title}
                          </a>
                          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                            <Badge tone="indigo">{fileKind(m.mime_type)}</Badge>
                            <span>{formatSize(m.size_bytes)}</span>
                            <span>{m.original_name}</span>
                            <span>
                              {new Date(m.created_at).toLocaleDateString("zh-TW")}
                            </span>
                          </div>
                        </div>
                        {isInstructor && (
                          <form action={deleteMaterial}>
                            <input type="hidden" name="id" value={m.id} />
                            <button
                              type="submit"
                              className="rounded-md border border-rose-700/40 px-2.5 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                            >
                              刪除
                            </button>
                          </form>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            ))}
        </div>
      )}

      <p className="mt-6 text-xs text-slate-500">
        下載連結有效 1 小時，過期請重新整理頁面。
      </p>
    </div>
  );
}
