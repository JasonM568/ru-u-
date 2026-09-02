# HANDOFF — 菁英班孵化系統 1.0

> 交班單。最後更新：2026-09-02。維護前先讀這份 + `CLAUDE.md`。

## 這是什麼

希望學院．菁英班投資團隊「孵化系統 1.0」的線上填寫平台。學員與講師用 **QBC 既有帳號**登入，線上填寫四類表單。7/18–19 兩天課程使用，最緊迫的是第一天問卷「當場計分 → 分組」。

- **正式網址**：https://elite.huangxi.info （自訂網域）
- **Vercel 別名**：https://ru-u.vercel.app
- **GitHub**：https://github.com/JasonM568/ru-u-.git （branch `main`，push 即自動部署）
- **Vercel 專案**：`ru-u`（`prj_aTiN5krxDDG9sSKoTCuaeOvuNWfX`），team `TJ's projects`（`team_3uui5KByNy4YiVCUPVCsObPs`）

## 技術棧

Next.js 16（App Router，**middleware 已改名 `proxy.ts`**）＋ TypeScript ＋ Tailwind v4 ＋ `@supabase/ssr`。DB/Auth = Supabase。部署 Vercel。

## 帳號

| 用途 | 帳號 | 說明 |
|---|---|---|
| 講師 | `306465@gmail.com`（陳孟宏）、`james.jr.ku@gmail.com`（顧及然）、梁舒庭 | seed 為 instructor |
| 測試學員 | `hung780cw@gmail.com`（顯示名「學院測試」） | 學員, 第一隊 |
| 測試學員 | `306465-test@gmail.com`（「測試點數」） | 第一隊，已塞一筆**示範問卷作答**（可刪） |

> 登入沿用 QBC 既有帳號密碼（同一個 Supabase）。系統**不建立帳號**，只在 `elite.enrollments` 名冊指定誰是本班學員/講師。

## 資料庫（Supabase `qubjpayeopvscrgrvrci` = QBC 正式庫）

⚠️ 這是**共用正式庫**（239 會員的 daily_reports/points 等都在裡面）。本系統所有表都隔離在獨立 **`elite` schema**，**絕不可污染 `public`**。

**9 張表**（`elite.` schema）：
`enrollments`（名冊＝權限來源）、`questionnaire_responses`（問卷）、`assessments`（成果驗收，講師 only）、`team_meetings`、`trade_ledger`、`reviews`（團隊三表）、`process_notes`（孵化過程，講師 only）、`course_materials`（教材 metadata）、`course_videos`（影片連結，2026-07-31 新增；影片本體放 YouTube/Vimeo，系統只存連結做嵌入，不吃 egress）、`thesis_cards`（投資論點卡，2026-09-02 新增；本人＋講師可見，講師不可改，cc_* 由 server 重算）、`thesis_reconciliations`（T+20 對帳，2026-09-02 新增；一卡一筆，四象限由 server 重算，講師只能看）、`flow_configs`（講師下發的分段設定，2026-09-02 新增；一群組一份，講師寫、名冊內讀）、`flow_runs`（作業存檔，2026-09-02 新增；整份控制台狀態，每人 30 檔上限由 trigger 保底，本人讀寫、講師看）。

**Storage**：私有 bucket `elite-materials`（課程教材，2026-07-19 新增）。講師上傳（txt/jpg/png/webp/pdf/zip，單檔 30MB）、名冊內學員下載（1 小時 signed URL）。同名檔案上傳前有提醒防呆。schema/bucket 變更是用 MCP `apply_migration` 直打正式庫，repo 內無 migration 檔（專案慣例）。⚠️ 該 Supabase 專案掛在「TJ's projects」組織 **Pro 方案**（月含 250GB egress），教材下載流量計入、與 QBC 全站共用。

