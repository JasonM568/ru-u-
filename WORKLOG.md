# WORKLOG — 菁英班孵化系統 1.0

工作摘要逐次紀錄（最新在上）。現況與待辦見 `HANDOFF.md`。

---

## 2026-09-02　作業流控制台 — 階段二：論點卡上雲

> 在 `feat/thesis-cloud` 分支。資料表與 RLS 已建在正式庫（`elite.thesis_cards`），程式待使用者驗收後合 main。

**資料表 `elite.thesis_cards`**（migration `elite_thesis_cards`）：一人可存多張卡；欄位對應論點卡七欄（證據與證偽條件各存 jsonb 三筆），另有 `group_id`／`as_of` 記控制台脈絡，`cc_l3`／`cc_l4`／`cc_total`／`cc_ratio`／`cc_pass` 五欄由 server 端重算。RLS：select 本人或 `elite.is_instructor()`；insert／update／delete 皆 `user_id = auth.uid() and elite.is_enrolled()`，**講師不能改也不能刪學員的卡**。

**RLS 雙向實測（10 項全過）**：模擬學員 A 寫入後——A select 1；他人 B select 0、update 0 列、冒充 A insert 被拒 42501；講師 select 1、update 0 列、delete 0 列；A 的欄位未被改動、A delete 1；anon 被拒。測試列已刪。

**程式**
- `lib/flow/cloud.ts`（純函式）：`sanitizeCard` 把前端 JSON 收斂成合法 ThesisCard（缺欄補空、證據與條件固定三筆、ccMode 與涵蓋層次只收合法值、多餘欄位丟掉）；`cardToRow` 產生資料列並用 `lib/flow/ccc.ts` 重算 cc_*；`rowToCard` 還原。
- `lib/flow/thesis.ts`：`cccOf`／`thesisText` 從 ThesisCardForm 抽出成純函式（server component 不能從 "use client" 模組 import 一般函式），ThesisCardForm 保留 re-export。
- `app/(app)/flow/actions.ts`：`saveThesisCard` 收 `{ card: JSON字串, groupId, asOf }`，回傳 `{ ok, id, updatedAt }`。**與問卷不同，這裡不 redirect**——控制台是純客戶端工具，存完要把 id 寫回 localStorage 的 `state.tc.id`，所以直接回傳結果。有 id 就 update（RLS 限本人，對不上時當新卡 insert）。`deleteThesisCard` 走傳統 form action ＋ redirect。
- `app/(app)/flow/cards/page.tsx`「我的論點卡」：列表（代號名稱、群組／子段／分類、CCC 徽章、最後更新）、展開整張卡、`CardActions`（載入到控制台＝改寫 localStorage 的 `state.tc` 後導回 `/flow`／複製／刪除含 confirm）。
- ThesisCardForm 加「儲存到雲端／更新雲端這張卡」按鈕與狀態列；「清空這張卡」會同時清掉 id（清空＝開新卡，不會把雲端那張洗成空白）。控制台標頭加「我的論點卡」連結。
- 測試：`scripts/test-flow.ts` 加 5 項（sanitize、cc 重算兩組教材數字、來回序列化、空卡判定）→ 36/36。

**實測（學院測試帳號，dev）**：填 100/105/108/0.35 存雲端 → 資料庫 cc_ratio 0.2286、cc_pass true；改 0.15 按更新 → 0.5333、false；「我的論點卡」顯示「CCC 53.3% 本案不成立」；清掉本機 tc 後按「載入到控制台」→ 卡連同 id 回到控制台；刪除 → 列表空、資料庫 0 列。

**驗證**：tsc 通過｜ESLint 0 錯誤（既有 1 警告）｜`npm run test` 36/36｜`npm run build` 通過（新增路由 `/flow/cards`）。

---

## 2026-09-02　作業流控制台 — UAT 11 步通過、字級放大

> UAT 已過、build／lint／test 全綠，**2026-09-02 已合併 main 上線**（merge 3f8aed8）。

