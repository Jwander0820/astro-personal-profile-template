# Security Policy

## 支援範圍

安全修正以最新 tagged release 與 `main` 為優先。舊版使用者可能需要升級才能取得修正。

## 私密回報

請優先使用 GitHub repository 的 **Security → Report a vulnerability** 私密回報功能，提供：

- 受影響版本或 commit
- 重現條件與最小步驟
- 實際與預期結果
- 可能影響與你已採取的緩解方式

若私密漏洞回報未開啟，請建立一個不含利用細節、credential、個人資料或未公開網址的普通 issue，只說明需要維護者提供私密聯絡管道。

請勿測試你不擁有或未獲授權的部署，也不要在公開 issue、discussion 或 pull request 中揭露敏感資訊。

## 專案安全邊界

- 公開 Profile Studio 只使用瀏覽器 localStorage 與 IndexedDB，不具備 GitHub 寫入權限。
- 本機 adapter 只監聽 loopback，且不應暴露到靜態輸出或公開網路。
- `ONLINE_STUDIO_MODE` 是 build-time 輸出規則，不是身份驗證。
- 自介內容本身會公開；使用者應在發布前檢查地點、email、雇主與私人網址。
