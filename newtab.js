var CONFIG = { ha: { url: '', token: '', devices: [] }, servers: [], pageOverrides: { newTab: true, homePage: true, startupPage: true } };

function sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }

function bgFetch(url, opts) {
  return browser.runtime.sendMessage({
    type: 'fetch', url: url,
    method: (opts && opts.method) || 'GET',
    headers: opts && opts.headers,
    body: opts && opts.body,
    timeout: opts && opts.timeout,
    _t0: Date.now()
  });
}

// ── Page override check ─────────────────────────────────────────
// Ask background script what context this page was opened in,
// then decide whether to show the dashboard or a blank page.

function checkPageOverride(config) {
  var overrides = config.pageOverrides || { newTab: true, homePage: true, startupPage: true };

  // If all toggles are on, skip the check
  if (overrides.newTab && overrides.homePage && overrides.startupPage) {
    return Promise.resolve(true);
  }

  return browser.runtime.sendMessage({ type: 'getTabContext' }).then(function(ctx) {
    if (!ctx) return true; // fallback: show dashboard

    // Startup takes priority (first ~6 seconds after extension loads)
    if (ctx.isStartup) {
      return overrides.startupPage !== false;
    }
    // New tab (Ctrl+T or similar)
    if (ctx.isNewTab) {
      return overrides.newTab !== false;
    }
    // Otherwise it's a home page navigation (Home button, about:home)
    return overrides.homePage !== false;
  }).catch(function() {
    return true; // on error, show dashboard
  });
}

function hidePageContent() {
  document.body.style.background = '#2b2a33';
  document.querySelector('.top').style.display = 'none';
  document.querySelector('.widgets').style.display = 'none';
  document.getElementById('btn-settings').style.display = 'none';
}

// ── Search ──────────────────────────────────────────────────────
document.getElementById('search-bar').addEventListener('click', function() {
  document.getElementById('q').focus();
});
document.getElementById('q').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && this.value.trim()) {
    var q = this.value.trim();
    var isUrl = /^https?:\/\//i.test(q) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(q);
    window.location.href = isUrl
      ? (q.startsWith('http') ? q : 'https://' + q)
      : 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }
});

// ── Home Assistant ──────────────────────────────────────────────
var shState = {};

function haHeaders() {
  return { 'Authorization': 'Bearer ' + CONFIG.ha.token, 'Content-Type': 'application/json' };
}

async function haFetchState(entityId) {
  try {
    var r = await bgFetch(CONFIG.ha.url + '/api/states/' + entityId, { headers: haHeaders(), timeout: 5000 });
    if (!r || !r.ok) return null;
    return r.json ? r.json.state : null;
  } catch (e) { return null; }
}

async function haToggle(entityId, currentState) {
  var service = currentState === 'on' ? 'turn_off' : 'turn_on';
  var domain = entityId.split('.')[0];
  try {
    await bgFetch(CONFIG.ha.url + '/api/services/' + domain + '/' + service, {
      method: 'POST', headers: haHeaders(),
      body: JSON.stringify({ entity_id: entityId }), timeout: 5000
    });
  } catch {}
}

function renderShBtn(dev, idx) {
  var state = shState[dev.id];
  var btn = document.getElementById('sh-btn-' + idx);
  if (!btn) return;
  btn.className = 'sh-btn ' + (state === 'on' ? 'on' : state === 'off' ? 'off' : '');
  btn.querySelector('.sh-state-label').textContent = state === 'on' ? 'on' : state === 'off' ? 'off' : '';
}

