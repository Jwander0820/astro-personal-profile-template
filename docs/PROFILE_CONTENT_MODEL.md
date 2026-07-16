# Profile Studio 內容模型

Profile Studio、AI 回答檔與手動 Markdown 編輯共用同一份內容。`src/content` 是唯一來源，Studio 不是另一個資料庫。

## 本機 Studio

Windows 建議直接雙擊 `start-studio.cmd`，或執行：

```powershell
.\start-studio.cmd
```

在 Windows PowerShell 可使用 `npm.cmd run studio`；其他環境使用 `npm run studio`。

此命令同時啟動：

- `http://localhost:4322`：只綁定本機 loopback 的內容編輯台。
- `http://localhost:4321`：Astro 即時預覽；使用 localhost 可避免 YouTube 嵌入來源辨識問題。

Studio 的寫入 API 不會部署到 `dist`，GitHub Pages 上也不存在。圖片上傳僅接受 PNG、JPG、WebP、GIF、SVG，單檔上限 5 MB，並寫入 `public/images/`。

預覽同步預設採用明確儲存；也可切換成 5 秒 debounce 的自動更新。每個表單都有獨立 revision，同一表單同時只會送出一個寫入，舊回應不會清除較新的修改。Markdown 通過驗證並寫入後，Studio 才以內容 revision 重新載入右側 iframe，並分開顯示寫入失敗與預覽載入失敗。輸入到一半的無效內容不會排入背景寫入。

連結管理分為個人資料下方的社群 Icons，以及首頁 Links 卡片。社群服務目錄會顯示尚未建立的項目；首次儲存時才建立對應 Markdown。兩種連結都能選擇 `src/lib/icons.ts` 的內建 Icon，或將自訂圖檔上傳到 `public/images/` 並寫入 `image` 欄位。

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

Studio 的唱盤欄位接受 YouTube 播放清單完整網址或 playlist ID，儲存時只保留 `list` ID。Notion 欄位接受已發布到網路的完整頁面網址；`preview` 產生簡化連結卡片，`inline` 則嘗試 iframe 內嵌，實際是否允許內嵌仍取決於 Notion 回應標頭。

## 為什麼不直接做線上 CMS

GitHub Pages 是靜態主機，無法安全地在公開頁面直接改 repository 檔案。若做線上 CMS，就需要 OAuth、後端、權限與 token 保存。這個版本將編輯能力限制在本機，保留 Git review、無後端成本，也不會讓管理介面被部署。

未來若需要真正的非開發者線上發佈，可在不改內容模型的前提下增加 GitHub App/OAuth 後端；後端只要產生同一套 Markdown 即可。

## 擴充原則

- 新增一般內容欄位時，同步更新 `src/content.config.ts`、Studio 寫入驗證與 JSON Schema。
- 新增全新視覺 block 時，才修改 Astro component 與 CSS。
- 所有寫入路徑必須限制於 `src/content` 或 `public/images`。
- AI 產生的檔案使用 `generated-` 前綴，讓重複套用可預測，並避免刪除手寫檔案。
