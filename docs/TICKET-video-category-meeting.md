# 待辦單：影片／教材新增「例會」分類

狀態：Ready（2026-11-01 開單，Jason 拍板走 B）｜優先：本週，趕在 11 月例會第一支影片上傳前｜估：1 小時含部署

## Problem
影片分類寫死四種（課前資料／Day 1／Day 2／補充教材），資料庫 `elite.course_video_create` 也只接受 `pre/day1/day2/extra`。月例會影片（8 月起每月一支，11 月起兩期合辦）沒有可選的分類，管理員只能塞進「補充教材」。

## 決策紀錄
2026-11-01 Jason 拍板：加一個「例會」分類（方案 B）。暫行做法（先用補充教材）同時可用，加完分類後以 SQL 改回。

## Scope
1. `lib/constants.ts`：`MATERIAL_CATEGORIES` 加 `{ key: "meeting", name: "例會" }`，放在 `day2` 之後、`extra` 之前。教材與影片共用此清單，教材上傳會同時多出「例會」選項，屬預期。
2. 正式庫 `elite.course_video_create`：允許值改為 `('pre','day1','day2','meeting','extra')`。以 `apply_migration` 直打（專案慣例，repo 無 migration 檔），只動這一個函式。
3. 前端排序與分組（`lib/video-course.ts` 的 `orderedVideos`／`videoGroups`）讀同一份常數，**不需改**；驗證即可。
4. 既有以「補充教材」暫貼的例會影片（若有）：上線後以 SQL `update elite.course_videos set category='meeting' where course_id in (例會課程) and category='extra'`，先列出會改到哪幾支再執行。

## Out of Scope
自訂分段名稱、分段排序拖拉（v3 已列下期）。

## Acceptance Criteria
- AC1 `/videos` 管理端新增影片的分段下拉有「例會」，順序：課前資料、Day 1、Day 2、例會、補充教材。
- AC2 以「例會」新增影片成功；直接呼叫 RPC 帶 `p_category='meeting'` 成功，帶 `'foo'` 仍被拒。
- AC3 學員端課程頁出現「例會」分段標題，上一集／下一集順序在 Day 2 之後、補充教材之前。
- AC4 既有 10 支一期影片的分段與順序不變（`scripts/videos_v3_snapshot.py` 前後一致）。
- AC5 `/materials` 上傳選「例會」成功，列表以「例會」分組顯示。
- AC6 `npm run build`、`npm run test`、`scripts/test-videos-v3.mjs` 通過。

## Handoff Notes
- **Backend**：只改 `course_video_create` 的 `in (...)` 清單。已查正式庫（2026-11-01）：`course_materials` 與 `course_videos` 的 category 都**沒有** DB 層 check 約束，全庫只有這一個函式寫死分類值。
- **Frontend**：常數加一行；確認 `VideoCourseAdmin.tsx`、`MaterialUploader.tsx` 的下拉都是跑 `MATERIAL_CATEGORIES.map`，不是另外寫死。
- **QA**：AC2 的拒絕案例要用 SQL 打 RPC 驗，不是只看畫面。AC4 跑快照比對。
- **營運（Jason）**：上線後把已用「補充教材」暫貼的例會影片回報給工程改分類；新上傳的直接選「例會」。