function buildSmartHome() {
  var grid = document.getElementById('sh-grid');
  grid.innerHTML = '';
  if (!CONFIG.ha.devices || !CONFIG.ha.devices.length) {
    grid.innerHTML = '<div class="empty-msg" style="grid-column:1/-1">No devices — <a href="#" id="link-settings-ha">open settings</a></div>';
    var link = document.getElementById('link-settings-ha');
    if (link) link.addEventListener('click', function(e) { e.preventDefault(); browser.runtime.openOptionsPage(); });
    return;
  }
  CONFIG.ha.devices.forEach(function(dev, idx) {
    shState[dev.id] = null;
    var btn = document.createElement('button');
    btn.className = 'sh-btn'; btn.id = 'sh-btn-' + idx;
    var n = document.createElement('span'); n.className = 'sh-name'; n.textContent = dev.name || dev.id;
    var s = document.createElement('span'); s.className = 'sh-state-label';
    btn.appendChild(n); btn.appendChild(s);
    btn.addEventListener('click', async function() {
      var cur = shState[dev.id]; if (cur === null) return;
      shState[dev.id] = cur === 'on' ? 'off' : 'on'; renderShBtn(dev, idx);
      btn.classList.add('loading'); await haToggle(dev.id, cur); btn.classList.remove('loading');
      var delays = [3000, 8000, 18000, 40000];
      for (var i = 0; i < delays.length; i++) {
        await sleep(delays[i]);
        var st = await haFetchState(dev.id);
        if (st !== null) { shState[dev.id] = st; renderShBtn(dev, idx); }
      }
    });
    grid.appendChild(btn);
  });
}

async function shPollingLoop() {
  if (!CONFIG.ha.url || !CONFIG.ha.token || !CONFIG.ha.devices.length) return;
  var count = CONFIG.ha.devices.length;
  var step = Math.floor(60000 / count);
  CONFIG.ha.devices.forEach(function(dev, i) {
    haFetchState(dev.id).then(function(st) { if (st !== null) { shState[dev.id] = st; renderShBtn(dev, i); } });
  });
  await sleep(60000);
  while (true) {
    for (var i = 0; i < count; i++) {
      if (i > 0) await sleep(step);
      var st = await haFetchState(CONFIG.ha.devices[i].id);
      if (st !== null) { shState[CONFIG.ha.devices[i].id] = st; renderShBtn(CONFIG.ha.devices[i], i); }
    }
    await sleep(step);
  }
}

// ── Servers ─────────────────────────────────────────────────────
function buildServers() {
  var list = document.getElementById('srv-list');
  list.innerHTML = '';
  if (!CONFIG.servers || !CONFIG.servers.length) {
    list.innerHTML = '<div class="empty-msg">No servers — <a href="#" id="link-settings-srv">open settings</a></div>';
    var link = document.getElementById('link-settings-srv');
    if (link) link.addEventListener('click', function(e) { e.preventDefault(); browser.runtime.openOptionsPage(); });
    return;
  }
  CONFIG.servers.forEach(function(srv, idx) {
    var el = document.createElement('div'); el.className = 'server-item'; el.id = 'srv-' + idx;
    var dot = document.createElement('span'); dot.className = 'server-dot checking';
    var info = document.createElement('div'); info.className = 'server-info';
    var nm = document.createElement('div'); nm.className = 'server-name'; nm.textContent = srv.name || srv.url;
    var lat = document.createElement('div'); lat.className = 'server-latency'; lat.textContent = 'checking...';
    info.appendChild(nm); info.appendChild(lat);
    var tag = document.createElement('span'); tag.className = 'server-tag ' + srv.type;
    tag.textContent = srv.type === 'ext' ? 'EXT' : 'LAN';
    el.appendChild(dot); el.appendChild(info); el.appendChild(tag);
    list.appendChild(el);
  });
}

async function checkServer(srv, idx) {
  var el = document.getElementById('srv-' + idx); if (!el) return;
  var dot = el.querySelector('.server-dot');
  var lat = el.querySelector('.server-latency');
  dot.className = 'server-dot checking';
  try {
    var r = await bgFetch(srv.url, { method: 'HEAD', timeout: srv.type === 'ext' ? 7000 : 3000 });
    if (r && !r.error) { dot.className = 'server-dot online'; lat.textContent = (r.latency || 0) + ' ms'; }
    else { dot.className = 'server-dot offline'; lat.textContent = 'unreachable'; }
  } catch { dot.className = 'server-dot offline'; lat.textContent = 'unreachable'; }
}

