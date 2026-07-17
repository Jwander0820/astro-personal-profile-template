# 用 AI 產生個人自介網站

這個專案提供一份固定的回答格式，讓 Codex 或其他 coding agent 能先訪談、再把答案安全地寫進現有 Markdown。AI 不需要理解每個 Astro component，也不需要直接猜 frontmatter 欄位。

## 最短使用方式

先把專案 fork／clone 到自己的 repository，再依工具能力選擇下列模式。

### 只建立與驗證內容

在 Codex 或其他具備專案檔案與終端機存取能力的 coding agent 中輸入：

> 請依照 AGENTS.md 的個人自介流程訪談我，產生 profile.answers.json、套用內容並執行 build。沒有得到答案的選填資料請留空，不要自行杜撰。

### 一站式建立並發布

若 coding agent 也能使用 Git，且目前專案的 `origin` 是你自己的 repository，可輸入：

> 請依照 AGENTS.md 訪談我建立個人自介。訪談完成後，產生並驗證 profile.answers.json，使用既有 profile:apply 流程更新 src/content，執行完整 build。Build 成功後，請列出即將公開的個人資料與 Git 變更摘要，等待我確認發布；我確認後，先確認 origin 是我自己的 repository，再建立與本次內容相符的 commit、推送至部署分支，並回報 GitHub Pages workflow 結果。若尚未完成 GitHub Actions、Pages 或 Git 權限設定，請停止發布並告訴我需要完成的步驟。不要提交 profile.answers.json，也不要把個人資料推到上游模板 repository。

這是一個連續流程，但不會略過公開前確認。Agent 應在 build 成功後列出將公開的姓名、地點、email、雇主資訊、私人網址與主要 Git diff；只有使用者再次確認，才可以 commit 與 push。若 remote 仍指向上游模板、Git 尚未登入或 Pages 尚未設定，Agent 應停止發布並提供下一步，不能改推到其他 repository。

Agent 應分兩輪詢問：

1. 必填：顯示名稱、一句話身分、1～6 個關鍵字、自我介紹。
2. 選填：國家／地區、社群網站、精選連結、About me 卡片、圖片板塊、YouTube 播放清單、抽籤功能、字型與排版偏好。

回答時可以很口語。Agent 的工作是整理語句、確認不確定的網址，最後產生符合 `docs/profile-answers.schema.json` 的 `profile.answers.json`。

若使用不能存取 repository 的一般 AI 對話介面，它只能完成訪談與 JSON 產出，不能直接修改 content、commit 或部署。此時可使用 [`ai/PROFILE_INTERVIEW_PROMPT.md`](ai/PROFILE_INTERVIEW_PROMPT.md)，再將 JSON 貼到 Profile Studio；Gemini 操作與限制請見 [`ai/GEMINI.md`](ai/GEMINI.md)。

## Coding agent 一站式流程

1. 讀取 schema 與範例，只詢問尚未提供的資料。
2. 將確認過的回答寫入 gitignored 的 `profile.answers.json`。
3. 執行 `npm run profile:apply -- profile.answers.json`，由共用轉換器更新 `src/content/**`，不手動猜測 frontmatter。
4. 執行 `npm run build`；若內容驗證失敗，修正回答或產生內容後重新驗證。
5. 檢查 Git diff，列出即將公開的個人資料與檔案摘要，並提供 `npm run studio` 作為可選的視覺檢查。
6. 等待使用者明確確認發布。
7. 確認 `origin` 是使用者自己的 repository，且變更中不包含 `profile.answers.json`、secret 或無關檔案。
8. 建立符合實際變更的 commit，推送至部署分支；GitHub Pages 預設由 `main` 觸發。
9. 若工具能讀取 GitHub Actions 狀態，等待 workflow 完成並回報網站網址；否則提供 Actions 頁面與首次設定清單。

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
- 是否要加入大圖板塊？若要，提供圖片路徑、替代文字、附加說明，以及希望放在 Links 前、Links 後或 About 後。
- 是否要使用 YouTube 播放清單唱盤？若要，提供網址中的 `list` ID。
- 是否保留「今日手氣」抽籤？
- 內文與標題要使用系統預設、Noto Sans TC、Noto Serif TC 或 LXGW WenKai TC？可跳過。

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
- 更新 `generated-link-*.md`、`generated-*.md` 自介卡片與 `generated-image-*.md` 圖片板塊。
- 原本手寫的自訂 Markdown 不會被刪除；範本預設自介卡片會被隱藏。
- 依回答啟用或停用唱盤與抽籤。

`profile.answers.json` 已加入 `.gitignore`。網站只需要提交產生後的 Markdown 與圖片，不需要提交原始訪談答案。`npm run build` 允許這個本機回答檔存在，並會掃描 Git 已追蹤或未忽略的公開檔案是否含有疑似密鑰；套用回答後，首頁區塊顯示狀態也會依實際產生的內容同步。

## 發布與 GitHub Pages 首次設定

具備 Git 權限的 coding agent 可以在公開內容摘要得到確認後協助 commit／push。一般聊天型 AI 無法直接操作 repository。第一次部署通常仍需要 repository 擁有者在 GitHub 完成：

1. Fork 專案，或建立自己的 repository。
2. 到 **Settings → Pages → Build and deployment**，將 Source 設為 **GitHub Actions**。
3. 到 **Actions** 頁面啟用 fork 的 workflow（若 GitHub 顯示停用提示）。
4. 確認 coding agent 使用的 `origin` 是自己的 repository，並已具備 push 權限。
5. 將完成內容推送到 `main`。

部署 workflow 會自動判斷使用者首頁 repository（`帳號.github.io`）與一般 project repository 的 base path。若 workflow 失敗，Agent 應回報失敗階段與可操作的修正方式，不應把本機 build 成功當成部署完成。

## 隱私與安全

- 不要把 GitHub 密碼、personal access token、API key 寫進回答檔或 Markdown。
- 公開網站只放願意讓任何訪客看到的 email、所在地與經歷。
- AI 不應自行開啟 repository Actions、修改 Pages 設定、commit 或 push；除非使用者明確要求。即使起始提示已要求發布，push 前仍要再確認一次公開內容摘要。
- 發布前確認 `origin` 屬於使用者，不要把個人自介內容推回上游模板 repository。
- 套用前建議先 commit 目前版本，讓所有變更都能從 Git 還原。
