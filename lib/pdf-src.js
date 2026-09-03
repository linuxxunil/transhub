/**
 * TransHub 共享模組：PDF 來源白名單校驗。
 * ?src= 參數僅允許 http(s)/file，防偽協議（javascript:/data: 等）注入。
 */
(function (global) {
  'use strict';

  function resolvePdfSource(raw, baseUrl) {
    if (!raw || typeof raw !== 'string') return null;
    var u;
    try { u = new URL(raw, baseUrl || 'https://example.invalid/'); }
    catch (e) { return null; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:' && u.protocol !== 'file:') return null;
    return u.href;
  }

  /** 判定網址是否指向 PDF（http/https/file 且路徑以 .pdf 結尾，不分大小寫、忽略查詢串與 hash） */
  function isPdfUrl(raw) {
    if (!raw || typeof raw !== 'string') return false;
    var u;
    try { u = new URL(raw); }
    catch (e) { return false; }
    if (u.protocol !== 'https:' && u.protocol !== 'http:' && u.protocol !== 'file:') return false;
    return /\.pdf$/i.test(u.pathname);
  }

  global.TransHubPdfSrc = { resolvePdfSource: resolvePdfSource, isPdfUrl: isPdfUrl };
})(typeof self !== 'undefined' ? self : this);
