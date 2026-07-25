# 抽籤 Block 維護指南

首頁的「今日手氣」會從 `src/content/fortunes.json` 隨機抽出一張啟用中的籤。所有籤文都集中在這一個檔案，不需要修改 Astro 元件。

## 新增籤紙

Profile Studio 的「其它功能」可控制今日手氣是否顯示，並編輯標題與說明。前往 `/studio/fortune-poem/` 可新增、搜尋、排序、停用或刪除籤詩；右側只載入正式的今日手氣 block，可隨機試抽，也能從任一籤詩卡片指定該張結果來檢查文字排列。

線上 Studio 會把籤桶保存在同一份瀏覽器草稿，並納入 JSON／ZIP 匯出匯入；它不會直接修改 GitHub。以 `npm run studio` 啟動時，籤詩頁才會顯示「儲存到本機專案」，明確寫回 `src/content/fortunes.json` 與 `src/content/blocks/fortune.md`。也可以依下列格式手動維護 JSON。

在 JSON 陣列中加入一個物件：

```json
{
  "id": "free-iphone",
  "grade": "大吉",
  "category": "joke",
  "message": "恭喜你抽到免費 iPhone 了！",
  "note": "（並沒有）",
  "visible": true
}
```

欄位規則：

- `id`：必填、不可與其他籤重複；建議使用簡短英文與連字號。
- `grade`：可填 `大吉`、`中吉`、`小吉`、`吉`、`末吉`、`凶` 或 `大凶`。範本預設籤詩仍只使用 `大吉`、`中吉`、`小吉`，不會因開放其他等級而自動加入凶籤。
- `category`：祝福籤填 `blessing`，玩梗籤填 `joke`。
- `message`：必填，顯示為籤紙主要內容。
- `note`：選填，適合補充祝福或括號吐槽；不需要時可刪除整個欄位。
- `visible`：填 `true` 才會加入籤池；填 `false` 可暫停使用但保留內容。

JSON 不支援註解。除了最後一筆外，每個物件結尾都必須保留逗號；字串必須使用半形雙引號。

## 修改、停用與刪除

- 修改：直接編輯該物件的 `grade`、`category`、`message` 或 `note`。
- 暫停：將 `visible` 改成 `false`，之後可隨時恢復。
- 刪除：移除完整物件，並確認前後物件之間仍只有一個逗號。

每張啟用中的籤被抽到的機率相同。若要維持目前 7：3 的風格，每新增 7 張祝福籤，大約搭配 3 張玩梗籤即可。系統在籤池多於一張時，不會連續兩次抽到同一張。

## 調整首頁順序

編輯 `src/content/profile/main.md` 的 `homeOrder`：

```yaml
homeOrder: [about, turntable, links, fortune, notion]
```

`fortune` 就是抽籤 block，可移到陣列中的其他位置。五個項目都必須保留，而且不能重複。若只想暫時隱藏抽籤 block，請將 `src/content/blocks/fortune.md` 的 `visible` 改成 `false`。

## 驗證

完成修改後執行：

```bash
npm.cmd run build
```

建置會檢查 JSON 語法、唯一 ID、籤文欄位、首頁順序、資料比例與互動 UI 契約。若資料格式錯誤，終端機會指出對應原因。
