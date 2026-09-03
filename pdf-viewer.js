/**
 * TransHub PDF 檢視器：本機打包的 PDF.js 渲染 + 文字層選區翻譯。
 * 來源：① header「選擇本機檔案」（FileReader，零權限）② popup「翻譯當前分頁 PDF」/ 右鍵連結（?src=，僅 http(s)/file 白名單）。
 */
'use strict';

(function () {
  var pdfjsLib = globalThis.pdfjsLib;
  pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('lib/pdfjs/pdf.worker.min.js');

  /** 校驗 ?src= 白名單：實作在 lib/pdf-src.js（僅允許 http(s)/file，防偽協議注入） */

  var viewerEl = document.getElementById('viewer');
  var statusEl = document.getElementById('status');
  var pageInfoEl = document.getElementById('pageInfo');
  var fileInput = document.getElementById('fileInput');
  var pdfDoc = null;
  var renderedPages = {};
  var observed = {};
  var observer = null;
  var currentFileLabel = '';

  function setStatus(msg) {
    statusEl.textContent = msg || '';
  }

  function clearViewer() {
    viewerEl.innerHTML = '';
    renderedPages = {};
    observed = {};
    if (observer) { observer.disconnect(); observer = null; }
    var hint = document.getElementById('emptyHint');
    if (hint) hint.remove();
    pageInfoEl.textContent = '';
  }

  function loadFromArrayBuffer(buf, label) {
    setStatus('解析中…');
    clearViewer();
    currentFileLabel = label || '';
    pdfjsLib.getDocument({ data: new Uint8Array(buf) }).promise.then(function (doc) {
      pdfDoc = doc;
      setStatus('');
      setupPages();
    }).catch(function (e) {
      setStatus('無法開啟 PDF：' + (e && e.message ? e.message : '格式錯誤或檔案已加密'));
    });
  }

  function loadFromUrl(url) {
    setStatus('下載 PDF 中…');
    fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.arrayBuffer();
    }).then(function (buf) {
      loadFromArrayBuffer(buf, decodeURIComponent(url.split('/').pop() || '遠端 PDF'));
    }).catch(function () {
      setStatus('無法下載此 PDF（可能為跨網域限制）。請先下載檔案，再用「選擇本機檔案」開啟。');
    });
  }

  function setupPages() {
    observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var n = Number(en.target.dataset.page);
          if (!renderedPages[n]) renderPage(n);
          pageInfoEl.textContent = currentFileLabel + '　第 ' + n + ' / ' + pdfDoc.numPages + ' 頁';
        }
      });
    }, { root: null, rootMargin: '400px 0px' });

    var containerWidth = Math.min(document.documentElement.clientWidth - 48, 1000);
    for (var i = 1; i <= pdfDoc.numPages; i++) {
      (function (pageNum) {
        var wrap = document.createElement('div');
        wrap.className = 'pageWrap';
        wrap.dataset.page = String(pageNum);
        viewerEl.appendChild(wrap);
        pdfDoc.getPage(pageNum).then(function (page) {
          var base = page.getViewport({ scale: 1 });
          var scale = Math.max(0.8, Math.min(2, containerWidth / base.width));
          var viewport = page.getViewport({ scale: scale });
          wrap.style.width = Math.floor(viewport.width) + 'px';
          wrap.style.height = Math.floor(viewport.height) + 'px';
          observed[pageNum] = { page: page, viewport: viewport };
          observer.observe(wrap);
          if (pageNum === pdfDoc.numPages) pageInfoEl.textContent = currentFileLabel + '　共 ' + pdfDoc.numPages + ' 頁';
        });
      })(i);
    }
  }

  function renderPage(pageNum) {
    var item = observed[pageNum];
    if (!item || renderedPages[pageNum]) return;
    renderedPages[pageNum] = true;
    var wrap = viewerEl.querySelector('.pageWrap[data-page="' + pageNum + '"]');
    if (!wrap) return;

    var canvas = document.createElement('canvas');
    var textLayer = document.createElement('div');
    textLayer.className = 'textLayer';
    wrap.appendChild(canvas);
    wrap.appendChild(textLayer);

    var viewport = item.viewport;
    var outputScale = window.devicePixelRatio || 1;
    canvas.width = Math.floor(viewport.width * outputScale);
    canvas.height = Math.floor(viewport.height * outputScale);
    canvas.style.width = Math.floor(viewport.width) + 'px';
    canvas.style.height = Math.floor(viewport.height) + 'px';

    item.page.render({ canvasContext: canvas.getContext('2d'), viewport: viewport, transform: outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null }).promise.then(function () {
      return item.page.getTextContent();
    }).then(function (textContent) {
      return pdfjsLib.renderTextLayer({
        textContentSource: textContent,
        container: textLayer,
        viewport: viewport
      }).promise;
    }).catch(function () {
      // 文字層失敗不影響畫面渲染，僅該頁無法選取
    });
  }

  document.getElementById('openLocal').addEventListener('click', function () { fileInput.click(); });
  document.getElementById('openLocal2').addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function () {
    var f = fileInput.files && fileInput.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function () { loadFromArrayBuffer(reader.result, f.name); };
    reader.readAsArrayBuffer(f);
  });

  TransHubCard.init();

  var src = TransHubPdfSrc.resolvePdfSource(new URLSearchParams(location.search).get('src'), chrome.runtime.getURL('/'));
  if (src) loadFromUrl(src);
})();
