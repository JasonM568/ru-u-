import { requireInstructor } from "@/lib/auth";
import { Card, PageHeader, Badge, EmptyState } from "@/components/ui";
import { ProcessNoteForm } from "./ProcessNoteForm";

const KIND_TITLE: Record<string, string> = {
  segment: "表一　環節觀察",
  stuck: "表二　卡點彙整",
  dependency: "表三　依賴清單",
  good_moves: "表四　有效動作庫",
  daily: "表五　每日總結",
};

export default async function ProcessNotesPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const { supabase } = await requireInstructor();
  const sp = await searchParams;

  const { data: notes } = await supabase
    .schema("elite")
    .from("process_notes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <PageHeader
        title="孵化過程紀錄"
        subtitle="模組 E：把「顧及然親自帶」轉化成「系統可複製」的原料，萃取 2.0 藍本。僅講師可見，不對學員公開。"
      />

      <div className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-xs text-amber-800">
        🔒 本頁與所有觀察紀錄僅講師可見，學員端在資料庫層即被封鎖。
      </div>

      {sp.saved && (
        <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          紀錄已儲存。
        </div>
      )}
      {sp.error && (
        <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-700">
          儲存失敗：{sp.error}
        </div>
      )}

      <ProcessNoteForm />

      <h2 className="mb-3 font-semibold text-slate-800">已記錄的觀察</h2>
      {!notes || notes.length === 0 ? (
        <EmptyState>尚無紀錄。</EmptyState>
      ) : (
        <div className="space-y-3">
          {notes.map((n) => {
            const payload = (n.payload ?? {}) as Record<string, string>;
            return (
              <Card key={n.id}>
                <div className="mb-2">
                  <Badge tone="indigo">{KIND_TITLE[n.kind] ?? n.kind}</Badge>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {Object.entries(payload)
                    .filter(([, v]) => v)
                    .map(([k, v]) => (
                      <div key={k}>
                        <dt className="text-xs text-slate-400">{k}</dt>
                        <dd className="whitespace-pre-wrap text-slate-700">{v}</dd>
                      </div>
                    ))}
                </dl>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
