# Profile Studio 內容模型

公開模式、本機模式、AI 回答檔與手動 Markdown 編輯共用同一份內容契約。`src/content` 是網站唯一來源；Studio 的瀏覽器草稿不是另一個公開資料庫。

## 本機 Studio

Windows 建議直接雙擊 `start-studio.cmd`，或執行：

```powershell
.\start-studio.cmd
```

在 Windows PowerShell 可使用 `npm.cmd run studio`；其他環境使用 `npm run studio`。

此命令同時啟動：

- `http://localhost:4321/studio/`：唯一的 Profile Studio 使用者介面與正式頁面預覽。
- `http://localhost:4322`：只綁定 loopback、沒有獨立 UI 的背景寫入 API。

背景 API 不會部署到 `dist`，GitHub Pages 上也不存在。公開 `/studio/` 使用 `localStorage` 保存文字、IndexedDB 保存圖片 Blob，並以 ZIP 匯入／匯出；不會嘗試連線 GitHub。以 `npm run studio` 啟動時，同一頁會偵測背景 API，只有使用者按下「儲存到專案」才把通過檔頭驗證的 PNG、JPG、WebP 或 GIF（單檔上限 5 MB）寫入 `public/images/`，再套用內容。

所有欄位都即時送入嵌入的正式首頁；首頁與 Studio 使用同一份正式 CSS、ProfileRenderer 結構及 Icon catalog。唱盤也會在 renderer 更新後重新掛載正式 YouTube Player；播放清單 ID 不變時會保留現有播放器，避免編輯其它文字便中斷。寫入仍保持明確按鈕，不會因輸入事件自動修改檔案。

連結管理分為個人資料下方的社群 Icons，以及首頁 Links 卡片。新增社群時先從內建服務與 Icon 選擇；「自訂網站」使用一般網站名稱、URL 與箭頭 Icon。若目前建置允許公開 Studio，Links 尾端會由程式加入「建立你的自介網站」入口；它不是使用者內容，不會寫進 `src/content/links` 或匯出的回答檔。

圖片板塊是 `blocks/*.md` 中的 `layout: image`。Studio 可建立與維護滿版、左右分割、海報式版型，並設定比例、裁切焦點、替代文字、Markdown 附文及顯示錨點。`placement` 會實際錨定在 Links 前、Links 後或 About 後；若對應首頁板塊被隱藏，圖片板塊會移到主要內容尾端，避免內容消失。

字型使用 `src/data/font-presets.json` 白名單。`system` 不發出外部請求；其他選項由 Google Fonts 載入，且目前只收錄 SIL Open Font License 1.1 字型。內文與展示標題可分開設定。

## 欄位責任

| 使用者操作 | 實際檔案 | 驗證來源 |
|---|---|---|
| 基本資料、字型、字級、About 排版 | `profile/main.md` | Studio + Astro collection schema |
| 首頁五大板塊順序、顯示與標題 | `profile/main.md` 的 `homeOrder`、`homeVisibility`、`aboutHeading`、`linksHeading` | 順序固定五個唯一值；顯示設定可為任意子集合 |
| 社群連結 | `links/*.md` | URL protocol、content schema |
| 自介卡片 | `sections/*.md` | `order`、`visible`、layout |
| 圖片板塊 | `blocks/*.md` | 圖片路徑、區域、版型、比例、焦點與替代文字 |
| 播放清單／抽籤／Notion | `blocks/*.md` | 各 block 的條件驗證 |
| 籤桶內容 | `fortunes.json` | 共用籤桶模組的 ID、等級、分類、訊息、啟用數與 revision 驗證 |

籤桶管理採整份檔案儲存：搜尋與畫面排序不改變來源順序，只有上移／下移操作會改變草稿順序。儲存時若偵測到 `fortunes.json` 已被外部修改，Studio 會拒絕覆寫並要求重新載入。

唱盤欄位在 Studio、AI 回答檔與手動 Markdown 三種入口都接受 YouTube 播放清單完整網址或 playlist ID；`si` 等分享參數可以保留，程式載入時會自動取出 `list` ID，Studio 儲存時則只保留 ID。Notion 欄位接受已發布到網路的完整頁面網址；`preview` 產生簡化連結卡片，`inline` 則嘗試 iframe 內嵌，實際是否允許內嵌仍取決於 Notion 回應標頭。

## 為什麼線上 Studio 不直接發布

GitHub Pages 是靜態主機，無法安全地在公開頁面直接改 repository 檔案。若做可發布的線上 CMS，就需要 OAuth、後端、權限與 token 保存。這個版本只會在 `auto` allowlist 或 `public` 模式產生公開 `/studio/`；進入的訪客能編輯、正式預覽與下載設定包，但頁面不持有 repository 權限。真正寫檔仍在本機進行，因此保留 Git review、沒有後端成本，也不會把 token 放進瀏覽器。

`ONLINE_STUDIO_MODE=auto` 是正式部署預設值，會比對 `ONLINE_STUDIO_ALLOWED_REPOSITORIES` 與 `ONLINE_STUDIO_ALLOWED_SITES`；未命中的 fork／網域不生成路由與入口。`public` 明確公開，`off` 明確關閉。`npm run studio` 屬於本機專案模式，不受正式部署開關限制。

未來若需要真正的非開發者線上發佈，可在不改內容模型的前提下增加 GitHub App/OAuth 後端；後端只要產生同一套 Markdown 即可。

## 擴充原則

- 新增一般內容欄位時，同步更新 `src/content.config.ts`、Studio／回答檔執行期驗證與 JSON Schema；URL 欄位應沿用共用的安全協定規則。
- 新增全新視覺 block 時，才修改 Astro component 與 CSS。
- 所有寫入路徑必須限制於 `src/content` 或 `public/images`。
- AI 產生的檔案使用 `generated-` 前綴，讓重複套用可預測，並避免刪除手寫檔案。
