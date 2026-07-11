# 抽籤 Block 維護指南

首頁的「今日手氣」會從 `src/content/fortunes.json` 隨機抽出一張啟用中的籤。所有籤文都集中在這一個檔案，不需要修改 Astro 元件。

## 新增籤紙

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
- `grade`：只能填 `大吉`、`中吉` 或 `小吉`。
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
