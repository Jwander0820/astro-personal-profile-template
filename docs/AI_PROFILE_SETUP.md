# 用 AI 產生個人自介網站

這個專案提供一份固定的回答格式，讓 Codex 或其他 coding agent 能先訪談、再把答案安全地寫進現有 Markdown。AI 不需要理解每個 Astro component，也不需要直接猜 frontmatter 欄位。

## 最短使用方式

把專案 fork 或 clone 後，在 coding agent 中輸入：

> 請依照 AGENTS.md 的個人自介流程訪談我，產生 profile.answers.json、套用內容並執行 build。沒有得到答案的選填資料請留空，不要自行杜撰。

Agent 應分兩輪詢問：

1. 必填：顯示名稱、一句話身分、1～6 個關鍵字、自我介紹。
2. 選填：國家／地區、社群網站、精選連結、About me 卡片、YouTube 播放清單、抽籤功能與排版偏好。

回答時可以很口語。Agent 的工作是整理語句、確認不確定的網址，最後產生符合 `docs/profile-answers.schema.json` 的 `profile.answers.json`。

若使用一般 AI 對話介面，可直接使用 [`ai/PROFILE_INTERVIEW_PROMPT.md`](ai/PROFILE_INTERVIEW_PROMPT.md)。Gemini 操作與限制請見 [`ai/GEMINI.md`](ai/GEMINI.md)。

## 可直接交給 AI 的問答清單

### 基本資料

- 網站要顯示什麼名字？
- 想用哪一句話描述現在的身分或正在做的事？
- 想放哪 1～6 個關鍵字？
- 請用自己的語氣寫一段自我介紹。AI 可以協助潤飾，但不應自行添加經歷。
- 是否顯示國家或地區？可以不填。

### 連結與內容

- 想放哪些社群網站？請提供服務名稱與完整網址。
- 是否有重要的專案、文章、作品集或歌單連結？每個項目可附一句說明和標籤。
- About me 想分成哪些卡片？例如「關於我」、「音樂」、「專案」、「旅行」。
- 是否要使用 YouTube 播放清單唱盤？若要，提供網址中的 `list` ID。
- 是否保留「今日手氣」抽籤？

## 套用與檢查

Profile Studio 的「AI 協助產生自介」會先驗證 JSON 並顯示個人資料、連結、卡片與功能開關摘要，不會在第一次點擊時寫檔。確認摘要後再按「確認套用」；server 會重新驗證後才修改內容。若 Studio 仍有其他尚未儲存的修改，需先處理完再套用，避免互相覆蓋。

Agent 或開發者可執行：

```bash
npm run profile:apply -- profile.answers.json
npm run build
.\start-studio.cmd
```

`profile:apply` 的行為：

- 更新 `src/content/profile/main.md`。
- 隱藏舊的社群 icon，建立 `generated-social-*.md`。
- 更新 `generated-link-*.md` 與 `generated-*.md` 自介卡片。
- 原本手寫的自訂 Markdown 不會被刪除；範本預設自介卡片會被隱藏。
- 依回答啟用或停用唱盤與抽籤。

`profile.answers.json` 已加入 `.gitignore`。網站只需要提交產生後的 Markdown 與圖片，不需要提交原始訪談答案。

## GitHub Pages 仍需手動完成的部分

AI 可以修改檔案、執行 build，也可以在得到明確授權後協助 commit/push；但第一次部署通常仍需要 repository 擁有者在 GitHub 完成：

1. Fork 專案，或建立自己的 repository。
2. 到 **Settings → Pages → Build and deployment**，將 Source 設為 **GitHub Actions**。
3. 到 **Actions** 頁面啟用 fork 的 workflow（若 GitHub 顯示停用提示）。
4. 將完成內容推送到 `main`。

部署 workflow 會自動判斷使用者首頁 repository（`帳號.github.io`）與一般 project repository 的 base path。

## 隱私與安全

- 不要把 GitHub 密碼、personal access token、API key 寫進回答檔或 Markdown。
- 公開網站只放願意讓任何訪客看到的 email、所在地與經歷。
- AI 不應自行開啟 repository Actions、修改 Pages 設定、commit 或 push；除非使用者明確要求。
- 套用前建議先 commit 目前版本，讓所有變更都能從 Git 還原。
