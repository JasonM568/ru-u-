# 課程影片 v3 上線手冊

目標 2026-10-17 前。正式庫 `qubjpayeopvscrgrvrci` 為 QBC 共用庫；開發者僅可執行 `BEGIN READ ONLY … ROLLBACK` 唯讀查詢。PM 以 Supabase MCP `apply_migration` 執行 DB 遷移，並負責推送、合併及部署。**新前端不得先於 DB 上線。**

| 順序 | 執行與通過條件 | 不通過時 |
|---|---|---|
| 1. 凍結寫入及唯讀預檢 | PM 先通知講師凍結影片新增、刪除、開通、發布與課程變更，直到部署與冒煙完成。所有預檢查詢以 `BEGIN READ ONLY;` 開始、`ROLLBACK;` 結束。核對 Up guard：10 支已發布影片（Day 1 六支、Day 2 四支），每支恰一筆 `2026-1` audience，11 位 active 一期學員，期別主檔、v2 policy/RPC、欄位與 FK 存在；`video_courses`、`course_grants`、`elite_videos_v3_backup` 不存在；`pg_default_acl` 確認 elite 的 authenticated=arwd。記錄影片 ID 集合。 | 任一基線不符即停，修訂並重審 migration，不繞過 guard。 |
| 2. 講師乾跑與 AC10 before | 使用 repo 外私有目錄（700、JSON 600）。先用一位 active 講師執行 `python3 scripts/videos_v2_snapshot.py dry-run-instructor --out <私有目錄>`，確認 `supabase db query` 多 statement 回傳**最後的 SELECT**（10 支）。再執行 `before`，11 位一期 active 學員逐人以 authenticated 身分取得可見影片 ID。 | 查詢、身分驗證、11 人或 10 支任一不符即停。不在訊息或 PR 貼學員 ID。 |
| 3. DB 遷移 | PM 以 MCP `apply_migration` 執行 `migrations/20261003_videos_v3_up.sql`，記錄 migration version。SQL 交易內有 `lock_timeout='5s'`、鎖表、guard、ACL/RLS postcheck；失敗會整筆回滾。期間繼續凍結影片寫入，因 v2 前端仍查逐支受眾表。 | 鎖逾時可在確認基線仍一致後稍後重試；其他失敗先查明，不手改正式庫。 |
| 4. AC10 after＋compare | 緊接 DB commit，對**同一私有目錄**執行快照腳本 `after` 和 `compare`；11 位各 10 支且逐人 ID 集合 0 diff。再唯讀確認學員可見課程恰一門「2026 第一期菁英班課程影片」。 | 維持凍結，評估 guarded Down 或前向修復；不得先部署新版前端。 |
| 5. 前端部署 | PM 隨即合併／部署 v3。確認 `/videos`、`/videos/courses/[courseId]`、`/videos/[id]`；新前端要在 DB 完成後部署。 | 失敗維持寫入凍結，修復部署。 |
| 6. 冒煙與解凍 | 講師建空課、課程開通、加草稿、試播後發布、取消發布、移課退草稿、非空課刪除拒絕；一期學員仍見一門課、10 支影片；二期未開通看不到；停權 0。手機三層動線、同課側欄與上下集、YouTube iframe fail-open 均確認。PM 批准後解除影片寫入凍結。 | 保持凍結並記錄身分、路由、錯誤，前向修復。 |
| 7. 備份清理 | 上線穩定 14 天後由 PM 審核清理 `elite_videos_v3_backup`。清理後本版 Down 不可再使用。v2 備份另依 v2 手冊評估。 | 尚可能回滾時保留備份。 |

## 唯讀預檢 SQL

以下每一段若拆開執行，仍須各自包 `BEGIN READ ONLY; … ROLLBACK;`。與 Up guard 差異須先停。

```sql
BEGIN READ ONLY;
SELECT count(*) AS videos,
       count(*) FILTER (WHERE published_at IS NOT NULL AND category='day1') AS day1,
       count(*) FILTER (WHERE published_at IS NOT NULL AND category='day2') AS day2
FROM elite.course_videos;
SELECT count(*) AS first_active_students FROM elite.enrollments
WHERE class_role='student' AND cohort='2026-1' AND status='active';
SELECT count(*) AS first_grants FROM elite.video_audiences
WHERE kind='cohort' AND cohort_code='2026-1';
SELECT count(*) AS unmatched FROM elite.course_videos v
WHERE (SELECT count(*) FROM elite.video_audiences a WHERE a.video_id=v.id)<>1
   OR NOT EXISTS (SELECT 1 FROM elite.video_audiences a
                  WHERE a.video_id=v.id AND a.kind='cohort' AND a.cohort_code='2026-1');
SELECT code FROM elite.cohorts WHERE code='2026-1';
SELECT policyname,permissive,cmd,qual,with_check FROM pg_policies
WHERE schemaname='elite' AND tablename IN ('course_videos','video_audiences');
SELECT n.nspname,r.rolname,d.defaclacl FROM pg_default_acl d
JOIN pg_namespace n ON n.oid=d.defaclnamespace
JOIN pg_roles r ON r.oid=d.defaclrole WHERE n.nspname='elite';
SELECT to_regclass('elite.video_courses') AS courses,
       to_regclass('elite.course_grants') AS grants,
       to_regnamespace('elite_videos_v3_backup') AS backup;
SELECT id::text FROM elite.course_videos ORDER BY id;
ROLLBACK;
```

另以 `pg_proc`／`pg_get_functiondef` 核對 `video_audience_matches`、`video_set_audiences`、`video_apply_category`、`video_create`、`video_delete`，以及既有 `cohort_v1_active_gate`；查 `information_schema.columns` 與 `pg_constraint` 核對 v2 影片欄位／FK。這些唯讀查詢同樣必須包交易。影片 ID 集合及個資只保存在 repo 外的私有快照。

## 快照指令與回滾門檻

```sh
python3 scripts/videos_v2_snapshot.py dry-run-instructor --out <repo外私有目錄>
python3 scripts/videos_v2_snapshot.py before --out <同目錄>
# PM 完成 DB 遷移後
python3 scripts/videos_v2_snapshot.py after --out <同目錄>
python3 scripts/videos_v2_snapshot.py compare --out <同目錄>
```

腳本在每段正式查詢強制 `BEGIN READ ONLY … ROLLBACK`，核對 linked project ref，僅輸出計數。`migrations/20261003_videos_v3_down.sql` 只供 PM 在全部 guard 通過時以 MCP 執行。若有任何新課程、grant、草稿、影片增刪或內容改動，Down 將拒絕；保持 v3 RLS 並前向修復，不能強行恢復 v2 逐支受眾而洩漏。Down 成功後才可部署 v2 前端。正式庫不可使用本機 fixture、Auth seed 或直接 psql 寫入。
