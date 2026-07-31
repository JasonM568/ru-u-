import { requireEnrollment } from "@/lib/auth";
import { MATERIAL_CATEGORIES } from "@/lib/constants";
import {
  Card,
  PageHeader,
  EmptyState,
  Field,
  Input,
  Textarea,
  Select,
} from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { videoEmbedUrl } from "@/lib/video";
import { createVideo, deleteVideo } from "./actions";

type Video = {
  id: string;
  category: string;
  title: string;
  url: string;
  note: string | null;
  created_at: string;
};

export default async function VideosPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string; error?: string }>;
}) {
  const { supabase, enrollment } = await requireEnrollment();
  const sp = await searchParams;
  const isInstructor = enrollment.class_role === "instructor";

  const { data } = await supabase
    .schema("elite")
    .from("course_videos")
    .select("*")
    .order("created_at", { ascending: true });
  const videos = (data ?? []) as Video[];

  // 依固定分類順序分組；不在清單內的舊分類歸到「其他」
  const knownKeys = MATERIAL_CATEGORIES.map((c) => c.key as string);
  const groups: { key: string; name: string; items: Video[] }[] =
    MATERIAL_CATEGORIES.map((c) => ({
      key: c.key,
      name: c.name,
      items: videos.filter((v) => v.category === c.key),
    }));
  const others = videos.filter((v) => !knownKeys.includes(v.category));
  if (others.length > 0) groups.push({ key: "other", name: "其他", items: others });

  return (
    <div>
      <PageHeader
        title="課程影片"
        subtitle={
          isInstructor
            ? "貼上 YouTube / Vimeo 連結，全班學員登入後即可觀看。"
            : "講師提供的課程影片，點播放即可觀看。"
        }
      />

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          影片已新增。
        </div>
      )}
      {sp.deleted && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          影片已移除。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          操作失敗：{sp.error}
        </div>
      )}

      {isInstructor && (
        <Card className="mb-6">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-indigo-600">
              ＋ 新增課程影片
            </summary>
            <form action={createVideo} className="mt-4 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="影片標題" required>
                  <Input name="title" required placeholder="如 Day 1 上午：總經框架" />
                </Field>
                <Field label="分類" required>
                  <Select name="category" defaultValue="extra">
                    {MATERIAL_CATEGORIES.map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              </div>
              <Field
                label="影片網址"
                hint="支援 YouTube（含未列出）與 Vimeo 連結"
                required
              >
                <Input
                  name="url"
                  type="url"
                  required
                  placeholder="https://youtu.be/…"
                />
              </Field>
              <Field label="說明（選填）">
                <Textarea name="note" placeholder="這支影片的重點、建議觀看的段落…" />
              </Field>
              <SubmitButton>新增影片</SubmitButton>
            </form>
          </details>
        </Card>
      )}

      {videos.length === 0 ? (
        <EmptyState>尚無課程影片。</EmptyState>
      ) : (
        <div className="space-y-8">
          {groups
            .filter((g) => g.items.length > 0)
            .map((g) => (
              <section key={g.key}>
                <div className="mb-3 border-l-2 border-[color:var(--gold)] pl-3">
                  <h2 className="font-display text-base font-semibold text-slate-800">
                    {g.name}
                  </h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  {g.items.map((v) => {
                    const embed = videoEmbedUrl(v.url);
                    return (
                      <Card key={v.id}>
                        {embed ? (
                          <div className="aspect-video overflow-hidden rounded-lg bg-black">
                            <iframe
                              src={embed}
                              title={v.title}
                              className="h-full w-full"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                              allowFullScreen
                            />
                          </div>
                        ) : (
                          <a
                            href={v.url}
                            target="_blank"
                            rel="noreferrer"
                            className="block rounded-lg bg-slate-50 p-4 text-sm text-slate-700 underline-offset-2 hover:underline"
                          >
                            ▶ 開啟影片連結
                          </a>
                        )}
                        <div className="mt-3 flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="font-medium text-slate-800">{v.title}</p>
                            {v.note && (
                              <p className="mt-1 whitespace-pre-wrap text-xs text-slate-500">
                                {v.note}
                              </p>
                            )}
                            <p className="mt-1 text-xs text-slate-400">
                              {new Date(v.created_at).toLocaleDateString("zh-TW")}
                            </p>
                          </div>
                          {isInstructor && (
                            <form action={deleteVideo}>
                              <input type="hidden" name="id" value={v.id} />
                              <button
                                type="submit"
                                className="rounded-md border border-rose-700/40 px-2.5 py-1 text-xs text-rose-600 transition hover:bg-rose-50"
                              >
                                移除
                              </button>
                            </form>
                          )}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              </section>
            ))}
        </div>
      )}
    </div>
  );
}
