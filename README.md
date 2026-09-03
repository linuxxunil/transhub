# TransHub

> **One hub, many translators.** 聚眾家之長，譯如母語。

TransHub 是一個桌面版 Chrome / Edge（Manifest V3）劃詞翻譯擴展：在閱讀英文網站時，**雙擊單詞、Alt/⌘+點擊句子**，即可即時翻譯為繁體中文。它聚合多家翻譯服務為一個入口——某家免費額度用盡時自動切換下一家，全部用盡即停止，**絕不自動產生付費**。

> **One hub, many translators.** TransHub is a desktop Chrome/Edge extension that instantly translates clicked words and sentences into Traditional Chinese, aggregating Tencent Cloud, Alibaba Cloud, Baidu and Youdao behind one configurable failover chain.

---

## 功能特性

| 操作 | 行為 |
|---|---|
| 雙擊英文單詞 | 翻譯單詞（浮動卡片顯示） |
| Alt / ⌘ + 點擊 | 翻譯所在句子 |
| 選中文字後连按兩次快速鍵（預設 `T`，可自定義） | 翻譯選中內容 |
| 先選中文字 → 右鍵菜單「翻譯選中文本」 | 翻譯選中內容 |
| Esc / 點擊卡片外空白 | 關閉翻譯卡片 |

- 浮動卡片支持：複製、收藏、關閉
- 來源/目標語言可配置（預設來源：自動檢測；預設目標：**繁體中文**）
- 翻譯緩存：相同文本不重復請求
- 翻譯歷史（1000 條）：搜索、收藏、刪除、導出 JSON
- 快速鍵防誤触：輸入框/textarea 內不触發、带修饰鍵不触發、按住不放不触發

## 聚合多家翻譯服務

| 服務 | 免費額度（以官方為準） | 說明 |
|---|---|---|
| 騰訊雲機器翻譯 | 每月 500 萬字符（免費包，月重置） | 建議控制台關閉後付費作雙保险 |
| 阿里雲機器翻譯 | 每月 100 萬字符（通用版/專業版各 100 萬） | 超額進入後付費，注意關閉或設餘額提醒 |
| 百度翻譯 | 標準版 5 萬/月；個人認證高級版 100 萬/月 | 建議完成個人認證 |
| 有道翻譯 | 新用戶體驗金（50 元），用完即收費 | 請保守使用，或謹慎啟用 |

- **順序可調**：設置頁「翻譯服務」面板用「↑ 上移 / ↓ 下移」調整，立即生效
- **自動切換**：當前服務額度用盡（本地估算達上限，或返回額度類錯誤）時自動切換下一個
- **錯誤停用**：返回「餘額不足/欠費/配額耗盡」類錯誤的服務商當月自動停用，跨月恢復
- **絕不停留**：全部服務不可用時明確報錯，絕不靜默扣費

> 免費額度規則随時可能調整，以各服務商官方頁面為準。

## 快速開始

1. 下载或克隆本項目，打開 `chrome://extensions`（Edge 為 `edge://extensions`）
2. 開啟「開發者模式」→「加载解壓縮的擴展」→ 選擇本項目目錄
3. 點擊工具欄 TransHub 圖標 →「打開完整設置」→ 在各服務商面板填入密鑰
4. 點擊每個服務商旁的「測試」按钮驗證连通性
5. 打開任意英文網頁，雙擊一個單詞試試

### 各服務商 Key 申請步驟

#### 騰訊雲機器翻譯

1. 註冊騰訊雲賬號並完成實名認證：https://cloud.tencent.com
2. 開通機器翻譯服務：https://console.cloud.tencent.com/tmt （點「立即使用」開通）
3. 前往「訪問管理 → API 密鑰管理」創建密鑰，獲得 **SecretId** 與 **SecretKey**：https://console.cloud.tencent.com/cam/capi
   - 安全建議：創建子賬號並僅授予 `QcloudTMTFullAccess` 權限，用子賬號密鑰
4. 將 SecretId / SecretKey 填入 TransHub 設置頁 → 點「測試」
5. 官方快速入門（含截圖教程）：https://cloud.tencent.com/document/product/551/104415

