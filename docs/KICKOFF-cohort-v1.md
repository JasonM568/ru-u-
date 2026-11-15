# 派工單：Cohort v1 期別啟用（貼給新 pane 的 kickoff）

> 用法：在 Navide 另開一個 pane，把以下整段貼進去當第一則訊息。

---

你負責菁英班系統（`/Users/jasonmchen/Downloads/菁英班-系統開發/app`，Next.js + Supabase）的「期別啟用 Cohort v1」。

**先讀規格：`docs/cohort-v1-SPEC.md`（已定稿，不要改需求）。** 相鄰的 `docs/videos-v2-SPEC.md` 是下一案，本次不做。

## 硬截止
**2026-10-23。** 第二期學員開課前 15 天開始陸續註冊，且課前要填職務適應性評估問卷——填問卷必須先進名冊，一進名冊就會看到第一期的全部資料。這個日期不能延。

## 前置條件
開工前先確認 `feat/flow-custom-chain`（作業流控制台階段六）是否已驗收合併。**本案會改寫既有 RLS，與未合併分支同時進行會打架**，請先確認 main 乾淨再從 main 切 `feat/cohort-v1`。

## 核心需求（規格的 MVP Scope 有完整版）
1. 新增 `elite.cohorts` 主檔（`2026-1`／`2026-2`，可切換「當期」，同時只有一個當期）
2. `/admin/roster` 可設定與修改期別；新成員預設落在當期
3. 教材、作業流設定、團隊三表掛期別，RLS 改比對新函式 `elite.my_cohort()`
4. 學員停權（`status` active／suspended），保留紀錄但擋讀寫
5. 遷移：既有 14 人與全部既有內容 `'1.0'` → `2026-1`

## 三個必須守住的紅線
1. **不要把 `is_enrolled()` 改成期別判定。** 它的語意是「我在名冊內」，被多張表的 INSERT 政策共用。期別判定走新的 `my_cohort()`，內容表自己帶期別欄位。唯一該改 `is_enrolled()` 的地方是加上 `and status = 'active'`（停權），理由見規格。
2. **本案不是純新增。** 會改寫 `course_materials`、`flow_configs`、`team_meetings`、`trade_ledger`、`reviews` 共 18 條既有政策、動既有資料，與本專案過去「MCP 直打正式庫、只做純新增」的慣例不同。**先在 Supabase branch 演練遷移、備妥回滾，再碰正式庫**；正式庫 `qubjpayeopvscrgrvrci` 與 QBC 全站共用。
3. **遷移後現有 11 位第一期學員所見內容必須與遷移前完全一致**（規格 AC1）。status 遷移後必須全為 `active`，否則全班鎖在門外。

## 兩個留給你決定的技術選項（規格 Risks 有說明）
- 團隊三表掛期別：(a) 三表各加 `cohort` 欄位，政策加 `AND cohort = my_cohort()`；(b) 改用全域唯一 team 主檔。(b) 較乾淨但會動到 `/admin/teams` 既有程式。
- 教材「多期通用」：建議先做布林值，不夠用再升級成期別多選。

決定後請先回報做法與回滾方案，確認過再動正式庫。

## 驗收
照規格的 AC1–AC9 逐條驗。最關鍵兩條：**建第二期測試帳號驗跨期隔離（含直查資料庫路徑，不能只看畫面有沒有藏起來）**、以及第一期的完整回歸。
