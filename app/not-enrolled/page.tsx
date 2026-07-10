import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth";
import { Card } from "@/components/ui";

export default async function NotEnrolledPage() {
  const ctx = await getSessionContext();
  if (ctx.enrollment) redirect("/");

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md">
        <Card>
          <h1 className="text-lg font-bold text-slate-900">尚未加入本班</h1>
          <p className="mt-2 text-sm text-slate-600">
            你的帳號（{ctx.email}）目前不在菁英班名冊中，因此還無法使用系統。
          </p>
          <p className="mt-2 text-sm text-slate-600">
            請聯絡講師團隊將你加入名冊；加入後重新登入即可。
          </p>
          <form action="/auth/signout" method="post" className="mt-5">
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              登出
            </button>
          </form>
        </Card>
      </div>
    </div>
  );
}
