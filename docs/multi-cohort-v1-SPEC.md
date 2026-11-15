# 複訓多期權限 Multi-cohort v1

狀態：PRD v1.0（2026-11-01 定稿）｜決策者：Jason｜**硬截止：2026-11-07 第二期開課**
前置：Cohort v1（`cohort-v1-SPEC.md`）、影片 v3（`videos-v3-SPEC.md`）皆已上線。本案建立在其期別機制之上，不推翻。

## Goal / Problem

第二期有數位第一期學員複訓。Jason 拍板：**複訓學員等同第二期學員**，享有第二期全部權限（教材、影片、作業流分段設定、二期隊伍與團隊三表），**同時保留**第一期教材與第一期團隊紀錄的檢視權。

現況是一人一期：`enrollments` 一人一列、一個 `cohort`；正式庫 22 條 RLS 政策＋1 條 Storage 政策以 `elite.my_cohort()` 單值比對。單純把人移到第 2 期會失去第 1 期的教材與團隊紀錄。

## Users & Scenarios

- **管理員**：在 `/admin/roster` 對複訓學員按「轉入第 2 期（保留第 1 期檢視權）」→ 指派二期隊伍 → 完成。之後上傳二期教材、開通二期課程，複訓學員與二期學員一視同仁。
- **複訓學員**：登入後所有頁面以第 2 期身分運作（儀表板、教材、影片、作業流、團隊三表）。教材頁多出第 1 期教材；團隊頁有「第 1 期紀錄」唯讀檢視。
- **一般一期學員／二期學員**：完全無感。

## 設計原則（給 Tech Lead）

- **主期別不變語意**：`enrollments.cohort` 仍是唯一的「行動期別」。所有寫入、隊伍、作業流設定、儀表板都只看主期別。既有前端程式碼零改動即可繼續正確。
- **額外期別只給「讀」**：新增 `elite.cohort_memberships(user_id, cohort, team_id, created_at)` 記錄歷史期別與**當時的隊伍**。沒有 team_id 就無法正確對回舊團隊紀錄（隊伍編號 1／2 每期重用）。
- **單一可見性來源**：新增 `elite.my_cohorts()`（主期別 ∪ memberships），讀取類政策改比對 `cohort = any(elite.my_cohorts())`。影片的 `course_grant_matches()` 同步改為 `cohort_code = any(my_cohorts())`，複訓學員就不需要逐人指定開通一期課程。
- **不改 `is_enrolled()` 與 `my_cohort()` 語意**，兩者被 INSERT 政策與前端共用（Cohort v1 既有鐵則）。

## MVP Scope

**A. 資料層**
1. `elite.cohort_memberships`：`(user_id, cohort)` 主鍵，`team_id` 可空，FK 到 `enrollments`／`cohorts`，`ON DELETE CASCADE`。
2. `elite.my_cohorts() returns text[]`：`STABLE SECURITY DEFINER`，比照 `my_cohort()` 寫法；`status='active'` 才回傳。
3. `elite.my_team_memberships() returns table(cohort text, team_id int)`：主期別隊伍 ∪ memberships 隊伍，供團隊三表 SELECT 用。
4. 政策改寫（**只改 SELECT／讀取面**，寫入面不動）：
   - `course_materials` SELECT、Storage `elite_materials_storage_select`：`cohort = any(my_cohorts()) or all_cohorts`
   - `flow_configs` SELECT：`cohort = any(my_cohorts())`
   - `team_meetings`／`trade_ledger`／`reviews` SELECT：`(cohort, team_id) in my_team_memberships()`；INSERT／UPDATE／DELETE 維持 `cohort = my_cohort() and team_id = my_team()`
   - `enrollments` 的 `cohort_v1_active_gate`：SELECT 面改 `cohort = any(my_cohorts())`（讓舊隊伍成員名單可讀），寫入面不動
   - `course_grant_matches()`：`g.cohort_code = any(elite.my_cohorts())`
5. 講師 RPC `elite.transfer_cohort(p_user uuid, p_to_cohort text)`：一個交易內 (a) 把目前 `(cohort, team_id)` 寫入 memberships，(b) `enrollments.cohort := p_to_cohort`、`team_id := null`、`job_role` 保留。只有 active instructor 可呼叫。另提供 `elite.remove_membership(p_user, p_cohort)` 供回滾。

