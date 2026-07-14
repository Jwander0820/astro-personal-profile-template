# Profile Studio 內容模型

Profile Studio、AI 回答檔與手動 Markdown 編輯共用同一份內容。`src/content` 是唯一來源，Studio 不是另一個資料庫。

## 本機 Studio

Windows 建議直接雙擊 `start-studio.cmd`，或執行：

```powershell
.\start-studio.cmd
```

亦可使用 `npm.cmd run studio`；`pnpm studio` 保留為 pnpm 環境正常時的替代方式。

此命令同時啟動：

- `http://localhost:4322`：只綁定本機 loopback 的內容編輯台。
- `http://localhost:4321`：Astro 即時預覽；使用 localhost 可避免 YouTube 嵌入來源辨識問題。

Studio 的寫入 API 不會部署到 `dist`，GitHub Pages 上也不存在。圖片上傳僅接受 PNG、JPG、WebP、GIF、SVG，單檔上限 5 MB，並寫入 `public/images/`。

預覽同步採用明確儲存：使用者按下「儲存基本資料」、「儲存板塊設定」或單一內容項目的「儲存」後，Markdown 先通過驗證並寫入，Astro 再透過檔案監看刷新右側 iframe。輸入到一半的無效內容不會寫入檔案。

連結管理分為個人資料下方的社群 Icons，以及首頁 Links 卡片。社群服務目錄會顯示尚未建立的項目；首次儲存時才建立對應 Markdown。兩種連結都能選擇 `src/lib/icons.ts` 的內建 Icon，或將自訂圖檔上傳到 `public/images/` 並寫入 `image` 欄位。

## 欄位責任

| 使用者操作 | 實際檔案 | 驗證來源 |
|---|---|---|
| 基本資料、字級、About 排版 | `profile/main.md` | Studio + Astro collection schema |
| 首頁五大板塊順序、顯示與標題 | `profile/main.md` 的 `homeOrder`、`homeVisibility`、`aboutHeading`、`linksHeading` | 順序固定五個唯一值；顯示設定可為任意子集合 |
| 社群連結 | `links/*.md` | URL protocol、content schema |
| 自介卡片 | `sections/*.md` | `order`、`visible`、layout |
| 播放清單／抽籤／Notion | `blocks/*.md` | 各 block 的條件驗證 |

Studio 的唱盤欄位接受 YouTube 播放清單完整網址或 playlist ID，儲存時只保留 `list` ID。Notion 欄位接受已發布到網路的完整頁面網址；`preview` 產生簡化連結卡片，`inline` 則嘗試 iframe 內嵌，實際是否允許內嵌仍取決於 Notion 回應標頭。

## 為什麼不直接做線上 CMS

GitHub Pages 是靜態主機，無法安全地在公開頁面直接改 repository 檔案。若做線上 CMS，就需要 OAuth、後端、權限與 token 保存。這個版本將編輯能力限制在本機，保留 Git review、無後端成本，也不會讓管理介面被部署。

未來若需要真正的非開發者線上發佈，可在不改內容模型的前提下增加 GitHub App/OAuth 後端；後端只要產生同一套 Markdown 即可。

## 擴充原則

- 新增一般內容欄位時，同步更新 `src/content.config.ts`、Studio 寫入驗證與 JSON Schema。
- 新增全新視覺 block 時，才修改 Astro component 與 CSS。
- 所有寫入路徑必須限制於 `src/content` 或 `public/images`。
- AI 產生的檔案使用 `generated-` 前綴，讓重複套用可預測，並避免刪除手寫檔案。
