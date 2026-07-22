# Astro 個人簡介

以 Astro 製作的靜態個人名片／Link in Bio 網站。採行動優先設計，個人資料、連結、首頁內容與自訂區塊都可由 Markdown 管理。

可參考的範例 https://jwander0820.github.io/astro-personal-profile-template/

## 本機開發

請先安裝 Node.js 22.12 以上版本（一般 Node.js 安裝程式會一併安裝 npm）。

```bash
npm install
npm run dev
```

開發伺服器預設位於 `http://localhost:4321`。

### 使用視覺化 Profile Studio

不想直接修改 Markdown 時，可以啟動只在本機運作的內容編輯台：

Windows 可直接雙擊專案根目錄的 `start-studio.cmd`，首次啟動時會自動安裝專案所需套件。也可以在 PowerShell／CMD 執行：

```powershell
.\start-studio.cmd
```

也可以在 Windows 使用 `npm.cmd run studio`；其他環境使用 `npm run studio`。

前往 `http://localhost:4322`，即可編輯基本資料、字型與圖片，建立可指定區域及版型的圖片板塊、拖曳首頁板塊、調整社群連結，並在右側即時檢查桌面／手機畫面。預設採手動儲存，修改會先留在 Studio 草稿中，再由頂端固定列的「儲存並更新」一次寫入並刷新預覽。


### 讓 AI 引導建立自介

若不熟悉程式，可以先 fork／clone 到自己的 repository，再把專案交給 Codex 或其他具備檔案、終端機與 Git 存取能力的 coding agent。若只想建立並檢查內容，輸入：

```text
請依照 AGENTS.md 的個人自介流程訪談我，產生 profile.answers.json、套用內容並執行 build。沒有得到答案的選填資料請留空，不要自行杜撰。
```

若希望由同一個 Agent 一站式處理內容與 GitHub Pages 發布，輸入：

```text
請依照 AGENTS.md 訪談我建立個人自介，完成內容套用與 build。Build 成功後，請列出即將公開的個人資料與 Git 變更摘要並等待我確認；只有得到確認後，才檢查 origin、commit、push 並回報 GitHub Pages 結果。不要提交 profile.answers.json，也不要把個人資料推到上游模板 repository。
```

這個模式仍會在 push 前停下來確認即將公開的姓名、地點、email 與連結；第一次部署所需的 GitHub 設定請見下方部署說明。

AI 問答、空白填寫模板與完整發布流程請見 [`docs/AI_PROFILE_SETUP.md`](docs/AI_PROFILE_SETUP.md)。只有一般聊天介面、不能存取 repository 的 AI，可使用 [provider-neutral 訪談提示詞](docs/ai/PROFILE_INTERVIEW_PROMPT.md) 產生 JSON，再貼到 Profile Studio。


## 修改內容

- 個人資料：`src/content/profile/main.md`
- 連結：`src/content/links/*.md`
- 首頁區塊：`src/content/sections/*.md`
- 自訂區塊：`src/content/blocks/*.md`
- 圖片：`public/images/`

圖片放進 `public/images/`，並在 Markdown 中使用 `/images/檔名`。

連結、自訂區塊、圖片板塊、Notion 與黑膠唱盤的欄位和範例，請見 [`docs/CUSTOMIZATION_GUIDE.md`](docs/CUSTOMIZATION_GUIDE.md)。

## GitHub Pages 部署

在 fork 中啟用 **Actions**，並到 **Settings → Pages → Build and deployment** 將 Source 設為 **GitHub Actions**。推送至 `main` 後，`.github/workflows/deploy.yml` 會自動建置並發布；`astro.config.mjs` 會依 repository 擁有者與名稱設定正確的 `site` 與 `base`。

## Cloudflare Pages 部署

Cloudflare Pages 使用 `npm run build`、輸出目錄 `dist`，並建議固定使用 Node.js 22。完整設定、`SITE_URL` 與錯誤排除請見 [`docs/CLOUDFLARE_PAGES.md`](docs/CLOUDFLARE_PAGES.md)。

從 `0.1.0` 開發基線升級到 V1 的相容性與復原方式，請見 [`docs/V1_UPGRADE.md`](docs/V1_UPGRADE.md)。
