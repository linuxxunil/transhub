#!/usr/bin/env node
'use strict';
/**
 * TransHub 自動化測試執行器（常駐）
 * - 純本機測試：不打真實 API、不需密鑰
 * - 由 test agent 於每次驗證時執行：node tests/run.js
 * - 案例編號與 tests/test-cases.md 對應；功能變更時由 test agent 同步增修案例
 */
const vm = require('vm');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.join(__dirname, '..');

// ---------- chrome stub（模擬 MV3 service worker 環境） ----------
let store = {}; // 模擬 chrome.storage.local 內容
const listeners = { onMessage: null };

// 與 SW 的 importScripts 一致：以 vm 載入 lib，使兩者共享同一 global（providers 內部依賴 TranslationMD5）
global.importScripts = function () {
  vm.runInThisContext(require('fs').readFileSync(path.join(ROOT, 'lib/md5.js'), 'utf8'), { filename: 'lib/md5.js' });
  vm.runInThisContext(require('fs').readFileSync(path.join(ROOT, 'lib/providers.js'), 'utf8'), { filename: 'lib/providers.js' });
};

global.chrome = {
  runtime: {
    id: 'test-extension-id',
    lastError: null,
    onInstalled: { addListener: function () {} },
    onMessage: {
      addListener: function (fn) { listeners.onMessage = fn; }
    },
    sendMessage: function () {}
  },
  contextMenus: {
    create: function () {},
    onClicked: { addListener: function () {} }
  },
  tabs: { sendMessage: function () {} },
  storage: {
    local: {
      get: function (defaults) {
        const out = Object.assign({}, defaults);
        Object.keys(defaults).forEach(function (k) { if (k in store) out[k] = store[k]; });
        return Promise.resolve(out);
      },
      set: function (obj) { Object.assign(store, obj); return Promise.resolve(); }
    }
  }
};

global.TranslationMD5 = undefined; // 由 importScripts（vm 載入）掛載
global.TranslationProviders = undefined;

// fetch stub：由各 Provider 案例注入 canned 回應
let fetchHandler = null;
global.fetch = function (url, options) {
  if (!fetchHandler) return Promise.reject(new Error('fetchHandler 未設置'));
  return Promise.resolve(fetchHandler(url, options));
};

vm.runInThisContext(require('fs').readFileSync(path.join(ROOT, 'background.js'), 'utf8'), { filename: 'background.js' });

// ---------- 測試工具 ----------
let failed = 0;
const results = [];
function assert(cond, msg) { if (!cond) throw new Error(msg || 'assertion failed'); }
async function t(id, name, fn) {
  try { await fn(); results.push({ id: id, ok: true }); console.log('PASS ' + id + ' ' + name); }
  catch (e) { failed++; results.push({ id: id, ok: false }); console.log('FAIL ' + id + ' ' + name + ' :: ' + (e && e.message)); }
}
function monthKey() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}
function resetStore() { store = {}; }
function legacySettings() {
  return {
    enabled: true, dblclickEnabled: false, sourceLang: 'auto', targetLang: 'zh-TW',
    hotkey: { enabled: true, key: 't', windowMs: 600 },
    providerOrder: ['tencent', 'alibaba', 'baidu', 'youdao'],
    providers: {
      tencent: { enabled: true, secretId: 'OLD_SID', secretKey: 'OLD_SK', region: 'ap-guangzhou' },
      alibaba: { enabled: true, accessKeyId: 'OLD_AKID', accessKeySecret: 'OLD_AKS', region: 'cn-hangzhou' },
      baidu: { enabled: true, appid: 'OLD_BA', key: 'OLD_BK' },
      youdao: { enabled: true, appKey: 'OLD_YK', appSecret: 'OLD_YS' }
    },
    usage: {}
  };
}
function newFormatSettings(overrides) {
  const s = {
    enabled: true, dblclickEnabled: false, sourceLang: 'auto', targetLang: 'zh-TW',
    hotkey: { enabled: true, key: 't', windowMs: 600 },
    providerOrder: ['tencent', 'alibaba', 'baidu', 'youdao'],
    providers: {
      tencent: { enabled: true, region: 'ap-guangzhou' },
      alibaba: { enabled: true, region: 'cn-hangzhou' },
      baidu: { enabled: true },
      youdao: { enabled: true }
    },
    usage: {}
  };
  return Object.assign(s, overrides || {});
}
function newFormatSecrets() {
  return {
    tencent: { secretId: 'SID', secretKey: 'SK' },
    alibaba: { accessKeyId: 'AKID', accessKeySecret: 'AKS' },
    baidu: { appid: 'BA', key: 'BK' },
    youdao: { appKey: 'YK', appSecret: 'YS' }
  };
}
function patchProvider(id, impl, bucket) {
  bucket.push({ id: id, orig: global.TranslationProviders[id].translate });
  global.TranslationProviders[id].translate = impl;
}
function restoreProviders(bucket) {
  bucket.forEach(function (p) { global.TranslationProviders[p.id].translate = p.orig; });
}
function callMessage(msg, sender) {
  return new Promise(function (resolve) {
    listeners.onMessage(msg, sender || { id: 'test-extension-id' }, resolve);
  });
}

