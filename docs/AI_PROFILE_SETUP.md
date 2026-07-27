# 用 AI 產生個人自介網站

這個專案提供一份固定的回答格式，讓 Codex 或其他 coding agent 能先訪談、再把答案安全地寫進現有 Markdown。AI 不需要理解每個 Astro component，也不需要直接猜 frontmatter 欄位。

## 最短使用方式

先把專案 fork／clone 到自己的 repository，再依工具能力選擇下列模式。

### 只建立與驗證內容

在 Codex 或其他具備專案檔案與終端機存取能力的 coding agent 中輸入：

```text
請依照 AGENTS.md 的個人自介流程訪談我，產生 profile.answers.json、套用內容並執行 build。沒有得到答案的選填資料請留空，不要自行杜撰。
```

### 一站式建立並發布

若 coding agent 也能使用 Git，且目前專案的 `origin` 是你自己的 repository，可輸入：

```text
請依照 AGENTS.md 訪談我建立個人自介。訪談完成後，產生並驗證 profile.answers.json，使用既有 profile:apply 流程更新 src/content，執行完整 build。Build 成功後，請列出即將公開的個人資料與 Git 變更摘要，等待我確認發布；我確認後，先確認 origin 是我自己的 repository，再建立與本次內容相符的 commit、推送至部署分支，並回報 GitHub Pages workflow 結果。若尚未完成 GitHub Actions、Pages 或 Git 權限設定，請停止發布並告訴我需要完成的步驟。不要提交 profile.answers.json，也不要把個人資料推到上游模板 repository。
```

這是一個連續流程，但不會略過公開前確認。Agent 應在 build 成功後列出將公開的姓名、地點、email、雇主資訊、私人網址與主要 Git diff；只有使用者再次確認，才可以 commit 與 push。若 remote 仍指向上游模板、Git 尚未登入或 Pages 尚未設定，Agent 應停止發布並提供下一步，不能改推到其他 repository。

Agent 應先取得網站最基本的顯示名稱，再讓使用者自行選擇是否補充其他內容：

1. 必填：顯示名稱。
2. 選填：一句話身分、1～6 個關鍵字、自我介紹、國家／地區、社群網站、精選連結、About me 卡片、圖片板塊、YouTube 播放清單、抽籤功能、主色、字型與排版偏好。

回答時可以很口語。Agent 的工作是整理語句、確認不確定的網址，最後產生符合 `docs/profile-answers.schema.json` 的 `profile.answers.json`。

若使用不能存取 repository 的一般 AI 對話介面，它只能完成訪談與 JSON 產出，不能直接修改 content、commit 或部署。任意能依提示詞輸出 JSON 的 AI 工具都可使用，本流程不要求特定品牌或模型。此時可使用 [`ai/PROFILE_INTERVIEW_PROMPT.md`](ai/PROFILE_INTERVIEW_PROMPT.md)，再將 JSON 貼到 Profile Studio。

## 沒有電腦時：使用線上 Studio

允許公開 Studio 的部署會在正式首頁 Links 與頁尾提供 `/studio/` 入口。線上 Studio 不需要安裝 Node.js 或 npm，手機也能使用；它會從目前網站內容建立草稿，並支援 AI JSON 匯入、正式頁面即時預覽、圖片上傳或公開 HTTPS 圖片網址、網頁內嵌卡片、唱盤試播、今日手氣標題／說明／籤桶編輯與試抽，以及下載包含 JSON 與圖片的 `profile-settings.zip`。頂端 route 可在同一分頁切換個人檔案、籤詩與 Icon 預覽。

線上版不具備 GitHub 寫入權限，也不會把草稿送到後端。下載後可先保留檔案，日後有本機專案時：

1. 之後在 `/studio/` 匯入 ZIP 設定包；若只有 JSON，也可直接匯入。
2. 執行 `npm run studio` 後，同一頁會顯示「儲存到專案」；確認後才寫入 Markdown 與圖片。JSON 也可使用 `npm run profile:apply -- profile.answers.json`。
3. 執行 `npm run build`，再依公開內容摘要確認是否發布。

預覽直接嵌入正式首頁並使用正式 CSS、卡片結構與 SVG Icons；只會省略「建立你的自介網站」卡片與頁尾 Studio 連結，因為它們是範本導覽而非使用者內容。圖片使用瀏覽器 Blob URL 即時顯示。YouTube 實際播放、外部 iframe 能否載入，仍取決於瀏覽器與第三方服務。

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

## 回答方式與空白模板

你可以讓 AI 一題一題訪談，也可以先填好下方模板再一次貼上。訪談時可以使用口語回答；AI 應只詢問尚未提供的資訊，不顯示不必要的 JSON 欄位名稱，並讓每組選填內容都能直接跳過。

### 可以填寫的內容

| 類別 | 填寫方式 |
|---|---|
| 顯示名稱 | 網站公開顯示的姓名或暱稱 |
| 一句話身分 | 選填；簡短描述目前的身分、工作方向或正在做的事 |
| 關鍵字 | 選填；最多 6 個詞，例如興趣、技能或生活主題 |
| 自我介紹 | 選填；可以留空，或使用自己的語氣描述自己。AI 可以協助潤飾，但不能增加未提供的經歷 |
| 公開地區 | 選填，只填願意公開的國家、地區或城市 |
| 社群連結 | 服務名稱與完整網址，例如 GitHub、Instagram 或 `mailto:` email |
| 精選連結 | 標題、網址、簡短說明、排序與卡片樣式（一般、主色強調或低調），例如作品集、專案或文章 |
| About me 卡片 | 卡片標題、內容、選填標籤與 `/images/` 圖片路徑或公開 HTTPS 圖片網址 |
| 圖片板塊 | 標題、`/images/` 圖片路徑或公開 HTTPS 圖片網址、替代文字、說明、顯示位置與版型 |
| 網頁內嵌 | 標題、公開 http(s) 網址或 Notion／YouTube iframe 程式碼、預覽連結或直接 iframe、選填高度與標籤 |
| YouTube 播放清單 | 完整播放清單網址，或網址中 `list=` 後方的 ID |
| 今日手氣 | 保留或關閉；選填標題、說明與籤詩內容，不指定時保留專案既有籤桶 |
| 外觀 | 6 碼 HEX 主色、內文／標題字型、About me 格狀或列表排版，以及首頁板塊順序 |

