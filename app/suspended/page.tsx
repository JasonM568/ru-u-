import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Card } from "@/components/ui";

export default async function SuspendedPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: status } = await supabase.schema("elite").rpc("my_enrollment_status");
  if (status !== "suspended") redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card>
        <h1 className="text-lg font-bold text-slate-900">菁英班使用權限暫停</h1>
        <p className="mt-2 text-sm text-slate-600">你的帳號目前暫停使用菁英班系統。既有作答與團隊紀錄仍會保留。</p>
        <p className="mt-2 text-sm text-slate-600">如需恢復使用，請聯絡講師團隊；復權後重新登入即可。</p>
        <form action="/auth/signout" method="post" className="mt-5">
          <button type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">登出</button>
        </form>
      </Card>
    </div>
  );
}
