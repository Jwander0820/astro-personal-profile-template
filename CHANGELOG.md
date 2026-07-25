# Changelog

本文件記錄 `astro-personal-profile-template` 的使用者可見變更。專案採用 [Semantic Versioning](https://semver.org/)。

`0.1.0` 是公開模板分流時的開發基線；`v1.0.0` 是第一個遵循穩定內容契約的正式版本。

## [Unreleased]

### 新增

- 新增統一的 `/studio/` Profile Studio；公開模式可在手機編輯、以正式首頁即時預覽並下載設定包，本機模式則在同一頁直接儲存到專案。
- Studio 支援文字與圖片草稿、AI／既有 JSON 匯入、ZIP 圖片設定包、社群 Icon 選擇器、其它功能分頁與隨機主色。
- 首頁 Links 新增受部署規則控制的 Studio 入口卡片，讓公開範本訪客能直接找到線上編輯器。
- Studio 新增「完成設定」收尾分頁，集中完整 ZIP、純 JSON、匯入、還原預設與本機儲存，並支援公開 HTTPS 圖片網址。
- Studio 新增同頁橫向功能 route，串接個人檔案、籤詩編輯器與 Icon 預覽；所有子路由沿用同一份公開開關。
- 新增 `/studio/fortune-poem/` 籤詩編輯器，可編輯今日手氣標題、說明、籤文、等級、分類、啟用狀態與順序；右側獨立載入正式籤詩 block，支援隨機試抽與指定單張結果。

### 改善

- 正式首頁改由 `ProfileRenderer` 統一組裝；Studio 預覽直接載入正式頁面、CSS 與 SVG Icon catalog，不再維護另一套模擬畫面。
- Studio 預覽會省略範本自己的 Links 入口卡片與頁尾 Studio 連結，避免把平台導覽誤認為使用者無法刪除的個人內容。
- 公開籤詩編輯器不再嘗試連線訪客電腦的 loopback adapter；本機寫入探測只在 `localhost` 或 `127.0.0.1` 執行。
- 移除舊 4322 Studio UI；4322 僅保留 loopback 背景寫入 API，並加入 `ONLINE_STUDIO_MODE=auto|public|off`、repository 與網站 allowlist。
- Studio 正式預覽中的唱盤可重新掛載 YouTube 播放器；編輯相同播放清單的文字時會保留目前播放器，不再只顯示不可操作的外觀。
- Studio 正式預覽中的今日手氣可直接試抽，編輯其它欄位時也會保留目前籤紙結果；開場文案同步精簡以騰出編輯空間。
- 首頁 Studio 入口卡片移除額外標籤，並讓正式 Astro 元件與即時預覽 renderer 維持相同文案與結構。
- `profile.answers.json` 與 ZIP 設定包現在會匯出／匯入完整籤桶；舊版未含籤桶的回答檔仍保留相容性。
- Icon 預覽移至受 Studio 開關保護的 `/studio/icons/`，複製按鈕只複製 `mail` 這類 Studio 可直接使用的代號。
- 補上面向一般使用者的 FAQ，並修正 AI 訪談提示詞中貼上 JSON 的分頁名稱。

## [1.1.0] - 2026-07-24

### 新增

- 新增可自訂的 `mainColor`，支援系統色盤、HEX 色碼、八組精選色與完整 RGB 空間隨機抽色，並同步納入內容 schema、AI 回答檔與 Profile Studio。
- 依主色自動產生亮／暗模式的文字、按鈕、柔和底色及背景漸層，並加入對比保護，讓極亮或極暗色碼仍維持可讀性。
- Profile Studio 新增僅保存在目前瀏覽器的「最近使用」，記錄最近八個成功儲存且不重複的主色；尚無紀錄時以虛線色槽呈現。

### 改善

- 將主色設定與閱讀排版整合為平衡的雙欄外觀工作區，縮短色碼欄與隨機按鈕，並將精選色與歷史色整理為水平色帶。
- 黑膠唱盤中央標籤改為沿用目前主色衍生漸層，不再固定使用紫色。
- 更新 Profile Studio、AI 訪談流程、自訂指南與回歸驗證，確保主色在手動編輯、回答檔套用及網站輸出間保持一致。

## [1.0.2] - 2026-07-24

### 修正

- 唱盤在 Profile Studio、AI 回答檔與手動 Markdown 都可直接使用 YouTube 完整播放清單網址，並會自動解析 `list`、忽略 `si` 等分享參數。
- Studio 寫入 Markdown 與 JSON 前會先比較內容，完全相同時不再重寫檔案，避免無意義的檔案時間、監聽通知與 Git 假異動。

### 改善

- 將一句話身分與關鍵字改為選填；Profile Studio、AI 回答檔、內容 schema、首頁顯示與 SEO metadata 現在都能正確處理省略或留空的內容。

## [1.0.1] - 2026-07-23

### 修正

- 將 `src/content/profile/main.md` 的自我介紹正文改為選填；Profile Studio 與 AI 回答檔現在都接受留空或省略 `bio`。
- 同步更新回答檔 JSON Schema、AI 訪談提示詞與使用指南，避免仍把自我介紹誤標為必填。

## [1.0.0] - 2026-07-23

### 安全性

- 將 Markdown 原始 HTML 以文字呈現，並在內容 schema、回答檔與 Markdown 轉換階段封鎖危險或無效的 URL 協定。
- Studio 圖片上傳改為只接受通過檔頭驗證的 PNG、JPG、WebP、GIF，停止接收未清理的 SVG。
- GitHub Pages workflow 改用最小 job 權限，並以完整 commit SHA 固定官方 Actions。
- 公開安全掃描改為涵蓋所有 Git 已追蹤文字檔與私密路徑，不再只檢查固定資料夾。

### 修正

- 將同一 Markdown／JSON 檔案的讀取、合併與寫入序列化，避免平行儲存造成更新遺失，並保留籤詩 revision 衝突保護。
- 拆分公開安全檢查與上游範本預設檢查，使 `profile.answers.json` 與套用後的個人化內容不再阻擋一般 build。
- 套用回答檔後依實際可見內容同步 `homeVisibility`，並讓回答檔執行期驗證與 JSON Schema 的欄位、數量及列舉限制一致。
- 新增內容前若相關表單仍有未儲存修改，Studio 會阻止重繪並提示先儲存，避免草稿遭捨棄。
- YouTube API 載入失敗後會清除失敗狀態，讓使用者可正常重試。

### 改善

- 籤桶等級開放大吉、中吉、小吉、吉、末吉、凶與大凶七級選擇；既有範本籤詩仍維持大吉至小吉的吉籤內容。
- 新增可自訂顯示區域、滿版／左右分割／海報版型、圖片比例、裁切焦點、替代文字與 Markdown 附文的圖片板塊，並在 Profile Studio 提供建立、上傳與編輯流程。
- 新增內文與展示標題字型選擇；只允許系統預設及 SIL OFL 開放授權白名單字型，避免任意外部字型與不明授權。
- 修正自訂 block 的 `placement` 只存在於內容檔、首頁卻未依區域插入的落差。
- Profile Studio 頂端固定列新增「儲存並更新」，可將不同面板的待處理修改批次寫入，最後只刷新預覽一次。
- Profile Studio 的社群 Icon 清單支援拖曳及上移／下移排序；排序與顯示開關先保留為草稿，不再每次操作就寫檔及刷新預覽。
- 預設社群 Icon 改為 Facebook、Instagram、Threads、GitHub 依序開啟，其餘服務依常用程度排列。
- 建立 V1.0.0 三條主要工作流的規格基線：自動儲存與即時預覽、籤桶維護及 AI 協助產生自介。
- Profile Studio 的內容寫入改用 revision 驅動的預覽刷新，移除固定 350／650 ms 延遲及三次重複載入，單次儲存只導向預覽一次。
- 建立籤桶共用內容模組與本機讀寫介面，加入完整資料驗證、revision 衝突保護、原子替換及最近一次備份。
- Profile Studio 新增籤桶管理，可搜尋、顯示排序、新增、編輯、啟用、停用、調整來源順序、刪除與復原上一次版本。
- Profile Studio 新增可選的 5 秒批次自動更新、跨表單寫入協調、未儲存提醒，以及手動／自動模式切換；狀態文案統一為固定寬度的「已儲存」與「更新中」。
- AI 回答檔改為先驗證並顯示套用摘要，再由使用者確認寫入；加入不綁定特定供應商的提示詞與測試 fixture。
- 將公開模板的預設身份與播放清單改為通用 placeholder，避免把個人內容帶入新站。

### 建置與文件

- 升級至 Astro 7.1.3 與安全版本的建置依賴，並明確要求 Node.js 22.12 以上；`npm audit` 回復為 0 vulnerabilities。
- Studio 預覽改由套件宣告的 CLI bin 啟動，不再依賴 Astro 5 的內部 `astro.js` 路徑。
- 統一以 npm 管理依賴，改用 `package-lock.json` 提供可重現安裝。
- 更新 GitHub Pages workflow，以 `npm ci` 與 `npm run build` 完成部署建置。
- 同步更新 README、AI 設定流程與 Profile Studio 指引中的操作命令。
- 補上 Codex／coding agent 的一站式提示詞與發布交接流程，涵蓋 JSON 自動套用、build、公開內容確認、remote 檢查、commit／push 及 GitHub Pages 結果回報。
- 新增可直接複製的 AI 訪談提示詞、欄位參考與空白填寫模板，讓使用者可選擇逐步訪談或一次提供資料。
- 將連結、自訂區塊、圖片板塊、Notion 與黑膠唱盤的詳細欄位移至獨立自訂指南，精簡 README 的快速使用流程。
- 新增 Cloudflare Pages 部署與 V1 升級說明，並完成正式版本資料整理。
- 完整 build 新增模板安全檢查，阻擋私人回答檔、常見憑證格式與個人化預設內容。

## [0.1.0] - 2026-07-15

### 新增

- 建立 Astro 靜態個人自介模板，以 `src/content/` Markdown 與 JSON 作為網站及 Profile Studio 的共同資料來源。
- 支援基本資料、社群連結、精選連結、About me 卡片、首頁區塊順序與顯示狀態設定。
- 建立本機 Profile Studio，可編輯主要內容、管理連結與卡片、上傳圖片、切換首頁區塊並預覽網站。
- 建立 AI 回答檔流程，包含 `profile.answers.example.json`、JSON Schema、引導文件及 `profile:apply` 套用指令。
- 加入亮色、暗色與跟隨系統的主題切換，以及全站字級與小字比例設定。
- 加入 YouTube 播放清單唱盤、連續播放選項及行動版互動調整。
- 加入 Notion 預覽卡片與 inline iframe 模式。
- 加入可維護的日式抽籤區塊，籤詩資料集中於 `src/content/fortunes.json`，並支援減少動態效果偏好。
- 加入 GitHub Pages 建置工作流程，並依儲存庫名稱自動處理 Astro `base` 路徑。
- 加入 UI contract 與 Profile 工具驗證，統一由 `npm run build` 執行。

### 安全與資料邊界

- 將 `profile.answers.json`、`.env*`、建置產物、依賴與本機 Codex 狀態排除於 Git。
- Profile Studio 僅監聽本機介面，並驗證 Host、Origin、HTTP method 與 JSON content type。
- AI 流程要求使用者確認個人事實與網址，不自動發布敏感資料。

[Unreleased]: https://github.com/Jwander0820/astro-personal-profile-template/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/Jwander0820/astro-personal-profile-template/compare/v1.0.2...v1.1.0
[1.0.2]: https://github.com/Jwander0820/astro-personal-profile-template/compare/v1.0.1...v1.0.2
[1.0.1]: https://github.com/Jwander0820/astro-personal-profile-template/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/Jwander0820/astro-personal-profile-template/compare/2c716400a78b7e91afdb0fa67c91330188dfaf4b...v1.0.0
[0.1.0]: https://github.com/Jwander0820/astro-personal-profile-template/tree/2c716400a78b7e91afdb0fa67c91330188dfaf4b
