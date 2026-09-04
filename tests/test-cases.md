# TransHub 測試案例與驗證記錄

> 本檔案由 **test agent** 維護：
> 1. 功能新增/修改時，同步新增或更新案例（編號遞增、不重用、不刪除歷史案例）
> 2. 每次驗證必先執行 `node tests/run.js`（自動案例）
> 3. 每次驗證完成後，在下方「驗證記錄」區塊**最上方**追加一節結果

## 自動案例（tests/run.js）

| ID | 模組 | 標題 | 對應測試 |
|---|---|---|---|
| TC-A01 | 存儲 | 舊格式自動遷移（settings 密鑰 → secrets） | TC-A01 |
| TC-A02 | 存儲 | saveSettings 拆分寫入（settings 無密鑰 + secrets 更新） | TC-A02 |
| TC-A03 | 存儲 | getSettings 合併讀取（密鑰來自 secrets、DEFAULTS 補全） | TC-A03 |
| TC-A04 | 存儲 | 遷移冪等（二次讀取不再觸發寫入） | TC-A04 |
| TC-A05 | 存儲 | 空存儲回傳 DEFAULTS | TC-A05 |
| TC-A06 | 設定 | providerOrder 正規化（剔除未知、補齊缺失） | TC-A06 |
| TC-A07 | 訊息 | onMessage 拒絕未授權 sender | TC-A07 |
| TC-A08 | 訊息 | get-usage 回傳四家摘要 | TC-A08 |
| TC-A09 | 翻譯鏈 | 空文本回覆「沒有選中文字」 | TC-A09 |
| TC-A10 | 翻譯鏈 | 總開關關閉回覆「翻譯功能已關閉」 | TC-A10 |
| TC-A11 | 翻譯鏈 | 全部服務缺密鑰 → 逐家具體報錯（絕不靜默） | TC-A11 |
| TC-A12 | 翻譯鏈 | 失敗自動切換下一家 | TC-A12 |
| TC-A13 | 翻譯鏈 | 額度類錯誤當月停用該服務 | TC-A13 |
| TC-A14 | 翻譯鏈 | 相同文本命中緩存（cached 標記、不重複調用） | TC-A14 |
| TC-A15 | 翻譯鏈 | TEXT_MAX=5000 截斷（緩存鍵/歷史/Provider 一致） | TC-A15 |
| TC-A16 | 翻譯鏈 | 歷史上限 1000 | TC-A16 |
| TC-A17 | Provider | 騰訊雲 TC3 頭與 payload 構造 | TC-A17 |
| TC-A18 | Provider | 百度 MD5 簽名與參數（zh-TW→cht） | TC-A18 |
| TC-A19 | Provider | 有道 SHA-256 v3 簽名與參數 | TC-A19 |
| TC-A20 | Provider | 阿里雲 POST 形狀（簽名在 body、URL 無參數）+ Code=200 成功 | TC-A20 |
| TC-A21 | Provider | 阿里雲 Code 非 200 判錯 | TC-A21 |
| TC-A22 | Provider | 阿里雲非 2xx 解析錯誤內文 | TC-A22 |
| TC-A23 | Provider | 四家缺密鑰各自 bail | TC-A23 |
| TC-A24 | Provider | 騰訊 Error 回應判錯 | TC-A24 |
| TC-A25 | PDF | selection-card 共享模組掛載（無 DOM 可載入、init 可呼叫） | TC-A25 |
| TC-A26 | PDF | PDF 來源白名單（僅 http(s)/file，防偽協議注入） | TC-A26 |
| TC-A27 | PDF | manifest 與 PDF 檢視器檔案完整性（activeTab、載入順序、本地 PDF.js、打包清單） | TC-A27 |
| TC-A28 | PDF | isPdfUrl 判定（http/https/file + .pdf 路徑、忽略查詢串） | TC-A28 |

## 手動案例（需瀏覽器操作）