**UAT**：用「學院測試」(`hung780cw@gmail.com`) 登入後，由 Claude 透過 Chrome 分頁實際操作 SPEC 的 11 步驗收，全部通過。要點：反查先改 3483 再改回 1519 確認真的會動；「複製指令」與「匯出作業紀錄」都用真實點擊後讀 macOS 剪貼簿驗證（851 字指令／192 行 Markdown）；CCC 100/105/108/0.35 → 5.0%/8.0%/8.0%/22.9%/通過，改 0.15 → 53.3%/本案不成立且標題轉「CCC 未過」；自訂分段新增子段並搬 2308、2301 後，指令名單與 SLT 分級行同步；輸入 2603 跳紅色警示。測試用假卡與自訂分段已從 localStorage 清除。

**登入問題排除**：本機登入失敗不是環境問題。本機與正式站連同一個 Supabase 專案，auth log 顯示 `invalid_credentials`，帳號本身正常（已驗證、有密碼、未停用）。密碼重設後即可登入。

**字級放大**（使用者反映年長學員看不清）：三支 flow 元件的 Tailwind 字級整體升一級，並把 9～11px 全部收斂到 14px，現在整頁最小字級 14px、主要說明 16px。站標頭的「輸入／輸出」原本 10px 灰色小標，改為 16px 半粗體。共用元件（Field 標籤與提示、輸入框、PageHeader 副標、按鈕）在 `globals.css` 以 `.flow-console` 範圍限定放大，其他頁面不受影響；輸入框 16px 也避免 iPhone 聚焦自動縮放。內容區限制到 390px 寬驗證無溢出。

**文案**：「今晚帶走三件事」→「這個作業流程讓你帶走三件事」（`FlowConsole.tsx`、`stations.ts` 註解）。

**行前自檢與 skill 版本的釐清**（不涉程式）：學員材料裡沒有「生產版」五支 skill，只有 -edu 骨架；老師的《指令串》明寫「不是版本問題，是模組不齊」，每道指令附備援。本機 `macroscope-edu` 已從 v2 升到 iCloud 的 v3（多 CRS 崩盤前哨），其餘四支與 iCloud 最新版相同。BSA＝舉證責任對稱化、CCC＝確認條件成本；BDS／IL／SRE／SHE 在所有材料中無定義，待問顧老師。

**驗證**：`npm run build` 通過｜ESLint 0 錯誤 1 既有警告（`app/layout.tsx` 字型載入，與本次無關）｜`npm run test` 31/31｜tsc 通過。

---

## 2026-09-02　五層作業流控制台（/flow）— 階段一：移植進站

> ✅ 已於 2026-09-02 驗收並合併 main 上線（見上一則）。
> 規格見 `docs/flow-console-SPEC.md`。啟動：`npm run flow`。

**需求**：8/30 月例會教「AI 供應鏈五層作業流」——八道指令、每層產出一張交棒卡、最後收斂成一張投資論點卡。原本做成單檔 HTML 給學員自用，但資料全存在自己的瀏覽器，換裝置就不見、講師也收不到。而下個月例會的核心是 **T+20 對帳**（把當初寫的三個證偽條件拿出來逐條對實際數據），沒有線上收卡就做不了。

**四階段規劃**（使用者已確認，每階段驗收再下一步）

1. ← **本次**　控制台移植進站，資料仍存 localStorage
2. 論點卡上雲（`elite.thesis_cards` ＋ RLS）
3. 講師端 `/admin/thesis-cards` ＋ T+20 對帳
4. 分段設定由講師下發

**另一個已確認的決定**：論點卡可見範圍 = **本人＋講師**（最保守）。教材裡的「交叉詰問」當場用投影／列印，不靠系統。之後要放寬再議——RLS 放寬容易，收緊麻煩。

**完成**

