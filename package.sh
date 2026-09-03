#!/bin/bash
# 打包上架 zip：只包含執行所需檔案，排除開發檔案
set -euo pipefail
cd "$(dirname "$0")"

VERSION=$(python3 -c "import json; print(json.load(open('manifest.json'))['version'])")
OUT="dist/TransHub-v${VERSION}.zip"

mkdir -p dist
rm -f "$OUT"

zip -X -r "$OUT" \
  manifest.json \
  background.js \
  content.js \
  pdf-viewer.html pdf-viewer.js \
  popup.html popup.js \
  options.html options.js \
  lib/md5.js lib/providers.js lib/selection-card.js lib/pdf-src.js \
  lib/pdfjs/pdf.min.js lib/pdfjs/pdf.worker.min.js \
  icons/icon16.png icons/icon48.png icons/icon128.png \
  -x '*.DS_Store' > /dev/null

echo "已生成: $OUT"
echo "---- 包內檔案 ----"
unzip -l "$OUT"
echo "---- 提示 ----"
echo "1. 該 zip 可直接上傳到 Edge Partner Center 或 Chrome Web Store"
echo "2. AGENTS.md / README.md / privacy-policy.md / store-listing.md / SUBMIT-GUIDE.md / icons/icon.svg / icons/icon300.png 均不在包內（開發與商店資料檔案）"
