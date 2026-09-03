/**
 * TransHub content script：初始化共享劃詞翻譯模組。
 * 觸發與卡片邏輯位於 lib/selection-card.js（manifest content_scripts 先載入該檔）。
 */
(function () {
  'use strict';
  if (globalThis.TransHubCard && typeof globalThis.TransHubCard.init === 'function') {
    globalThis.TransHubCard.init();
  }
})();
