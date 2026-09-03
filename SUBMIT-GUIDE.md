# 上架提交指南 / Submission Guide

> 本擴展可同時提交到 Edge Add-ons（推荐，免費）與 Chrome Web Store（不公開 unlisted，需一次性 5 美元）。
> 兩個商店使用同一份 zip 包（由 `package.sh` 生成）。

## 第 0 步：打包

```bash
./package.sh
# 產出 dist/translation-plugin-v<版本號>.zip
```

## 第 1 步：準備上架材料

| 材料 | 位置 |
|---|---|
| 商店名稱/描述/權限說明 | `store-listing.md` |
| 隐私政策頁面 URL | 把 `privacy-policy.md` 托管到 GitHub（见該文件末尾說明），拿到公開 URL |
| 圖標 | Edge 商店 logo 用 `icons/icon300.png`；擴展圖標已內置 |
| 截圖 | 按 `store-listing.md` 的截圖建議截取 |

## 第 2 步：Edge Add-ons 上架（免費）

1. 訪問 https://partner.microsoft.com/dashboard/microsoftedge → 用 Microsoft 賬號註冊開發者（免費，需邮箱驗證）
2. Partner Center → **Edge 加载項** → **創建新加载項**
3. 填寫：
   - 名稱：`TransHub`
   - 簡短說明 / 描述：複製 `store-listing.md` 對應內容
   - 類别：生產力（Productivity）
   - 隐私政策 URL：你的隐私政策連結
   - 網站URL（可留空）
4. 上傳 `icons/icon300.png` 作為商店 logo（300×300）
5. 上傳至少 1 张截圖
6. 上傳 `dist/translation-plugin-vX.Y.Z.zip`
7. 提交审核信息中的權限說明：複製 `store-listing.md` 的「權限說明」段
8. **可见性**：可選擇「公開」或「隐藏（僅連結可安装）」
9. 提交 → 审核通常 1–7 天 → 通過後可在 Edge 加载項商店安装

## 第 3 步（可選）：Chrome Web Store 不公開發布

1. 訪問 https://chrome.google.com/webstore/devconsole → 註冊開發者賬戶（**一次性 5 美元**）
2. 「新增項」→ 上傳同一個 zip
3. 填寫商店资產（名稱/描述/截圖/圖標 128 已在包內）
4. **隐私權規範**標籤頁：
   - 單一用途：複製 `store-listing.md` 的「單一用途聲明」
   - 權限理由：複製「權限說明」段
   - 數據使用聲明：勾選「不收集任何用戶數據」（本擴展不上傳任何數據）
   - 隐私政策 URL
5. 可见性選擇「**不公開（Unlisted）**」→ 只有拿到連結的人能安装
6. 提交审核（通常數天）→ 通過後把安装連結分享給自己或朋友

## 第 4 步：版本更新流程

```bash
# 1. 遞增版本號（預設 patch；新功能用 node bump-version.js --minor；不兼容變更用 --major）
node bump-version.js
# 2. 重新打包
./package.sh
# 3. 在對應商店的「版本管理」里上傳新 zip 並提交审核
```

## 常见审核退回原因（提前避免）

- `<all_urls>` 內容腳本用途解釋不清 → 提交時務必貼上權限說明
- 缺少隐私政策 URL → 第 1 步先準備好
- 描述里出現「官方/合作」等暗示與厂商有關系的字眼 → 已在草稿中避免，勿自行添加
- 截圖與實際功能不符 → 用真實界面截圖

## 個人使用提醒

若僅自用，**無需上架**：`chrome://extensions` / `edge://extensions` 開啟開發者模式 → 「加载解壓縮的擴展」選擇本項目目錄即可，功能無任何差异。
