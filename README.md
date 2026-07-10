# 菁英班孵化系統 1.0

希望學院．菁英班投資團隊「孵化系統 1.0」線上填寫平台。學員與講師以 QBC 既有帳號登入，線上填寫**職務適性問卷、成果驗收、團隊運轉紀錄、孵化過程紀錄**四類表單；問卷可自動計分並建議職務分流。

- 正式站：https://elite.huangxi.info
- 交班/維運細節見 **[HANDOFF.md](./HANDOFF.md)**；開發脈絡與鐵則見 **[CLAUDE.md](./CLAUDE.md)**

## 技術棧

Next.js 16（App Router）· TypeScript · Tailwind v4 · `@supabase/ssr` · Supabase（Auth + Postgres + RLS）· Vercel

## 快速開始

```bash
npm install
# 建立 .env.local（見下）
npm run dev      # http://localhost:3000
```

`.env.local`：
```
NEXT_PUBLIC_SUPABASE_URL=https://qubjpayeopvscrgrvrci.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_TVSonFIGTq1sI75A8o7xQg_95grIHPL
```

其他指令：
```bash
npm run build                    # 正式建置
npx tsc --noEmit                 # 型別檢查
npx tsx scripts/test-scoring.ts  # 計分邏輯單元測試
```

## 專案結構

```
app/
  (app)/            登入後區域（含 nav），layout 做 requireEnrollment 閘門
    page.tsx        角色感知儀表板（學員/講師不同）
    questionnaire/  25 題問卷（前端即時預覽 + server action 重算存分）
    team/           團隊運轉三表：meetings / ledger / reviews
    admin/          講師後台（layout 做 requireInstructor）
                    roster / results / assessments / teams / process-notes / schedule
  login/  not-enrolled/  auth/signout/
components/          UI primitives、AppNav、SubmitButton、QuestionnaireReview
lib/
  supabase/         @supabase/ssr client / server / middleware 三件套
  auth.ts           getSessionContext / requireEnrollment / requireInstructor
  scoring.ts        計分引擎（純函式）
  questionnaire.ts  25 題題庫
  constants.ts      五職務 / 隊伍
proxy.ts            Next 16 的 middleware（認證閘門）
```

## 資料模型

所有資料表隔離在 Supabase 的獨立 **`elite` schema**（不污染共用正式庫的 `public`）。權限以 Postgres RLS 強制：成果驗收與孵化紀錄**僅講師可讀**。詳見 [HANDOFF.md](./HANDOFF.md)。

## 部署

連接 GitHub `JasonM568/ru-u-`；`git push origin main` 觸發 Vercel 自動部署。
