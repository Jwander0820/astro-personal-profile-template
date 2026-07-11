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

`npm run build` 會一併執行 `npm run check:ui`，檢查首頁排序、桌面／手機斷點、44px 操作尺寸，以及唱片與唱臂共用的幾何定位，避免只通過編譯但視覺互動已經回歸。

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

全站字級與說明、標籤、頁尾等小字可分開縮放：

```yaml
fontScale: 1          # 0.9～1.2，控制整體字級
smallTextScale: 1.15 # 0.9～1.35，額外放大小字
```

兩個欄位皆可省略，預設值為 `1`。如果只覺得說明文字太小，建議先保留 `fontScale: 1`，將 `smallTextScale` 調成 `1.1`～`1.2`。

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

首頁會依照上述位置輸出：個人資料與社群 icon → `before-links` → Links → `between-links-sections` → About me → `after-sections`。因此預設的唱盤會在 Links 與 About me 後方；若想把唱盤移到 Links 上方，只需將它的 `placement` 改成 `before-links`。

### 內嵌 Notion 頁面

複製 `src/content/blocks/notion-embed.md`，再將 Notion 官方嵌入程式碼中的 `src` 網址貼到 `url`：

```yaml
---
title: 最近動態
placement: after-sections
order: 20
visible: true
layout: embed
provider: notion
url: https://your-workspace.notion.site/your-page
embedMode: preview
height: 600
tags: []
---
```

`embedMode: preview` 會顯示精簡的外部檔案卡片，避免長篇嵌入內容壓過首頁；改成 `embedMode: inline` 才會直接載入 iframe。Notion 頁面必須先透過 `Share → Publish → Embed this page` 公開並取得嵌入網址。inline 模式的 `height` 可設為 320–1200；修改 Notion 內容後不需要重新建置網站。

### 黑膠唱盤隨機播放器

`turntable` 版型會讀取公開或不公開的 YouTube 播放清單。設定檔只需保存分享網址中的 `list` ID，不需要 API Key：

```yaml
---
title: On rotation
placement: after-sections
order: 5
visible: true
layout: turntable
provider: youtube
playlistId: PLlaN88a7y2_oK0nKMjZSwdU_njxUYWykm
continuousPlayback: true
tags: [Shuffle, YouTube]
---

按下唱針，從短期輪播清單隨機抽一首。
```

`continuousPlayback` 設為 `true` 時，單曲播完會隨機接續下一首，預設為開啟；若要停用則設為 `false`。為符合 YouTube 自動播放規範，只有播放器仍有至少一半位於畫面中時才會自動接續。

播放器會等到訪客按下唱針後才載入 YouTube，並從唱盤下方向下展開，避免預先顯示播放清單縮圖或讓未互動的訪客載入播放器。播放器會隨機選取單支影片、顯示目前 YouTube 曲名，唱臂會依播放進度從外圈往唱片中心移動；暫停、結束或播放失敗時會回到唱臂架。使用滑鼠或觸控拖曳唱臂可跳轉播放時間，鍵盤方向鍵每次調整 5 秒、搭配 Shift 調整 15 秒，Home／End 可跳至開頭／結尾。「換一首」會避開目前曲目重新抽選。私人清單、禁止嵌入或受地區限制的影片可能無法播放。YouTube 播放器必須保持可見、至少 `200 × 200px`，且不得以自訂介面遮擋。

`layout` 可選 `card`、`plain`、`embed` 或 `turntable`。同一位置內使用 `order` 排序。新增文字、圖片、標籤與調整位置只需修改 Markdown；若要新增全新的視覺種類或互動行為，則需要擴充 Astro component 與 CSS。


## GitHub Pages 部署

`.github/workflows/deploy.yml` 會在推送至 `main` 後建置並發布。請到 repository 的 **Settings → Pages → Build and deployment**，將 Source 設為 **GitHub Actions**。

`astro.config.mjs` 會依 repository 擁有者與名稱自動設定 GitHub Pages 的 `site` 與 `base`。在 fork 中啟用 **Actions**，並於 **Settings → Pages → Build and deployment** 將 Source 設為 **GitHub Actions**，推送到 `main` 後即可部署。

## 下一階段

目前 `/music`、`/projects`、`/live` 以首頁卡片預留；未來可增加對應頁面與 Content Collections。