async function checkAllServers() {
  if (!CONFIG.servers || !CONFIG.servers.length) return;
  for (var i = 0; i < CONFIG.servers.length; i++) {
    if (i > 0) await sleep(400);
    checkServer(CONFIG.servers[i], i);
  }
  document.getElementById('srv-updated').textContent =
    'updated ' + new Date().toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

async function serversPollingLoop() {
  await checkAllServers();
  setInterval(checkAllServers, 5 * 60 * 1000);
}

// ── Network ─────────────────────────────────────────────────────
async function loadIpInfo() {
  var set = function(id, val) {
    var el = document.getElementById(id); el.textContent = val || '\u2014'; el.classList.remove('skeleton');
  };
  try {
    var r = await bgFetch('https://ipwho.is/', { timeout: 8000 });
    if (r && !r.error) {
      var d = r.json || JSON.parse(r.text);
      if (d.success !== false) {
        set('ip-addr', d.ip);
        set('ip-isp', d.connection ? d.connection.isp : '\u2014');
        set('ip-loc', [d.city, d.region, d.country].filter(Boolean).join(', '));
        set('ip-org', d.connection ? d.connection.org : '\u2014');
        return;
      }
    }
  } catch {}
  try {
    var r2 = await bgFetch('http://ip-api.com/json/', { timeout: 8000 });
    if (r2 && !r2.error) {
      var d2 = r2.json || JSON.parse(r2.text);
      if (d2.status === 'success') {
        set('ip-addr', d2.query);
        set('ip-isp', d2.isp || '\u2014');
        set('ip-loc', [d2.city, d2.regionName, d2.country].filter(Boolean).join(', '));
        set('ip-org', d2.org || '\u2014');
        return;
      }
    }
  } catch {}
  ['ip-addr','ip-isp','ip-loc','ip-org'].forEach(function(id) {
    var el = document.getElementById(id); el.textContent = 'error'; el.classList.remove('skeleton');
  });
}

// ── Settings gear ───────────────────────────────────────────────
document.getElementById('btn-settings').addEventListener('click', function() {
  browser.runtime.openOptionsPage();
});

// ── Init — load config, check overrides, decrypt token, start ───
browser.storage.local.get('config').then(function(data) {
  var cfg = data.config;
  if (!cfg) { buildSmartHome(); buildServers(); loadIpInfo(); return; }
  if (!cfg.ha) cfg.ha = { url: '', token: '', devices: [] };
  if (!cfg.servers) cfg.servers = [];
  if (!cfg.pageOverrides) cfg.pageOverrides = { newTab: true, homePage: true, startupPage: true };

  // Check if dashboard should be shown for this context
  checkPageOverride(cfg).then(function(shouldShow) {
    if (!shouldShow) {
      hidePageContent();
      return;
    }

    // Decrypt token if encrypted
    var tokenPromise;
    if (cfg.ha.token && typeof cfg.ha.token === 'object' && cfg.ha.token.ct) {
      tokenPromise = CryptoHelper.decrypt(cfg.ha.token);
    } else {
      tokenPromise = Promise.resolve(cfg.ha.token || '');
    }

    tokenPromise.then(function(plainToken) {
      CONFIG = {
        ha: { url: cfg.ha.url || '', token: plainToken, devices: cfg.ha.devices || [] },
        servers: cfg.servers,
        pageOverrides: cfg.pageOverrides
      };
      buildSmartHome();
      buildServers();
      shPollingLoop();
      serversPollingLoop();
      loadIpInfo();
    });
  });
}).catch(function() {
  buildSmartHome(); buildServers(); loadIpInfo();
});
