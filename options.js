'use strict';

var $ = function (id) { return document.getElementById(id); };
var settings = null;

var PROVIDER_FIELDS = {
  tencent: ['enabled', 'secretId', 'secretKey'],
  alibaba: ['enabled', 'accessKeyId', 'accessKeySecret'],
  baidu: ['enabled', 'appid', 'key'],
  youdao: ['enabled', 'appKey', 'appSecret']
};

var SECRET_FIELDS = [
  'tencent-secretId', 'tencent-secretKey',
  'alibaba-accessKeyId', 'alibaba-accessKeySecret',
  'baidu-appid', 'baidu-key',
  'youdao-appKey', 'youdao-appSecret'
];
var REVEAL_MS = 3000;
var revealTimers = {};

function setupSecretMasking() {
  SECRET_FIELDS.forEach(function (fid) {
    var el = $(fid);
    if (!el) return;
    el.type = 'password';
    el.addEventListener('input', function () {
      el.type = 'text';
      if (revealTimers[fid]) clearTimeout(revealTimers[fid]);
      revealTimers[fid] = setTimeout(function () { el.type = 'password'; }, REVEAL_MS);
    });
    el.addEventListener('blur', function () {
      if (revealTimers[fid]) clearTimeout(revealTimers[fid]);
      el.type = 'password';
    });
  });
}

function send(msg) {
  return new Promise(function (resolve) {
    chrome.runtime.sendMessage(msg, resolve);
  });
}

function load() {
  send({ type: 'get-settings' }).then(function (res) {
    if (!res || !res.ok) return;
    settings = res.settings;
    fillBasic();
    fillProviders();
    renderProviderOrder();
  });
  loadHistory();
}

function renderProviderOrder() {
  var list = $('providerList');
  if (!list || !settings || !settings.providerOrder) return;
  settings.providerOrder.forEach(function (pid, idx) {
    var el = list.querySelector('.provider[data-pid="' + pid + '"]');
    if (!el) return;
    list.appendChild(el);
    var h3 = el.querySelector('h3');
    var name = h3.getAttribute('data-name');
    h3.textContent = '';
    var badge = document.createElement('span');
    badge.className = 'ord-badge';
    badge.textContent = String(idx + 1);
    h3.appendChild(badge);
    h3.appendChild(document.createTextNode(name));
    var btns = document.createElement('span');
    btns.className = 'ord-btns';
    var up = document.createElement('button');
    up.textContent = '↑ 上移';
    up.addEventListener('click', function () { moveProvider(pid, -1); });
    var down = document.createElement('button');
    down.textContent = '↓ 下移';
    down.addEventListener('click', function () { moveProvider(pid, 1); });
    if (idx === 0) up.disabled = true;
    if (idx === settings.providerOrder.length - 1) down.disabled = true;
    btns.appendChild(up);
    btns.appendChild(down);
    h3.appendChild(btns);
  });
}

function moveProvider(pid, dir) {
  var order = settings.providerOrder.slice();
  var i = order.indexOf(pid);
  var j = i + dir;
  if (i < 0 || j < 0 || j >= order.length) return;
  order.splice(j, 0, order.splice(i, 1)[0]);
  settings.providerOrder = order;
  send({ type: 'save-settings', settings: settings }).then(function () {
    showStatus('providerStatus', true, '順序已更新');
    setTimeout(function () { $('providerStatus').textContent = ''; }, 1500);
    renderProviderOrder();
  });
}

function fillBasic() {
  $('enabled').checked = settings.enabled;
  $('dblclick-enabled').checked = !!settings.dblclickEnabled;
  $('sourceLang').value = settings.sourceLang;
  $('targetLang').value = settings.targetLang;
  var hk = settings.hotkey || { enabled: true, key: 't' };
  $('hotkey-enabled').checked = !!hk.enabled;
  $('hotkey-key').value = hk.key || 't';
}

function fillProviders() {
  Object.keys(PROVIDER_FIELDS).forEach(function (pid) {
    PROVIDER_FIELDS[pid].forEach(function (field) {
      var el = $(pid + '-' + field);
      if (!el) return;
      var v = settings.providers[pid][field];
      if (el.type === 'checkbox') el.checked = !!v;
      else el.value = v == null ? '' : v;
    });
  });
}

function collectProviders() {
  Object.keys(PROVIDER_FIELDS).forEach(function (pid) {
    PROVIDER_FIELDS[pid].forEach(function (field) {
      var el = $(pid + '-' + field);
      if (!el) return;
      if (el.type === 'checkbox') settings.providers[pid][field] = el.checked;
      else if (el.type === 'number') settings.providers[pid][field] = Number(el.value) || 0;
      else settings.providers[pid][field] = el.value.trim();
    });
  });
}

function showStatus(id, ok, text) {
  var el = $(id);
  el.className = 'status ' + (ok ? 'ok' : 'err');
  el.textContent = text;
}

$('saveBasic').addEventListener('click', function () {
  settings.enabled = $('enabled').checked;
  settings.dblclickEnabled = $('dblclick-enabled').checked;
  settings.sourceLang = $('sourceLang').value;
  settings.targetLang = $('targetLang').value;
  var hk = settings.hotkey || (settings.hotkey = {});
  hk.enabled = $('hotkey-enabled').checked;
  hk.key = ($('hotkey-key').value || 't').slice(0, 1).toLowerCase();
  hk.windowMs = 600;
  send({ type: 'save-settings', settings: settings }).then(function () {
    showStatus('basicStatus', true, '已保存');
    setTimeout(function () { $('basicStatus').textContent = ''; }, 1500);
  });
});