**RLS 鐵則（已實測雙向通過）**：
- `assessments`、`process_notes` → **只有講師有政策**，學員在資料庫層即讀不到（0 筆）。
- 團隊三表 → 學員只能讀寫自己 `team_id`；講師看全部。
- 問卷 → 學員讀寫自己；講師讀全部。
- 輔助函式：`elite.is_instructor()`、`elite.is_enrolled()`、`elite.my_team()`（SECURITY DEFINER，避免 RLS 遞迴）。
- `elite` schema 已透過 `ALTER ROLE authenticator SET pgrst.db_schemas='public, graphql_public, elite'` 曝露給 PostgREST。

## 環境變數（Vercel 已設 Production/Preview/Development）

```
NEXT_PUBLIC_SUPABASE_URL=https://qubjpayeopvscrgrvrci.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_TVSonFIGTq1sI75A8o7xQg_95grIHPL
```

皆為公開金鑰。**刻意不使用 service role key**——講師的名冊指派等操作都走「已登入 instructor」的 session + RLS。

## 計分邏輯

`lib/scoring.ts`（純函式）實作問卷文件的三部分計分 → 五職務建議：
- Part1(Q1–7) A/B/C/D → MA/MK/EQ/ST 統計，最高＝主傾向
- Part2(Q8–14) 數 A/B → 分析型/執行型
- Part3(Q15–25) LD/IN/GK 各取每題平均
- 綜合權重 → `suggestedRole`（風控骨幹是 Part3 GK ×2.2，其餘以 Part1 ×1.5 為骨幹）

送出時由 server action **重算**存 DB（前端只做即時預覽）。測試：`npx tsx scripts/test-scoring.ts`（5/5）。

## 五層作業流控制台（/flow）

✅ **2026-09-02 已合併 main 並上線。** 完整規格見 `docs/flow-console-SPEC.md`，開發脈絡見 `WORKLOG.md` 2026-09-02。

8/30 月例會「AI 供應鏈五層作業流」的線上版：輸入股票代號 → 產出八道指令 → 交棒卡逐層帶入 → 收斂成一張投資論點卡。目前資料存 localStorage（`flow5:{userId}`），**尚未進資料庫**。

- 資料與純函式：`lib/flow/`（`segments` 分段資料｜`prompts` 指令產生器｜`ccc` 確認成本與 33% 硬閘門｜`state` 分段結構邏輯｜`stations` 站點定義）
- 畫面：`app/(app)/flow/`
- 測試：`npx tsx scripts/test-flow.ts`（31/31）
- **改分段資料或指令文字前先看 SPEC 的「不可擅改」一節**——指令文字是教材原文，補充個股與教材原表必須分得清楚。

後續三階段（論點卡上雲 → 講師端 T+20 對帳 → 分段設定下發）見 SPEC。

## 路由

- 學員：`/`（儀表板）、`/questionnaire`、`/materials`（課程教材，講師可上傳/刪除）、`/videos`（課程影片，講師貼 YouTube/Vimeo 連結）、`/flow`（五層作業流控制台，2026-09-02 上線）、`/flow/cards`（我的論點卡＋T+20 對帳，2026-09-02 上線）；`/flow` 自訂產業鏈（階段六，`feat/flow-custom-chain` 待合併）、`/team`（`/team/meetings`｜`/ledger`｜`/reviews`）
- 講師：`/admin/roster`（名冊分組）、`/admin/results`（問卷分流＋看學員完整作答）、`/admin/assessments`、`/admin/teams`、`/admin/thesis-cards`（論點卡與 T+20 對帳總覽）、`/admin/process-notes`、`/admin/schedule`
- 公開：`/login`、`/not-enrolled`
- 權限閘門：`proxy.ts`（未登入→login）；`lib/auth.ts` 的 `requireEnrollment()`／`requireInstructor()`（頁面層）

## 本機開發

```bash
npm install
npm run dev        # http://localhost:3000（需 .env.local，見上）
npm run flow       # 起 dev 並直接開作業流控制台 /flow
npm run build      # 上線前驗證
npm run test       # 計分 + 作業流的純邏輯測試（改到 lib/scoring.ts 或 lib/flow/* 一定要跑）
```

## 部署

已 CLI link。`git push origin main` → Vercel 自動部署；或 `vercel deploy --prod`。

