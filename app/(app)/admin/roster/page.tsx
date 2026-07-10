import { requireInstructor } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { RosterManager } from "./RosterManager";

export default async function RosterPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; removed?: string; error?: string }>;
}) {
  const { supabase } = await requireInstructor();
  const sp = await searchParams;

  const [{ data: profiles }, { data: enrollments }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, display_name, email")
      .order("display_name", { ascending: true }),
    supabase
      .schema("elite")
      .from("enrollments")
      .select("user_id, class_role, job_role, team_id, display_name")
      .order("team_id", { ascending: true }),
  ]);

  return (
    <div>
      <PageHeader
        title="名冊與分組"
        subtitle="從 QBC 會員挑人加入本班，指派身分、隊伍與職務。學員登入後即以此為權限依據。"
      />

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          名冊已更新。
        </div>
      )}
      {sp.removed && (
        <div className="mb-4 rounded-lg bg-slate-100 px-4 py-3 text-sm text-slate-600">
          已從名冊移除。
        </div>
      )}
      {sp.error === "self" && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          不能移除自己。
        </div>
      )}
      {sp.error && sp.error !== "self" && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          操作失敗：{sp.error}
        </div>
      )}

      <RosterManager
        profiles={profiles ?? []}
        enrollments={enrollments ?? []}
      />
    </div>
  );
}
