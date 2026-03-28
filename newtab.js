// ════════ CONFIG — EDIT THIS SECTION ════════
const CONFIG = {
  ha: {
    url:   'http://homeassistant.local:8123',
    token: 'YOUR_TOKEN_HERE',
    devices: [
      { id: 'switch.device_1', name: 'Up Light'    },
      { id: 'switch.device_2', name: 'Table Light' },
      { id: 'switch.device_3', name: 'Sub PC'      },
      { id: 'switch.device_4', name: 'Printer'     },
    ]
  },
  servers: [
    { name: 'Server 1',    url: 'https://example.com',       type: 'ext' },
    { name: 'Server 2',    url: 'https://example2.com',      type: 'ext' },
    { name: 'NAS',         url: 'http://192.168.1.100:8080', type: 'loc' },
    { name: 'Home server', url: 'http://192.168.1.101:3000', type: 'loc' },
  ],
};
// ════════════════════════════════════════════

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── SEARCH ──────────────────────────────────────────────────────
document.getElementById('search-bar').addEventListener('click', function() {
  document.getElementById('q').focus();
});

document.getElementById('q').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && this.value.trim()) {
    const q = this.value.trim();
    const isUrl = /^https?:\/\//i.test(q) || /^[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(\/|$)/.test(q);
    window.location.href = isUrl
      ? (q.startsWith('http') ? q : 'https://' + q)
      : 'https://www.google.com/search?q=' + encodeURIComponent(q);
  }
});

// ── HOME ASSISTANT ───────────────────────────────────────────────
const HA = CONFIG.ha;
const haHeaders = { 'Authorization': 'Bearer ' + HA.token, 'Content-Type': 'application/json' };
const shState = {};

async function haFetchState(entityId) {
  try {
    const r = await fetch(HA.url + '/api/states/' + entityId, {
      headers: haHeaders, signal: AbortSignal.timeout(5000)
    });
    if (!r.ok) return null;
    return (await r.json()).state;
  } catch (e) {
    return null;
  }
}

async function haToggle(entityId, currentState) {
  const service = currentState === 'on' ? 'turn_off' : 'turn_on';
  const domain = entityId.split('.')[0];
  try {
    await fetch(HA.url + '/api/services/' + domain + '/' + service, {
      method: 'POST', headers: haHeaders,
      body: JSON.stringify({ entity_id: entityId }),
      signal: AbortSignal.timeout(5000)
    });
  } catch {}
}

function renderShBtn(dev, idx) {
  const state = shState[dev.id];
  const btn = document.getElementById('sh-btn-' + idx);
  if (!btn) return;
  btn.className = 'sh-btn ' + (state === 'on' ? 'on' : state === 'off' ? 'off' : '');
  btn.querySelector('.sh-state-label').textContent =
    state === 'on' ? 'on' : state === 'off' ? 'off' : '';
}

function buildSmartHome() {
  const grid = document.getElementById('sh-grid');
  HA.devices.forEach(function(dev, idx) {
    shState[dev.id] = null;
    const btn = document.createElement('button');
    btn.className = 'sh-btn';
    btn.id = 'sh-btn-' + idx;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'sh-name';
    nameSpan.textContent = dev.name || '';
    btn.appendChild(nameSpan);

    const stateSpan = document.createElement('span');
    stateSpan.className = 'sh-state-label';
    btn.appendChild(stateSpan);

    btn.addEventListener('click', async function() {
      const cur = shState[dev.id];
      if (cur === null) return;
      shState[dev.id] = cur === 'on' ? 'off' : 'on';
      renderShBtn(dev, idx);
      btn.classList.add('loading');
      await haToggle(dev.id, cur);
      btn.classList.remove('loading');
      const delays = [3000, 8000, 18000, 40000];
      for (let i = 0; i < delays.length; i++) {
        await sleep(delays[i]);
        const s = await haFetchState(dev.id);
        if (s !== null) { shState[dev.id] = s; renderShBtn(dev, idx); }
      }
    });
    grid.appendChild(btn);
  });
}