// ---------- 案例 ----------

async function main() {
  await new Promise(function (r) { setTimeout(r, 50); }); // 等待載入時的頂層 getSettings

  // ===== 存儲模組 =====
  await t('TC-A01', '舊格式自動遷移（settings 密鑰 → secrets）', async function () {
    resetStore();
    store.settings = legacySettings();
    await global.getSettings();
    assert(store.secrets && store.secrets.alibaba && store.secrets.alibaba.accessKeyId === 'OLD_AKID', 'secrets.alibaba 未寫入');
    assert(store.secrets.baidu && store.secrets.baidu.key === 'OLD_BK', 'secrets.baidu 未寫入');
    assert(!('accessKeyId' in store.settings.providers.alibaba), 'settings 仍殘留 accessKeyId');
    assert(!('secretKey' in store.settings.providers.tencent), 'settings 仍殘留 secretKey');
    assert(store.settings.providers.alibaba.region === 'cn-hangzhou', '非密鑰欄位 region 遺失');
    assert(store.settings.providers.tencent.enabled === true, 'enabled 遺失');
  });

  await t('TC-A02', 'saveSettings 拆分寫入（settings 無密鑰 + secrets 更新）', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    const merged = await global.getSettings();
    merged.providers.tencent.secretKey = 'NEW_SK';
    merged.sourceLang = 'en';
    await global.saveSettings(merged);
    assert(!('secretKey' in store.settings.providers.tencent), 'settings 殘留 secretKey');
    assert(store.secrets.tencent.secretKey === 'NEW_SK', 'secrets 未更新');
    assert(store.settings.sourceLang === 'en', 'sourceLang 未持久化');
    assert(!!store.settings.usage, 'usage 遺失');
  });

  await t('TC-A03', 'getSettings 合併讀取（密鑰來自 secrets、DEFAULTS 補全）', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.settings.providers.tencent.monthlyLimit = 1; // NON_PERSISTED，應被忽略
    store.secrets = newFormatSecrets();
    const merged = await global.getSettings();
    assert(merged.providers.alibaba.accessKeyId === 'AKID', '合併未取到 accessKeyId');
    assert(merged.providers.youdao.appSecret === 'YS', '合併未取到 appSecret');
    assert(merged.providers.tencent.monthlyLimit === 5000000, 'monthlyLimit 應為 DEFAULTS 值');
    assert(merged.sourceLang === 'auto', '一般設定合併錯誤');
  });

  await t('TC-A04', '遷移冪等（二次讀取不再觸發寫入）', async function () {
    resetStore();
    store.settings = legacySettings();
    await global.getSettings();
    const snap = JSON.stringify({ s: store.settings, k: store.secrets });
    await global.getSettings();
    assert(JSON.stringify({ s: store.settings, k: store.secrets }) === snap, '二次讀取產生額外寫入');
  });

  await t('TC-A05', '空存儲回傳 DEFAULTS', async function () {
    resetStore();
    const merged = await global.getSettings();
    assert(merged.enabled === true, 'enabled 預設');
    assert(merged.dblclickEnabled === false, 'dblclickEnabled 預設 false');
    assert(merged.hotkey && merged.hotkey.key === 't' && merged.hotkey.enabled === true, 'hotkey 預設');
    assert(merged.providerOrder.join(',') === 'tencent,alibaba,baidu,youdao', 'providerOrder 預設');
    assert(merged.providers.alibaba.region === 'cn-hangzhou', 'region 預設');
  });

  // ===== mergeSettings 模組 =====
  await t('TC-A06', 'providerOrder 正規化（剔除未知、補齊缺失）', async function () {
    resetStore();
    store.settings = newFormatSettings({ providerOrder: ['baidu', 'unknown-x', 'tencent'] });
    store.secrets = newFormatSecrets();
    const merged = await global.getSettings();
    assert(merged.providerOrder.join(',') === 'baidu,tencent,alibaba,youdao', '正規化結果錯誤: ' + merged.providerOrder.join(','));
  });

  // ===== 訊息層 =====
  await t('TC-A07', 'onMessage 拒絕未授權 sender', async function () {
    const res = await new Promise(function (resolve) {
      listeners.onMessage({ type: 'get-usage' }, { id: 'other-extension' }, resolve);
    });
    assert(res && res.ok === false && /未授權/.test(res.error), '未拒絕外部 sender: ' + JSON.stringify(res));
  });

  await t('TC-A08', 'get-usage 回傳四家摘要', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    const res = await callMessage({ type: 'get-usage' });
    assert(res && res.ok === true, 'ok 非真');
    ['tencent', 'alibaba', 'baidu', 'youdao'].forEach(function (id) {
      assert(res.usage[id] && res.usage[id].hasKey === true, id + ' hasKey 應為真');
    });
  });

  // ===== 翻譯鏈 =====
  await t('TC-A09', '空文本回覆「沒有選中文字」', async function () {
    const res = await global.translate('   ', 'auto', 'zh-TW');
    assert(res && res.ok === false && /沒有選中文字/.test(res.error), JSON.stringify(res));
  });

  await t('TC-A10', '總開關關閉回覆「翻譯功能已關閉」', async function () {
    resetStore();
    store.settings = newFormatSettings({ enabled: false });
    store.secrets = newFormatSecrets();
    const res = await global.translate('hello', 'auto', 'zh-TW');
    assert(res && res.ok === false && /已關閉/.test(res.error), JSON.stringify(res));
  });

  await t('TC-A11', '全部服務缺密鑰 → 逐家具體報錯（絕不靜默）', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = { tencent: {}, alibaba: {}, baidu: {}, youdao: {} };
    const res = await global.translate('unique-a11', 'auto', 'zh-TW');
    assert(res && res.ok === false, '應失敗');
    const err = res.error || '';
    assert(
      /騰訊雲：缺少/.test(err) && /阿里雲：缺少/.test(err) && /百度：缺少/.test(err) && /有道：缺少/.test(err),
      '應逐家具體報錯（errors 陣列未完整收集）: ' + err
    );
  });

  await t('TC-A12', '失敗自動切換下一家', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    const bucket = [];
    patchProvider('tencent', function () { return Promise.reject(new Error('騰訊雲：模擬失敗')); }, bucket);
    patchProvider('alibaba', function () { return Promise.resolve('阿里譯文'); }, bucket);
    try {
      const res = await global.translate('unique-a12', 'auto', 'zh-TW');
      assert(res.ok === true && res.provider === 'alibaba' && res.text === '阿里譯文', JSON.stringify(res));
    } finally { restoreProviders(bucket); }
  });

  await t('TC-A13', '額度類錯誤當月停用該服務', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    const bucket = [];
    patchProvider('tencent', function () { return Promise.reject(new Error('騰訊雲：餘額不足')); }, bucket);
    patchProvider('alibaba', function () { return Promise.resolve('備援譯文'); }, bucket);
    try {
      const res = await global.translate('unique-a13', 'auto', 'zh-TW');
      assert(res.ok === true, JSON.stringify(res));
      assert(store.settings.disabledProviders && store.settings.disabledProviders.tencent === monthKey(), 'disabledProviders 未標記');
    } finally { restoreProviders(bucket); }
  });

  await t('TC-A14', '相同文本命中緩存（cached 標記、不重複調用）', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    let calls = 0;
    const bucket = [];
    patchProvider('youdao', function (text) { calls++; return Promise.resolve('譯文' + text.length); }, bucket);
    try {
      const r1 = await global.translate('unique-a14', 'auto', 'zh-TW');
      const r2 = await global.translate('unique-a14', 'auto', 'zh-TW');
      assert(r1.ok && r2.ok && r2.cached === true, 'cached 標記錯誤');
      assert(calls === 1, '應只調用一次，實際 ' + calls);
    } finally { restoreProviders(bucket); }
  });

  await t('TC-A15', 'TEXT_MAX=5000 截斷（緩存鍵/歷史/Provider 一致）', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    let captured = '';
    const bucket = [];
    patchProvider('baidu', function (text) { captured = text; return Promise.resolve('OK'); }, bucket);
    try {
      const long = 'x'.repeat(6000);
      const res = await global.translate(long, 'auto', 'zh-TW');
      assert(res.ok === true, JSON.stringify(res));
      assert(captured.length === 5000, 'Provider 實收 ' + captured.length);
      assert(store.history && store.history[0] && store.history[0].text.length === 5000, '歷史未截斷');
      assert(store.history[0].text === captured, '歷史與實譯文本不一致');
    } finally { restoreProviders(bucket); }
  });

  await t('TC-A16', '歷史上限 1000', async function () {
    resetStore();
    store.settings = newFormatSettings();
    store.secrets = newFormatSecrets();
    store.history = [];
    for (let i = 0; i < 1000; i++) store.history.push({ id: 'h' + i, text: 't' + i, translation: '', provider: 'baidu', time: 0, fav: false });
    const bucket = [];
    patchProvider('baidu', function () { return Promise.resolve('OK'); }, bucket);
    try {
      const res = await global.translate('unique-a16', 'auto', 'zh-TW');
      assert(res.ok === true, JSON.stringify(res));
      assert(store.history.length === 1000, '歷史長度 ' + store.history.length);
      assert(store.history[0].text === 'unique-a16', '新記錄應在最前');
    } finally { restoreProviders(bucket); }
  });

  // ===== Provider 單元（fetch stub，不打真實 API） =====
  await t('TC-A17', '騰訊雲 TC3 頭與 payload 構造', async function () {
    let cap = null;
    fetchHandler = function (url, options) {
      cap = { url: url, o: options };
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ Response: { TargetText: 'T' } }); } });
    };
    try {
      const out = await global.TranslationProviders.tencent.translate('hi', 'en', 'zh-TW', { secretId: 'SID', secretKey: 'SK', region: 'ap-guangzhou' });
      assert(out === 'T', '回傳錯誤');
      assert(cap.url === 'https://tmt.tencentcloudapi.com/', 'URL 錯誤: ' + cap.url);
      assert(cap.o.headers['X-TC-Action'] === 'TextTranslate', 'Action 錯誤');
      assert(/^TC3-HMAC-SHA256 Credential=SID\//.test(cap.o.headers['Authorization']), 'Authorization 格式錯誤');
      const payload = JSON.parse(cap.o.body);
      assert(payload.SourceText === 'hi' && payload.Target === 'zh-TW' && payload.ProjectId === 0, 'payload 錯誤');
    } finally { fetchHandler = null; }
  });

  await t('TC-A18', '百度 MD5 簽名與參數', async function () {
    let cap = null;
    fetchHandler = function (url, options) {
      cap = { url: url, body: options.body };
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ trans_result: [{ dst: '你好' }] }); } });
    };
    try {
      const out = await global.TranslationProviders.baidu.translate('hi', 'en', 'zh-TW', { appid: 'BA', key: 'BK' });
      assert(out === '你好', '回傳錯誤');
      const p = new URLSearchParams(cap.body);
      const sign = global.TranslationMD5.md5('BA' + 'hi' + p.get('salt') + 'BK');
      assert(p.get('sign') === sign, 'MD5 簽名不符');
      assert(p.get('from') === 'en' && p.get('to') === 'cht', '語言參數錯誤');
    } finally { fetchHandler = null; }
  });

  await t('TC-A19', '有道 SHA-256 v3 簽名與參數', async function () {
    let cap = null;
    fetchHandler = function (url, options) {
      cap = { body: options.body };
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ errorCode: '0', translation: ['你好'] }); } });
    };
    try {
      const out = await global.TranslationProviders.youdao.translate('hi', 'en', 'zh-TW', { appKey: 'YK', appSecret: 'YS' });
      assert(out === '你好', '回傳錯誤');
      const p = new URLSearchParams(cap.body);
      const expect = crypto.createHash('sha256').update('YK' + 'hi' + p.get('salt') + p.get('curtime') + 'YS', 'utf8').digest('hex');
      assert(p.get('sign') === expect, 'SHA-256 簽名不符');
      assert(p.get('signType') === 'v3' && p.get('appKey') === 'YK', '參數錯誤');
    } finally { fetchHandler = null; }
  });

  await t('TC-A20', '阿里雲 POST 形狀（簽名在 body、URL 無參數）+ Code=200 成功', async function () {
    let cap = null;
    fetchHandler = function (url, options) {
      cap = { url: url, o: options };
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ Code: '200', Data: { Translated: 'A' } }); } });
    };
    try {
      const out = await global.TranslationProviders.alibaba.translate('hi', 'en', 'zh-TW', { accessKeyId: 'AKID', accessKeySecret: 'AKS', region: 'cn-hangzhou' });
      assert(out === 'A', '回傳錯誤');
      assert(cap.url === 'https://mt.cn-hangzhou.aliyuncs.com/', 'URL 應無 query: ' + cap.url);
      assert(cap.o.method === 'POST', '應為 POST');
      const body = cap.o.body;
      assert(/FormatType=text/.test(body) && /Scene=general/.test(body), '缺必填參數');
      assert(/TargetLanguage=zh-tw/.test(body), '目標語言應為小寫 zh-tw');
      assert(/Signature=/.test(body) && /AccessKeyId=AKID/.test(body), '簽名/密鑰應在 body');
    } finally { fetchHandler = null; }
  });

  await t('TC-A21', '阿里雲 Code 非 200 判錯', async function () {
    fetchHandler = function () {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ Code: '10005', Message: 'not support' }); } });
    };
    try {
      await global.TranslationProviders.alibaba.translate('hi', 'en', 'zh-TW', { accessKeyId: 'AKID', accessKeySecret: 'AKS' });
      throw new Error('應拋錯');
    } catch (e) {
      if (/應拋錯/.test(e.message)) throw e;
      assert(/阿里雲：10005 not support/.test(e.message), '錯誤訊息不符: ' + e.message);
    } finally { fetchHandler = null; }
  });

  await t('TC-A22', '阿里雲非 2xx 解析錯誤內文', async function () {
    fetchHandler = function () {
      return Promise.resolve({ ok: false, status: 400, json: function () { return Promise.resolve({ Code: 'MissingFormatType', Message: 'mandatory' }); } });
    };
    try {
      await global.TranslationProviders.alibaba.translate('hi', 'en', 'zh-TW', { accessKeyId: 'AKID', accessKeySecret: 'AKS' });
      throw new Error('應拋錯');
    } catch (e) {
      if (/應拋錯/.test(e.message)) throw e;
      assert(/MissingFormatType mandatory/.test(e.message), '未顯示真實錯誤碼: ' + e.message);
    } finally { fetchHandler = null; }
  });

  await t('TC-A23', '四家缺密鑰各自 bail', async function () {
    const cases = [
      ['tencent', { secretId: '', secretKey: '' }, /騰訊雲：缺少/],
      ['alibaba', { accessKeyId: '', accessKeySecret: '' }, /阿里雲：缺少/],
      ['baidu', { appid: '', key: '' }, /百度：缺少/],
      ['youdao', { appKey: '', appSecret: '' }, /有道：缺少/]
    ];
    for (const [id, cfg, re] of cases) {
      let threw = false;
      try { await global.TranslationProviders[id].translate('hi', 'auto', 'zh-TW', cfg); }
      catch (e) { threw = true; assert(re.test(e.message), id + ' 錯誤訊息不符: ' + e.message); }
      assert(threw, id + ' 未拋錯');
    }
  });

  await t('TC-A24', '騰訊 Error 回應判錯', async function () {
    fetchHandler = function () {
      return Promise.resolve({ ok: true, json: function () { return Promise.resolve({ Response: { Error: { Code: 'AuthFailure', Message: 'x' } } }); } });
    };
    try {
      await global.TranslationProviders.tencent.translate('hi', 'en', 'zh-TW', { secretId: 'SID', secretKey: 'SK' });
      throw new Error('應拋錯');
    } catch (e) {
      if (/應拋錯/.test(e.message)) throw e;
      assert(/騰訊雲：AuthFailure x/.test(e.message), '錯誤訊息不符: ' + e.message);
    } finally { fetchHandler = null; }
  });

  // ===== 共享模組與打包完整性 =====
  await t('TC-A25', 'selection-card 共享模組掛載（無 DOM 可載入、init 可呼叫）', async function () {
    const { join } = require('path');
    vm.runInThisContext(require('fs').readFileSync(join(ROOT, 'lib/selection-card.js'), 'utf8'), { filename: 'lib/selection-card.js' });
    assert(typeof global.TransHubCard === 'object' && typeof global.TransHubCard.init === 'function', 'TransHubCard.init 未掛載');
  });

  await t('TC-A26', 'PDF 來源白名單（僅 http(s)/file）', async function () {
    const { join } = require('path');
    vm.runInThisContext(require('fs').readFileSync(join(ROOT, 'lib/pdf-src.js'), 'utf8'), { filename: 'lib/pdf-src.js' });
    const resolve = global.TransHubPdfSrc.resolvePdfSource;
    const base = 'chrome-extension://test-extension-id/pdf-viewer.html';
    assert(resolve('https://a.com/x.pdf', base) === 'https://a.com/x.pdf', 'https 應通過');
    assert(resolve('http://a.com/x.pdf', base) === 'http://a.com/x.pdf', 'http 應通過');
    assert(resolve('file:///C:/doc.pdf', base) === 'file:///C:/doc.pdf', 'file 應通過');
    assert(resolve('javascript:alert(1)', base) === null, 'javascript: 應拒絕');
    assert(resolve('data:application/pdf;base64,xx', base) === null, 'data: 應拒絕');
    assert(resolve('chrome-extension://evil/x.pdf', base) === null, 'chrome-extension: 應拒絕');
    assert(resolve('', base) === null && resolve(null, base) === null && resolve('::::', base) === null, '空值/非法字串應拒絕');
  });

  await t('TC-A27', 'manifest 與 PDF 檢視器檔案完整性', async function () {
    const { join } = require('path');
    const m = JSON.parse(require('fs').readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
    assert(m.permissions.includes('activeTab'), '缺 activeTab');
    assert(!m.permissions.includes('scripting') && !m.permissions.includes('tabs'), '權限應最小化');
    assert(!m.host_permissions.some(function (h) { return h.indexOf('mt.aliyuncs.com') >= 0; }), '不應有通用 mt.aliyuncs.com');
    const cs = m.content_scripts[0];
    assert(cs.js[0] === 'lib/selection-card.js' && cs.js[1] === 'content.js', 'content_scripts 載入順序錯誤');
    ['pdf-viewer.html', 'pdf-viewer.js', 'lib/pdf-src.js', 'lib/pdfjs/pdf.min.js', 'lib/pdfjs/pdf.worker.min.js'].forEach(function (f) {
      assert(require('fs').existsSync(join(ROOT, f)), '缺檔案: ' + f);
    });
    // package.sh 打包清單完整性：檢視器相關檔案必須都在清單中
    const pkg = require('fs').readFileSync(join(ROOT, 'package.sh'), 'utf8');
    ['pdf-viewer.html', 'pdf-viewer.js', 'lib/selection-card.js', 'lib/pdf-src.js', 'lib/pdfjs/pdf.min.js', 'lib/pdfjs/pdf.worker.min.js'].forEach(function (f) {
      assert(pkg.indexOf(f) >= 0, 'package.sh 打包清單缺: ' + f);
    });
  });

  await t('TC-A28', 'isPdfUrl 判定（http/https/file + .pdf 路徑、忽略查詢串）', async function () {
    const { join } = require('path');
    vm.runInThisContext(require('fs').readFileSync(join(ROOT, 'lib/pdf-src.js'), 'utf8'), { filename: 'lib/pdf-src.js' });
    const isPdf = global.TransHubPdfSrc.isPdfUrl;
    assert(isPdf('https://a.com/doc.pdf') === true, 'https .pdf 應真');
    assert(isPdf('https://a.com/doc.PDF?x=1') === true, '大寫與查詢串應真');
    assert(isPdf('http://a.com/x/y.pdf#p=4') === true, 'hash 應真');
    assert(isPdf('file:///C:/dir/doc.pdf') === true, 'file 應真');
    assert(isPdf('https://a.com/page') === false, '非 .pdf 應假');
    assert(isPdf('https://a.com/doc.pdfx') === false, '.pdfx 應假');
    assert(isPdf('chrome://extensions/x.pdf') === false, 'chrome: 應假');
    assert(isPdf('javascript:alert(1)') === false, 'javascript: 應假');
    assert(isPdf('') === false && isPdf(null) === false && isPdf('not a url') === false, '空值/非法應假');
  });

  // ===== 總結 =====
  console.log('');
  console.log(failed === 0 ? '--- 全部 ' + results.length + ' 項自動案例通過 ---' : '--- ' + failed + ' / ' + results.length + ' 項自動案例失敗 ---');
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(function (e) {
  console.error('測試執行錯誤:', e);
  process.exit(1);
});
