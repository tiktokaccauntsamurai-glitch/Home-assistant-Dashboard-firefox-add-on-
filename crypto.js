// ── crypto.js — AES-256-GCM local encryption for sensitive fields ──
// Key auto-generated on first use, stored in browser.storage.local
// Token is never stored as plaintext

var CryptoHelper = (function() {

  var KEY_NAME = '_encryptionKey';

  function exportKey(key) {
    return crypto.subtle.exportKey('raw', key).then(function(buf) {
      return btoa(String.fromCharCode.apply(null, new Uint8Array(buf)));
    });
  }

  function importKey(b64) {
    var raw = Uint8Array.from(atob(b64), function(c) { return c.charCodeAt(0); });
    return crypto.subtle.importKey('raw', raw, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  function getKey() {
    return browser.storage.local.get(KEY_NAME).then(function(data) {
      if (data[KEY_NAME]) {
        return importKey(data[KEY_NAME]);
      }
      return crypto.subtle.generateKey(
        { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']
      ).then(function(key) {
        return exportKey(key).then(function(b64) {
          var obj = {};
          obj[KEY_NAME] = b64;
          return browser.storage.local.set(obj).then(function() {
            return key;
          });
        });
      });
    });
  }

  function encrypt(plaintext) {
    if (!plaintext) return Promise.resolve(null);
    return getKey().then(function(key) {
      var iv = crypto.getRandomValues(new Uint8Array(12));
      var encoded = new TextEncoder().encode(plaintext);
      return crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv }, key, encoded).then(function(ct) {
        return {
          iv: btoa(String.fromCharCode.apply(null, iv)),
          ct: btoa(String.fromCharCode.apply(null, new Uint8Array(ct)))
        };
      });
    });
  }

  function decrypt(obj) {
    if (!obj || !obj.iv || !obj.ct) return Promise.resolve('');
    return getKey().then(function(key) {
      var iv = Uint8Array.from(atob(obj.iv), function(c) { return c.charCodeAt(0); });
      var ct = Uint8Array.from(atob(obj.ct), function(c) { return c.charCodeAt(0); });
      return crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv }, key, ct).then(function(buf) {
        return new TextDecoder().decode(buf);
      });
    }).catch(function() {
      return '';
    });
  }

  return { encrypt: encrypt, decrypt: decrypt };
})();
