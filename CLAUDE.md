@AGENTS.md

# 菁英班孵化系統 1.0 — 開發脈絡（維護前必讀）

完整交班見 **HANDOFF.md**。以下是動任何程式碼前必須知道的鐵則。

## 鐵則（違反會出大事）

1. **共用正式庫**：Supabase `qubjpayeopvscrgrvrci` 是 QBC 正式庫（239 會員的真實資料）。本系統所有表**只放在 `elite` schema**，**永遠不要在 `public` 建表或改動既有資料**。
2. **RLS 是安全邊界**：`elite.assessments`（成果驗收）與 `elite.process_notes`（孵化過程）**學員完全不可見**——靠 RLS 政策封鎖，不是靠前端隱藏。改這兩張表的存取邏輯前，先確認 RLS 沒被繞過。用 `elite.is_instructor()` 判斷講師。
3. **登入沿用 QBC 帳號**：不做註冊流程。誰是本班學員/講師由 `elite.enrollments` 名冊決定（講師在 `/admin/roster` 指派）。
4. **不用 service role key**：所有操作走「已登入使用者」的 session + RLS。前端只有兩個公開環境變數（見 HANDOFF）。

## Next.js 16 注意（此版有 breaking changes，另見 AGENTS.md）

- middleware 已改名 **`proxy.ts`**（函式名 `proxy`，nodejs runtime）。
- `cookies()`、`params`、`searchParams` 皆為 **async**，務必 `await`。
- 預設 Turbopack。

## 架構速覽

- 認證閘門：`proxy.ts`（未登入→`/login`）＋ `lib/auth.ts`（`requireEnrollment`／`requireInstructor`，頁面層）。
- Supabase 存取一律 `supabase.schema("elite").from(...)`（`elite` 已曝露給 PostgREST）。
- 計分：改計分規則只動 `lib/scoring.ts`（純函式），改完跑 `npx tsx scripts/test-scoring.ts`。送出時 server action 會**重算**，前端只是預覽。
- 題庫在 `lib/questionnaire.ts`；五職務/隊伍在 `lib/constants.ts`。

## 慣例

- 繁體中文 UI、手機友善、Tailwind。
- server action 放各路由的 `actions.ts`，錯誤用 `redirect('?error=...')` 帶回頁面顯示。
- 改完 push `main` 會自動部署到 https://elite.huangxi.info 。
