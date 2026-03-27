// background.js — proxies fetch requests without CORS/CORP restrictions
browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {
  if (msg.type !== 'fetch') return false;

  var opts = {
    method: msg.method || 'GET',
    signal: AbortSignal.timeout(msg.timeout || 8000)
  };
  if (msg.headers) opts.headers = msg.headers;
  if (msg.body) opts.body = msg.body;

  fetch(msg.url, opts)
    .then(function(r) {
      var ct = r.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        return r.json().then(function(data) {
          sendResponse({ ok: r.ok, status: r.status, json: data, latency: msg._t0 ? Date.now() - msg._t0 : null });
        });
      } else {
        return r.text().then(function(text) {
          sendResponse({ ok: r.ok, status: r.status, text: text, latency: msg._t0 ? Date.now() - msg._t0 : null });
        });
      }
    })
    .catch(function(e) {
      sendResponse({ ok: false, error: e.message });
    });

  return true;
});

// Redirects about:home to the custom new tab page
browser.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (tab.url === 'about:home' || tab.url === 'about:newtab') {
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL('newtab.html')
    });
  }
});
