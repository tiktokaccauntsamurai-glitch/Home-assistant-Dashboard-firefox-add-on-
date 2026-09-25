var CONFIG = { ha: { url: '', token: '', devices: [] }, servers: [], pageOverrides: { newTab: true, homePage: true, startupPage: true }, searchEngine: { type: 'google', customUrl: '' } };

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
var ENGINE_CONFIGS = {
  google: { label: 'G', color: '#4285F4', placeholder: 'Search with Google or enter address',  url: function(q) { return 'https://www.google.com/search?q=' + encodeURIComponent(q); } },
  ddg:    { label: 'D', color: '#de5833', placeholder: 'Search with DuckDuckGo or enter address', url: function(q) { return 'https://duckduckgo.com/?q=' + encodeURIComponent(q); } },
  custom: { label: '?', color: '#9090a0', placeholder: 'Search or enter address', url: null }
};

function buildSearchUrl(q) {
  var se = CONFIG.searchEngine || { type: 'google', customUrl: '' };
  var type = se.type || 'google';
  if (type === 'ddg') return ENGINE_CONFIGS.ddg.url(q);
  if (type === 'custom' && se.customUrl) return se.customUrl.replace('{query}', encodeURIComponent(q));
  return ENGINE_CONFIGS.google.url(q);
}

function updateSearchBar() {
  var se = CONFIG.searchEngine || { type: 'google', customUrl: '' };
  var type = se.type || 'google';
  var cfg = ENGINE_CONFIGS[type] || ENGINE_CONFIGS.google;
  var icon = document.getElementById('search-engine-icon');
  var input = document.getElementById('q');
  icon.textContent = cfg.label;
  icon.style.color = cfg.color;
  input.placeholder = cfg.placeholder;
}

document.getElementById('search-bar').addEventListener('click', function() {
  document.getElementById('q').focus();
});
document.getElementById('q').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && this.value.trim()) {
    var q = this.value.trim();
    var isUrl = /^https?:\/\//i.test(q) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(q);
    window.location.href = isUrl
      ? (q.startsWith('http') ? q : 'https://' + q)
      : buildSearchUrl(q);
  }
});

// ── Home Assistant ──────────────────────────────────────────────
// Device tile modes (see HaFormat.resolveMode):
//   toggle — button that calls turn_on / turn_off
//   status — read-only state indicator (dot + label)
//   sensor — reading with unit, optional secondary entity (e.g. humidity)
var shState = {};   // entity_id → full state object
var shTiles = [];   // { dev, mode, el }

function haHeaders() {
  return { 'Authorization': 'Bearer ' + CONFIG.ha.token, 'Content-Type': 'application/json' };
}

