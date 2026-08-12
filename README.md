# Astro 個人自介網站模板

用 Astro、Markdown 與 JSON 建立可自行託管的個人首頁。你可以用瀏覽器裡的 Profile Studio 視覺化編輯，也能直接維護內容檔或請 AI 協助產生設定。

[線上示範](https://jwander0820.github.io/astro-personal-profile-template/) · [常見問題](docs/FAQ.md) · [自訂指南](docs/CUSTOMIZATION_GUIDE.md)

## 快速開始

需求：Node.js 22.12 以上版本與 npm。

先 fork 或使用 GitHub 的「Use this template」建立自己的 repository，再把下列 `USERNAME` 與 `REPOSITORY` 換成自己的資料：

```bash
git clone https://github.com/USERNAME/REPOSITORY.git
cd REPOSITORY
npm install
npm run dev
```

開啟 `http://localhost:4321` 查看網站。

接著選一條最適合你的設定方式。

### 路徑 A：直接使用網頁版 Profile Studio

開啟開發伺服器的 `/studio/`，依照六個步驟編輯並即時預覽正式首頁：

1. 基本身份
2. 公開連結
3. 自介內容
4. 外觀
5. 其他功能
6. 完成設定

網頁版只把草稿保存在瀏覽器的 localStorage 與 IndexedDB，不會存取 GitHub 或自動上傳。完成後下載 `profile-settings.zip` 或 `profile.answers.json`。

若部署後看不到 Studio，請參考[部署模式說明](#profile-studio-部署模式)；未設定 allowlist 的 fork 在 `auto` 模式下預設不公開 Studio。

### 路徑 B：本機 Profile Studio 直接寫入專案

Windows 可執行：

```powershell
.\start-studio.cmd
```

或在任何平台執行：

```bash
npm run studio
```

再開啟 `http://localhost:4321/studio/`。本機模式仍使用同一個 Studio 頁面，但會顯示「儲存到專案」按鈕。

儲存前會先：

- 驗證完整設定與圖片格式。
- 顯示即將新增或更新的檔案清單。
- 避免同名圖片覆蓋既有檔案。
- 將內容與圖片視為一次交易；失敗時不留下部分更新。
- 保留內容未變檔案的 mtime，避免製造假 Git diff。

4322 只是一個 loopback API adapter，不是第二套 Studio UI，也不會被輸出到靜態網站。

### 路徑 C：設定檔、Markdown 或 AI

第一次建立自介時，建議複製範例：

```bash
cp profile.answers.example.json profile.answers.json
npm run profile:plan -- profile.answers.json
npm run profile:apply -- profile.answers.json
npm run build
```

Windows PowerShell 可將 `cp` 改為 `Copy-Item`。若系統封鎖 npm 的 `.ps1` shim，請改用 `npm.cmd`。

`profile.answers.json` 已列入 `.gitignore`，適合保存可能含個人資訊的工作檔。真正公開的來源是：

- `src/content/profile/main.md`：基本身份與全站外觀
- `src/content/links/*.md`：社群與精選連結
- `src/content/sections/*.md`：About me 卡片
- `src/content/blocks/*.md`：播放清單、圖片、籤詩與嵌入內容
- `public/images/`：上傳到專案的圖片

若要請 AI 引導設定，先閱讀 [AI Profile Setup](docs/AI_PROFILE_SETUP.md) 與 [provider-neutral 訪談提示](docs/ai/PROFILE_INTERVIEW_PROMPT.md)。所有個人欄位除了顯示名稱以外都可省略；AI 不應猜測你的地點、email、雇主或私人網址。

## replace 與 merge

答案檔可用 `applyMode` 說明套用方式：

```json
{
  "version": 1,
  "applyMode": "merge",
  "identity": {
    "title": "新的短標題"
  }
}
```

- `replace`（預設）：答案檔代表完整狀態；省略的可選欄位會依契約預設重設，而不是保留既有值。適合首次設定、Studio 匯出與完整搬移。
- `merge`：只更新答案檔明確提供的頂層欄位；沒有提供的社群、連結、區塊與外觀維持原狀。適合小幅自動化更新。

先執行 `npm run profile:plan -- profile.answers.json` 可查看檔案變更，不會寫入專案。CLI 的 `--mode=merge` 或 `--mode=replace` 會覆蓋答案檔內的模式。

完整格式見 [JSON Schema](docs/profile-answers.schema.json) 與 [內容模型](docs/PROFILE_CONTENT_MODEL.md)。

## 圖片與隱私

圖片欄位只接受：

- `/images/` 下的安全專案路徑
- 公開的 `https://` 圖片網址
- Studio 上傳的 PNG、JPEG、WebP 或 GIF（單檔最多 5 MB）

獨立 JSON 不含圖片二進位；ZIP 設定包才會攜帶 Studio 上傳的圖片。

執行 build、commit 或發布前，請特別檢查即將公開的地點、email、雇主資訊與私人專案網址。不要把 token、密碼或 API key 放進 Markdown、JSON 或公開環境變數。

## 驗證

一般自介使用者至少執行：

```bash
npm run build
```

維護模板或修改 Studio 時執行：

```bash
npm run check:quality
npm run check:studio-deployment
npm run check:browser:install
npm run check:browser
npm run check:template-defaults
```

上游 repository 的 pull request 與 `main` 都有阻擋式 CI；任何 build、契約、部署矩陣、瀏覽器測試或模板預設檢查失敗都不會被當成成功。

## 部署

### GitHub Pages

1. 在 repository 的 **Settings → Pages → Build and deployment** 選擇 **GitHub Actions**。
2. 確認 `origin` 是你自己的 fork，不是上游模板。
3. 將已檢查的公開內容推到 `main`。
4. 確認 `CI` workflow 成功，並等待 `.github/workflows/deploy.yml` 完成 build 與部署。

workflow 會依 GitHub repository 名稱計算 Astro 的 `site` 與 `base`。如果你的正式網域不同，可設定 repository variable `SITE_URL`。

### Cloudflare Pages

Build command 使用 `npm run build`，輸出目錄使用 `dist`，Node.js 使用 22。詳細設定見 [Cloudflare Pages 指南](docs/CLOUDFLARE_PAGES.md)。

## Profile Studio 部署模式

`ONLINE_STUDIO_MODE` 支援：

- `auto`：本機開發永遠可用；正式 build 只在 repository 或 site 精確符合 allowlist 時輸出 Studio。
- `public`：正式 build 一律輸出 Studio。
- `off`：正式 build 不輸出 Studio。

GitHub Actions variables 範例：

```text
ONLINE_STUDIO_MODE=auto
ONLINE_STUDIO_ALLOWED_REPOSITORIES=your-name/your-repository
ONLINE_STUDIO_ALLOWED_SITES=https://example.com
```

這是 build 規則，不是身份驗證。公開 Studio 仍只編輯瀏覽器本地草稿，不具備 repository 寫入能力。

## 專案架構

正式 Astro components 與 `src/scripts/profile-renderer.js` 是同一份可見文件的兩個 renderer 入口；Studio iframe 直接載入正式首頁，不維護模擬預覽。

答案檔、內容 schema、Studio UI、project writer 與 renderer 共享同一組契約。新增設定欄位時必須同步涵蓋：

- Astro content schema
- 答案驗證與 JSON Schema
- Studio 編輯控制項
- 本機 writer 與 preview bridge
- 正式 renderer
- UI、工具與瀏覽器回歸測試

更深入的邊界與檔案對照見 [Profile Content Model](docs/PROFILE_CONTENT_MODEL.md)。

## 參與開發與安全回報

- 提交問題或功能需求前，請閱讀 [CONTRIBUTING.md](CONTRIBUTING.md)。
- 安全問題請依 [SECURITY.md](SECURITY.md) 使用 GitHub 私密漏洞回報，不要把敏感細節放在公開 issue。
- 版本差異見 [CHANGELOG.md](CHANGELOG.md)。
- 從 v1.2 升級請見 [v1.3 升級指南](docs/V1_3_UPGRADE.md)。

本專案採用 [MIT License](LICENSE)。