**B. 管理員 UI（`/admin/roster`）**
6. 每位學員列多一個「轉期」按鈕 → 對話框選目標期別、勾選「保留原期別檢視權」（預設勾）→ 呼叫 `transfer_cohort`。
7. 名冊列顯示「額外期別」標籤（例：`2026-2 ｜ 另：2026-1`），可移除額外期別。
8. 期別篩選下拉：篩「第 1 期」時，額外期別含第 1 期的人也列出並標示「複訓」。

**C. 學員 UI**
9. `/materials`：不改查詢（RLS 已放行），但列表加期別分組或標籤，讓複訓學員分得清第 1 期與第 2 期教材。
10. `/team`、`/team/meetings`、`/team/ledger`、`/team/reviews`：有 memberships 的使用者，頁首多一個「期別」切換（主期別／歷史期別）。切到歷史期別時以該 membership 的 `(cohort, team_id)` 查詢，**唯讀**：隱藏新增／編輯／刪除按鈕，server action 另外擋（寫入政策本就會擋，這是雙保險）。
11. `/flow`：學員端 `flow_configs` 查詢不加過濾會同時拿到兩期設定。改為只取**主期別**設定（前端加 `.eq("cohort", enrollment.cohort)`），避免複訓學員套到一期的舊分段。
12. 影片：**無 UI 變更**。`course_grant_matches()` 改完後，一期課程開通給「2026-1」的複訓學員自動看得到。

**D. 資料遷移與操作**
13. 本案上線後，Jason 在 `/admin/roster` 逐位對複訓學員按「轉期」→ 第 2 期，再指派二期隊伍。
14. 既有一期課程的 11 筆個人開通可一併清除（`video_course_set_grants` 只留 `2026-1`）。

## Out of Scope

- 額外期別的**寫入**權（複訓學員不能再往第 1 期團隊紀錄新增）。
- 額外期別的作業流分段設定套用。
- 問卷、論點卡、作業存檔：本就不分期別，不動。**複訓學員不重填問卷**（2026-11-01 拍板），7 月作答維持鎖定；講師不要對複訓學員按「開放重填」。
- 多於兩個期別的 UI 美化（資料結構支援 N 期，UI 以兩期為準）。
- 複訓學員的成果驗收、孵化過程紀錄：講師 only 表，不受期別影響。

## User Stories

1. 身為管理員，我按一個鍵就把複訓學員轉入第 2 期，不用手抄他原本的隊伍。
2. 身為管理員，我上傳二期教材、開通二期課程時，不需要為複訓學員做任何額外動作。
3. 身為複訓學員，我登入後看到的是第 2 期的儀表板、隊伍與作業流，和二期同學一樣。
4. 身為複訓學員，我在教材頁還能下載第 1 期教材，在團隊頁能回看第 1 期的會議、台帳、復盤，但不能再新增。
5. 身為二期學員，我看不到任何第 1 期的教材、影片、團隊紀錄，連標題都看不到。
6. 身為一期（非複訓）學員，改版前後我看到的東西一模一樣。

## Acceptance Criteria

- AC1 轉期後，複訓學員 `enrollments.cohort='2026-2'`，memberships 有 `('2026-1', 原team_id)` 一列；`my_cohorts()` 回傳兩期。
- AC2 複訓學員 `/materials` 同時列出第 1 期與第 2 期教材，且兩者的 signed URL 都能下載（Storage 政策實測）。
- AC3 複訓學員 `/videos` 同時看到「2026 第一期菁英班課程影片」與二期課程，**不需要**個人開通。
- AC4 複訓學員 `/team/*` 預設顯示第 2 期隊伍；切到第 1 期顯示原隊伍紀錄；切到第 1 期時 UI 無新增／編輯按鈕，直接呼叫 server action 寫入第 1 期 → 被 RLS 拒絕（DB 層實測）。
- AC5 複訓學員 `/flow` 只套用第 2 期的分段設定。
- AC6 二期一般學員：第 1 期教材 0 筆、第 1 期影片 0 筆、第 1 期團隊紀錄 0 筆（DB 層實測，不是靠前端隱藏）。
- AC7 一期一般學員：改版前後 `scripts/cohort_v1_snapshot.py` 快照一致。
- AC8 移除額外期別後，複訓學員立即看不到第 1 期教材與團隊紀錄；回滾腳本可把人改回第 1 期並刪除 membership。
- AC9 停權（`status='suspended'`）的複訓學員，兩期內容皆不可讀。
- AC10 講師帳號行為不變（講師不經 `my_cohorts()`，走 `is_instructor()`）。

