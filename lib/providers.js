(function (global) {
  'use strict';

  var enc = new TextEncoder();

  function toHex(buf) {
    return Array.from(new Uint8Array(buf)).map(function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');
  }

  function sha256Hex(msg) {
    return crypto.subtle.digest('SHA-256', enc.encode(msg)).then(toHex);
  }

  function hmac256(keyBytes, msg) {
    return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(msg)); });
  }

  function hmac256Str(key, msg) {
    return hmac256(enc.encode(key), msg);
  }

  function hmacSha1Raw(key, msg) {
    return crypto.subtle.importKey('raw', enc.encode(key), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
      .then(function (k) { return crypto.subtle.sign('HMAC', k, enc.encode(msg)); });
  }

  function md5(msg) {
    return global.TranslationMD5.md5(msg);
  }

  var FETCH_TIMEOUT_MS = 15000;

  function fetchWithTimeout(url, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, FETCH_TIMEOUT_MS);
    options = options || {};
    options.signal = controller.signal;
    return fetch(url, options).finally(function () { clearTimeout(timer); });
  }

  function formPost(url, params) {
    return fetchWithTimeout(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams(params).toString()
    }).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }

  function bail(msg) {
    throw new Error(msg);
  }

  var LANG = {
    baidu: { 'zh-TW': 'cht', 'zh': 'zh', 'en': 'en', 'ja': 'jp', 'ko': 'kor', 'auto': 'auto' },
    youdao: { 'zh-TW': 'zh-CHT', 'zh': 'zh-CHS', 'en': 'en', 'ja': 'ja', 'ko': 'ko', 'auto': 'auto' },
    tencent: { 'zh-TW': 'zh-TW', 'zh': 'zh', 'en': 'en', 'ja': 'ja', 'ko': 'ko', 'auto': 'auto' },
    alibaba: { 'zh-TW': 'zh-TW', 'zh': 'zh', 'en': 'en', 'ja': 'ja', 'ko': 'ko', 'auto': 'auto' }
  };

  function mapLang(map, lang) {
    return map[lang] || map['auto'] || 'auto';
  }

  var providers = {
    baidu: {
      name: '百度翻譯',
      langs: LANG.baidu,
      translate: function (text, source, target, cfg) {
        if (!cfg.appid || !cfg.key) bail('百度：缺少 APPID 或密鑰');
        var salt = String(Math.floor(Math.random() * 1e9));
        var sign = md5(cfg.appid + text + salt + cfg.key);
        return formPost('https://fanyi-api.baidu.com/api/trans/vip/translate', {
          q: text, from: mapLang(LANG.baidu, source), to: mapLang(LANG.baidu, target),
          appid: cfg.appid, salt: salt, sign: sign
        }).then(function (data) {
          if (data.error_code) bail('百度：' + data.error_code + ' ' + (data.error_msg || ''));
          if (!data.trans_result || !data.trans_result.length) bail('百度：無結果');
          return data.trans_result.map(function (r) { return r.dst; }).join('\n');
        });
      }
    },

    youdao: {
      name: '有道翻譯',
      langs: LANG.youdao,
      translate: function (text, source, target, cfg) {
        if (!cfg.appKey || !cfg.appSecret) bail('有道：缺少 AppKey 或密鑰');
        var salt = String(Math.floor(Math.random() * 1e9));
        var curtime = String(Math.floor(Date.now() / 1000));
        var input = text.length <= 20 ? text : (text.slice(0, 10) + text.length + text.slice(-10));
        return sha256Hex(cfg.appKey + input + salt + curtime + cfg.appSecret).then(function (sign) {
          return formPost('https://openapi.youdao.com/api', {
            q: text, from: mapLang(LANG.youdao, source), to: mapLang(LANG.youdao, target),
            appKey: cfg.appKey, salt: salt, curtime: curtime, sign: sign, signType: 'v3'
          });
        }).then(function (data) {
          if (String(data.errorCode) !== '0') {
            var YOUDAO_ERRORS = {
              '401': '賬戶信息不合法',
              '402': '訪問頻率受限',
              '411': '賬戶餘額不足',
              '412': '賬戶已被停用'
            };
            bail('有道：errorCode ' + data.errorCode + (YOUDAO_ERRORS[String(data.errorCode)] ? ' ' + YOUDAO_ERRORS[String(data.errorCode)] : ''));
          }
          if (!data.translation || !data.translation.length) bail('有道：無結果');
          return data.translation.join('\n');
        });
      }
    },

    tencent: {
      name: '騰訊雲',
      langs: LANG.tencent,
      translate: function (text, source, target, cfg) {
        if (!cfg.secretId || !cfg.secretKey) bail('騰訊雲：缺少 SecretId 或 SecretKey');
        var host = 'tmt.tencentcloudapi.com';
        var service = 'tmt';
        var region = cfg.region || 'ap-guangzhou';
        var timestamp = Math.floor(Date.now() / 1000);
        var date = new Date(timestamp * 1000).toISOString().slice(0, 10);
        var payload = JSON.stringify({
          SourceText: text,
          Source: mapLang(LANG.tencent, source),
          Target: mapLang(LANG.tencent, target),
          ProjectId: 0
        });
        return sha256Hex(payload).then(function (hashedPayload) {
          var canonical = 'POST\n/\n\n' +
            'content-type:application/json; charset=utf-8\n' +
            'host:' + host + '\n' +
            '\n' +
            'content-type;host\n' +
            hashedPayload;
          return sha256Hex(canonical);
        }).then(function (hashedCanonical) {
          var stringToSign = 'TC3-HMAC-SHA256\n' + timestamp + '\n' + date + '/' + service + '/tc3_request\n' + hashedCanonical;
          return hmac256Str('TC3' + cfg.secretKey, date)
            .then(function (kDate) { return hmac256(kDate, service); })
            .then(function (kService) { return hmac256(kService, 'tc3_request'); })
            .then(function (kSigning) { return hmac256(kSigning, stringToSign); })
            .then(toHex);
        }).then(function (signature) {
          var authorization = 'TC3-HMAC-SHA256 Credential=' + cfg.secretId + '/' + date + '/' + service +
            '/tc3_request, SignedHeaders=content-type;host, Signature=' + signature;
          return fetchWithTimeout('https://' + host + '/', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8',
              'X-TC-Action': 'TextTranslate',
              'X-TC-Version': '2018-03-21',
              'X-TC-Region': region,
              'X-TC-Timestamp': String(timestamp),
              'Authorization': authorization
            },
            body: payload
          }).then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status);
            return r.json();
          });
        }).then(function (data) {
          var resp = data.Response || {};
          if (resp.Error) bail('騰訊雲：' + resp.Error.Code + ' ' + resp.Error.Message);
          if (typeof resp.TargetText !== 'string') bail('騰訊雲：無結果');
          return resp.TargetText;
        });
      }
    },

    alibaba: {
      name: '阿里雲',
      langs: LANG.alibaba,
      translate: function (text, source, target, cfg) {
        if (!cfg.accessKeyId || !cfg.accessKeySecret) bail('阿里雲：缺少 AccessKeyId 或 Secret');
        function pct(s) {
          return encodeURIComponent(s).replace(/[!'()*]/g, function (c) {
            return '%' + c.charCodeAt(0).toString(16).toUpperCase();
          });
        }
        var params = {
          Action: 'TranslateGeneral',
          Version: '2018-10-12',
          Format: 'JSON',
          AccessKeyId: cfg.accessKeyId,
          SignatureMethod: 'HMAC-SHA1',
          SignatureVersion: '1.0',
          SignatureNonce: (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()) + Date.now()),
          Timestamp: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
          SourceLanguage: mapLang(LANG.alibaba, source),
          TargetLanguage: mapLang(LANG.alibaba, target),
          SourceText: text,
          RegionId: cfg.region || 'cn-hangzhou'
        };
        var keys = Object.keys(params).sort();
        var canonical = keys.map(function (k) { return pct(k) + '=' + pct(params[k]); }).join('&');
        var stringToSign = 'GET&%2F&' + pct(canonical);
        return hmacSha1Raw(cfg.accessKeySecret + '&', stringToSign).then(function (sig) {
          var bytes = new Uint8Array(sig);
          var bin = '';
          for (var i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
          var b64 = btoa(bin);
          return fetchWithTimeout('https://mt.cn-hangzhou.aliyuncs.com/?' + canonical + '&Signature=' + pct(b64))
            .then(function (r) {
              if (!r.ok) throw new Error('HTTP ' + r.status);
              return r.json();
            });
        }).then(function (data) {
          if (data.Code) bail('阿里雲：' + data.Code + ' ' + (data.Message || ''));
          if (!data.Data || typeof data.Data.Translated !== 'string') bail('阿里雲：無結果');
          return data.Data.Translated;
        });
      }
    }
  };

  global.TranslationProviders = providers;
})(typeof self !== 'undefined' ? self : this);
