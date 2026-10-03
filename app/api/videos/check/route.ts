import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { inspectVideo } from "@/lib/video-status";
import { videoEmbedUrl } from "@/lib/video";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "請先登入" }, { status: 401 });
  const { data: enrollment } = await supabase.schema("elite").from("enrollments")
    .select("class_role,status").eq("user_id", user.id).maybeSingle();
  if (enrollment?.class_role !== "instructor" || enrollment.status !== "active")
    return NextResponse.json({ error: "無權檢查影片" }, { status: 403 });
  const url = new URL(request.url).searchParams.get("url") ?? "";
  if (!videoEmbedUrl(url)) return NextResponse.json({ error: "網址格式不正確" }, { status: 400 });
  return NextResponse.json({ status: await inspectVideo(url) });
}
