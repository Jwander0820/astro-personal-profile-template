# 升級到 v1.3

v1.3 強化本機專案寫入安全、答案檔更新語意、Studio 外觀控制與上游 CI。既有內容不需要全面重寫。

## 升級步驟

1. 先備份或 commit 目前的 `src/content/` 與 `public/images/`。
2. 合併 v1.3 程式變更，保留自己的內容檔與資產。
3. 執行 `npm install` 更新 lockfile 對應環境。
4. 執行 `npm run profile:plan -- profile.answers.json` 檢查答案檔影響。
5. 執行 `npm run build`；模板維護者再執行完整品質檢查。

## 答案檔模式


未指定 `applyMode` 時仍採用 `replace`，與舊版完整套用行為相同。若只要更新少量欄位，請明確加入：

```json
{
  "version": 1,
  "applyMode": "merge",
  "identity": { "title": "新的短標題" }
}
```

`merge` 只更新明確提供的頂層欄位；省略的 socials、links、sections、imageBlocks、embedBlocks、playlist、fortune、features 與 appearance 維持原狀。

## 本機 Studio adapter

舊的細粒度 profile、home、links、sections、image-blocks、answers/apply 與 answers/validate API 已移除。現在使用：

- `GET /api/status`
- `POST /api/project/plan`
- `POST /api/project/apply`
- 籤詩編輯器使用的 fortunes 與 fortune block API

若下游 fork 曾直接呼叫 4322 的舊端點，請改成先 plan、確認後再 apply。公開 Studio 不受影響。

## 圖片寫入

本機儲存會先驗證答案與圖片，再在暫存副本計算變更。同名但內容不同的圖片會取得 digest 後綴，不會覆蓋既有檔；任何提交失敗都會嘗試回復已寫入檔案。

## 外觀與 schema

Studio 外觀步驟新增 `fontScale` 與 `smallTextScale` 控制。既有 `src/content/profile/main.md` 值會保留；未指定 `sectionsLayout` 的內容仍使用 `list` 預設，避免舊網站版面改變。