圖片板塊的位置可選 Links 前、Links 後或 About 後；版型可選滿版、圖片在左、圖片在右或海報。字型可選系統預設、Noto Sans TC、Noto Serif TC 或 LXGW WenKai TC。主色使用 `#7A58A6` 這類 6 碼 HEX 色碼；沒有偏好時可省略並保留預設紫色。

任意自訂 Markdown 區塊與唱盤連續播放設定目前不在 AI 回答檔格式內，請參考 [`CUSTOMIZATION_GUIDE.md`](CUSTOMIZATION_GUIDE.md) 手動設定。一般網站與 Notion 可使用回答檔的 `embedBlocks`，或直接在 Profile Studio「其它功能」新增。

### 可直接複製的空白模板

不需要的選填項目可以留空或填寫「跳過」。有多個社群、連結、卡片或圖片板塊時，重複對應的小段即可。

```text
【基本資料】

顯示名稱：
一句話身分（選填）：
關鍵字（選填）：
自我介紹（選填）：
公開地區（選填）：

【社群連結】

- 服務：
  網址：

【精選連結】

- 標題：
  網址：
  簡短說明：
  卡片樣式（一般／主色強調／低調）：
  標籤：

【About me 卡片】

- 標題：
  內容：
  標籤：
  圖片路徑或公開 HTTPS 網址：

【圖片板塊】

- 標題：
  圖片路徑或公開 HTTPS 網址：
  圖片替代文字：
  說明：
  顯示位置：
  版型：
  圖片比例：
  裁切焦點：
  標籤：

【功能】

YouTube 播放清單：
網頁內嵌（標題、網址、預覽連結／直接 iframe、高度、標籤）：
今日手氣：
今日手氣標題：
今日手氣說明：
自訂籤詩（ID、等級、祝福／玩梗、籤文、選填備註、是否啟用）：

【外觀】

內文字型：
標題字型：
About me 排版：
首頁板塊順序：

【其他補充】

希望保留的語氣：
其他要求：
```

## 套用與檢查

在 Profile Studio 的「完成設定」貼上 AI 產生的 JSON，再按「驗證並載入草稿」。通過共用 schema 後只會更新瀏覽器草稿與正式預覽；公開模式下載設定包，本機模式仍需明確按下「儲存到專案」才會寫檔。單獨下載或複製 JSON 不包含從裝置上傳的圖片檔，但會保留 `/images/` 路徑與公開 HTTPS 圖片網址。

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

`profile.answers.json` 已加入 `.gitignore`。網站只需要提交產生後的 Markdown 與圖片，不需要提交原始訪談答案。`npm run build` 會執行 Astro 診斷、內容驗證與靜態建置；上游範本維護者可另跑 `npm run check:quality` 掃描公開檔案中的疑似密鑰並執行工具鏈回歸檢查。套用回答後，首頁區塊顯示狀態也會依實際產生的內容同步。

## 發布與 GitHub Pages 首次設定

具備 Git 權限的 coding agent 可以在公開內容摘要得到確認後協助 commit／push。一般聊天型 AI 無法直接操作 repository。第一次部署通常仍需要 repository 擁有者在 GitHub 完成：

1. Fork 專案，或建立自己的 repository。fork 的正式部署預設不公開線上 Studio；需要時再設定 `ONLINE_STUDIO_ALLOWED_REPOSITORIES` 或 `ONLINE_STUDIO_ALLOWED_SITES`。
2. 到 **Settings → Pages → Build and deployment**，將 Source 設為 **GitHub Actions**。
3. 到 **Actions** 頁面啟用 fork 的 workflow（若 GitHub 顯示停用提示）。
4. 確認 coding agent 使用的 `origin` 是自己的 repository，並已具備 push 權限。
5. 將完成內容推送到 `main`。

部署 workflow 會自動判斷使用者首頁 repository（`帳號.github.io`）與一般 project repository 的 base path。只有安裝依賴、Astro 診斷、內容驗證、靜態建置、artifact 上傳或 Pages 發布失敗會阻擋部署；上游範本的 Studio、Playwright 與維護契約檢查會保留結果但不阻擋網站上線。若 workflow 失敗，Agent 應回報失敗階段與可操作的修正方式，不應把本機 build 成功當成部署完成。

Studio 與發布常見問題請見 [`FAQ.md`](FAQ.md)。

## 隱私與安全

- 不要把 GitHub 密碼、personal access token、API key 寫進回答檔或 Markdown。
- 公開網站只放願意讓任何訪客看到的 email、所在地與經歷。
- AI 不應自行開啟 repository Actions、修改 Pages 設定、commit 或 push；除非使用者明確要求。即使起始提示已要求發布，push 前仍要再確認一次公開內容摘要。
- 發布前確認 `origin` 屬於使用者，不要把個人自介內容推回上游模板 repository。
- 套用前建議先 commit 目前版本，讓所有變更都能從 Git 還原。
