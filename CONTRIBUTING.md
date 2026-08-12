# 參與開發

感謝你願意改善這個個人自介網站模板。請先用 issue 說明問題、使用情境與預期結果；小型修正可直接送 pull request。

## 本機環境

需求：Node.js 22.12 以上版本與 npm。

```bash
npm install
npm run dev
```

修改 Profile Studio 時可執行 `npm run studio`，並開啟 `http://localhost:4321/studio/`。4322 僅是 loopback API adapter。

## 變更原則

- `src/content/` 是正式網站與 Studio 預設值的來源。
- `/studio/` 是唯一的 Studio UI；預覽必須載入正式首頁 renderer。
- 正式 Astro components 與 `src/scripts/profile-renderer.js` 必須保持可見結構一致。
- 新增設定欄位時，請同步更新 content schema、答案驗證、JSON Schema、Studio、writer、preview、renderer、文件與測試。
- 公開 Studio 不得持有 repository credential、寫入 GitHub 或靜默上傳草稿。
- 本機 no-op 儲存不得改變 mtime 或產生無意義的 Git diff。
- 不要提交自己的 `profile.answers.json`、私人連結、token、測試下載檔或 build output。

## 驗證

一般程式變更至少執行：

```bash
npm run build
npm run check:quality
git diff --check
```

修改 Studio UI、預覽或互動時另外執行：

```bash
npm run check:browser:install
npm run check:browser
```

修改 Studio build 規則時執行 `npm run check:studio-deployment`；修改 starter content 或模板公開行為時執行 `npm run check:template-defaults`。

## Pull request

- 一個 PR 聚焦一個問題，說明使用者影響與相容性。
- 列出實際執行的驗證及結果，不要把失敗或 `continue-on-error` 描述成通過。
- 若 UI 有視覺變更，附上桌面與 390 px 行動版截圖。
- 保留現有個人化內容；不要用範例檔全面覆蓋不相關 Markdown。
- 使用 Conventional Commit 風格的簡短標題，例如 `fix: 避免圖片同名覆蓋`。

## 回報安全問題

請勿把可利用細節或私人資料貼到公開 issue；依 [SECURITY.md](SECURITY.md) 使用私密漏洞回報。
