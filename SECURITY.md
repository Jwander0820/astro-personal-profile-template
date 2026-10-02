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
- 本機 API 的讀取與寫入均要求每次啟動的隨機憑證；憑證只由終端機啟動連結的 fragment 傳入 Studio，不得由 HTML、靜態輸出或未驗證 API 發送。此控制不保護已能讀取終端機、瀏覽器或同帳號檔案的程式；同源 Studio 與預覽程式仍屬受信任程式。
- ZIP 匯入必須限制總大小、項目數、metadata、回答文件與圖片總量，完整驗證結構與校驗碼後才保存引用圖片；保留既有撤銷與跨分頁使用的圖片。
- 直接內嵌拒絕 URL 中的本機名稱、私人／保留 IP 及帳密。這是位址字面值檢查，無法保證公開 DNS 名稱、重新導向或日後 DNS 回應都不指向內網。
- `ONLINE_STUDIO_MODE` 是 build-time 輸出規則，不是身份驗證。
- 自介內容本身會公開；使用者應在發布前檢查地點、email、雇主與私人網址。
- 唱盤只載入固定 YouTube HTTPS 網域的跨來源播放器 iframe，不在個人頁面或 Studio 預覽執行第三方 API 腳本。本站控制程式只交換播放指令與經驗證的播放器資料，不傳送 Studio 草稿、圖片備份或本機 adapter 資訊。
- 播放器訊息必須同時符合 YouTube origin、該 iframe 的來源視窗與 widget ID；回傳文字只作為文字顯示。本機 adapter 不接受 YouTube 或 `null` origin 的寫入請求。
