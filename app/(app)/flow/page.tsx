import { requireEnrollment } from "@/lib/auth";
import type { FlowConfigRow, PublishedConfig } from "@/lib/flow/config";
import { FlowConsoleLoader } from "./FlowConsoleLoader";

export const metadata = {
  title: "五層作業流控制台 — 菁英班孵化系統",
};

export default async function FlowPage() {
  const { supabase, userId, enrollment } = await requireEnrollment();

  // 講師下發的分段設定（RLS：名冊內都讀得到）＋ 發布者名字（JS 端 Map join）
  const [{ data: cfgRows }, { data: members }] = await Promise.all([
    supabase.schema("elite").from("flow_configs").select("*").order("updated_at", { ascending: false }),
    supabase.schema("elite").from("enrollments").select("user_id, display_name").eq("class_role", "instructor"),
  ]);
  const nameOf = new Map((members ?? []).map((m) => [m.user_id as string, m.display_name as string | null]));
  const configs: PublishedConfig[] = ((cfgRows ?? []) as FlowConfigRow[]).map((r) => ({
    ...r,
    publisher: nameOf.get(r.published_by) ?? null,
  }));

  return (
    <FlowConsoleLoader
      userId={userId}
      isInstructor={enrollment.class_role === "instructor"}
      configs={configs}
    />
  );
}
