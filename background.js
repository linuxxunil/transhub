'use strict';

importScripts('lib/md5.js', 'lib/providers.js');

var PROVIDER_ORDER = ['tencent', 'alibaba', 'baidu', 'youdao'];
var HISTORY_MAX = 1000;
var cache = new Map();

var QUOTA_ERROR_RE = /免費額度|免费额度|額度已用|额度已用|額度用盡|额度用尽|額度不足|额度不足|配額|配额|quota|餘額不足|余额不足|欠費|欠费|停服|已被停用|insufficient|ResourceExhausted/i;

var DEFAULTS = {
  enabled: true,
  sourceLang: 'auto',
  targetLang: 'zh-TW',
  hotkey: { enabled: true, key: 't', windowMs: 600 },
  providerOrder: PROVIDER_ORDER.slice(),
  providers: {
    tencent: {
      enabled: true, secretId: '', secretKey: '', region: 'ap-guangzhou',
      monthlyLimit: 5000000, dailyLimit: 0
    },
    alibaba: {
      enabled: true, accessKeyId: '', accessKeySecret: '', region: 'cn-hangzhou',
      monthlyLimit: 1000000, dailyLimit: 0
    },
    baidu: {
      enabled: true, appid: '', key: '',
      monthlyLimit: 1000000, dailyLimit: 0
    },
    youdao: {
      enabled: true, appKey: '', appSecret: '',
      monthlyLimit: 500000, dailyLimit: 0
    }
  },
  usage: {}
};

function monthKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function dayKey() {
  var d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

var NON_PERSISTED_PROVIDER_FIELDS = { monthlyLimit: 1, dailyLimit: 1 };

function normalizeOrder(order) {
  var out = [];
  (order || []).forEach(function (id) {
    if (TranslationProviders[id] && out.indexOf(id) < 0) out.push(id);
  });
  PROVIDER_ORDER.forEach(function (id) {
    if (out.indexOf(id) < 0) out.push(id);
  });
  return out;
}

function getSettings() {
  return chrome.storage.local.get({ settings: null }).then(function (res) {
    var s = res.settings;
    if (!s) return structuredClone(DEFAULTS);
    var merged = structuredClone(DEFAULTS);
    for (var k in s) {
      if (k === 'providers') continue;
      merged[k] = s[k];
    }
    var savedProviders = s.providers || {};
    for (var p in DEFAULTS.providers) {
      var clean = {};
      var saved = savedProviders[p] || {};
      for (var f in saved) {
        if (NON_PERSISTED_PROVIDER_FIELDS[f]) continue;
        clean[f] = saved[f];
      }
      merged.providers[p] = Object.assign({}, DEFAULTS.providers[p], clean);
    }
    merged.providerOrder = normalizeOrder(s.providerOrder || (s.providers ? Object.keys(savedProviders) : null));
    merged.usage = s.usage || {};
    merged.disabledProviders = s.disabledProviders || {};
    return merged;
  });
}

function saveSettings(settings) {
  return chrome.storage.local.set({ settings: settings });
}

function recordUsage(settings, providerId, chars) {
  var m = monthKey();
  var d = dayKey();
  if (!settings.usage[m]) settings.usage[m] = {};
  settings.usage[m][providerId] = (settings.usage[m][providerId] || 0) + chars;
  settings.usage[m][providerId + ':calls'] = (settings.usage[m][providerId + ':calls'] || 0) + 1;
  var dayBucket = settings.usage['__daily__'] || (settings.usage['__daily__'] = {});
  if (!dayBucket[d]) dayBucket[d] = {};
  dayBucket[d][providerId] = (dayBucket[d][providerId] || 0) + chars;
  for (var day in dayBucket) {
    if (day !== d) delete dayBucket[day];
  }
  for (var mk in settings.usage) {
    if (mk !== m && mk !== '__daily__') delete settings.usage[mk];
  }
}

function quotaLeft(settings, providerId) {
  var cfg = settings.providers[providerId];
  if (!cfg) return false;
  if (settings.disabledProviders && settings.disabledProviders[providerId] === monthKey()) return false;
  var m = settings.usage[monthKey()] || {};
  var d = (settings.usage['__daily__'] || {})[dayKey()] || {};
  if (cfg.monthlyLimit > 0 && (m[providerId] || 0) >= cfg.monthlyLimit) return false;
  if (cfg.dailyLimit > 0 && (d[providerId] || 0) >= cfg.dailyLimit) return false;
  return true;
}

function markQuotaError(settings, providerId) {
  if (!settings.disabledProviders) settings.disabledProviders = {};
  settings.disabledProviders[providerId] = monthKey();
}

function getUsageSummary() {
  return getSettings().then(function (s) {
    var m = s.usage[monthKey()] || {};
    var d = (s.usage['__daily__'] || {})[dayKey()] || {};
    var out = {};
    (s.providerOrder || PROVIDER_ORDER).forEach(function (id) {
      var cfg = s.providers[id];
      out[id] = {
        name: TranslationProviders[id].name,
        enabled: cfg.enabled,
        monthlyUsed: m[id] || 0,
        monthlyLimit: cfg.monthlyLimit,
        dailyUsed: d[id] || 0,
        dailyLimit: cfg.dailyLimit,
        hasKey: providerHasKey(id, cfg),
        monthlyCalls: m[id + ':calls'] || 0,
        disabled: !!(s.disabledProviders && s.disabledProviders[id] === monthKey()),
        remainingChars: cfg.monthlyLimit > 0 ? Math.max(0, cfg.monthlyLimit - (m[id] || 0)) : null
      };
    });
    return out;
  });
}

function providerHasKey(id, cfg) {
  switch (id) {
    case 'tencent': return !!(cfg.secretId && cfg.secretKey);
    case 'alibaba': return !!(cfg.accessKeyId && cfg.accessKeySecret);
    case 'baidu': return !!(cfg.appid && cfg.key);
    case 'youdao': return !!(cfg.appKey && cfg.appSecret);
  }
  return false;
}

function translateWithProvider(id, text, source, target, settings) {
  var p = TranslationProviders[id];
  var cfg = settings.providers[id];
  return p.translate(text, source, target, cfg).then(function (result) {
    recordUsage(settings, id, text.length);
    return { text: result, provider: id, providerName: p.name };
  });
}

function translate(text, source, target) {
  text = (text || '').trim();
  if (!text) return Promise.resolve({ ok: false, error: '沒有選中文字' });
  var cacheKey = source + '>' + target + '>' + text;
  if (cache.has(cacheKey)) {
    var c = cache.get(cacheKey);
    return Promise.resolve({ ok: true, text: c.text, provider: c.provider, providerName: c.providerName, cached: true });
  }
  return getSettings().then(function (settings) {
    if (!settings.enabled) return { ok: false, error: '翻譯功能已關閉' };
    var src = source || settings.sourceLang || 'auto';
    var tgt = target || settings.targetLang || 'zh-TW';
    var errors = [];
    var chain = Promise.reject(null);
    (settings.providerOrder || PROVIDER_ORDER).forEach(function (id) {
      chain = chain.catch(function () {
        var cfg = settings.providers[id];
        if (!cfg || !cfg.enabled) return Promise.reject(null);
        if (!quotaLeft(settings, id)) {
          errors.push(TranslationProviders[id].name + '：額度已用盡或已停用');
          return Promise.reject(null);
        }
        return translateWithProvider(id, text, src, tgt, settings).catch(function (err) {
          var msg = err && err.message ? err.message : String(err);
          if (QUOTA_ERROR_RE.test(msg)) {
            markQuotaError(settings, id);
            errors.push(TranslationProviders[id].name + '：檢測到額度類錯誤，本月已停用（' + msg + '）');
          } else if (!/額度已用盡/.test(msg)) {
            errors.push(msg);
          }
          throw err;
        });
      });
    });
    return chain.then(function (result) {
      cache.set(cacheKey, result);
      if (cache.size > 500) cache.delete(cache.keys().next().value);
      return addHistory(text, result.text, result.provider, src, tgt).then(function () {
        return saveSettings(settings).then(function () {
          return { ok: true, text: result.text, provider: result.provider, providerName: result.providerName };
        });
      });
    }).catch(function () {
      var resp = { ok: false, error: errors.length ? errors.join('；') : '所有翻譯服務均不可用' };
      return saveSettings(settings).then(function () { return resp; });
    });
  });
}

function addHistory(text, translation, provider, from, to) {
  return chrome.storage.local.get({ history: [] }).then(function (res) {
    var h = res.history;
    h.unshift({
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      text: text,
      translation: translation,
      provider: provider,
      from: from,
      to: to,
      time: Date.now(),
      fav: false
    });
    if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
    return chrome.storage.local.set({ history: h });
  });
}

chrome.runtime.onInstalled.addListener(function () {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻譯選中文字',
    contexts: ['selection']
  });
  getSettings().then(saveSettings);
});

