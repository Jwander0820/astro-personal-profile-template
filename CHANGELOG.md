# Changelog

本文件記錄 `astro-personal-profile-template` 的使用者可見變更。專案採用 [Semantic Versioning](https://semver.org/)。

目前尚未建立正式 Git tag，`0.1.0` 是公開模板分流時的開發基線，而不是 `v1.0.0` 穩定承諾。

## [Unreleased]

### 建置與文件

- 統一以 npm 管理依賴，改用 `package-lock.json` 提供可重現安裝。
- 更新 GitHub Pages workflow，以 `npm ci` 與 `npm run build` 完成部署建置。
- 同步更新 README、AI 設定流程與 Profile Studio 指引中的操作命令。

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

[Unreleased]: https://github.com/Jwander0820/astro-personal-profile-template/compare/2c716400a78b7e91afdb0fa67c91330188dfaf4b...HEAD
[0.1.0]: https://github.com/Jwander0820/astro-personal-profile-template/tree/2c716400a78b7e91afdb0fa67c91330188dfaf4b
