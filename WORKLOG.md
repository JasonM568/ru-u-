# WORKLOG — 菁英班孵化系統 1.0

工作摘要逐次紀錄（最新在上）。現況與待辦見 `HANDOFF.md`。

---

## 2026-07-10（下半場）　功能調整 · 品牌改版 · 修正

**功能調整（依使用者回饋）**
- 講師端 `/admin/results` 可預覽問卷題目、展開看每位學員完整 25 題作答。
- 開放講師以測試身分填問卷（不列入學員分流）。
- 問卷姓名自動帶入（唯讀）；填完即鎖定，講師可「開放重填」（新增 `locked` 欄位）；解鎖後學員端加明確引導。
- 例會出席改為勾選團隊成員。
- 學員導覽列加「團隊工作區」。
- 修正 `/admin/teams`：完整列出各隊例會/台帳/覆盤（原摘要區塊顯示有問題）。

**品牌改版（QEC 深藏藍 × 金）**
- 參考 `UI_Demo`（QEC Logo、行前 DM）→ 用 Tailwind `@theme` 重定義色票（slate 反轉為深色、indigo→金、狀態色深底亮字），全站轉深色奢華風。
- 卡片金色細邊、金漸層按鈕、深色輸入、Noto Serif TC 金色襯線標題。
- Logo 去背（Pillow 四角洪水填充）放入導覽列/登入頁；產出 `app/icon.png` 當 favicon。
- **修正**：改版時誤用低數字 slate 當文字色（反轉後變暗），逐一改回亮色（欄位標題/名稱、輸入文字、重填橫幅等）。

**帳密 / 重設密碼**
- 釐清：密碼為單向雜湊、不可查；兩站同帳密。
- 登入頁加「忘記密碼？」連結 → 導 course 平台重設（`https://course.huangxi.info/forgot-password`，路徑待使用者確認）。
- 決定：不做臨時密碼/強制改密碼；學員忘記直接點忘記密碼。

**資料清理**
- 移除測試帳號「測試點數」的名冊與示範問卷（第一隊現只剩「學院測試」）。

**待辦**：① 確認 course 平台忘記密碼路徑正確 ② 於 Supabase 後台把 `https://elite.huangxi.info/**` 加入 Auth Redirect URLs（用 Add URL 附加，勿覆蓋）③ 正式開課前完整清理測試資料。

---

## 2026-07-10　專案從 0 到上線

**目標**：把菁英班孵化系統的四類紙本表單做成線上平台，學員/講師登入填寫。

**完成**

- **需求釐清**：讀完五份素材（問卷 v2、成果驗收表、團隊運轉模板、孵化過程模板、兩天流程表）。確認四類表單、兩種角色、權限鐵則（驗收/孵化紀錄僅講師）。與使用者確認：沿用 QBC 帳號登入、不建帳號、四類全做。
- **資料庫**：發現 Supabase `qubjpayeopvscrgrvrci` 是 QBC 正式庫 → 依隔離鐵則開獨立 `elite` schema，建 7 表 + 3 輔助函式 + 完整 RLS + seed 3 講師 + 曝露 schema 給 PostgREST。
- **RLS 實測**：模擬學員/講師 JWT，驗證學員查驗收/孵化紀錄=0、跨隊資料看不到；講師看得到全部。雙向通過。
- **前端**：Next.js 16（App Router，middleware→`proxy.ts`）+ Tailwind v4 + `@supabase/ssr`。
  - 認證閘門、登入、not-enrolled、角色感知儀表板。
  - 學員：25 題問卷（即時預覽計分 + server action 重算存分）、團隊三表（例會/決策台帳/覆盤）。
  - 講師後台：名冊分組、問卷分流、成果驗收、團隊紀錄、孵化過程、課程流程表。
- **計分引擎** `lib/scoring.ts`（三部分→五職務），單元測試 5/5 通過。
- **部署**：build 綠燈 → push GitHub `ru-u-` → CLI link Vercel 專案 `ru-u`、設環境變數 → `vercel deploy --prod`。上線 https://elite.huangxi.info （自訂網域）。線上冒煙測通過。

**補強（同日）**

- 使用者指出「講師看不到學員問卷」→ `/admin/results` 加「問卷題目預覽」＋每位學員「完整 25 題作答」展開（新元件 `QuestionnaireReview`）。
- 釐清測試帳號：使用者用「學院測試」(`hung780cw@gmail.com`)，補上第一隊。另在「測試點數」塞一筆示範作答供看講師視圖。
- 產出 SOP 文件：HANDOFF.md、README.md、CLAUDE.md、本 WORKLOG.md；更新持久記憶 `project_elite_incubator`。

**下次**：使用者跑功能/驗收測試（清單見 HANDOFF），回報 bug 即修。可選：清掉示範作答資料。
