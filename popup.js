'use strict';

var $ = function (id) { return document.getElementById(id); };

function fmt(n) {
  return n >= 10000 ? (n / 10000).toFixed(1) + '萬' : String(n);
}

function statusText(u) {
  if (!u.enabled) return '已停用';
  if (!u.hasKey) return '未配置';
  if (u.disabled) return '本月已停用（額度錯誤）';
  if (u.monthlyLimit > 0 && u.monthlyUsed >= u.monthlyLimit) return '已用盡';
  if (u.remainingChars === null || u.remainingChars === undefined) return '剩餘不限';
  return '剩餘 ' + fmt(u.remainingChars) + ' 字符 / ' + fmt(u.monthlyLimit);
}

function exceeded(u) {
  return (u.disabled && u.enabled && u.hasKey) ||
    (u.enabled && u.hasKey && u.monthlyLimit > 0 && u.monthlyUsed >= u.monthlyLimit);
}

function render(u) {
  var box = $('usage');
  box.innerHTML = '';
  Object.keys(u).forEach(function (id) {
    var item = u[id];
    var row = document.createElement('div');
    row.className = 'u-row';
    var name = document.createElement('span');
    name.className = 'u-name';
    name.textContent = item.name;
    if (!item.hasKey && item.enabled) {
      var warn = document.createElement('span');
      warn.className = 'nokey';
      warn.textContent = '未配置密鑰';
      name.appendChild(warn);
    }
    var quota = document.createElement('span');
    quota.className = 'u-quota' + (exceeded(item) ? ' exceeded' : '');
    quota.textContent = statusText(item);
    row.appendChild(name);
    row.appendChild(quota);
    box.appendChild(row);

    var calls = document.createElement('div');
    calls.className = 'u-calls';
    calls.textContent = '本月已調用 ' + (item.monthlyCalls || 0) + ' 次';
    box.appendChild(calls);
  });
}

chrome.runtime.sendMessage({ type: 'get-usage' }, function (res) {
  if (res && res.ok) render(res.usage);
});

chrome.runtime.sendMessage({ type: 'get-settings' }, function (res) {
  if (!res || !res.ok) return;
  var s = res.settings;
  $('enabled').checked = s.enabled;
  $('sourceLang').value = s.sourceLang;
  $('targetLang').value = s.targetLang;
});

$('enabled').addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'get-settings' }, function (res) {
    if (!res || !res.ok) return;
    res.settings.enabled = $('enabled').checked;
    chrome.runtime.sendMessage({ type: 'save-settings', settings: res.settings });
  });
});

$('sourceLang').addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'get-settings' }, function (res) {
    if (!res || !res.ok) return;
    res.settings.sourceLang = $('sourceLang').value;
    chrome.runtime.sendMessage({ type: 'save-settings', settings: res.settings });
  });
});

$('targetLang').addEventListener('change', function () {
  chrome.runtime.sendMessage({ type: 'get-settings' }, function (res) {
    if (!res || !res.ok) return;
    res.settings.targetLang = $('targetLang').value;
    chrome.runtime.sendMessage({ type: 'save-settings', settings: res.settings });
  });
});

$('openPdf').addEventListener('click', function () {
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    var tab = tabs && tabs[0];
    var url = tab && tab.url || '';
    var viewerUrl = chrome.runtime.getURL('pdf-viewer.html');
    if (globalThis.TransHubPdfSrc && TransHubPdfSrc.isPdfUrl(url)) {
      viewerUrl += '?src=' + encodeURIComponent(url);
    }
    chrome.tabs.create({ url: viewerUrl });
    window.close();
  });
});