async function shPollingLoop() {
  const count = HA.devices.length;
  const step = Math.floor(60000 / count);
  HA.devices.forEach(function(dev, i) {
    haFetchState(dev.id).then(function(s) {
      if (s !== null) { shState[dev.id] = s; renderShBtn(dev, i); }
    });
  });
  await sleep(60000);
  while (true) {
    for (let i = 0; i < count; i++) {
      if (i > 0) await sleep(step);
      const s = await haFetchState(HA.devices[i].id);
      if (s !== null) { shState[HA.devices[i].id] = s; renderShBtn(HA.devices[i], i); }
    }
    await sleep(step);
  }
}

// ── SERVERS ──────────────────────────────────────────────────────
function buildServers() {
  const list = document.getElementById('srv-list');
  CONFIG.servers.forEach(function(srv, idx) {
    const el = document.createElement('div');
    el.className = 'server-item';
    el.id = 'srv-' + idx;

    const dot = document.createElement('span');
    dot.className = 'server-dot checking';
    el.appendChild(dot);

    const info = document.createElement('div');
    info.className = 'server-info';

    const name = document.createElement('div');
    name.className = 'server-name';
    name.textContent = srv.name;
    info.appendChild(name);

    const latency = document.createElement('div');
    latency.className = 'server-latency';
    latency.textContent = 'checking...';
    info.appendChild(latency);

    el.appendChild(info);

    const tag = document.createElement('span');
    tag.className = 'server-tag ' + srv.type;
    tag.textContent = srv.type === 'ext' ? 'EXT' : 'LAN';
    el.appendChild(tag);

    list.appendChild(el);
  });
}

async function checkServer(srv, idx) {
  const el = document.getElementById('srv-' + idx);
  if (!el) return;
  const dot = el.querySelector('.server-dot');
  const lat = el.querySelector('.server-latency');
  dot.className = 'server-dot checking';
  const t0 = Date.now();
  try {
    await fetch(srv.url, {
      method: 'HEAD', mode: 'no-cors', cache: 'no-store',
      signal: AbortSignal.timeout(srv.type === 'ext' ? 7000 : 3000)
    });
    dot.className = 'server-dot online';
    lat.textContent = (Date.now() - t0) + ' ms';
  } catch {
    dot.className = 'server-dot offline';
    lat.textContent = 'unreachable';
  }
}

async function checkAllServers() {
  for (let i = 0; i < CONFIG.servers.length; i++) {
    if (i > 0) await sleep(400);
    checkServer(CONFIG.servers[i], i);
  }
  const now = new Date();
  document.getElementById('srv-updated').textContent =
    'updated ' + now.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

async function serversPollingLoop() {
  await checkAllServers();
  setInterval(checkAllServers, 5 * 60 * 1000);
}

// ── NETWORK / IP ─────────────────────────────────────────────────
async function loadIpInfo() {
  try {
    const r = await fetch('https://ipwho.is/', {
      signal: AbortSignal.timeout(8000)
    });
    const d = await r.json();
    console.log('[Network] ipwho.is response:', d);
    if (!d.success) throw new Error('ipwho.is returned success=false');
    const set = function(id, val) {
      const el = document.getElementById(id);
      el.textContent = val || '\u2014';
      el.classList.remove('skeleton');
    };
    set('ip-addr', d.ip);
    set('ip-isp',  d.connection ? d.connection.isp : '\u2014');
    set('ip-loc',  [d.city, d.region, d.country].filter(Boolean).join(', '));
    set('ip-org',  d.connection ? d.connection.org : '\u2014');
  } catch (e) {
    console.error('[Network] IP fetch failed:', e);
    ['ip-addr','ip-isp','ip-loc','ip-org'].forEach(function(id) {
      const el = document.getElementById(id);
      el.textContent = 'error';
      el.classList.remove('skeleton');
    });
  }
}

// ── INIT ─────────────────────────────────────────────────────────
buildSmartHome();
buildServers();
shPollingLoop();
serversPollingLoop();
loadIpInfo();
