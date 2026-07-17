# 使用 Gemini 協助產生自介

## Gemini Apps（不需要 API key）

1. 開啟 Gemini 網頁版的新對話。
2. 加入 `docs/profile-answers.schema.json` 與 [`PROFILE_INTERVIEW_PROMPT.md`](PROFILE_INTERVIEW_PROMPT.md)。Gemini Apps 官方說明目前支援從電腦上傳文件與文字檔，但帳號、方案及組織管理政策可能限制檔案功能。
3. 依訪談逐步回答；不想公開的地點、社群或聯絡方式直接回答「跳過」。
4. 要求最終只輸出 JSON，存成 `profile.answers.json`，或直接複製到 Profile Studio。
5. 在 Studio 先按「驗證回答」並核對摘要，再按「確認套用」。若 URL 或必填欄位錯誤，回 Gemini 修正，不要手動猜測資料。

Gemini Apps 的一般對話介面只負責產生 JSON，不會直接修改本機 repository、commit 或部署。若改用具備 repository 與 Git 存取能力的 coding agent，請使用 [`../AI_PROFILE_SETUP.md`](../AI_PROFILE_SETUP.md) 的一站式提示詞。

Gemini Apps 的檔案內容與帳號資料處理方式可能依帳號類型及設定不同；只提供願意交給該服務處理的內容，並避免真實 secret。

## Gemini API（未來可選整合）

Gemini API 官方支援以 JSON Schema 約束結構化輸出，但只支援 JSON Schema 的子集合；即使輸出是合法 JSON，值仍可能在語意上不正確，因此本專案必須保留 `/api/answers/validate` 與人工確認，不能直接信任模型輸出。

目前 V1.0.0 不內建 Gemini API 呼叫。若未來加入：

- 使用 provider adapter，不把 Gemini 欄位寫進 `profile.answers.json`。
- API key 只放在受控後端的環境變數或 secret manager；Google 官方明確要求不要提交到 Git，也不要放在 production browser/mobile client。
- 設定費用上限、rate limit、使用者同意、資料最小化與無 AI fallback。
- structured output schema 若因複雜度被拒絕，可建立等價的供應商專用簡化 schema，但 server 仍以本專案完整規則重新驗證。

## 官方參考

- [Gemini Apps 上傳與分析檔案](https://support.google.com/gemini/answer/14903178)
- [Gemini API Structured outputs](https://ai.google.dev/gemini-api/docs/structured-output)
- [Gemini API key 安全指南](https://ai.google.dev/gemini-api/docs/api-key)
