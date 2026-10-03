# 課程影片 v2 上線手冊

目標：2026-10-17 前；交付 PM：2026-10-12 前。正式庫 `qubjpayeopvscrgrvrci` 為 QBC 全站共用，開發者僅能執行 `BEGIN READ ONLY … ROLLBACK` 唯讀預檢，正式寫入由 PM 以 Supabase MCP `apply_migration` 執行。推送、PR、部署也由 PM 執行。

| 順序 | 執行與通過條件 | 失敗處置 |
|---|---|---|
| 1. 唯讀預檢 | 每段查詢都以 `BEGIN READ ONLY;` 開頭、`ROLLBACK;` 結尾。確認 `elite.course_videos` **恰 10**、每列 `cohort='2026-1' AND all_cohorts=false`；一期 active 學員 **11**；`elite_videos_select`、`cohort_v1_active_gate` 存在；影片欄位、FK、index 名稱符合 Up guard；新表/備份 schema/函式尚不存在；查 `pg_default_acl` 確認 elite 的 authenticated=arwd。記錄當下影片 ID 集合，不傳學員資料。 | 任一差異先停止，修訂 migration、回滾和 AC12 基線並重新審查，不直接改 SQL guard。 |
| 2. AC12 before | 凍結**影片寫入**（新增、刪除、任何開通調整），維持至前後快照比對完成。先執行 `python3 scripts/videos_v2_snapshot.py dry-run-instructor --out <repo外私有目錄>`，以一位 active 講師身分唯讀乾跑相同的多 statement 查詢，確認 `supabase db query` 回傳最後的影片 SELECT 結果（10 IDs，腳本只印數量）；再由 PM 執行 `python3 scripts/videos_v2_snapshot.py before --out <同私有目錄>`。腳本檢查 linked project ref，逐人以 authenticated/JWT 只讀查影片 ID。目錄 700、JSON 600。 | 乾跑查詢若未回傳最後 SELECT 的一列結果，先修查詢工具/腳本；11 人或每人 10 支不符即停。勿在訊息/PR 貼 ID 或個資。 |
| 3. DB 遷移 | PM 在既有 MCP `apply_migration` 通道執行 `migrations/20261003_videos_v2_up.sql`，記錄 migration version。交易 commit 前 RLS/資料切換不可見。此時舊部署的影片表單仍 INSERT 已刪欄位，因此繼續凍結寫入。 | SQL guard/ACL postcheck 失敗應整筆 rollback。先查明差異，不繞過 guard。 |
| 4. AC12 after | PM 立即執行 `python3 scripts/videos_v2_snapshot.py after --out <同私有目錄>` 和 `compare`；**11 人 × 10 支、逐人 ID 集合 0 diff** 才繼續。 | 未達 0 diff 時維持影片寫入凍結；按 guard 評估 down，若不安全則前向修復。 |
| 5. 前端部署 | PM 合併/部署本分支，緊接 DB 變更，確認 `/videos`、`/videos/[id]` 和 `/api/videos/check` 可用。新版上傳移除影片目標期別選單，新增即草稿；教材及作業流選單照舊。 | 部署失敗時維持影片寫入凍結，修正部署。DB→前端空窗期不允許使用舊影片表單。 |
| 6. 冒煙與開放 | active 講師新增草稿、試播、開通/取消；一期學員 10 支、二期看不到、停權 0 支；用合成帳號驗直接 URL 得 404、PostgREST 直查 0；手機側欄、上下集、YouTube 私人提示與播放器下方處理中說明。除明確 401/403 私人訊號外，播放頁應保留 iframe。PM 確認後才解除影片寫入凍結。 | 失敗保持凍結，記錄情境/身分/錯誤，前向修復。 |
| 7. 清理備份 | 上線穩定 14 天後，由 PM 另案審核並 drop `elite_videos_v2_backup` schema。**drop 後本版 down SQL 不可再用。** | 未滿 14 天或仍可能回滾時保留備份。 |

## 唯讀預檢 SQL 範例

```sql
BEGIN READ ONLY;
SELECT count(*) AS videos,
       count(*) FILTER (WHERE cohort='2026-1' AND NOT all_cohorts) AS first_only
FROM elite.course_videos;
SELECT count(*) AS first_active_students FROM elite.enrollments
WHERE class_role='student' AND cohort='2026-1' AND status='active';
SELECT policyname,permissive,cmd,qual,with_check FROM pg_policies
WHERE schemaname='elite' AND tablename='course_videos';
SELECT n.nspname, r.rolname, d.defaclacl FROM pg_default_acl d
JOIN pg_namespace n ON n.oid=d.defaclnamespace
JOIN pg_roles r ON r.oid=d.defaclrole WHERE n.nspname='elite';
ROLLBACK;
```

## 回滾門檻

`migrations/20261003_videos_v2_down.sql` 僅供 PM 在嚴格 guard 全過時以 MCP 執行；任何新草稿、個人/多期/所有期別開通、影片增刪或受眾改動都會拒絕。若任一學員已依新模型取得不同存取權，不可強退到 Cohort v1 的單期欄位，應維持新版政策並做前向修復。回滾 DB 後，舊版前端才可部署。正式庫絕不可用本機合成 fixture、Auth seed 或直接 psql 寫入。
