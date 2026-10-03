# 課程影片 v3 本機驗證紀錄

使用隔離的本機 Supabase stack（API 54521、Postgres 54522）與合成名冊，不連正式庫寫入。fixture 在 Up 前重現 `elite` default ACL：`authenticated=arwd`。講師、一期、二期、停權及 11 位一期合成學員均為測試身分。

| 驗證 | 結果 |
|---|---|
| Up/Down | v2 合成基線 Up 通過、Down 通過；加草稿後 Down guard 正確拒絕。新表 REVOKE 後只授 SELECT，authenticated 直寫拒絕。 |
| AC1、AC2 | 一期能讀課程與 10 支影片，二期直查課程／影片均 0；直接路由以 404/列表處理。 |
| AC3 | 已開通課程內草稿對學員不可見；講師可見；發布後可見，取消發布後消失。 |
| AC4、AC5 | 多期 grant 開放兩期；指定個人只開放該名成員。 |
| AC6 | 停權身分即使有個人 grant，課程與影片皆 0。 |
| AC7 | 課程頁固定四類只顯示非空分段；播放頁查詢限定 `course_id`，側欄與上下集不跨課。 |
| AC8 | 空課／只有草稿的課程不出現在學員列表。 |
| AC9 | 手機 390px 截圖確認三層動線、播放器在寬度內，側欄可收合。 |
| AC10 | `scripts/videos_v3_ac10_local.py` 對 11 位一期合成學員逐人比對 v2/v3 ID 集合，均 10 支、0 diff，v3 各見一門命名課程。正式上線須再依 RUNBOOK 做正式唯讀 before/after。 |
| 講師管理 | 建課、開通對話框、移課確認文字、刪除含 10 支影片課程的拒絕訊息在本機 UI 確認；移課 RPC 原子退草稿。 |
| 播放器 | 本機影片網址換成從既有私有唯讀快照取得的正式 10 支 URL，桌機與手機播放頁皆有 YouTube iframe 和固定說明。 |

自動檢查：`npx tsc --noEmit`、`npm run lint`（僅既有 font warning）、`npm test`（5/5、70/70）、`npm run build`、`node scripts/test-videos-v3.mjs` 均通過。截圖存於 repo 外 `.proof-videos-v3`（目錄 700、檔案 600），共八張：學員課程列表／課程頁、桌機／手機播放、講師課程管理、課程開通、移課警告、非空課刪除拒絕。
