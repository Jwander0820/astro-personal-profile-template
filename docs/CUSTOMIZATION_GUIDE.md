# 自訂內容指南

本指南提供手動修改 Markdown 時需要的欄位與範例。若不想直接編輯檔案，可執行 `start-studio.cmd`，透過 Profile Studio 完成多數設定。

網站內容都位於 `src/content/`：

- 基本資料與首頁設定：`src/content/profile/main.md`
- 社群與精選連結：`src/content/links/*.md`
- About me 卡片：`src/content/sections/*.md`
- 自訂區塊、圖片、Notion、唱盤與抽籤：`src/content/blocks/*.md`
- 圖片檔案：`public/images/`

圖片放進 `public/images/` 後，請使用 `/images/檔名` 引用。修改完成後執行 `npm run build`，確認欄位和值符合內容格式。

## 基本資料與外觀

`src/content/profile/main.md` 包含姓名、頭銜、標籤、首頁順序與外觀設定。`location` 與 frontmatter 後方的自我介紹正文都是選填；不想公開時可以留空或移除。

```yaml
sectionsLayout: grid
bodyFont: noto-sans-tc
displayFont: noto-serif-tc
fontScale: 1
smallTextScale: 1.1
```

- `sectionsLayout`：`grid` 或 `list`。
- `bodyFont`、`displayFont`：`system`、`noto-sans-tc`、`noto-serif-tc`、`lxgw-wenkai-tc`。
- `fontScale`：`0.9`～`1.2`，控制全站字級。
- `smallTextScale`：`0.9`～`1.35`，額外調整說明、標籤與頁尾等小字。

首頁順序由 `homeOrder` 控制，必須各包含一次 `about`、`turntable`、`links`、`fortune`、`notion`。`homeVisibility` 則只列出要顯示的板塊。

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

主要欄位：

| 欄位 | 用途與可用值 |
|---|---|
| `title` | 顯示名稱 |
| `url` | `https://`、`http://`、`mailto:` 或頁面錨點 |
| `group` | `social`、`main`、`featured`、`footer` |
| `layout` | `icon`、`card`、`compact` |
| `style` | `primary`、`normal`、`subtle` |
| `order` | 同群組由小到大排序 |
| `visible` | `true` 顯示，`false` 隱藏 |
| `image` | 選填，自訂圖片的 `/images/` 路徑 |
| `tags` | 選填，卡片標籤陣列 |

`layout: icon` 適合頭像下方的社群快速連結；`layout: card` 搭配 `group: main` 或 `featured` 會顯示在 Links 板塊。

常用 Icon 名稱：

- 社群：`github`、`threads`、`facebook`、`x`、`twitter`、`pixiv`、`instagram`、`linkedin`、`youtube`、`tiktok`
- 音訊：`spotify`、`youtubemusic`、`applemusic`、`podcasts`、`applepodcasts`、`kkbox`、`tidal`
- 其他：`notion`、`mail`、`music`、`code`、`live`、`arrow`

啟動網站後可前往 `http://localhost:4321/icons/` 查看實際預覽與完整名稱。Icon 來源與授權記錄於 `THIRD_PARTY_NOTICES.md`。

## 新增自訂區塊

複製 `src/content/blocks/example.md` 並修改檔名：

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

`layout` 可使用 `card`、`plain`、`image`、`embed`、`turntable` 或 `fortune`。同一位置的區塊依 `order` 由小到大排序。

`placement` 決定顯示錨點：

- `before-links`：Links 前。
- `between-links-sections`：Links 後、About me 前。
- `after-sections`：About me 後。

如果 Links 或 About me 被隱藏，對應的自訂區塊會移到主要內容尾端。唱盤、抽籤與 Notion 是首頁板塊，整體順序仍由 `homeOrder` 控制。

## 圖片板塊

可在 Profile Studio 的「圖片板塊」建立，或複製 `src/content/blocks/image-showcase.md`：

```md
---
title: 旅行照片
placement: between-links-sections
order: 10
visible: true
layout: image
image: /images/travel.jpg
imageAlt: 海邊夕陽與遠方山脈
imageLayout: split-left
imageAspect: landscape
imagePosition: center
tags: [Travel]
---

可在這裡加入圖片旁邊或下方的說明文字。
```

| 欄位 | 可用值 |
|---|---|
| `image` | 必填，`/images/` 下的圖片路徑 |
| `imageAlt` | 圖片替代文字，建議描述畫面內容 |
| `imageLayout` | `full`、`split-left`、`split-right`、`poster` |
| `imageAspect` | `auto`、`landscape`、`square`、`portrait` |
| `imagePosition` | `center`、`top`、`bottom`、`left`、`right` 或四角組合 |

## 內嵌 Notion 頁面

先在 Notion 將頁面發布到網路，再複製 `src/content/blocks/notion-embed.md` 並填入公開網址：

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

- `embedMode: preview`：顯示精簡的外部連結卡片。
- `embedMode: inline`：嘗試直接載入 iframe。
- `height`：inline 模式高度，可設為 `320`～`1200`。

Notion 頁面必須可公開存取。inline 是否能正常顯示仍取決於 Notion 回應的嵌入限制；若無法載入，可改用 `preview`。

## 黑膠唱盤隨機播放器

唱盤使用 YouTube 播放清單，不需要 API Key。可直接在 Profile Studio 貼上播放清單網址，或手動修改 `src/content/blocks/turntable.md`：

```md
---
title: On rotation
placement: after-sections
order: 5
visible: true
layout: turntable
provider: youtube
playlistId: PLxxxxxxxxxxxxxxxx
continuousPlayback: true
tags: [Shuffle, YouTube]
---

按下唱針，隨機播放清單中的一首歌。
```

- `playlistId`：YouTube 網址中 `list=` 後方的 ID。
- `continuousPlayback`：`true` 會在歌曲結束後隨機接續，`false` 則停止。
- 播放器會等訪客按下唱針後才載入 YouTube。
- 私人播放清單、禁止嵌入或有地區限制的影片可能無法播放。

## 今日手氣

抽籤板塊與籤桶格式請見 [`fortune-block.md`](fortune-block.md)。Profile Studio 也提供籤詩的新增、編輯、排序、停用與復原功能。

## 驗證修改

完成手動修改後執行：

```bash
npm run build
```

若內容欄位、圖片路徑、網址或選項值不符合格式，build 會指出對應檔案與錯誤。