#### 阿里雲機器翻譯

1. 註冊阿里雲賬號並完成實名認證：https://www.aliyun.com
2. 開通機器翻譯服務（通用版 / 專業版）：https://mt.console.aliyun.com
3. 創建 **AccessKeyId / AccessKeySecret**：https://ram.console.aliyun.com （建議創建 RAM 子賬號，僅授予 `AliyunMTFullAccess`）
4. 填入 TransHub 設置頁 → 點「測試」
5. 官方帮助中心：https://help.aliyun.com/zh/machine-translation/

#### 百度翻譯

1. 登錄百度翻譯開放平台並註冊成為開發者：https://fanyi-api.baidu.com
2. 在「管理控制台」開通 **通用文本翻譯** 服務：https://fanyi-api.baidu.com/api/trans/product/desktop
3. 在控制台底部獲取 **APPID** 與 **密鑰**
4. （推荐）完成個人實名認證並切換為「高級版」，免費額度從 5 萬/月提升至 100 萬/月
5. 填入 TransHub 設置頁 → 點「測試」
6. 官方接入文檔：https://fanyi-api.baidu.com/doc/21

#### 有道翻譯

1. 註冊有道智雲開放平台：https://ai.youdao.com （新用戶贈送體驗金）
2. 進入控制台：**創建應用**，並創建/綁定一個「文本翻譯」服務實例：https://ai.youdao.com/console
3. 在應用詳情獲取 **AppKey** 與 **AppSecret**
4. 填入 TransHub 設置頁 → 點「測試」
5. 官方產品文檔目錄：https://ai.youdao.com/DOCSIRMA/

> 安全提醒：所有密鑰僅保存在本機瀏覽器（chrome.storage.local）。請勿將密鑰分享給他人；洩漏請立即到對應控制台禁用重建。

## 隐私與安全

- **密鑰只存本機**：chrome.storage.local，不上傳、不進代碼庫、不打日誌
- **不收集數據**：無统计、無廣告、無遥測代碼
- **翻譯內容直達服務商**：點擊的文字只發送給你自己配置並授權的服務商
- **歷史與收藏僅存本機**：可随時刪除、清空或導出
- 隐私政策全文见 `privacy-policy.md`

## 項目結構

```text
transhub/
├── manifest.json        # MV3 配置、權限
├── background.js        # 後台核心：多服務路由、額度追蹤、故障切換、緩存、歷史
├── content.js           # 頁面交互：雙擊/Alt·⌘+點擊/快速鍵、浮動卡片（Shadow DOM）
├── popup.html/.js       # 工具欄彈窗：開關、語言、額度與調用次數一覽
├── options.html/.js     # 設置頁：密鑰、順序調整、快速鍵、用量總覽、歷史管理
├── lib/
│   ├── md5.js           # 百度签名（MD5）
│   └── providers.js     # 四家服務商适配器（含各自官方签名算法）
├── icons/               # 擴展圖標
├── package.sh           # 打包上架 zip
├── SUBMIT-GUIDE.md      # Edge / Chrome 商店提交流程
├── store-listing.md     # 商店文案草稿
└── privacy-policy.md    # 隐私政策
```

翻譯請求流程：

```text
點擊文字（content.js）
        ↓ 選中/定位文本
chrome.runtime.sendMessage
        ↓
background.js：緩存查詢 → 按 providerOrder 依次尝試
        ↓ 失敗或額度用盡則切換下一個
騰訊雲 → 阿里雲 → 百度 → 有道
        ↓
顯示繁體中文（浮動卡片）→ 記錄歷史與用量
```

## 打包與上架

```bash
./package.sh          # 生成 dist/TransHub-v<版本>.zip
```

提交流程（Edge 免費 / Chrome unlisted）见 `SUBMIT-GUIDE.md`。

## 许可證

本項目基於 [MIT License](LICENSE) 發布。

## 免责聲明

TransHub 為獨立開發的個人工具，與騰訊雲、阿里雲、百度、有道等翻譯服務商無任何隸屬或合作關系。各服務免費額度規則以官方頁面為準，超出額度可能產生費用，請自行在各服務商控制台管理額度與賬單。
