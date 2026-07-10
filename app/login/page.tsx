import { Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">
            菁英班孵化系統 1.0
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            希望學院．菁英班投資團隊
          </p>
        </div>

        <Card>
          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next ?? "/"} />

            {error && (
              <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
                {error}
              </div>
            )}

            <Field label="帳號（Email）" required>
              <Input
                name="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                required
              />
            </Field>

            <Field label="密碼" required>
              <Input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </Field>

            <SubmitButton pendingText="登入中…">登入</SubmitButton>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs text-slate-400">
          使用你的希望學院（QBC）帳號登入即可，無需另行註冊。
        </p>
      </div>
    </div>
  );
}