| ID | 模組 | 步驟 | 預期 |
|---|---|---|---|
| TC-M01 | 觸發 | 全新安裝（預設值）於英文頁面雙擊單詞 | 不觸發翻譯（雙擊預設關閉） |
| TC-M02 | 觸發 | 設置頁勾選「雙擊觸發翻譯」→ 保存 → 雙擊單詞 | 浮動卡片顯示繁體翻譯 |
| TC-M03 | 觸發 | 選中英文單詞/句子後連按兩次 `T` | 浮動卡片顯示選中內容翻譯 |
| TC-M04 | 觸發 | 選中整句後雙擊 | 整句翻譯（句子靠選取觸發） |
| TC-M05 | 觸發 | Alt/⌘ + 點擊頁面文字 | 不再觸發翻譯（已移除） |
| TC-M06 | 觸發 | 選中文字 → 右鍵選單「翻譯選中文字」 | 卡片顯示翻譯 |
| TC-M07 | 卡片 | Esc / 點擊卡片外空白；點「複製」「收藏」 | 卡片關閉；「已複製」「已收藏」回饋 |
| TC-M08 | 設定 | 開啟擴展下切換雙擊開關並保存（不重載頁面） | 即時生效（storage.onChanged） |
| TC-M09 | 設定 | 快速鍵改為其他字母；於輸入框內連按該鍵 | 新鍵生效；輸入框內不觸發 |
| TC-M10 | 設定 | 密鑰輸入框輸入內容 | 明文 3 秒後自動遮罩；blur 立即遮罩 |
| TC-M11 | 設定 | 「↑ 上移 / ↓ 下移」調整服務順序 | 保存後立即按新順序嘗試 |
| TC-M12 | 遷移 | v0.1.x 舊資料（密鑰在 settings）載入新版 | 設置頁密鑰仍顯示、翻譯可用（自動遷移） |
| TC-M13 | 額度 | 打開設置頁「用量總覽」→ 刷新 | 四家狀態/剩餘/調用次數正確顯示 |
| TC-M14 | Provider | 各服務商面板填入密鑰後點「測試」 | 顯示「成功：譯文」或具體錯誤 |
| TC-M15 | PDF | popup「翻譯 PDF」（當前分頁非 PDF）→ 檢視器內選擇本機 PDF | 檢視器渲染內容與頁碼顯示 |
| TC-M16 | PDF | 檢視器內雙擊英文單詞 | 浮動卡片顯示繁體翻譯 |
| TC-M17 | PDF | 檢視器內選取整句 → 連按兩次 T | 整句繁體翻譯 |
| TC-M18 | PDF | 檢視器內 Esc / 點擊卡片外 | 卡片關閉 |
| TC-M19 | PDF | 地址欄直開 http(s) PDF → popup「翻譯 PDF」 | 檢視器自動載入該分頁 PDF（單按鈕智慧判斷） |
| TC-M20 | PDF | 網頁上右鍵 PDF 連結 →「用 TransHub 翻譯此 PDF」 | 同網域可載入；跨網域顯示「請先下載」提示 |
| TC-M21 | PDF | 變更雙擊開關/快速鍵設定後，檢視器內操作 | 即時生效（不需重開檢視器） |
| TC-M22 | PDF | 網頁（content script）劃詞回歸：雙擊t、右鍵選單 | 行為與升級前一致（重構不變） |
| TC-M23 | 防護 | 重新載入擴展後，於未重新整理的舊網頁分頁觸發翻譯 | 卡片顯示「擴展已更新，請重新整理此頁面」，console 無 Uncaught Error |
| TC-M24 | 觸發 | ① 無反白時滑鼠停在單詞上按 tt；② 游標在空白處/圖片上按 tt；③ 反白後滑鼠移開按 tt | ① 翻譯游標處單詞（卡片錨定游標）；② 不觸發；③ 翻譯反白內容（滑鼠位置無關，單詞/句子均可） |

## 真實 API 聯通（由 test agent 視密鑰可用性執行）

| ID | 模組 | 內容 | 預期 |
|---|---|---|---|
| TC-R01 | 阿里雲 | en→zh-TW 實譯（密鑰經環境變數） | 繁體輸出 |
| TC-R02 | 阿里雲 | auto→zh-TW 實譯 | 繁體輸出 |
| TC-R03 | 阿里雲 | ja→zh-TW（服務端限制） | 回 10005，不算失敗 |
| TC-R04 | 其他 | 各家實譯（有密鑰時抽測） | 正常回譯文或明確錯誤 |

> 密鑰一律經環境變數傳入，不得寫入本檔案、報告或任何持久化位置。

---

## 驗證記錄

> 由 test agent 每次驗證後**覆寫**本區：**僅保留最後一次的測試結果**（舊記錄移除，案例目錄仍為累加維護）；格式如下範例。
>
> ### YYYY-MM-DD HH:mm ｜ v版本 ｜ 變更摘要
> - 執行者：test agent
> - 自動案例：node tests/run.js → N/N PASS
> - 手動案例：TC-Mxx PASS / 待瀏覽器驗證
> - 真實 API：TC-Rxx PASS / SKIP
> - 結論：PASS / FAIL（失敗項與定位）
> - 遺留事項：（無則寫「無」）

### 2026-09-03 ｜ v0.3.3 ｜ tt 無選取時後備翻譯游標處單詞（與雙擊行為對稱）
- 執行者：test agent
- 自動案例：node tests/run.js → 28/28 PASS；語法檢查（node --check lib/selection-card.js、tests/run.js）＋manifest JSON＋版本 0.3.3 皆通過
- 手動案例：TC-M01~M24 **已由用戶於瀏覽器人工驗證 PASS**（含 TC-M24 本輪重點：① 無反白滑鼠停單詞按 tt → 譯游標處單詞且卡片錨定游標；② 游標在空白處/圖片按 tt → 不觸發；③ 反白後滑鼠移開按 tt → 譯反白內容，定位依選取框與滑鼠無關）。代碼走查確認：lastMouse 初始 {-1,-1} 哨兵（滑鼠未動不後備）、wordAtPoint 與雙擊共用同一 WORD_RE（英文單詞）、e.repeat/修飾鍵/輸入框排除均在觸發分支之前、有選取路徑（selectionRect 定位、1000 字上限）完全不變、mousemove 為 passive 僅更新內部變數
- 真實 API：TC-R01~R03 SKIP——阿里雲回 InvalidAccessKeyId.NotFound（提供的 AK 無效/已失效，屬憑證環境問題非代碼缺陷；錯誤經 Code 非 200 路徑正確判錯並顯示具體訊息，另驗證 TC-A21 判錯路徑有效）
- 結論：**PASS**（代碼層全過；真實 API 聯通待有效密鑰補測）
- 遺留事項：提供有效阿里雲密鑰後補測 TC-R01~R03；觀察（低風險）：選取非文字物件（如圖片）時 selectionRect 非 null，若游標處恰有單詞則卡片錨定走選取框分支而非游標，觸發與翻譯正確性不受影響
