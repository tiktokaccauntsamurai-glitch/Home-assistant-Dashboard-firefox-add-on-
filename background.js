// background.js — proxies fetch requests and tracks tab open context

// ── Tab context tracking ────────────────────────────────────────
// Tracks how each tab was opened so newtab.js can decide
// whether to show the dashboard based on user's toggle preferences.

var extensionStartTime = Date.now();
var newTabIds = {};

browser.tabs.onCreated.addListener(function(tab) {
  newTabIds[tab.id] = Date.now();
  // Clean up stale entries after 10 seconds
  setTimeout(function() { delete newTabIds[tab.id]; }, 10000);
});

// Clean up when tabs close
browser.tabs.onRemoved.addListener(function(tabId) {
  delete newTabIds[tabId];
});

// ── Message handler ─────────────────────────────────────────────
browser.runtime.onMessage.addListener(function(msg, sender, sendResponse) {

  // Context query from newtab.js
  if (msg.type === 'getTabContext') {
    var tabId     = sender.tab ? sender.tab.id : -1;
    var isNewTab  = !!newTabIds[tabId];
    var isStartup = (Date.now() - extensionStartTime) < 6000;

    delete newTabIds[tabId];
    sendResponse({ isNewTab: isNewTab, isStartup: isStartup });
    return false;
  }

  // Proxied fetch
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
