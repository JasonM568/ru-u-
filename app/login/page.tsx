import Image from "next/image";
import { Card, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/SubmitButton";
import { signIn } from "./actions";

// 帳號與課程平台共用（同帳同密）→ 忘記密碼一律至課程平台重設
const COURSE_RESET_URL = "https://course.huangxi.info/forgot-password";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-7 flex flex-col items-center text-center">
          <Image
            src="/qec-logo.png"
            alt="QEC 量子菁英俱樂部"
            width={748}
            height={854}
            priority
            className="h-32 w-auto"
          />
          <h1 className="font-display mt-4 text-2xl font-bold tracking-wide text-gold">
            投資菁英班
          </h1>
          <p className="mt-1 text-[11px] tracking-[0.25em] text-slate-500">
            QUANTUM ELITE CLUB
          </p>
          <p className="mt-2 text-sm text-slate-400">孵化系統 1.0　·　登入</p>
        </div>

        <Card>
          <form action={signIn} className="space-y-4">
            <input type="hidden" name="next" value={next ?? "/"} />

            {error && (
              <div className="rounded-lg border border-rose-700/40 bg-rose-50 px-3 py-2 text-sm text-rose-600">
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

            <div className="flex items-center justify-between gap-2 pt-1">
              <SubmitButton pendingText="登入中…">登入</SubmitButton>
              <a
                href={COURSE_RESET_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-slate-400 underline-offset-2 transition hover:text-[color:var(--gold-bright)] hover:underline"
              >
                忘記密碼？
              </a>
            </div>
          </form>
        </Card>

        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">
          使用你的希望學院（QBC）帳號登入即可，無需另行註冊。
          <br />
          忘記密碼請至
          <a
            href={COURSE_RESET_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mx-1 text-[color:var(--gold)] underline-offset-2 hover:underline"
          >
            課程平台
          </a>
          重設，重設後回此登入（兩站同帳號密碼）。
        </p>
      </div>
    </div>
  );
}
