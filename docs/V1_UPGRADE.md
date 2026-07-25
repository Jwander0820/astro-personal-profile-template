# 從 0.1.0 升級到 v1.0.0

這份文件說明公開模板從 `0.1.0` 開發基線升級到正式版 `v1.0.0` 的內容相容性、備份與驗證步驟。

## 相容性摘要

- 建置基線升級為 Astro 7.1.3，需使用 Node.js 22.12 以上；部署平台也必須同步設定 Node 22。
- `src/content/` 仍是唯一資料來源。
- 五個 `homeOrder` 值維持 `about`、`turntable`、`links`、`fortune`、`notion`，每個值必須出現一次。
- 既有 profile、link、section、block 與 fortune 檔案不需要批次改寫。
- 統一 Studio 會即時更新正式預覽，但只有按下「儲存到專案」才寫入檔案。
- 籤桶仍以既有 `src/content/fortunes.json` 為網站來源，不建立第二份資料庫；可由 `/studio/fortune-poem/` 編輯，回答檔則保存可攜式副本。
- AI 回答可在「其它功能」驗證並載入草稿；既有 `profile.answers.json` 仍沿用 version 1 schema。

本次沒有強制內容 migration。若內容原本不符合 schema，新的集中驗證可能會更早拒絕寫入；請依錯誤訊息修正原始 Markdown 或 JSON，不要停用驗證。

## 升級步驟

1. 先 commit 或另外備份個人站的 `src/content/` 與 `public/images/`。
2. 取得固定的正式 tag，並在獨立更新分支合併，不要讓個人站直接追蹤模板 `main`：

   ```powershell
   git fetch upstream --tags
   git switch main
   git pull --ff-only origin main
   git switch -c update/template-v1.0.0
   git merge v1.0.0
   ```
3. 執行：

   ```powershell
   npm ci
   npm run build
   npm run studio
   ```

   如果 `node --version` 低於 `v22.12.0`，請先升級 Node，再執行安裝。Astro 7 的編譯器比 Astro 5 嚴格；若自訂 `.astro` 檔案有未關閉標籤或依賴舊的空白處理，請依 build diagnostics 修正。

4. 在 Studio 確認基本資料、首頁順序、連結、卡片與區塊皆能載入。
5. 確認欄位修改會立即反映在右側正式預覽，再測試一次「儲存到專案」。
6. 檢查 `src/content/fortunes.json`，第一次修改前保留 Git 備份。
7. 若使用 AI 回答檔，在「其它功能」按「驗證並載入草稿」，核對預覽後再儲存。
8. 重新執行 `npm run build` 並檢查 `git diff`，只提交預期的模板與個人內容變更。

## 復原

- 尚未 commit：使用 Git 或既有備份還原個人內容，不要刪除整個 working tree。
- 籤桶誤改：使用 Git diff 或自己的備份還原 `src/content/fortunes.json`。
- AI 套用不符合預期：套用前摘要不會修改檔案；已套用則用 Git diff 檢查並還原對應的 `src/content/` 檔案。
- V1 build 失敗：停止部署，保留錯誤輸出，修正 schema 或內容後重新跑完整 build。

## v1.0.0 後的相容性承諾

`v1.0.0` 後，主要 frontmatter、回答檔 version 1 schema 與五個首頁板塊值應維持向下相容。若未來無法避免破壞性變更，必須提高 major version，並提供 migration、備份與復原步驟。
