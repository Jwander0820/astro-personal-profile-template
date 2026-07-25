# Cloudflare Pages 部署

本專案輸出純靜態網站，可直接由 Cloudflare Pages 連接 GitHub 或 GitLab repository 建置。本機 Profile Studio 的寫入服務不會進入 `dist/`；部署後的 `/studio/` 是純前端設定產生器，可即時預覽圖片並下載 ZIP 設定包，但不具備 repository 寫入能力，也不需要在 Cloudflare 保存 AI API key。

## 建置設定

建立 Pages 專案並選取 repository 後，使用下列設定：

| 欄位 | 值 |
| --- | --- |
| Production branch | `main` |
| Framework preset | Astro；若未自動辨識可選 None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 留空 |
| Node.js | 22.12 以上 |

Cloudflare Pages Build Image V3 預設提供 Node.js 22；若既有 Pages 專案仍使用舊 build image，請先升級 build system，或設定 `NODE_VERSION=22`。Astro 7 要求至少 Node.js 22.12；本專案的 GitHub Pages workflow 也使用 Node.js 22，兩邊應維持一致。

官方參考：

- [Cloudflare Pages：Git integration](https://developers.cloudflare.com/pages/configuration/git-integration/)
- [Cloudflare Pages：Build image](https://developers.cloudflare.com/pages/configuration/build-image/)

## 網址與環境變數

`astro.config.mjs` 在 Cloudflare Pages 預設使用根路徑 `/`。建議在 Production 環境設定：

```text
SITE_URL=https://<你的-project>.pages.dev
```

公開範本可保留預設值 `ONLINE_STUDIO_MODE=public`。若這是個人正式網站、不希望公開 `/studio/` 與下載入口，請再設定：

```text
ONLINE_STUDIO_MODE=off
```

`off` 會在建置完成時移除 `/studio/` 靜態產物，首頁頁尾也不顯示 Studio 連結。這是靜態網站適用的建置開關；不要把它誤當成密碼保護。

綁定自訂網域後，把 `SITE_URL` 改成正式的 `https://` 網址再重新部署，以產生正確 canonical URL。Preview deployment 可以不設定獨立的 `SITE_URL`；它只用於人工預覽，不應取代 production canonical。

## 第一次部署

1. 在 Cloudflare Dashboard 開啟 **Workers & Pages**，建立 Pages application。
2. 選擇 **Import an existing Git repository**，授權並選取本 repository。
3. 填入上方建置設定及 `SITE_URL`。
4. 儲存並部署。
5. 在 build log 確認 `npm ci`、`astro check`、`astro build`、`check:ui` 與 `check:profile-tools` 全部成功。
6. 開啟產生的 `pages.dev` 網址，確認首頁、圖片、主題切換、抽籤與行動版配置。

之後 `main` 的新 commit 會觸發 production deployment；非 production branch／Pull Request 可用 preview deployment 驗證。是否允許公開存取由 Cloudflare 專案與網域設定決定，私人 Git repository 不代表部署網站自動為私人。

## 失敗排除

- 安裝失敗：確認使用 Node.js 22，且 repository 內含最新 `package-lock.json`。
- 找不到輸出：Build output directory 必須是 `dist`，不要填 `/dist`。
- 網址指向 `localhost`：確認 production 環境已設定完整的 `SITE_URL`。
- 子路徑資源 404：Cloudflare Pages 使用根路徑；不要手動設定 GitHub Pages repository base path。
- build 驗證失敗：先在乾淨目錄執行 `npm ci` 與 `npm run build`，不要跳過 contract check。

## 部署前驗證

推送前先在乾淨環境執行 `npm ci` 與 `npm run build`。本機 build 只能確認專案可建置；實際 Cloudflare Pages 網址、資源載入與互動功能仍需在部署完成後由維護者確認。
