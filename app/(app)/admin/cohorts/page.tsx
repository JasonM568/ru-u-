import { requireInstructor } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { CohortManager } from "./CohortManager";

export default async function CohortsPage({ searchParams }: {
  searchParams: Promise<{ saved?: string; current?: string; error?: string }>;
}) {
  const { supabase } = await requireInstructor();
  const sp = await searchParams;
  const { data, error } = await supabase.schema("elite").from("cohorts")
    .select("code, display_name, started_on, is_current").order("code");
  return (
    <div>
      <PageHeader title="期別管理" subtitle="設定當期後，之後加入名冊的新成員預設進入該期。" />
      {(sp.saved || sp.current) && <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700">期別設定已更新。</p>}
      {(sp.error || error) && <p className="mb-4 rounded-lg bg-rose-50 p-3 text-sm text-rose-700">操作失敗：{sp.error ?? error?.message}</p>}
      <CohortManager cohorts={data ?? []} />
    </div>
  );
}