## Risks / Open Questions

- 🔴 **改的是正式庫 RLS**，與 QBC 239 會員共用同一個 Supabase。必須先在 branch 用 `videos_v3_local_baseline.sql` 的方式演練，備妥回滾 SQL，再以 `apply_migration` 直打正式庫（專案慣例，repo 無 migration 檔）。
- 🟠 **團隊三表 SELECT 改成 `(cohort, team_id) in (...)`** 是本案最容易寫錯的地方：既有政策是 `team_id = my_team() AND cohort = my_cohort()` 兩個獨立條件，改成成對比對後要確認主期別那一對仍然成立。
- 🟠 **時程**：11/01 定稿、11/07 開課。估 1.5–2 天開發＋0.5 天演練與 UAT，沒有緩衝。若 11/05 前無法通過 AC1–AC7，**退回路 A**（直接轉期、暫不保留一期檢視權，零程式），開課後再補。
- ✅ 複訓學員不重填問卷（2026-11-01 拍板）。二期學員的作答以 `user_id` 為鍵、RLS 只允許寫自己那列，**不可能覆蓋一期學員的作答**；唯一覆蓋路徑是講師對同一人按「開放重填」。轉期 RPC 保留 `job_role`，與不重填一致。
- ⚠ 前提：二期沿用同一份 v2 題目（`lib/questionnaire.ts`）。若二期要換題目，作答以題號存 jsonb，舊作答會對不上新題庫，需另立「題庫版本」欄位，屬另案。
- 🟡 `/admin/results` 目前兩期混排（11 筆一期已鎖定＋二期新作答）。建議本案順手加期別篩選與「複訓」標籤，避免講師誤按一期學員的「開放重填」。
- ⚠ 教材「多期通用」與本案並存：`all_cohorts` 邏輯不動。

## Handoff Notes

**Backend**
1. 新增 memberships 表、`my_cohorts()`、`my_team_memberships()`、`transfer_cohort()`／`remove_membership()` RPC；全部 `SECURITY DEFINER` + `SET search_path TO ''`，比照 `my_cohort()`。
2. 只改讀取面政策（清單見 MVP A-4）；寫入面與 `is_enrolled()`／`my_cohort()` 一律不動。`course_grant_matches()` 改一行。
3. 演練 + 回滾 SQL 一起交；跑 `scripts/cohort_v1_snapshot.py` 與 `videos_v3_snapshot.py` 前後比對。

**Frontend**
1. `/admin/roster`：轉期對話框、額外期別標籤與移除、篩選含複訓。
2. `/team/*` 四頁：期別切換（只在有 memberships 時顯示）、歷史期別唯讀；`team/actions.ts` 寫入前檢查 `cohort === enrollment.cohort`。
3. `/flow/page.tsx`：學員端加主期別過濾。`/materials`：加期別分組或標籤。
4. `/admin/results`：加期別篩選（join `enrollments.cohort`，預設當期）；複訓學員標示「複訓・不重填」。

**QA**
1. 四種帳號各走一遍：複訓、二期一般、一期一般、講師。重點 AC4、AC6 要用 SQL 在 DB 層驗，不是看畫面。
2. 回歸：`npm run test`、`scripts/test-videos-v3.mjs`、一期快照比對。
3. 轉期 → 移除額外期別 → 回滾三步都要實跑一次。

**營運（Jason）**
1. 上線前先做：切當期到第 2 期、加二期學員、建二期課程與例會課程（見 11/01 討論）。
2. 上線後：對每位複訓學員按「轉期」、指派二期隊伍；清一期課程的 11 筆個人開通。
3. 11/05 為路 A／路 B 的決斷點。
