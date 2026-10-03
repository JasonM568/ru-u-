import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEnrollment } from "@/lib/auth";
import { videoEmbedUrl } from "@/lib/video";
import { inspectVideo } from "@/lib/video-status";
import { categoryName, orderedVideos, videoGroups, type Video } from "@/lib/video-course";
import { Badge } from "@/components/ui";

function Sidebar({ videos, current }: { videos: Video[]; current: string }) {
  return <nav aria-label="課程章節" className="space-y-5">{videoGroups(videos).map((group) => <section key={group.key}>
    <h2 className="mb-2 text-xs font-semibold tracking-wider text-amber-700">{group.name}</h2>
    <ol className="space-y-1">{group.videos.map((v,index) => <li key={v.id}>
      <Link href={`/videos/${v.id}`} aria-current={v.id === current ? "page" : undefined}
        className={`flex gap-2 rounded-lg px-3 py-2 text-sm transition ${v.id === current
          ? "border border-amber-700/60 bg-amber-50 text-amber-700"
          : "text-slate-600 hover:bg-slate-100"}`}>
        <span className="shrink-0 opacity-60">{String(index+1).padStart(2,"0")}</span>
        <span>{v.title}{!v.published_at && <span className="ml-1 text-amber-600">· 草稿</span>}</span>
      </Link>
    </li>)}</ol>
  </section>)}</nav>;
}

export default async function VideoPage({ params }: { params: Promise<{id:string}> }) {
  const { id } = await params;
  const { supabase, enrollment } = await requireEnrollment();
  const { data: raw, error } = await supabase.schema("elite").from("course_videos")
    .select("id,course_id,title,url,category,note,created_at,published_at").eq("id",id).maybeSingle();
  if (error || !raw) notFound();
  const video = raw as Video;
  const { data: course } = await supabase.schema("elite").from("video_courses")
    .select("id,title").eq("id",video.course_id).maybeSingle();
  if (!course) notFound();
  const { data } = await supabase.schema("elite").from("course_videos")
    .select("id,course_id,title,url,category,note,created_at,published_at")
    .eq("course_id",video.course_id).order("created_at");
  const visible = orderedVideos((data ?? []) as Video[]);
  const index = visible.findIndex((v) => v.id === id);
  if (index < 0) notFound();
  const previous = visible[index-1], next = visible[index+1];
  const status = await inspectVideo(video.url);
  const embed = videoEmbedUrl(video.url);
  const instructor = enrollment.class_role === "instructor";
  return <div>
    <Link href={`/videos/courses/${video.course_id}`} className="mb-4 inline-block text-sm text-amber-700 hover:underline">← 返回{course.title}</Link>
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
      <main className="min-w-0">
        <div className="aspect-video overflow-hidden rounded-xl border border-slate-300 bg-black">
          {status !== "private" && embed ? <iframe title={video.title} src={embed}
            className="h-full w-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
            : <div className="flex h-full items-center justify-center p-5 text-center text-sm text-slate-800" role="status">
              {status === "private" ? instructor
                ? "這支在 YouTube 是私人影片，請改成「不公開」才能播放"
                : "影片尚未開放"
                : "影片網址無法辨識，請聯絡講師"}
            </div>}
        </div>
        <p className="mt-2 text-xs text-slate-500">若影片無法播放，可能仍在 YouTube 處理中，請稍後再試。</p>
        <div className="mt-5 flex flex-wrap items-center gap-2"><span className="text-sm text-amber-700">{categoryName(video.category)}</span>
          {instructor && !video.published_at && <Badge tone="amber">草稿 · 僅講師可見</Badge>}
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold text-slate-900">{video.title}</h1>
        {video.note && <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-600">{video.note}</p>}
        <div className="mt-8 flex items-center justify-between gap-3 border-t border-slate-300 pt-5 text-sm">
          {previous ? <Link href={`/videos/${previous.id}`} className="btn-ghost rounded-lg px-4 py-2">← 上一集<span className="hidden sm:inline">：{previous.title}</span></Link> : <span />}
          {next ? <Link href={`/videos/${next.id}`} className="btn-gold rounded-lg px-4 py-2">下一集<span className="hidden sm:inline">：{next.title}</span> →</Link> : <span />}
        </div>
        <details className="qec-card mt-6 rounded-xl p-4 lg:hidden">
          <summary className="cursor-pointer font-semibold">課程章節 · 點此展開</summary>
          <div className="mt-4"><Sidebar videos={visible} current={id} /></div>
        </details>
      </main>
      <aside className="qec-card hidden self-start rounded-xl p-4 lg:block"><h2 className="mb-4 font-semibold">課程章節</h2>
        <Sidebar videos={visible} current={id} /></aside>
    </div>
  </div>;
}
