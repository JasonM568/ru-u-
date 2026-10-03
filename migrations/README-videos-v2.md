# 課程影片 v2：資料模型與驗證

此變更建立於 Cohort v1（`e0de414`）之上。正式庫是 QBC 全站共用庫；本分支只提供 SQL 與程式，正式寫入、推送、PR 由 PM 執行。

## 唯一可見性來源

- `course_videos.published_at IS NULL` 是草稿，只有 active 講師能讀；有值時仍須命中 `video_audiences`。
- `video_audiences` 一列只代表一個 `cohort`、一個 `user` 或 `all`，由 CHECK 保證三者互斥。複選期別寫多列；`all` 包括將來新增的期別；個人可與期別並存。`all` 與明列期別互斥。
- `course_videos.cohort` 與 `all_cohorts` 已移除；影片權限不再讀取這兩欄。教材的同名欄位保持原樣。
- `video_audiences.target_user_id` 參照 `enrollments(user_id) ON DELETE CASCADE`：移出名冊時，個人開通列自動刪除；同一人日後再加入不會繼承舊列。成員改期時，期別列自然按新期別重算；個人列繼續有效。停權保留名冊與個人列，但 restrictive gate 使其零存取，復權後恢復。
- 新增、開通、取消開通、同分類覆寫、刪除只由已登入 active 講師呼叫 `SECURITY DEFINER` RPC；普通 `authenticated` 只有 `course_videos` 和 `video_audiences` 的 SELECT grant，新表 SELECT 又由 RLS 限定講師。開通 RPC 在單一 DB 交易中覆寫受眾與狀態。同分類 RPC 只覆寫該分類**已開通**影片，草稿不動，也在單一交易完成。
- `video_audiences` 只能透過 RPC 寫入。從 Dashboard 或 `service_role` 直接改表可能同時留下 `all` 與期別列，繞過 RPC 的互斥檢查。

## RLS 與 ACL

影片 SELECT 的 permissive policy：

```sql
elite.is_enrolled() AND (
  elite.is_instructor() OR
  (published_at IS NOT NULL AND elite.video_audience_matches(id))
)
```

`video_audience_matches(id)` 以目前 `auth.uid()` 比對 `kind='all'`、`cohort_code=elite.my_cohort()` 或個人 UUID；函式固定 `search_path=''`，不依賴學員可讀 audience 表。既有 `course_videos.cohort_v1_active_gate` 保持啟用。新表另有 `cohort_v1_active_gate AS RESTRICTIVE FOR ALL TO authenticated USING (elite.is_enrolled()) WITH CHECK (elite.is_enrolled())`，再加講師專用 SELECT policy。停權者在影片政策、函式及 restrictive gate 三處均無權讀取。

`video_audience_matches` 由 RLS 政策以查詢者 `authenticated` 身分呼叫，因此必須保留對 `authenticated` 的 EXECUTE grant；撤掉會使學員的影片 SELECT 失敗。

正式 `elite` schema 的 default ACL 給 `authenticated=arwd`。Up SQL 對新表建立後立即 `REVOKE ALL FROM public, anon, authenticated`，對 identity sequence 也 revoke，再明確 grant SELECT；對既有影片表 revoke 直接寫入，僅授 SELECT。RPC 的 EXECUTE 明確 revoke public/anon 後 grant authenticated，函式內自行檢查 active instructor。不得只依靠 RLS 而遺漏 default ACL。

## 遷移及回滾

Up/Down 各以 `BEGIN`/`COMMIT` 包住。Up guard 要求現有 10 支皆只歸 `2026-1`、一期 active 學員 11 人、舊影片 SELECT policy 與停權 gate 存在；將舊影片 ID/目標與 SELECT policy 存入私有備份 schema，逐支寫一筆 `2026-1` audience 並設定開通時間，最後原子切換 policy 和欄位。若上線前影片數或舊資料已變，SQL 會拒絕，須先重新審核映射，不能略過 guard。

Down 僅在影片 ID 集合未變、每支均已開通且恰有一筆 `2026-1` 期別對象時恢復 Cohort v1 欄位與 SELECT policy。任何草稿、個人、多期、所有期別或新增影片都拒絕回滾；應做前向修復，避免舊 policy 洩漏。Cohort v1 的 down 腳本仍引用影片舊欄位，須先安全回退 v2，才能考慮 Cohort v1 down。

## 本機演練紀錄

在獨立 Supabase Postgres 與獨立本機 Supabase stack 使用 `scripts/videos_v2_local_baseline.sql` 合成帳號演練。Fixture **在 Up 前**執行 `ALTER DEFAULT PRIVILEGES IN SCHEMA elite GRANT SELECT,INSERT,UPDATE,DELETE ON TABLES TO authenticated`，重現正式庫 ACL。Up/Down 通過；一期 10 支、二期 0、停權 0、講師 10；學員直查 audience 得 0 列，講師直接 INSERT 新表/影片表被拒。講師 RPC 建草稿、指定單期/多期/所有期別/個人、取消開通皆通過；個人 FK 刪名冊後列數 1→0。變更對象及新增草稿後，Down guard 正確拒絕；清回合成基線後 Down 通過。`scripts/videos_v2_ac12_local.py` 再於獨立 DB 對 11 人逐一做前後 RLS 可見影片 ID 快照，皆為 10 IDs、0 diff。可指定 `VIDEOS_V2_LOCAL_PG_PORT=54422` 在獨立本機 Supabase stack 的 PostgreSQL 上建立專用測試 DB；預設為隔離容器埠 55433。

`scripts/test-videos-v2.mjs` 使用本機 Supabase URL guard，對 PostgREST/登入 session 驗 AC1/2/3/4/5/6/8/12 與 grant。此腳本只供本機合成資料；執行前先依本機 stack 建 fixture 與合成 Auth 身分。

播放頁的 YouTube oEmbed 只將明確 401/403 視為私人；404、429、5xx、逾時或網路失敗皆保留播放器 iframe。oEmbed 使用約 10 分鐘的 Next fetch 快取。播放器下方固定說明 YouTube 可能仍在處理中，因為 oEmbed 成功不代表轉檔完成。
