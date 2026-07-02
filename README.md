# Astro 個人簡介

以 Astro 製作的靜態個人名片／Link in Bio 網站。採行動優先設計，個人資料、連結、首頁內容與自訂區塊都可由 Markdown 管理。

## 本機開發

```bash
npm install
npm run dev
```

開發伺服器預設位於 `http://localhost:4321`。

專案也包含 `pnpm-lock.yaml`，CI 會使用 pnpm 進行可重現安裝；本機使用上述 npm 指令同樣可正常開發。

## Build 與預覽

```bash
npm run build
npm run preview
```

## 修改內容

- 個人資料：`src/content/profile/main.md`
- 連結：`src/content/links/*.md`
- 首頁區塊：`src/content/sections/*.md`
- 自訂區塊：`src/content/blocks/*.md`
- 圖片：`public/images/`

圖片放進 `public/images/`，並在 Markdown 中使用 `/images/檔名`。

`src/content/profile/main.md` 內的 `location` 是選填欄位，刪除或以 `#` 註解後就不會顯示。About me 排版可透過以下設定切換：

```yaml
sectionsLayout: list # 每個區塊一列
# sectionsLayout: grid # 兩欄卡片
```

## 新增連結

在 `src/content/links/` 新增 Markdown 檔：

```md
---
title: 技術筆記
url: https://example.com
icon: code
group: featured
order: 50
visible: true
layout: card
style: normal
tags: [Python, Notes]
---

放在卡片上的簡短說明。
```

`layout: icon` 會加入頭像下方的快速連結列，數量不限並會自動換行；`layout: card` 搭配 `group: main` 或 `group: featured` 會加入 Links 卡片區。同群組依 `order` 數字由小到大排序。

可用的品牌 icon：

- 社群：`github`、`threads`、`facebook`、`x`、`twitter`（與 `x` 相同圖示）、`pixiv`、`instagram`、`linkedin`、`youtube`、`tiktok`
- 音訊：`spotify`、`youtubemusic`、`applemusic`、`podcasts`、`applepodcasts`、`kkbox`、`tidal`
- 其他：`notion`、`mail`、`music`、`code`、`live`、`arrow`

Icon 圖形集中在 `src/lib/icons.ts`，可新增或替換 SVG path；品牌 icon 的來源與授權資訊記錄於 `THIRD_PARTY_NOTICES.md`。

啟動開發伺服器後，前往 `http://localhost:4321/icons/` 可查看所有 icon 的實際預覽與名稱。若專案部署在子路徑，請在網站網址後加上 `/icons/`。

隱藏項目請設定：

```yaml
visible: false
```

## 新增自訂區塊

複製 `src/content/blocks/example.md` 並修改檔名，即可加入一個 Markdown block：

```md
---
title: 最近在做什麼
placement: between-links-sections
order: 20
visible: true
layout: card
image: /images/example.jpg
tags: [Learning, Building]
---

這裡可以使用一般 **Markdown** 撰寫內容。
```

`placement` 決定區塊位置：

- `before-links`：社群 icon 後、Links 前
- `between-links-sections`：Links 與 About me 之間
- `after-sections`：About me 後

`layout` 可選 `card` 或 `plain`。同一位置內使用 `order` 排序。新增文字、圖片、標籤與調整位置只需修改 Markdown；若要新增全新的視覺種類或互動行為，則需要擴充 Astro component 與 CSS。


## GitHub Pages 部署

`.github/workflows/deploy.yml` 會在推送至 `main` 後建置並發布。請到 repository 的 **Settings → Pages → Build and deployment**，將 Source 設為 **GitHub Actions**。

`astro.config.mjs` 會依 repository 擁有者與名稱自動設定 GitHub Pages 的 `site` 與 `base`。在 fork 中啟用 **Actions**，並於 **Settings → Pages → Build and deployment** 將 Source 設為 **GitHub Actions**，推送到 `main` 後即可部署。

## 下一階段

目前 `/music`、`/projects`、`/live` 以首頁卡片預留；未來可增加對應頁面與 Content Collections。
