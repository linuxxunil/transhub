# 項目開發規則（AGENTS.md）

本文件是 OpenCode 的項目級常備規則，每次對话自動生效。

## 工作流程

- **所有輸出一律使用繁體中文**：對話回覆、文檔（README/AGENTS/SUBMIT-GUIDE 等）、UI 文案、錯誤訊息、註釋均使用繁體；唯一例外是廠商 API 回傳的原始錯誤訊息保持原文，以及額度錯誤正則需同時含簡繁關鍵詞以匹配簡體回傳。
- 每次代碼修改後，必須做完整的測試與驗證，驗證通過才算完成。
- **每次開發完成後，必須派發兩個專案 agent 進行驗證，兩者皆 PASS 才算完成**：
  - `security` agent（`.opencode/agent/security.md`）：唯讀安全審查，輸出風險表與 PASS/FAIL。
  - `test` agent（`.opencode/agent/test.md`）：維護 `tests/` 測試案例（新功能同步增修 TC-Axx/TC-Mxx 案例，自動案例實作進 `tests/run.js`）、執行語法檢查與 `node tests/run.js`、核心流程走查、真實 API 聯通測試；**每次驗證後必須將結果記錄至 `tests/test-cases.md` 的「驗證記錄」區（僅保留最後一次結果）**，輸出 PASS/FAIL。該 agent 僅允許修改 `tests/test-cases.md` 與 `tests/run.js`。
  - security 判定有高/中風險、或 test 有 FAIL 時，修復後必須重新派發該 agent 複審，直到 PASS。
- **每次代碼修改後，必須自動遞增版本號**：運行 `node bump-version.js`（預設遞增 patch 位；新增功能用 `node bump-version.js --minor`；不兼容變更用 `node bump-version.js --major`），版本號寫入 manifest.json。
- 修復多次失敗時，先詢問用戶，不要無限重試。
- 驗證需要額外信息（如控制台輸出、賬號狀態、網路環境）時，先詢問用戶再執行。
- 每次開放（發布/交付）前必須完成回歸測試：語法檢查、`node tests/run.js`、核心流程走查、真實 API 聯通測試。

## 翻譯服務規則

- 預設不接入需要付費的 API；僅使用免費額度或用戶自有密鑰。
- 所有雲服務必須設置額度上限；額度用盡自動停止或切換下一個 Provider，絕不自動產生費用。
- Provider 順序（預設）：騰訊雲 → 阿里雲 → 百度 → 有道，順序可在設置頁調整。
- 面向中国大陸網路環境，外網服務（Google、DeepL 等）不作為核心依賴。

## 安全規則

- API Key / Secret 只保存在用戶本機（chrome.storage.local），絕不寫入代碼庫、文檔或日誌。
- 密鑰類輸入框必須遮罩顯示；輸入時明文顯示 3 秒後自動重新遮罩。
- 測試用臨時腳本放在 /tmp，密鑰通過環境變量傳入，用後即刪。常駐自動化測試放 `tests/run.js`（進 git、不打包上架）。
