# 升級到 v1.2.0

這份文件適用於從 `v1.1.x` 升級到 `v1.2.0` 的既有個人站。v1.2.0 新增公開／本機共用的 Profile Studio、設定包與籤詩工具，但維持既有內容格式及回答檔 version 1，相容的自訂內容不需要 migration。

## 升級前

1. 備份目前分支與自訂的 `src/content/`、`public/images/`。
2. 確認 `profile.answers.json`、`.env`、token 與私人圖片沒有被提交。
3. 記錄自行修改過的 Astro 元件、CSS 與 Studio 程式；更新模板時需要人工合併這些客製內容。

## 主要變更

- `/studio/` 成為公開模式與本機模式共用的唯一 UI。
- `npm run studio` 仍從 `http://localhost:4321/studio/` 開啟編輯器；port `4322` 只提供 loopback 寫入 API，不再提供第二套 Studio 頁面。
- 公開 Studio 只在瀏覽器保存草稿並下載 JSON／ZIP，不會寫入 GitHub 或持有 repository token。
- `ONLINE_STUDIO_MODE=auto|public|off` 控制正式建置是否保留 Studio 路由、首頁 Links 卡片與頁尾入口。
- `auto` 只接受 repository 或 site 的精確 allowlist；未設定的 fork 預設不公開 Studio。
- `profile.answers.json` 與 ZIP 設定包可包含完整籤桶；舊版未包含籤桶的 version 1 回答檔仍可匯入。

## 升級步驟

將模板更新合併到自己的分支後執行：

```powershell
npm ci
npm run build
```

Windows PowerShell 若阻擋 npm 的 `.ps1` shim，可改用：

```powershell
npm.cmd ci
npm.cmd run build
```

既有 Markdown 與 JSON 通過內容驗證後即可繼續使用，不需要重新建立個人資料。若曾把 `http://localhost:4322/` 當作 Studio 書籤，請改用 `http://localhost:4321/studio/`。

## Studio 部署模式

| 模式 | 正式部署行為 |
| --- | --- |
| `auto` | 只有精確符合 `ONLINE_STUDIO_ALLOWED_REPOSITORIES` 或 `ONLINE_STUDIO_ALLOWED_SITES` 時保留 Studio |
| `public` | 保留 Studio 路由、首頁入口卡片與頁尾入口 |
| `off` | 移除所有 Studio 路由與公開入口 |

Git clone 本身不會自動開啟正式部署的 Studio。使用 `auto` 時，仍需讓部署環境的 repository 或正式網站符合 allowlist；本機開發則永遠可以使用 Studio。

## 升級後檢查

1. 執行 `npm run studio`，確認六個步驟與「06 完成設定」可正常使用。
2. 確認既有首頁內容、圖片、連結、播放清單及抽籤設定沒有被覆寫。
3. 確認公開模式不顯示「儲存到專案」，本機 adapter 連線後才顯示。
4. 若有公開 Studio，確認正式首頁保留入口，但 Studio iframe 預覽不顯示自己的入口卡片與頁尾連結。
5. 維護模板時再執行 `npm run check:studio-deployment` 與 `npm run check:browser`；一般使用者不需要安裝 Playwright。

## 復原

若升級後需要暫停公開 Studio，可先設為 `ONLINE_STUDIO_MODE=off` 重新部署，不會影響個人內容。需要完整回復時，切回升級前備份的 commit 或 tag，再執行 `npm ci` 與 `npm run build`。
