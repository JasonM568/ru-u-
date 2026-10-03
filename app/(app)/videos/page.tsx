import Link from "next/link";
import { requireEnrollment } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import { videoGroups, orderedVideos, type Video, type VideoAudience, type RosterMember } from "@/lib/video-course";
import { VideoAdmin } from "./VideoAdmin";

export default async function VideosPage() {
  const { supabase, enrollment } = await requireEnrollment();
  const instructor = enrollment.class_role === "instructor";
  const { data, error } = await supabase.schema("elite").from("course_videos")
    .select("id,title,url,category,note,created_at,published_at")
    .order("created_at", { ascending: true });
  const videos = orderedVideos((data ?? []) as Video[]);
  const [audienceResult, cohortResult, rosterResult] = instructor ? await Promise.all([
    supabase.schema("elite").from("video_audiences").select("video_id,kind,cohort_code,target_user_id"),
    supabase.schema("elite").from("cohorts").select("code,display_name").order("code"),
    supabase.schema("elite").from("enrollments").select("user_id,display_name,cohort,team_id,class_role,status")
      .order("display_name"),
  ]) : [{data:[]},{data:[]},{data:[]}];
  return <div>
    <PageHeader title="課程影片" subtitle={instructor
      ? "依章節管理影片；草稿先試播，再選擇對象開通。"
      : "依課程順序觀看，點選一堂即可進入播放頁。"} />
    {instructor && <VideoAdmin videos={videos}
      audiences={(audienceResult.data ?? []) as VideoAudience[]}
      cohorts={(cohortResult.data ?? []) as {code:string;display_name:string}[]}
      roster={(rosterResult.data ?? []) as RosterMember[]} />}
    {error ? <EmptyState>暫時無法取得影片，請稍後重試。</EmptyState>
      : videos.length === 0 ? <EmptyState>目前沒有可觀看的課程影片。</EmptyState>
        : <div className="space-y-7">{videoGroups(videos).map((group) => <section key={group.key}>
          <div className="mb-3 border-l-2 border-[color:var(--gold)] pl-3">
            <h2 className="font-display text-lg font-semibold text-slate-800">{group.name}</h2>
            <p className="text-xs text-slate-400">{group.videos.length} 堂</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">{group.videos.map((video,index) => <Link
            key={video.id} href={`/videos/${video.id}`} className="block rounded-xl focus-visible:outline-2 focus-visible:outline-amber-600">
            <Card className="h-full transition hover:border-amber-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3"><span className="mt-0.5 font-display text-lg text-amber-700">{String(index+1).padStart(2,"0")}</span>
                  <div><h3 className="font-semibold text-slate-800">{video.title}</h3>
                    {video.note && <p className="mt-1 line-clamp-2 text-sm text-slate-400">{video.note}</p>}
                  </div></div>
                {instructor && !video.published_at && <Badge tone="amber">草稿</Badge>}
              </div>
              <div className="mt-4 flex items-center justify-between text-xs text-slate-400">
                <span>{new Date(video.created_at).toLocaleDateString("zh-TW")}</span><span>觀看課程 →</span>
              </div>
            </Card>
          </Link>)}</div>
        </section>)}</div>}
  </div>;
}
