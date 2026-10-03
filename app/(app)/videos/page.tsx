import Link from "next/link";
import { requireEnrollment } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import type { Video, VideoCourse, CourseGrant, RosterMember } from "@/lib/video-course";
import { VideoCourseAdmin } from "./VideoCourseAdmin";

export default async function VideosPage() {
  const { supabase, enrollment } = await requireEnrollment();
  const instructor = enrollment.class_role === "instructor";
  const [courseResult, videoResult] = await Promise.all([
    supabase.schema("elite").from("video_courses").select("id,title,note,created_at")
      .order("created_at", { ascending: true }),
    supabase.schema("elite").from("course_videos")
      .select("id,course_id,title,url,category,note,created_at,published_at"),
  ]);
  const courses = (courseResult.data ?? []) as VideoCourse[];
  const videos = (videoResult.data ?? []) as Video[];
  const [grantResult, cohortResult, rosterResult] = instructor ? await Promise.all([
    supabase.schema("elite").from("course_grants").select("course_id,kind,cohort_code,target_user_id"),
    supabase.schema("elite").from("cohorts").select("code,display_name").order("code"),
    supabase.schema("elite").from("enrollments")
      .select("user_id,display_name,cohort,team_id,class_role,status").order("display_name"),
  ]) : [{ data: [] }, { data: [] }, { data: [] }];

  return <div>
    <PageHeader title="課程影片" subtitle={instructor
      ? "以課程管理開通對象；影片先試播、再發布。"
      : "先選課程，再依 Day 1、Day 2 等分段觀看。"} />
    {instructor && <VideoCourseAdmin courses={courses} videos={videos}
      grants={(grantResult.data ?? []) as CourseGrant[]}
      cohorts={(cohortResult.data ?? []) as {code:string;display_name:string}[]}
      roster={(rosterResult.data ?? []) as RosterMember[]} />}
    {courseResult.error || videoResult.error ? <EmptyState>暫時無法取得課程，請稍後重試。</EmptyState>
      : courses.length === 0 ? <EmptyState>目前沒有可觀看的課程。</EmptyState>
        : <div className="grid gap-4 sm:grid-cols-2">{courses.map((course) => {
          const included = videos.filter((v) => v.course_id === course.id);
          const published = included.filter((v) => v.published_at).length;
          return <Link key={course.id} href={`/videos/courses/${course.id}`}
            className="block rounded-xl focus-visible:outline-2 focus-visible:outline-amber-600">
            <Card className="h-full transition hover:border-amber-700">
              <div className="flex items-start justify-between gap-3">
                <h2 className="font-display text-xl font-semibold text-slate-900">{course.title}</h2>
                {instructor && published === 0 && <Badge tone="amber">尚無已發布影片</Badge>}
              </div>
              {course.note && <p className="mt-3 line-clamp-2 text-sm text-slate-600">{course.note}</p>}
              <p className="mt-5 text-sm text-amber-700">{published} 支已發布影片{instructor && included.length > published ? ` · ${included.length-published} 支草稿` : ""}</p>
              <p className="mt-2 text-xs text-slate-500">進入課程 →</p>
            </Card>
          </Link>;
        })}</div>}
  </div>;
}
