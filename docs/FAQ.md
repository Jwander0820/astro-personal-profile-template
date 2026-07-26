# 常見問題

這份問答給第一次使用 Astro、GitHub 或 Profile Studio 的人。內容設定的完整欄位請看 [`CUSTOMIZATION_GUIDE.md`](CUSTOMIZATION_GUIDE.md)；想讓 AI 訪談並整理自介，請看 [`AI_PROFILE_SETUP.md`](AI_PROFILE_SETUP.md)。

## Studio 與預覽

### 我 fork 之後，訪客還會看到線上 Studio 嗎？

預設不會。正式部署使用 `ONLINE_STUDIO_MODE=auto`，只允許 repository 或網站 allowlist 精確命中的目標。GitHub Actions 預設值只列出上游範本，因此別人的 fork 不會產生 `/studio/`、籤詩與 Icon 子頁，也不會顯示首頁 Links 卡片或頁尾入口。

如果想在自己的 fork 開放，請在 GitHub repository 的 **Settings → Secrets and variables → Actions → Variables** 設定：

```text
ONLINE_STUDIO_ALLOWED_REPOSITORIES=你的帳號/你的repository
```

自訂網域或 Cloudflare Pages 可改用 `ONLINE_STUDIO_ALLOWED_SITES=https://你的網址`。`ONLINE_STUDIO_MODE=public` 會直接公開，`off` 則一律關閉；這些只是建置開關，不是登入或密碼保護。

### 為什麼 Studio 預覽看不到「建立你的自介網站」？

這是刻意設計。那張卡片和頁尾的「線上 Studio」是範本導覽，不屬於你的自介資料，也不會寫入 `src/content/links/` 或設定包。正式網站只有在部署允許 Studio 時才會顯示；Studio 右側預覽會省略它們，讓你專注檢查自己的公開內容。

### 線上 Studio 會直接修改或發布 GitHub 嗎？

不會。線上版把文字草稿放在目前瀏覽器的 `localStorage`，上傳圖片放在 IndexedDB；除非你下載設定包，否則不會送到後端。它沒有 repository token，也不能 commit、push 或發布。

### 如何直接把內容儲存到專案？

Windows 可雙擊根目錄的 `start-studio.cmd`，或在 PowerShell 執行：

```powershell
npm.cmd run studio
```

再開啟 `http://localhost:4321/studio/`。本機背景服務成功連線後，「06 完成設定」會顯示「儲存到專案」；只有按下按鈕才會更新 `src/content/**` 與 `public/images/`。

### 為什麼是同一個 `/studio/`，卻有線上與本機兩種行為？

畫面是同一套。公開部署只有瀏覽器草稿與下載功能；`npm run studio` 另外啟動只監聽本機 loopback 的 `4322` 寫入服務，頁面偵測到它後才顯示專案寫入按鈕。

## 設定檔、圖片與功能

### JSON 和 ZIP 設定包有什麼不同？

JSON 適合純文字設定，只保存圖片路徑或公開 HTTPS 網址。從裝置上傳的圖片檔不會塞進 JSON；需要完整備份或搬到另一台電腦時，請下載包含 `profile.answers.json` 與圖片的 ZIP 設定包。

### 圖片為什麼沒有顯示？

專案圖片應放在 `public/images/`，內容使用 `/images/檔名`。外部圖片必須是公開 `https://` 網址，而且對方網站需允許外連；需要登入、會過期或封鎖跨站載入的網址無法穩定顯示。Studio 上傳只接受通過檔頭檢查的 PNG、JPG、WebP 或 GIF，單檔上限 5 MB。

### YouTube 播放清單要貼 ID 還是完整網址？

兩者都可以。Studio 與 AI 回答檔會從 `youtube.com`、YouTube Music、`youtu.be` 等分享網址讀取 `list=`，並忽略 `si` 等分享參數。單支影片網址若沒有播放清單 ID，則不能當作唱盤清單。

### 為什麼外部 Notion 或 YouTube 在預覽中不能操作？

正式元件仍受第三方服務的嵌入政策、Cookie、瀏覽器隱私設定與網路狀態影響。Studio 能確認本站的版面和設定，但無法繞過第三方禁止 iframe 或播放的限制。

### 要怎麼在 Studio 新增可嵌入的網頁？

到「05 其它功能」的「網頁內嵌」按「新增內嵌」，可以填公開 http(s) 網址，也可以直接貼 Notion 或 YouTube 的整段 `<iframe>`。Studio 只會取出安全的 `src` 與 `height`，不會執行或保存其餘 HTML；YouTube 一般影片、Shorts、直播與播放清單網址也會轉成正式 embed URL。直接 iframe 可設定 320～1200 px 高度；若右側預覽空白或被拒絕，代表來源網站不允許被嵌入，請改用預覽連結。

iframe 中真正必要的是 `src`；`title` 是無障礙說明，`height` 是顯示高度，`allowfullscreen` 與 `allow` 是授權全螢幕、播放或剪貼簿等能力。`width` 由本站響應式版面接管，`frameborder` 已由 CSS 取代。Notion 的 `v=` 等查詢參數可能代表指定檢視，Studio 會保留；YouTube 的 `si=` 是分享識別參數，不是播放必要值，轉換時會移除。

## AI 與發布

### 哪些資料一定要提供給 AI？

只有顯示名稱必填。短標題、關鍵字、自我介紹、地點、社群、email、精選連結、播放清單與互動功能都能跳過。AI 不應自行杜撰經歷、雇主、網址或聯絡方式。

### 一般聊天型 AI 產生 JSON 後要放哪裡？

到 Profile Studio 的「06 完成設定」，把 JSON 貼進 AI JSON 區域並按「驗證並載入草稿」。先用右側正式預覽檢查，再下載 ZIP／JSON；本機模式仍要另外按「儲存到專案」。

### AI 說已經發布網站，代表真的完成了嗎？

不一定。不能存取 repository、終端機與 GitHub Actions 的一般 AI 只能訪談及產生文字或 JSON。具備工具的 coding agent 也必須先完成 build、列出將公開的內容與 Git diff，得到你的確認後才能 commit／push，最後還要核對部署結果。

### 發布前最重要的檢查是什麼？

確認姓名、地點、email、雇主與每個網址都願意公開；確認 `origin` 是自己的 repository，不是上游範本；不要提交 `profile.answers.json`、token、API key 或密碼。第一次使用 GitHub Pages，還要在 **Settings → Pages** 選擇 **GitHub Actions**，並視 GitHub 提示啟用 fork 的 workflow。

## 問題排除

### 儲存後 Git 顯示很多不相關變更怎麼辦？

先不要 commit。檢查 `git status` 與 diff，只保留這次要公開的內容和圖片。本專案會跳過內容完全相同的寫入，以避免無意義的 mtime 變更；若仍出現大量變更，請確認是否匯入了不同的設定包或重設了既有內容。

### Windows build 出現 `EPERM` 是程式壞掉嗎？

不一定。Astro／Vite 的快取檔可能正被另一個開發伺服器或 IDE 鎖住。先停止仍在執行的 dev／Studio 行程，再重跑 `npm.cmd run build`。不要因為單一快取鎖定就刪除內容或認定部署程式有問題。

### 還是不知道該從哪裡開始？

只想編輯內容：執行 `npm.cmd run studio`。想讓 AI 協助：把 [`AI_PROFILE_SETUP.md`](AI_PROFILE_SETUP.md) 的提示詞交給具備檔案與終端機權限的 coding agent。只用手機或一般聊天 AI：先產生 JSON，再到允許公開的線上 Studio 匯入並下載設定包。
