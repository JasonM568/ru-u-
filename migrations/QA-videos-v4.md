# 課程影片 v4 驗收與上線守門

狀態：**隔離環境驗收通過（2026-11-17）**。`20261117_videos_v4_up.sql` 僅在本機隔離資料庫及本機 `wt-videos-v3` Supabase 容器演練；**正式庫 `qubjpayeopvscrgrvrci` 未連線、未執行 DDL**。不得在未取得 PM／Jason 明確確認前對正式庫執行 DDL。測試帳號與資料均為合成資料，已重現 `elite` schema 的 default ACL；未使用 service role key。

## 發版順序

1. 在隔離環境先取得遷移前快照：每門課的全部影片 ID，依 `pre → day1 → day2 → extra → 其他`、`created_at`、`id` 排序；另記錄講師及學員各自可見影片 ID 集合。
2. 在隔離環境演練 Up SQL，確認 SQL guard、交易回滾及下列 AC；重複執行應被前置 guard 拒絕。
3. 比對遷移後每門課的 `(course_id, id, sort_order)`：`sort_order` 應自 0 起連續，依分類＋`sort_order` 呈現的 ID 序列與步驟 1 完全一致。學員可見 ID 集合也應 0 diff。
4. 正式環境僅在另行取得 PM／Jason 的 DDL 授權、核對唯讀快照和演練結果後，由指定流程執行 SQL。資料庫欄位與 RPC 必須先就緒，才能部署會讀取 `sort_order` 的前端版本。不可提前清理 v2/v3 backup。

## 驗收矩陣（隔離環境實測）

| 驗收 | 結果 | 實測證據 |
|---|---|---|
| AC1 | **通過** | 本機瀏覽器用合成講師修改已發布影片與草稿的標題／說明；`/videos`、講師課程頁、學員課程頁和播放頁顯示新標題。空白標題時儲存鍵停用，RPC 亦拒絕。隔離資料庫比對 `id/url/published_at` 不變；學員 RLS 查詢讀到新標題。 |
| AC2 | **通過** | 瀏覽器上下按鈕使 `Video 1` 從第 1 移至第 2；拖曳使 `Video 3` 移至第 1；本機 SQL 查得 `Video 3/2/1` 的 `sort_order=0/1/2`。重整、登出再登入仍相同。暫時撤銷本機 reorder EXECUTE 後點下移，UI 恢復原順序並顯示 `permission denied for function course_video_reorder`；隨後已恢復授權並核對為 `t`。 |
| AC3 | **通過** | 講師與學員課程頁分類仍為 Day 1／Day 2；學員課程頁前 3 支為 `Video 3/2/1`，播放頁章節側欄同序，`Video 3` 的下一集連到 `Video 2`。學員看不到草稿且直接開草稿 URL 得 404，講師課程頁看得到草稿。跨分類拖曳前後 ID 序列一致。390px 觸控模擬拖曳成功；鍵盤聚焦「上移」後按 Enter 成功。 |
| AC4 | **通過** | 真實本機 Auth session 經 PostgREST 呼叫兩個 RPC：合成講師均 HTTP 204，學員與停權者均 HTTP 400 `active instructor required`，anon 均 HTTP 401。SQL 權限檢查：anon 兩函式 EXECUTE=`false|false`；authenticated 對 `course_videos` 的 INSERT／UPDATE／DELETE=`false|false|false`，直接 UPDATE 回 `permission denied`。另測不同期別學員同樣被拒。 |
| AC5 | **通過** | 缺漏、多餘、重複、跨課程、`NULL` ID 與 `NULL` 陣列均拒絕；每次 SQL 前後 `id|sort_order` 完全相同。空課程傳 `ARRAY[]::uuid[]` 成功。 |
| AC6 | **通過** | 獨立資料庫兩門課 14 支合成影片的遷移前後快照 0 diff；講師、第一期學員、第二期學員及停權者可見 ID 集合 0 diff。每門課 `sort_order` 分別為 0–12、0；非空／負數 0 筆。重跑 Up SQL 被 preflight guard 拒絕，原結構仍只有一個 `sort_order` 欄位。 |
| 延伸回歸 | **通過** | 新增影片 `sort_order=13`（原最大 12）；移入第二課影片在分類最後且 `published_at IS NULL`。刪除後重排補齊 0 起連續順位。並發新增持課程鎖時，舊 ID 清單的重排遭拒，順位無重複；以新完整清單重試成功。 |

## 執行方式與證據

- 腳本：[videos_v4_local_qa.py](../scripts/videos_v4_local_qa.py)；執行 `python3 scripts/videos_v4_local_qa.py`，**30/30 檢查通過**。腳本固定連 `127.0.0.1:54522`，建立全新的 `videos_v4_qa_<pid>` 資料庫，拒絕覆寫既有同名資料庫，不使用 linked project 或 service role key。本次完整資料庫為 `videos_v4_qa_77954`；合成快照與逐項結果位於 `/tmp/videos_v4_qa_20261117.json`。
- 套用順序：`videos_v3_local_baseline.sql` → `20261003_videos_v2_up.sql` → `20261003_videos_v3_up.sql` → 增加合成分類／草稿／第二門課 → 遷移前快照 → `20261117_videos_v4_up.sql` → 遷移後快照／RLS／RPC／併發測試。baseline 的 `elite` default ACL 使 `authenticated` 先具有新表 INSERT 權限；v4 演練後影片表只保留 SELECT，符合正式庫防護要求。
- 瀏覽器驗收使用本機 `wt-videos-v3` Supabase (`127.0.0.1:54521/54522`) 與 `localhost:3001` 的 Next.js。`app/.env.local` 當時指向正式 Supabase，因此啟動時**明確覆蓋**為本機 API URL 與本機 anon JWT；瀏覽器只登入 `synthetic-videos-*@example.test` 合成帳號。該本機容器的 `postgres` 資料庫也已套用 v4，以便實際測頁；正式庫完全未接觸。
- 本機瀏覽器觀測：管理清單與學員頁 `Video 3/2/1`、SQL `sort_order=0/1/2`；學生播放頁章節 `01 Video 3 → 02 Video 2 → 03 Video 1`，下一集 `/videos/10000000-0000-0000-0000-000000000002`；草稿 URL 對學員回 404。RPC HTTP 結果：講師 204／學員和停權者 400／anon 401。失敗回滾演練結束後，`has_function_privilege('authenticated','elite.course_video_reorder(uuid,uuid[])','EXECUTE')=t`。

**QA 判定：可進入「申請正式庫 DDL 授權」審查；這不是正式庫執行授權。** 正式步驟仍須依上方發版順序，在授權前另取正式庫唯讀快照並核對資料／ACL，資料庫欄位及 RPC 就緒後才部署前端。此隔離驗收不能保證正式資料與合成 fixture 完全相同。

## 目前已完成的離線檢查

- `npx tsc --noEmit`：通過。
- 對本案六個 TS／TSX 檔執行 `npx eslint`：通過。
- `git diff --check`：通過。
- 合成影片陣列驗證 `orderedVideos()`／`videoGroups()`：分類順序不變，組內按 `sort_order` 排序，通過。

以上「離線檢查」是工程 pane 原先紀錄；本次已在隔離環境補完 migration、真實本機 Auth session RPC 及瀏覽器驗收。正式庫仍未執行任何 migration。
