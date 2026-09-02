---
description: 五層作業流控制台（/flow）開發指揮 — 載入 SPEC 與現況，接續四階段開發
argument-hint: "[status | test | uat | phase2 | phase3 | phase4 | <自由描述>]"
allowed-tools: Bash(git:*), Bash(npm:*), Bash(npx:*), Read, Glob, Grep, Edit, Write
---

# 五層作業流控制台 — 開發指揮

專案根目錄：`/Users/jasonmchen/Downloads/菁英班-系統開發`
Next.js App：`/Users/jasonmchen/Downloads/菁英班-系統開發/app`（git repo 在這一層，不是父層）

## 目前狀態（指令展開時即時抓取）

- 分支：!`git -C "/Users/jasonmchen/Downloads/菁英班-系統開發/app" branch --show-current 2>/dev/null || echo "(讀取失敗)"`
- 未合併進 main 的 commit 數：!`git -C "/Users/jasonmchen/Downloads/菁英班-系統開發/app" log --oneline main..HEAD 2>/dev/null | wc -l | tr -d ' '`
- 最近 3 筆 commit：
!`git -C "/Users/jasonmchen/Downloads/菁英班-系統開發/app" log --oneline -3 2>/dev/null || echo "(讀取失敗)"`
- 工作區（空 = 乾淨）：
!`git -C "/Users/jasonmchen/Downloads/菁英班-系統開發/app" status --short 2>/dev/null || echo "(讀取失敗)"`

## 開始前必讀

依序讀這三份，不要跳過：

1. `app/docs/flow-console-SPEC.md` — 控制台完整規格。**特別注意「不可擅改」與「資料出處與可信度」兩節。**
2. `app/CLAUDE.md` — 專案鐵則。共用 QBC 正式庫（239 會員真實資料）、只能在 `elite` schema 建表、RLS 是安全邊界、不用 service role key。
3. `app/WORKLOG.md` 最上面那則（2026-09-02） — 階段一做了什麼、為什麼那樣做。

`app/AGENTS.md` 要求：這版 Next.js（16.2.10）有 breaking changes，寫程式前先讀 `app/node_modules/next/dist/docs/` 的相關章節。已知重點：`cookies()`／`params`／`searchParams` 皆為 async；middleware 已改名 `proxy.ts`；`ssr: false` 只能寫在 Client Component。

## 四階段進度

- [x] **階段一** 控制台移植進站（`/flow`），資料存 localStorage — 已完成，**在 feat/flow-console 分支未合併**
- [ ] **階段二** 論點卡上雲：`elite.thesis_cards` ＋ RLS ＋ `saveThesisCard` server action
- [ ] **階段三** 講師端 `/admin/thesis-cards` ＋ T+20 對帳（`elite.thesis_reconciliations`）
- [ ] **階段四** 分段設定由講師下發（`elite.flow_configs`）

各階段的資料表欄位與 RLS 設計寫在 SPEC 的「目前狀態與後續三階段」。

## 依參數執行

使用者輸入的參數：**$ARGUMENTS**

依參數決定要做什麼；沒給參數就走 `status`。

### `status`（預設）
讀完上面三份文件後，用三到五句話回報：目前在哪個階段、分支狀態、有沒有未完成的驗收、下一步建議做什麼。**然後停下來問使用者要做什麼，不要自作主張開工。**

### `test`
跑 `npm run test`（在 app 目錄）。這會跑計分 5/5 ＋ 作業流 31/31。有失敗就先修，並回報是程式錯還是測試的假設錯。

### `uat`
把 SPEC 最後那份「驗收清單（UAT）」11 個步驟列出來，一步一步帶使用者走。
**注意：Claude 不能輸入密碼，無法代替使用者登入。**每一步請使用者回報結果，有問題就當場修。

### `phase2` / `階段二`
開始論點卡上雲。**動資料庫前的順序不可顛倒：**

1. 先 `list_tables`（Supabase MCP，project `qubjpayeopvscrgrvrci`，schema `elite`）確認 `thesis_cards` 不存在
2. `apply_migration`（name: `elite_thesis_cards`）建表 ＋ 開 RLS ＋ 寫政策
3. **RLS 雙向實測**：本人看得到、他人 0 筆。沒測過不算完成
4. 才寫 server action 與頁面

RLS 規則（已與使用者確認）：論點卡**只有本人＋講師看得到**。學員讀寫自己（`user_id = auth.uid() and elite.is_enrolled()`）；講師只能 select 全部（`elite.is_instructor()`），**不能改學員的卡**。

`saveThesisCard` 必須用 `lib/flow/ccc.ts` 在 server 端**重算** `cc_*` 五個欄位，不信任前端傳來的數字——比照 `lib/scoring.ts` 的既有做法。

### `phase3` / `階段三`
講師端與 T+20 對帳。四象限判定（未觸發＋賺＝論點成立｜未觸發＋賠＝證偽條件設計失敗｜觸發＋執行＝紀律及格｜觸發＋未執行＝紀律失誤）寫成 `lib/flow/reconcile.ts` 純函式，server 端重算。講師端比照 `app/(app)/admin/teams/page.tsx`：平行 select ＋ JS 端 Map join。

### `phase4` / `階段四`
分段設定由講師下發（`elite.flow_configs`，講師寫、名冊內學員讀）。

### 其他自由描述
照使用者說的做，但仍受下面的紀律約束。

## 這個專案的紀律（每次都要遵守）

1. **正式庫**：只在 `elite` schema 建表，**永不碰 `public`**。migration 前先 `list_tables`。
2. **RLS 是安全邊界**，不是前端藏一藏。每張新表都要雙向實測。
3. **不信任前端數字**：CCC 與對帳結果一律 server 端重算。
4. **指令文字是教材原文**，`lib/flow/prompts.ts` 裡的字串不可擅改，要改先問講師。
5. **補充個股與教材原表必須分得清楚**：`added: true` 的 16 檔段位一律「未定」，不代填老師的先驗判斷。
6. **每階段開 feature branch**，`npm run build` ＋ `npm run test` 通過、人工驗收過，才合 `main`。**合進 main 會自動部署到正式站 https://elite.huangxi.info。**
7. 改完 `lib/flow/*` 或 `lib/scoring.ts` 一定要跑 `npm run test`。

## 常用指令

```bash
cd "/Users/jasonmchen/Downloads/菁英班-系統開發/app"
npm run flow        # 起 dev 並直接開 /flow（寫死 3000 埠，被占用時改用 npm run dev）
npm run test        # 計分 5/5 + 作業流 31/31
npm run test:flow   # 只跑作業流測試
npm run build       # 上線前驗證
```
