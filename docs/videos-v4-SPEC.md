# 課程影片 v4：影片標題編輯＋課程內觀看順序手動排序

狀態：PRD v1.0（2026-11-17 定稿）｜決策者：Jason｜前置：影片 v3 已於 2026-10-03 上線（`videos-v3-SPEC.md`），本案承接 v3「下期待辦」🟡4（影片編輯）。

## Goal / Problem

目前「影片課程」管理中，單支影片的標題／說明**完全沒有編輯入口**（草稿或已發布皆不可改，v3 文件已記錄此缺口），講師打錯字或想微調內容只能刪除重建，舊網址與發布狀態隨之失效。同時，課程內影片的觀看順序**完全自動依「分類＋上傳時間」排序**，講師無法手動調整，想把影片排在非上傳順序的位置時沒有辦法。

## Users & Scenarios

- **講師**（唯一操作者，`elite.is_instructor()`）：上傳多支影片後發現標題打錯字，想直接修正而不重建。
- **講師**：想把某支影片移到更適合的觀看順位（例如把補充教材排到課程最後，而非卡在依上傳時間排序的中間位置）。

## MVP Scope

**A. 影片標題／說明編輯（已拍板：編輯對象為單支影片，非整門課程）**
- 新增 `elite.course_video_update(p_video_id uuid, p_title text, p_note text)` RPC，instructor-only，檢查邏輯仿 `video_course_update`（標題不可空白）。
- 「管理影片」彈窗加入標題／說明欄位＋「儲存」按鈕；不論草稿或已發布皆可編輯，存檔後立即反映在清單與學員端。
- 換課程仍走既有「移動影片」流程，不在本案調整。

**B. 課程內觀看順序手動拖曳排序（已拍板：拖曳形式，非輸入編號）**
- `elite.course_videos` 新增 `sort_order int` 欄位。
- 新增 `elite.course_video_reorder(p_course_id uuid, p_ordered_ids uuid[])` RPC，instructor-only，一次性寫入該課程全部影片的順序（交易式，驗證傳入 id 集合與該課程現有影片集合一致才允許寫入）。
- 「影片發布管理」清單依課程分組，組內支援拖曳；拖曳後立即呼叫 reorder、樂觀更新＋失敗回滾。
- `lib/video-course.ts` 的 `orderedVideos()` 排序鍵改為優先依 `sort_order`。
- 已拍板（2026-11-17）：**保留現有分類分組，分類內部用 `sort_order` 取代「上傳時間」**；拖曳僅限分類內部，不可跨分類；跨分類重新分組不在本案範圍。
- 新影片建立時，`sort_order` 預設為該課程目前最大值 +1（排在最後）。

**C. 既有資料遷移**
- 現有課程內的影片，依目前 `orderedVideos()` 的既有排序結果（分類＋上傳時間）一次性回填 `sort_order`，確保上線瞬間畫面順序不跳動。

**D. 沿用 v3（不重做）**
- 權限模式不變：寫入只走講師 RPC，RLS／`is_instructor()` 為唯一權限邊界；新 RPC 沿用 v3「硬性約束」（正式庫 `elite` default ACL 先 revoke 再 grant）。
- 播放頁、課程頁、章節側欄、上一集／下一集邏輯不變，僅排序鍵底層替換。

## Out of Scope

- 跨分類整體重排、分類本身的順序調整
- 學員端自訂排序（排序只由講師決定，學員只能看）
- 批次匯入／複製課程排序
- 課程清單本身的排序（v3 已列為下期項目，本案僅處理「課程內影片」排序，不含「課程與課程之間」排序）

## User Stories

1. 身為講師，我想修改已上傳影片的標題／說明，以便修正打字錯誤，不用刪除重建。
2. 身為講師，我想拖曳調整課程內影片的觀看順序，以便依教學邏輯排列，而非被上傳時間綁住。
3. 身為學員，我看到的影片順序應與講師設定的順序一致。

## Acceptance Criteria

- **AC1** 草稿／已發布影片皆可成功修改標題與說明；標題不可為空白；存檔後清單與學員端（`/videos/[id]`、`/videos/courses/[courseId]`）立即反映新標題。
- **AC2** 拖曳排序後 `sort_order` 寫入成功；重新整理頁面、登出再登入，順序不跳回原狀。
- **AC3** 學員端顯示順序與講師設定的 `sort_order` 一致（含分類分組內部順序）。
- **AC4** 僅 instructor 可呼叫 `course_video_update`、`course_video_reorder`；非講師呼叫應被拒絕。
- **AC5** `course_video_reorder` 傳入的 id 集合若與該課程現有影片集合不一致（缺漏、多餘、跨課程 id），應整筆拒絕，不可部分寫入。
- **AC6** 既有課程上線遷移後，畫面呈現順序與遷移前一致（0 感知跳動）。

## Risks / Open Questions

- ✅ **排序與分類分組如何共存**（2026-11-17 已拍板）：保留分組、僅組內手動排序，不可跨分類；前端一次性把整門課全部影片 id 送給 reorder RPC。
- 🔵 拖曳 UI 套件選擇（原生 HTML5 drag 或第三方 lib）由前端技術決定，PM 不預設方案。
- 🔵 既有種子資料（v3 migration 內建 10 支影片）需一次性回填 `sort_order`，遷移時機與既有 v2/v3 backup 表清除時程可合併評估。

## Handoff Notes

**Backend（先提資料模型再動手）**
1. 候選：`elite.course_videos` 新增 `sort_order int not null default 0`；新增 `course_video_update`、`course_video_reorder` 兩個 security definer RPC，比照 `video_course_update` 的權限檢查與 v3「硬性約束」（新表/欄位的 ACL 先 revoke 再 grant、RLS 內呼叫的函式保留 authenticated EXECUTE）。
2. 遷移需含既有資料的 `sort_order` 一次性回填（依目前 `orderedVideos()` 邏輯算出初始值），並比照 v3 的交易式／guard／回滾守門與上線前後快照比對。

**Frontend**
1. `VideoCourseAdmin.tsx`「管理影片」彈窗加入標題／說明編輯欄位。
2. 「影片發布管理」清單加拖曳排序 UI（依課程分組，組內可拖曳）。
3. `lib/video-course.ts` 的 `orderedVideos()` 排序鍵改為 `sort_order`（分類分組邏輯不變，待 Risks 項確認後再動）。

**QA**
1. AC1／AC4：草稿與已發布影片皆測試改標題；非講師帳號呼叫兩個新 RPC 應被拒。
2. AC2／AC3：拖曳後重整、登出再登入、學員端三個頁面（`/videos/[id]`、`/videos/courses/[courseId]`）順序一致性。
3. AC5：傳入不完整或跨課程 id 集合應整筆拒絕。
4. AC6：既有課程遷移前後順序快照比對，0 diff。
