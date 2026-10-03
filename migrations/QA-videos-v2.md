# 課程影片 v2 本機驗收紀錄（2026-10-03）

環境：隔離 worktree、獨立 Supabase stack（本機合成 Auth 帳號）、獨立 Postgres 容器。正式庫只做 `BEGIN READ ONLY … ROLLBACK` 的 schema/數量/ACL 預檢：`course_videos` 10 支、均僅屬一期；一期 active 學員 11 位；`enrollments.user_id` 為 PK；影片 ID 為 uuid；`elite` default ACL 確有 `authenticated=arwd`。未對正式庫寫入。

| AC | 本機結果 |
|---|---|
| 1–2 | 期別 A 的合成學員查到開通影片，B 的 PostgREST 查不到；B 輸入已知 `/videos/<id>` 得 HTTP 404。講師可見全部。 |
| 3 | RPC 建草稿後，講師可見；一期、二期學員均無該列。 |
| 4 | 明列一期＋二期可見，後加的四期不可見；改成 `all` 後四期可見。 |
| 5 | 指定二期 X：X 可見；二期 B 與一期均不可見。X 改期後個人列仍有效。從名冊刪除個人後，FK cascade 清掉其個人 audience 列。 |
| 6 | 取消開通後，原指定對象立即查不到。 |
| 7 | 瀏覽器點「沿用上一支」，期別勾選正確帶入；整批選二期／第一隊後選入 2 人；同分類覆寫有二次確認，明列 10 支影片且其他分類不受影響。PostgREST 測試兩支同分類影片原子覆寫成功，其他分類仍保留原可見集合。 |
| 8 | 停權合成身分在 RLS 直查影片為 0；新 audience 表有 restrictive active gate。 |
| 9 | 目錄與側欄皆用目前 RLS 可見集合；第一集無上一集，最後一集無下一集；二期 0 支顯示空狀態而非錯誤；手機側欄收於播放器下方。 |
| 10 | 以 stubbed oEmbed response 測 403→私人、404→轉檔中、200→可播放；私人影片訊息以暫時的本機測試回應擷取畫面，該測試分支未留在產品碼。新增流程的 server action 在寫 DB 前檢查 oEmbed，私人狀態回傳錯誤。尚未使用真實的私人 YouTube 帳號做外部端到端測試。 |
| 11 | Playwright 以 390×844 視窗檢視播放器與收合側欄，無可見水平溢出。 |
| 12 | `videos_v2_ac12_local.py` 使用 11 個合成一期 JWT context，比對 up 前後各人 10 個影片 ID，0 diff；另有正式庫唯讀快照腳本供 PM 上線時跑。 |

工具門檻：`npx tsc --noEmit`、`npm run lint`、`npm test`（5+70 筆既有測試）、`npm run build`、`node scripts/test-videos-v2.mjs`、`npx tsx scripts/test-video-status.ts`、本機 SQL up/down 皆通過。lint 僅有既有 `app/layout.tsx` 字型警告，無錯誤。

截圖存於 repo 外的 `/Users/jasonmchen/Downloads/菁英班-系統開發/.proof-videos-v2/`，目錄 700、PNG 600：`catalog-student.png`、`catalog-instructor-draft.png`、`playback-desktop.png`、`playback-mobile.png`、`audience-dialog.png`、`category-confirm.png`、`private-video-instructor.png`。全部只用合成資料。
