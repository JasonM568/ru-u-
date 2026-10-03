import Link from "next/link";
import { notFound } from "next/navigation";
import { requireEnrollment } from "@/lib/auth";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { videoGroups, type Video, type VideoCourse } from "@/lib/video-course";

export default async function CoursePage({ params }: { params: Promise<{courseId:string}> }) {
  const { courseId } = await params;
  const { supabase, enrollment } = await requireEnrollment();
  const { data: raw, error } = await supabase.schema("elite").from("video_courses")
    .select("id,title,note,created_at").eq("id",courseId).maybeSingle();
  if (error || !raw) notFound();
  const course = raw as VideoCourse;
  const { data, error: videoError } = await supabase.schema("elite").from("course_videos")
    .select("id,course_id,title,url,category,note,created_at,published_at")
    .eq("course_id",courseId).order("created_at");
  const videos = (data ?? []) as Video[];
  const instructor = enrollment.class_role === "instructor";
  return <div>
    <Link href="/videos" className="mb-4 inline-block text-sm text-amber-700 hover:underline">← 返回課程列表</Link>
    <PageHeader title={course.title} subtitle={course.note ?? "依分段選擇影片觀看。"} />
    {videoError ? <EmptyState>暫時無法取得影片，請稍後重試。</EmptyState>
      : videos.length === 0 ? <EmptyState>這門課目前沒有可觀看的影片。</EmptyState>
        : <div className="space-y-8">{videoGroups(videos).map((group) => <section key={group.key}>
          <div className="mb-3 border-l-2 border-[color:var(--gold)] pl-3">
            <h2 className="font-display text-xl font-semibold text-slate-900">{group.name}</h2>
            <p className="text-xs text-slate-500">{group.videos.length} 支影片</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{group.videos.map((video,index) => <Link
            key={video.id} href={`/videos/${video.id}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-amber-600">
            <Card className="h-full transition hover:border-amber-700">
              <div className="flex items-start gap-3"><span className="font-display text-lg text-amber-700">{String(index+1).padStart(2,"0")}</span>
                <div className="min-w-0"><h3 className="font-semibold text-slate-900">{video.title}</h3>
                  {video.note && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{video.note}</p>}</div>
                {instructor && !video.published_at && <Badge tone="amber">草稿</Badge>}
              </div>
              <p className="mt-4 text-xs text-slate-500">播放影片 →</p>
            </Card>
          </Link>)}</div>
        </section>)}</div>}
  </div>;
}