async function haFetchState(entityId) {
  try {
    var r = await bgFetch(CONFIG.ha.url + '/api/states/' + entityId, { headers: haHeaders(), timeout: 5000 });
    if (r && r.status === 404) return { entity_id: entityId, state: 'not_found', attributes: {} };
    if (!r || !r.ok || !r.json) return null;
    return r.json;
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

function shTooltip(dev) {
  var st = shState[dev.id];
  var lines = [dev.id + (dev.secondary ? ' + ' + dev.secondary : '')];
  if (st && st.attributes && st.attributes.friendly_name) lines.unshift(st.attributes.friendly_name);
  var ago = HaFormat.formatAgo(HaFormat.lastSeen(st));
  if (ago) lines.push('updated ' + ago);
  return lines.join('\n');
}

function renderToggle(t) {
  var st = shState[t.dev.id];
  var s = st ? st.state : null;
  t.el.className = 'sh-btn ' + (s === 'on' ? 'on' : s === 'off' ? 'off' : (st && HaFormat.isUnavailable(st)) ? 'unavail' : '');
  t.el.querySelector('.sh-state-label').textContent =
    s === 'on' ? 'on' : s === 'off' ? 'off' : st ? HaFormat.describeStatus(st).label.toLowerCase() : '';
}

function renderStatus(t) {
  var d = HaFormat.describeStatus(shState[t.dev.id], t.dev.decimals);
  t.el.className = 'sh-btn sh-tile sh-status' + (d.tone ? ' tone-' + d.tone : '');
  t.el.querySelector('.sh-state-text').textContent = d.label;
}

function renderReading(el, reading) {
  var r = HaFormat.taggedReading(reading);
  el.dataset.kind = (reading && reading.kind) || '';
  el.textContent = '';
  if (r.tag) {
    var tag = document.createElement('span'); tag.className = 'sh-kind'; tag.textContent = r.tag;
    el.appendChild(tag);
  }
  var v = document.createElement('span');
  v.textContent = r.text;
  el.appendChild(v);
}

function renderSensor(t) {
  var st = shState[t.dev.id];
  var main = HaFormat.primaryReading(st, t.dev.decimals);
  var second = null;
  if (t.dev.secondary) {
    var st2 = shState[t.dev.secondary];
    second = HaFormat.primaryReading(st2, t.dev.decimals) || (st2 ? { text: '—', value: '—', unit: '', kind: null } : null);
  } else {
    second = HaFormat.builtinHumidity(st, t.dev.decimals);
  }
  t.el.className = 'sh-btn sh-tile sh-sensor' + (st && !main ? ' unavail' : '');
  var mainEl = t.el.querySelector('.sh-value');
  var secEl  = t.el.querySelector('.sh-value2');
  if (!st) { mainEl.textContent = ''; } else { renderReading(mainEl, main); }
  if (second) { renderReading(secEl, second); secEl.style.display = ''; }
  else        { secEl.textContent = ''; secEl.style.display = 'none'; }
}

function renderTile(t) {
  if (t.mode === 'status')      renderStatus(t);
  else if (t.mode === 'sensor') renderSensor(t);
  else                          renderToggle(t);
  if (t.mode !== 'toggle') t.el.title = shTooltip(t.dev);
}

function shUpdate(entityId, st) {
  shState[entityId] = st;
  shTiles.forEach(function(t) {
    if (t.dev.id === entityId || t.dev.secondary === entityId) renderTile(t);
  });
}

function createToggleTile(dev) {
  var btn = document.createElement('button');
  btn.className = 'sh-btn';
  var n = document.createElement('span'); n.className = 'sh-name'; n.textContent = dev.name || dev.id;
  var s = document.createElement('span'); s.className = 'sh-state-label';
  btn.appendChild(n); btn.appendChild(s);
  btn.addEventListener('click', async function() {
    var cur = shState[dev.id];
    if (!cur || HaFormat.isUnavailable(cur)) return;
    shUpdate(dev.id, Object.assign({}, cur, { state: cur.state === 'on' ? 'off' : 'on' }));
    btn.classList.add('loading'); await haToggle(dev.id, cur.state); btn.classList.remove('loading');
    var delays = [3000, 8000, 18000, 40000];
    for (var i = 0; i < delays.length; i++) {
      await sleep(delays[i]);
      var st = await haFetchState(dev.id);
      if (st !== null) shUpdate(dev.id, st);
    }
  });
  return btn;
}

// Read-only tiles open the entity history in HA, like the default "more-info" tap in Lovelace
function createReadonlyTile(dev, mode) {
  var el = document.createElement('a');
  el.className = 'sh-btn sh-tile';
  if (CONFIG.ha.url) {
    var ids = [dev.id].concat(dev.secondary ? [dev.secondary] : []);
    el.href = CONFIG.ha.url + '/history?entity_id=' + encodeURIComponent(ids.join(','));
  }
  var n = document.createElement('span'); n.className = 'sh-name'; n.textContent = dev.name || dev.id;
  el.appendChild(n);
  if (mode === 'status') {
    var row = document.createElement('span'); row.className = 'sh-state-row';
    var dot = document.createElement('span'); dot.className = 'sh-dot';
    var txt = document.createElement('span'); txt.className = 'sh-state-text';
    row.appendChild(dot); row.appendChild(txt);
    el.appendChild(row);
  } else {
    // both readings share one line so the tile keeps the 2-line height of a button
    var vals = document.createElement('span'); vals.className = 'sh-values';
    var v1 = document.createElement('span'); v1.className = 'sh-value';
    var v2 = document.createElement('span'); v2.className = 'sh-value sh-value2'; v2.style.display = 'none';
    vals.appendChild(v1); vals.appendChild(v2);
    el.appendChild(vals);
  }
  return el;
}

function buildSmartHome() {
  var grid = document.getElementById('sh-grid');
  grid.innerHTML = '';
  shTiles = [];
  if (!CONFIG.ha.devices || !CONFIG.ha.devices.length) {
    grid.innerHTML = '<div class="empty-msg" style="grid-column:1/-1">No devices — <a href="#" id="link-settings-ha">open settings</a></div>';
    var link = document.getElementById('link-settings-ha');
    if (link) link.addEventListener('click', function(e) { e.preventDefault(); browser.runtime.openOptionsPage(); });
    return;
  }
  CONFIG.ha.devices.forEach(function(dev) {
    var mode = HaFormat.resolveMode(dev);
    var el = mode === 'toggle' ? createToggleTile(dev) : createReadonlyTile(dev, mode);
    var t = { dev: dev, mode: mode, el: el };
    shTiles.push(t);
    renderTile(t);
    grid.appendChild(el);
  });
}

// Every tracked entity (primary + secondary), each fetched once per cycle
function shEntityIds() {
  var ids = [];
  (CONFIG.ha.devices || []).forEach(function(dev) {
    [dev.id, dev.secondary].forEach(function(id) {
      if (id && ids.indexOf(id) === -1) ids.push(id);
    });
  });
  return ids;
}

async function shPollingLoop() {
  var ids = shEntityIds();
  if (!CONFIG.ha.url || !CONFIG.ha.token || !ids.length) return;
  var step = Math.floor(60000 / ids.length);
  ids.forEach(function(id) {
    haFetchState(id).then(function(st) { if (st !== null) shUpdate(id, st); });
  });
  await sleep(60000);
  while (true) {
    for (var i = 0; i < ids.length; i++) {
      if (i > 0) await sleep(step);
      var st = await haFetchState(ids[i]);
      if (st !== null) shUpdate(ids[i], st);
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
  if (cfg.logoScale) document.documentElement.style.setProperty('--logo-scale', cfg.logoScale / 100);

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
        pageOverrides: cfg.pageOverrides,
        searchEngine: cfg.searchEngine || { type: 'google', customUrl: '' }
      };
      updateSearchBar();
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
