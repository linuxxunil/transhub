(function () {
  'use strict';

  var WORD_RE = /^[A-Za-z][A-Za-z''-]*$/;
  var card = null;
  var shadowHost = null;

  function getSelectionText() {
    var sel = window.getSelection();
    return sel ? sel.toString().trim() : '';
  }

  function wordAtPoint(x, y) {
    var range = document.caretRangeFromPoint(x, y);
    if (!range || !range.startContainer) return '';
    var node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';
    var text = node.textContent || '';
    var offset = range.startOffset;
    var start = offset;
    while (start > 0 && /[A-Za-z''-]/.test(text[start - 1])) start--;
    var end = offset;
    while (end < text.length && /[A-Za-z''-]/.test(text[end])) end++;
    var word = text.slice(start, end);
    return WORD_RE.test(word) ? word : '';
  }

  function sentenceAtPoint(x, y) {
    var range = document.caretRangeFromPoint(x, y);
    if (!range || !range.startContainer) return '';
    var node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return '';
    var text = node.textContent || '';
    var offset = range.startOffset;
    var start = 0;
    for (var i = offset - 1; i >= 0; i--) {
      if (/[.!?\u3002\uff01\uff1f\n]/.test(text[i])) { start = i + 1; break; }
    }
    var end = text.length;
    for (var j = offset; j < text.length; j++) {
      if (/[.!?\u3002\uff01\uff1f\n]/.test(text[j])) { end = j + 1; break; }
    }
    var sentence = text.slice(start, end).trim();
    if (sentence.length < 2 && node.parentElement) {
      sentence = (node.parentElement.textContent || '').trim().slice(0, 500);
    }
    return sentence.slice(0, 1000);
  }

  function ensureCard() {
    if (shadowHost) return card;
    shadowHost = document.createElement('div');
    shadowHost.style.cssText = 'position:fixed;z-index:2147483647;top:0;left:0;pointer-events:none;';
    var shadow = shadowHost.attachShadow({ mode: 'open' });
    var style = document.createElement('style');
    style.textContent = [
      ':host{all:initial}',
      '.card{pointer-events:auto;position:absolute;max-width:420px;min-width:160px;background:#ffffff;color:#222;',
      'border:1px solid #d0d4dc;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.18);',
      'font:13px/1.6 -apple-system,"Segoe UI","Microsoft JhengHei",sans-serif;padding:10px 12px;}',
      '.meta{font-size:11px;color:#8a8f99;margin-top:6px;display:flex;gap:8px;align-items:center;}',
      '.btns{margin-top:6px;display:flex;gap:8px;}',
      'button{all:unset;cursor:pointer;font-size:12px;color:#2563eb;padding:2px 4px;border-radius:4px;}',
      'button:hover{background:#eef2ff;}',
      '.err{color:#c0392b;}',
      '.close{margin-left:auto;color:#8a8f99;}'
    ].join('');
    shadow.appendChild(style);
    card = document.createElement('div');
    card.className = 'card';
    shadow.appendChild(card);
    document.documentElement.appendChild(shadowHost);
    return card;
  }

  function showCard(x, y, html) {
    var el = ensureCard();
    el.innerHTML = html;
    shadowHost.style.pointerEvents = 'none';
    var pad = 14;
    var left = Math.min(x + pad, window.innerWidth - 440);
    var top = Math.min(y + pad, window.innerHeight - 160);
    el.style.left = Math.max(8, left) + 'px';
    el.style.top = Math.max(8, top) + 'px';
    el.style.visibility = 'visible';
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function hideCard() {
    if (shadowHost) {
      shadowHost.remove();
      shadowHost = null;
      card = null;
    }
  }

  var lastResult = null;

  function renderResult(res) {
    lastResult = res;
    if (!card) return;
    var pos = { x: card._x, y: card._y };
    if (!res || !res.ok) {
      showCard(pos.x, pos.y, '<div class="err">翻譯失敗：' + esc(res && res.error || '未知錯誤') + '</div>' + btnsHtml());
      return;
    }
    var body = '<div class="translation">' + esc(res.text).replace(/\n/g, '<br>') + '</div>';
    var meta = '<div class="meta"><span>' + esc(res.providerName || res.provider) + '</span>' +
      (res.cached ? '<span>（緩存）</span>' : '') + '</div>';
    showCard(pos.x, pos.y, body + meta + btnsHtml());
  }

  function btnsHtml() {
    return '<div class="btns">' +
      '<button data-act="copy">複製</button>' +
      '<button data-act="fav">收藏</button>' +
      '<button data-act="close" class="close">關閉</button>' +
      '</div>';
  }

  function startTranslate(text, x, y) {
    if (!text) return;
    hideCard();
    var el = ensureCard();
    el._x = x;
    el._y = y;
    showCard(x, y, '<div>翻譯中…</div>');
    chrome.runtime.sendMessage({ type: 'translate', text: text }, function (res) {
      if (chrome.runtime.lastError) {
        renderResult({ ok: false, error: chrome.runtime.lastError.message });
        return;
      }
      renderResult(res);
    });
  }

  document.addEventListener('dblclick', function (e) {
    if (e.altKey) return;
    var target = e.target;
    if (target.closest && target.closest('input,textarea,[contenteditable],select')) return;
    var text = getSelectionText();
    if (!text) text = wordAtPoint(e.clientX, e.clientY);
    text = (text || '').trim();
    if (!text || text.length > 200) return;
    e.preventDefault();
    e.stopPropagation();
    startTranslate(text, e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function (e) {
    if (!e.altKey && !e.metaKey) return;
    if (shadowHost && shadowHost.contains(e.target)) return;
    var target = e.target;
    if (target.closest && target.closest('input,textarea,[contenteditable],select')) return;
    if (e.metaKey && !e.altKey && target.closest && target.closest('a')) return;
    var text = getSelectionText();
    if (!text) text = sentenceAtPoint(e.clientX, e.clientY);
    text = (text || '').trim();
    if (!text || text.length > 1000) return;
    e.preventDefault();
    e.stopPropagation();
    startTranslate(text, e.clientX, e.clientY);
  }, true);

  document.addEventListener('click', function (e) {
    if (!shadowHost) return;
    if (shadowHost.contains(e.target)) {
      var btn = e.composedPath ? e.composedPath().find(function (n) { return n.tagName === 'BUTTON' && n.dataset && n.dataset.act; }) : null;
      if (btn && card) {
        var act = btn.dataset.act;
        if (act === 'close') hideCard();
        else if (act === 'copy' && lastResult && lastResult.text) {
          navigator.clipboard.writeText(lastResult.text);
          btn.textContent = '已複製';
          setTimeout(function () { btn.textContent = '複製'; }, 1200);
        } else if (act === 'fav' && lastResult && lastResult.ok) {
          chrome.runtime.sendMessage({ type: 'fav-last' });
          btn.textContent = '已收藏';
        }
      }
      return;
    }
    hideCard();
  }, true);

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') hideCard();
  });

  var hotkeyCfg = { enabled: true, key: 't', windowMs: 600 };
  var lastTap = { key: '', time: 0 };

  function loadHotkeyCfg() {
    chrome.storage.local.get({ settings: null }, function (res) {
      var s = res.settings;
      if (!s || !s.hotkey || typeof s.hotkey !== 'object') return;
      hotkeyCfg = {
        enabled: !!s.hotkey.enabled,
        key: String(s.hotkey.key || 't').slice(0, 1).toLowerCase(),
        windowMs: Number(s.hotkey.windowMs) || 600
      };
    });
  }
  loadHotkeyCfg();
  if (chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener(function (changes, area) {
      if (area === 'local' && changes.settings) loadHotkeyCfg();
    });
  }

  function selectionRect() {
    var sel = window.getSelection();
    if (sel && sel.rangeCount) {
      var r = sel.getRangeAt(0).getBoundingClientRect();
      if (r && (r.width || r.height)) return r;
    }
    return null;
  }

  document.addEventListener('keydown', function (e) {
    if (e.repeat) { lastTap.key = ''; lastTap.time = 0; return; }
    if (e.ctrlKey || e.altKey || e.metaKey) return;
    if (!hotkeyCfg.enabled) return;
    var target = e.target;
    if (target.closest && target.closest('input,textarea,[contenteditable],select')) return;
    var k = (e.key || '').toLowerCase();
    if (k.length !== 1) return;
    if (k !== hotkeyCfg.key) { lastTap.key = ''; return; }
    var now = Date.now();
    if (lastTap.key === k && now - lastTap.time <= hotkeyCfg.windowMs) {
      lastTap.key = '';
      lastTap.time = 0;
      var text = getSelectionText().trim();
      if (!text || text.length > 1000) return;
      e.preventDefault();
      var r = selectionRect();
      var x = r ? Math.min(r.right, window.innerWidth - 30) : window.innerWidth / 3;
      var y = r ? Math.min(r.bottom + 8, window.innerHeight - 100) : window.innerHeight / 3;
      startTranslate(text, x, y);
    } else {
      lastTap.key = k;
      lastTap.time = now;
    }
  }, true);

  chrome.runtime.onMessage.addListener(function (msg, sender, sendResponse) {
    if (msg && msg.type === 'translate-selection') {
      var text = getSelectionText();
      if (text) startTranslate(text, window.innerWidth / 3, window.innerHeight / 3);
      sendResponse({ ok: !!text });
    }
    return false;
  });
})();