chrome.contextMenus.onClicked.addListener(function (info, tab) {
  if (info.menuItemId === 'translate-selection' && tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'translate-selection' }).catch(function () {});
  }
});

chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
  var responded = false;
  function respond(payload) {
    if (responded) return;
    responded = true;
    try { sendResponse(payload); } catch (e) {}
  }
  function run() {
    switch (msg && msg.type) {
      case 'translate':
        return translate(msg.text, msg.source, msg.target);
      case 'get-settings':
        return getSettings().then(function (s) { return { ok: true, settings: s }; });
      case 'save-settings':
        return saveSettings(msg.settings).then(function () { return { ok: true }; });
      case 'get-usage':
        return getUsageSummary().then(function (u) { return { ok: true, usage: u }; });
      case 'get-history':
        return chrome.storage.local.get({ history: [] }).then(function (res) {
          return { ok: true, history: res.history };
        });
      case 'fav-last':
        return chrome.storage.local.get({ history: [] }).then(function (res) {
          if (res.history.length) res.history[0].fav = true;
          return chrome.storage.local.set({ history: res.history });
        }).then(function () { return { ok: true }; });
      case 'clear-history':
        return chrome.storage.local.set({ history: [] }).then(function () { return { ok: true }; });
      case 'toggle-fav':
        return chrome.storage.local.get({ history: [] }).then(function (res) {
          res.history.forEach(function (h) { if (h.id === msg.id) h.fav = !!msg.fav; });
          return chrome.storage.local.set({ history: res.history });
        }).then(function () { return { ok: true }; });
      case 'delete-history':
        return chrome.storage.local.get({ history: [] }).then(function (res) {
          res.history = res.history.filter(function (h) { return h.id !== msg.id; });
          return chrome.storage.local.set({ history: res.history });
        }).then(function () { return { ok: true }; });
      case 'test-provider':
        return getSettings().then(function (s) {
          var id = msg.provider;
          if (!TranslationProviders[id]) return { ok: false, error: '未知服務' };
          return Promise.resolve().then(function () {
            return translateWithProvider(id, 'hello', 'en', s.targetLang || 'zh-TW', s);
          }).then(function (r) {
            return saveSettings(s).then(function () {
              return { ok: true, text: r.text, providerName: r.providerName };
            });
          });
        });
      default:
        return null;
    }
  }
  Promise.resolve().then(run).then(function (result) {
    if (result !== null && result !== undefined) respond(result);
  }).catch(function (err) {
    respond({ ok: false, error: err && err.message ? err.message : String(err) });
  });
  return true;
});
