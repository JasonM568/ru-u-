# 課程影片 v3：資料模型與遷移

本版從 v2 切換為整門課開通。正式庫屬 QBC 全站共用；開發者只做唯讀預檢，PM 負責推送、PR、部署與 MCP `apply_migration`。

## 單一可見性來源

- `elite.video_courses` 保存課程名稱與說明。每支 `elite.course_videos` 以非空 `course_id` 隸屬一門課；原本固定四類 `category` 繼續作為課程分段。
- `elite.course_grants` 一列代表一個期別或一位名冊成員，CHECK 保證二擇一；複選期別產生多列。整批選人是在儲存時展開為個人 UUID 的快照，往後成員改期不改變個人列。個人 FK 為 `enrollments(user_id) ON DELETE CASCADE`，移出名冊時移除權限。
- `published_at IS NULL` 是影片草稿，只有 active 講師看得到；有值時仍須命中所屬課程的 grant。新影片一律草稿；移到另一門課時由 RPC 原子設 `published_at=NULL`，須在新課程試播並發布。
- v2 `video_audiences`、`video_audience_matches`、逐支開通／同分類 RPC 一起移除。可見性只由 `course_grants` 決定。`course_grants` 只能透過講師 RPC 寫入；Dashboard 或 service role 直改可繞過 RPC 的名冊驗證，應避免。
- 課程內有影片時 `video_course_delete` 拒絕並回報支數；空課可刪，grant 由 FK cascade 清除。

## RLS 與 ACL

`course_videos` 的 permissive SELECT policy：

```sql
elite.is_enrolled() AND (
  elite.is_instructor() OR
  (published_at IS NOT NULL AND elite.course_grant_matches(course_id))
)
```

`video_courses` 的 permissive SELECT policy：

```sql
elite.is_enrolled() AND (
  elite.is_instructor() OR (
    elite.course_grant_matches(id) AND EXISTS (
    SELECT 1 FROM elite.course_videos v
    WHERE v.course_id=video_courses.id AND v.published_at IS NOT NULL
    )
  )
)
```

這個 EXISTS 受 `course_videos` RLS 限制，因此學員只看到有權且至少一支已發布影片的課程。影片 policy 只呼叫 `SECURITY DEFINER` 的 `course_grant_matches`，不再查 `video_courses`，所以沒有 policy 遞迴。本機以 authenticated 學員查課程及影片，已確認不觸發遞迴。`course_grant_matches` 必須授予 authenticated EXECUTE，因為 RLS policy 以查詢者身分呼叫；撤銷會讓學員 SELECT 失敗。

`video_courses`、`course_grants` 各自有 restrictive `cohort_v1_active_gate`，使用 `elite.is_enrolled()`；既有 `course_videos` gate 繼續有效。`course_grants` 只讓 active 講師 SELECT。正式 `elite` default ACL 會給 authenticated `arwd`，故新表建立後立即 REVOKE ALL，再明確授 SELECT；既有影片表也撤直接寫入。所有寫入只由驗證 active 講師的 SECURITY DEFINER RPC 執行。

Up 同時移除 `course_videos` 上 v1 殘留的 `elite_videos_insert`／`elite_videos_update`／`elite_videos_delete` 寫入政策。雖然目前 SELECT-only ACL 使其無作用，保留它們會讓日後誤授寫權時繞過講師 RPC。Down 不還原這些舊寫入政策：v2 本來就只允許 RPC 寫入，恢復政策會重新引入風險。

## 遷移與回滾

Up/Down 均在交易內設 `lock_timeout='5s'` 並鎖表，超時整筆失敗。Up guard 要求 v2 基線：恰 10 支已發布影片（Day 1 六支、Day 2 四支）、每支恰一筆 `2026-1` audience、11 位一期 active 學員、期別主檔、既有 policy/RPC 名稱及新物件不存在。Up 保存私有 `elite_videos_v3_backup`，建立「2026 第一期菁英班課程影片」，將 10 支歸課並保留發布狀態，授 `2026-1`，在同一交易內切換 RLS。

Down 只在原 10 支影片、課程、grant、影片內容與發布狀態完全等於備份時允許，並恢復 v2 表、函式與政策。新增草稿、換課、改 grant 等均使 Down 拒絕；此時採前向修復，不能強退造成權限外洩。成功 Down 會清除 v3 備份。v2 備份 schema 不由 v3 遷移更動；其清理由 PM 依 v2 手冊另行評估。

DB→前端空窗期，v2 前端仍會查詢已移除的 `video_audiences`，影片上傳與開通功能無法使用。上線時須凍結影片寫入、DB 變更後緊接部署新版前端；新版前端不可先於 DB 部署。

## 本機演練

專用 Supabase stack 在 Up 前先執行 `ALTER DEFAULT PRIVILEGES IN SCHEMA elite GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated`，重現正式 ACL。合成帳號透過 PostgREST 驗證課程／影片 RLS、停權、講師 RPC、草稿／發布、跨課移動退草稿、拒絕刪非空課及直寫被拒。Up/Down 通過，新增草稿後 Down guard 拒絕。`scripts/videos_v3_ac10_local.py` 在專用本機 DB 對 11 位合成一期學員做 v2→v3 逐人 ID 集合快照：每人 10 支，0 diff，且課程列表各一門。

播放頁沿用 v2 fail-open：只有 YouTube oEmbed 明確 401/403 才顯示私人影片提示；其餘狀況保留 iframe，並固定顯示處理中說明。oEmbed 結果約 10 分鐘快取。