$('saveProviders').addEventListener('click', function () {
  collectProviders();
  send({ type: 'save-settings', settings: settings }).then(function () {
    showStatus('providerStatus', true, '已保存');
    setTimeout(function () { $('providerStatus').textContent = ''; }, 1500);
  });
});

document.querySelectorAll('button[data-test]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var pid = btn.dataset.test;
    collectProviders();
    send({ type: 'save-settings', settings: settings }).then(function () {
      showStatus(pid + '-status', true, '測試中…');
      return send({ type: 'test-provider', provider: pid });
    }).then(function (res) {
      if (res && res.ok) showStatus(pid + '-status', true, '成功：' + res.text);
      else showStatus(pid + '-status', false, '失敗：' + (res && res.error || '未知錯誤'));
    });
  });
});

function fmtNum(n) {
  return n >= 10000 ? (n / 10000).toFixed(1) + '萬' : String(n);
}

function usageStatusText(u) {
  if (!u.enabled) return '已停用';
  if (!u.hasKey) return '未配置';
  if (u.disabled) return '本月已停用（額度錯誤）';
  if (u.monthlyLimit > 0 && u.monthlyUsed >= u.monthlyLimit) return '已用盡';
  return '啟用中';
}

function loadUsage() {
  send({ type: 'get-usage' }).then(function (res) {
    if (!res || !res.ok) return;
    var tbody = $('usageTable').querySelector('tbody');
    tbody.innerHTML = '';
    Object.keys(res.usage).forEach(function (id) {
      var u = res.usage[id];
      var tr = document.createElement('tr');
      var tdName = document.createElement('td');
      tdName.textContent = u.name;
      var tdStatus = document.createElement('td');
      tdStatus.textContent = usageStatusText(u);
      if (usageStatusText(u) !== '啟用中') tdStatus.style.color = '#c0392b';
      if (usageStatusText(u) === '未配置') tdStatus.style.color = '#b45309';
      var tdQuota = document.createElement('td');
      if (!u.enabled) tdQuota.textContent = '-';
      else if (u.remainingChars === null || u.remainingChars === undefined) tdQuota.textContent = '不限';
      else if (u.monthlyLimit > 0 && u.monthlyUsed >= u.monthlyLimit) tdQuota.textContent = '已用盡';
      else tdQuota.textContent = fmtNum(u.remainingChars) + ' / ' + fmtNum(u.monthlyLimit);
      var tdCalls = document.createElement('td');
      tdCalls.textContent = String(u.monthlyCalls || 0) + ' 次';
      tr.appendChild(tdName);
      tr.appendChild(tdStatus);
      tr.appendChild(tdQuota);
      tr.appendChild(tdCalls);
      tbody.appendChild(tr);
    });
  });
}

$('refreshUsage').addEventListener('click', loadUsage);

$('hotkey-key').addEventListener('input', function () {
  var el = $('hotkey-key');
  el.value = el.value.slice(0, 1).toLowerCase();
});

function loadHistory() {
  send({ type: 'get-history' }).then(function (res) {
    if (!res || !res.ok) return;
    renderHistory(res.history);
  });
}

function fmtTime(t) {
  var d = new Date(t);
  return d.toLocaleString();
}

function renderHistory(items) {
  var keyword = ($('search').value || '').toLowerCase();
  var tbody = $('historyTable').querySelector('tbody');
  tbody.innerHTML = '';
  items.filter(function (h) {
    if (!keyword) return true;
    return h.text.toLowerCase().indexOf(keyword) >= 0 || h.translation.toLowerCase().indexOf(keyword) >= 0;
  }).forEach(function (h) {
    var tr = document.createElement('tr');
    var tdFav = document.createElement('td');
    tdFav.className = 'fav';
    tdFav.textContent = h.fav ? '★' : '☆';
    tdFav.addEventListener('click', function () {
      send({ type: 'toggle-fav', id: h.id, fav: !h.fav }).then(loadHistory);
    });
    var tdText = document.createElement('td');
    tdText.textContent = h.text;
    var tdTrans = document.createElement('td');
    tdTrans.textContent = h.translation;
    var tdProv = document.createElement('td');
    tdProv.textContent = h.provider;
    var tdTime = document.createElement('td');
    tdTime.textContent = fmtTime(h.time);
    var tdDel = document.createElement('td');
    var del = document.createElement('span');
    del.className = 'del';
    del.textContent = '刪除';
    del.addEventListener('click', function () {
      send({ type: 'delete-history', id: h.id }).then(loadHistory);
    });
    tdDel.appendChild(del);
    tr.appendChild(tdFav);
    tr.appendChild(tdText);
    tr.appendChild(tdTrans);
    tr.appendChild(tdProv);
    tr.appendChild(tdTime);
    tr.appendChild(tdDel);
    tbody.appendChild(tr);
  });
}

$('search').addEventListener('input', loadHistory);

$('clearHistory').addEventListener('click', function () {
  if (!confirm('確定清空所有翻譯歷史？')) return;
  send({ type: 'clear-history' }).then(loadHistory);
});

$('exportHistory').addEventListener('click', function () {
  send({ type: 'get-history' }).then(function (res) {
    if (!res || !res.ok) return;
    var blob = new Blob([JSON.stringify(res.history, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'translation-history.json';
    a.click();
    URL.revokeObjectURL(url);
  });
});

setupSecretMasking();
load();
loadUsage();