- `lib/flow/segments.ts` — 16 個分類、**教材原表 74 個不重複代號（77 列）**＋ 16 檔補充個股。
  - 教材原表來自《AI 供應鏈投資判斷一覽表(Elite)》，段位先驗是顧老師的判斷。
  - 補充 16 檔（散熱 +5、CPO +5、PCB +6）是 Claude 依訓練資料補的，標 `added: true`、**段位一律「未定」不代填老師的先驗**，介面上虛線外框＋「補」標籤，並有「只用教材原表」開關可一鍵排除。**這 16 檔的代號與分段尚未逐一查證。**
  - 一併收錄簡報獨有的內容：瓶頸遷移四前兆（對應 SLT 三層）、租金三階段、CRS 分級撤退 × 段位矩陣、交叉詰問攻擊地圖。
- `lib/flow/prompts.ts` — 九道指令產生器。**指令文字一字不改沿用教材原文**，只代入產業鏈名稱／個股清單／子段名稱／交棒卡四種變數。改動指令文字＝改動教材，要先問講師。
- `lib/flow/ccc.ts` — CCC 與 33% 硬閘門純函式。比照 `lib/scoring.ts`，**階段二的 server action 要用同一支重算，不信任前端數字**。
- `lib/flow/state.ts` — 分段結構純邏輯（教材原分段／自訂分段／門檻沿用）。自訂子段若跨原分類，**不給假門檻**，明說「沒有單一門檻可用，請自己訂或再拆細」。
- `lib/flow/stations.ts` — 八道指令的注意事項、輸出檢核、三道硬閘門。
- `app/(app)/flow/` — 控制台本體（`page.tsx`／`FlowConsoleLoader.tsx`／`FlowConsole.tsx`／`RosterEditor.tsx`／`ThesisCardForm.tsx`）。
- `scripts/test-flow.ts` — **31 項純邏輯測試，全過**。跑法 `npx tsx scripts/test-flow.ts`。
- 導覽列加「作業流控制台」（學員／講師皆可見）。

**功能**：輸入代號自動反查子段並帶出同段名單 → 依序產八道指令（可一鍵複製）→ 交棒卡貼回頁面後自動帶進下游指令 → 三道硬閘門（交集卡未填不准進 L3、L3 CCC > 1/3 回頭換標的、L3+L4 合計 > 1/3 本案不成立）→ 論點卡七欄＋CCC 即時試算＋40 字檢查＋證偽條件三層次涵蓋檢查 → 匯出作業紀錄。另有自訂分段（拆子段、改名、搬個股）與分段設定匯出／匯入（零後端讓全班統一）。

**兩個技術決定**

- **`ssr: false` 動態載入控制台**。原本在 `useEffect` 裡讀 localStorage 再 `setState`，被 React 19 的 `react-hooks/set-state-in-effect` 擋下（會造成串連渲染）。這頁本來就是純客戶端工具，關掉 SSR 後狀態可在 `useState` 初始化時直接讀，順帶消除 hydration 不一致。`ssr: false` 只能寫在 Client Component，所以多一層 `FlowConsoleLoader.tsx`。
- **localStorage key 帶 `user_id`**（`flow5:{userId}`），同一台電腦多人登入不會互蓋。

**過程中的發現**：一覽表說的「74 檔」是**不重複代號數**，實際有 **77 列**——台積電(2330)、群聯(8299)、臻鼎-KY(4958) 各被刻意放進兩個分類。測試已鎖定就是這三檔跨段。

**驗證**：`npm run build` 通過｜ESLint 零錯誤零警告｜`test-flow.ts` 31/31｜瀏覽器實測 11 個站點渲染正常、無 console 錯誤、QEC 主題正確；輸入 3483 自動跳散熱群組 20 檔並標「段位未定・補充個股待查證」；CCC 填教材範例 100/105/108/0.35 → 5.0%/8.0%/8.0%/22.9%/通過，改預期報酬 0.15 → 53.3%/本案不成立且警示條跳出。

**未驗證**：登入後的實際流程。Claude 不能輸入密碼，無法用學員帳號登入，視覺驗證是靠暫時的免登入預覽路由完成的（測完已移除，`middleware.ts` 已還原、無殘留）。**UAT 要由使用者自己走一遍。**

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
