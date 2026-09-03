# 商店資料草稿 / Store Listing Draft

> 提交前自讀：Chrome 簡短說明上限 132 字符；Edge 支持描述 1 萬字符以內。以下已備好簡短版與完整版。

## 名稱 / Name

```
TransHub
```

## 簡短說明 / Short Description（≤132 字符）

```
TransHub：選中文字連按兩次快速鍵即時翻譯為繁體中文。聚合騰訊雲/阿里雲/百度/有道，額度用盡自動切換。
```

## 完整說明 / Full Description

```
TransHub —— One hub, many translators。聚眾家之長，譯如母語。

閱讀英文網站時，對不熟悉的單詞與句子即時翻譯為繁體中文。

▍核心功能
• 選中文字後連按兩次快速鍵（預設 T，可自定義）→ 翻譯選中內容（單詞、句子均可）
• 雙擊單詞翻譯（設置頁可開啟，預設關閉）
• PDF 劃詞翻譯：內建檢視器開啟本機或當前分頁 PDF，雙擊/選取即譯
• 右鍵菜單「翻譯選中文本」
• 浮動卡片：複製、收藏、關閉，Esc 退出

▍一個樞紐，多家翻譯
支持騰訊雲機器翻譯、阿里雲機器翻譯、百度翻譯、有道翻譯。
服務順序可自行調整；某個服務免費額度用盡時自動切換下一個，全部用盡即停止，絕不自動產生付費。

▍隱私承諾
• API 密鑰僅保存在你的瀏覽器本地，絕不上傳
• 不收集任何數據、無統計、無廣告、無遙測
• 翻譯歷史與收藏僅存本機，可隨時刪除/導出

▍其他
• 來源/目標語言可配置（預設目標語言：繁體中文）
• 各服務剩餘額度估算與月度調用次數一覽
• 面向桌面版 Chrome 與 Edge（Manifest V3）

─────────────────
免責聲明：TransHub 為獨立開發的個人工具，與騰訊雲、阿里雲、百度、有道等服務商無任何隸屬或合作關係。翻譯服務需使用你自己的賬號與密鑰，免費額度規則以各服務商官方頁面為準；超出額度可能產生費用，請自行在各服務商控制台管理。
Disclaimer: TransHub is an independently developed tool, not affiliated with Tencent Cloud, Alibaba Cloud, Baidu, or Youdao. Translation services require your own API credentials; free-tier rules are subject to each provider's official terms.
```

## 分類 / Category

- Chrome：工具（Utilities）→ 次類別：生產力工具 / Accessibility?（建議：生產工具）
- Edge：生產力（Productivity）

## 語言 / Language

- 預設：中文（繁體）；可補充 English 描述（見 privacy-policy.md 英文段落風格）

## 截圖建議 / Screenshots

1. 設置頁「用量總覽」（展示多服務商 + 額度）
2. 翻譯卡片懸浮在英文網頁上（雙擊單詞效果）
3. Popup 快捷設置
4. 快速鍵/語言設置區

> 截圖要求：Edge 最低 1 張，建議 640×480 以上；Chrome 建議 1280×800。可用 macOS 截圖（⇧⌘4）後微調。

## 單一用途聲明 / Single Purpose（提交時填寫）

```
本擴展僅用於一項功能：將用戶點擊/選中的網頁文字翻譯為目標語言並顯示。
This extension has a single purpose: translating clicked or selected text on web pages and displaying the result.
```

## 權限說明 / Permission Justification（提交時填寫）

```
- host_permissions（各翻譯 API 域名）：僅當用戶配置了相應服務商密鑰後，從後台直接調用該服務商的官方翻譯 API，避免跨域限制。
- content_scripts (<all_urls>)：翻譯功能需要在用戶點擊文字的任意網頁上讀取該文字並顯示浮動卡片；不讀取、不上傳頁面其他內容。
- storage：保存用戶設置、API 密鑰（僅本機）與本地翻譯歷史。
- contextMenus / activeTab / scripting：提供右鍵翻譯選中文本與按需注入翻譯卡片。
```
