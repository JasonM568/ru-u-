# WORKLOG — 菁英班孵化系統 1.0

工作摘要逐次紀錄（最新在上）。現況與待辦見 `HANDOFF.md`。

---

## 2026-07-31　新增課程影片區（/videos）

**需求**：平台原本沒有影片區。評估後採「影片放外部平台（YouTube 未列出 / Vimeo）、系統只做嵌入」方案——零流量成本，避免吃 Supabase Pro 與 QBC 共用的 250GB/月 egress。

**完成**

- 新表 **`elite.course_videos`**（第 9 張，MCP `apply_migration`，純新增）：category/title/url/note/created_by。RLS 比照教材表：講師 insert/update/delete、名冊內學員 select。
- `/videos` 頁：講師貼 YouTube/Vimeo 連結＋標題＋分類（沿用教材四分類）＋選填說明；學員看嵌入播放器（雙欄卡片）。講師可移除。導覽列加「課程影片」（學員/講師皆可見）。
- `lib/video.ts`：網址 → 嵌入 URL 解析（youtu.be／watch?v=／shorts／live／embed／vimeo.com/id／未列出 vimeo id/hash；YouTube 保留 t= 起始時間，走 youtube-nocookie 網域）。無法辨識的網址在新增時擋下；舊資料若解析失敗則顯示外開連結。

**備註**：影片「未列出」連結若外流仍可觀看；如需嚴格防外流，再議 Vimeo 網域鎖定（限 elite.huangxi.info 嵌入）。

---

## 2026-07-31　團隊三表全面開放同隊共同編輯

**需求**：三表原本一旦送出就不能改。改為以小組為單位，同隊成員皆可編輯已發佈的紀錄。

**完成（表一 例會）**

- `/team/meetings` 每筆紀錄下方加「✏️ 編輯此紀錄（同隊皆可修改）」展開表單，帶入原值、修改後儲存。
- 表單抽成共用元件 `MeetingForm.tsx`（新增/編輯共用），新增 `updateMeeting` server action（`team/actions.ts`），儲存時寫入 `updated_at`。
- 卡片顯示「最後更新」時間（`updated_at ≠ created_at` 才顯示）。

**完成（表二 台帳、表三 覆盤，比照辦理）**

- `/team/ledger` 表格每筆下方加編輯展開列（`TradeForm.tsx` + `updateTrade`）。
- `/team/reviews` 每張卡片下方加編輯展開區（`ReviewForm.tsx` + `updateReview`）。
- **schema 變更**：`trade_ledger`、`reviews` 原本沒有 `updated_at` 欄位，已用 MCP `apply_migration` 補上（純新增，migration 名 `add_updated_at_to_trade_ledger_and_reviews`）。既有資料列該欄為 NULL，編輯過才有值、才顯示「最後更新」。

**RLS**：三張表的 UPDATE 政策（`meet_upd`／`ledger_upd`／`review_upd`＝同隊可改、講師可改全部）當初建庫時就存在，這次只補前端與 `updated_at` 欄位，安全邊界未動。

**完成**

- 新增 `/materials` 頁：講師上傳教材、全班學員下載。導覽列加「課程教材」。
- 支援格式 txt/jpg/png/webp/pdf/zip，單檔上限 **30MB**（初版 20MB，同日調高）。
- 儲存：瀏覽器直傳 Supabase Storage 私有 bucket **`elite-materials`**，metadata 存 **`elite.course_materials`** 表（第 8 張表）。schema 變更沿用專案慣例：MCP `apply_migration` 直打正式庫，repo 無 migration 檔。
- RLS：講師 insert/delete；名冊內學員 select。下載走 **1 小時 signed URL**。
- 教材依分類分組：課前資料／Day 1／Day 2／補充教材（`lib/constants.ts`）。
- 防呆：上傳同名檔案先跳提醒，確認後才能重複上傳（提醒制，非硬性禁止）。

**已討論但暫緩**：下載紀錄追蹤（誰下載過哪個檔案）——需 `elite.material_downloads` 表＋下載改走系統端點記錄再轉址。設計方案在 2026-07-19 對話。

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