## 驗收清單（UAT）

**學員（用「學院測試」登入）**：登入→儀表板顯示隊伍｜填 25 題問卷→即時預覽→送出｜團隊三表新增｜決策台帳故意不填停損→應被擋｜直接打 `/admin/*`→應被導回。
**講師（用陳孟宏/顧及然）**：`/admin/roster` 指派職務分隊｜`/admin/results` 展開看學員 25 題作答｜`/admin/assessments` 個人+團隊評分｜`/admin/process-notes` 填一筆。
**資安**：學員登入打 `/admin/assessments`、`/admin/process-notes` 應被擋（DB 層已測 = 0 筆）。

## UI 主題（2026-07-10 改版）

QEC 深藏藍 × 金奢華風。色票在 `app/globals.css` 用 Tailwind `@theme` 定義：**slate 反轉**（低數字=深色面板、高數字=亮色文字）、**indigo→金**、狀態色深底亮字、`--color-white`→深面板。
⚠️ 寫新元件時：**文字色用高數字 slate（600–900）**、面板用低數字（50–200），否則文字會偏暗。品牌類別：`.text-gold` `.font-display` `.btn-gold` `.btn-ghost` `.qec-card`。Logo=`public/qec-logo.png`（已去背）、favicon=`app/icon.png`、標題字型 Noto Serif TC（layout `<link>` 載入）。

## 待辦 / 已知事項

- [ ] 確認 course 平台「忘記密碼」正確路徑（登入頁連結假設 `https://course.huangxi.info/forgot-password`，見 `app/login/page.tsx` 的 `COURSE_RESET_URL`）
- [ ] Supabase 後台把 `https://elite.huangxi.info/**` 加入 Auth → Redirect URLs（**用 Add URL 附加、勿覆蓋**，共用庫）
- [ ] 使用者跑完整功能/驗收測試，回報 bug → 修 → push → 自動部署
- [ ] 講師簽核 `docs/flow-prompts-generic-draft.md` 三段通用版指令措辭（簽核後加 chainKind 分支、移除自訂鏈的黃色提示）
- [ ] 決定自訂產業鏈的「拆段引導」要不要做（拆段前置指令＋編輯器提示＋單一子段警示，見 WORKLOG 階段六「已知風險與待決」）
- [ ] 正式開課前完整清理測試資料（清空「學院測試」問卷/團隊紀錄）
- [ ] 課前：講師在 `/admin/roster` 幫 8 位真實學員分隊、課後依問卷指派職務
- [ ] **作業流控制台階段一 UAT**：登入 `/flow` 走一遍（Claude 不能輸入密碼，無法代測）。OK 後合 `feat/flow-console` → main
- [ ] **查證 `lib/flow/segments.ts` 裡 16 檔補充個股**（散熱 3483/3338/6275/6125/4763、CPO 3234/3450/4977/4991/2340、PCB 6269/2367/2316/4927/6153/6251）的代號、公司名與所屬子段。這些非教材原表，是 Claude 依訓練資料補的
- [ ] 作業流控制台階段二～四（論點卡上雲 → 講師端 T+20 對帳 → 分段設定下發），見 `docs/flow-console-SPEC.md`
- [ ] 暫緩功能：教材下載紀錄追蹤（誰下載過哪個檔案）——需 `elite.material_downloads` 表＋下載改走系統端點記錄再轉址（設計方案在 2026-07-19 對話）
- 現況名冊：9 學員（吳旻玹/桂平宇/楊世祺/莊富翔/陳俐瑾/陳建中/黃大正/黃淑珮/學院測試）＋ 3 講師（陳孟宏/顧及然/梁舒庭）。「測試點數」已移除。多數學員未分隊未填問卷（課前狀態）
- 帳密：兩站同帳密、密碼單向雜湊不可查；不做臨時密碼，忘記密碼走 course 平台重設
- ⚠️ 非本專案：該 Supabase 有 44 張 ERP 表 RLS 未開（既有問題），本系統未觸碰
