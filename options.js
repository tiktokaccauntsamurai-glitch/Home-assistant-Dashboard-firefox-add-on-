function showToast(msg) {
  var toast = document.getElementById('toast');
  toast.textContent = msg || 'Settings saved';
  toast.classList.add('show');
  setTimeout(function() { toast.classList.remove('show'); }, 2500);
}

// ── Helpers ──────────────────────────────────────────────────────
function makeEl(tag, props) {
  var el = document.createElement(tag);
  if (props) Object.keys(props).forEach(function(k) { el[k] = props[k]; });
  return el;
}

function makeField(labelText, input) {
  var field = makeEl('div', { className: 'field' });
  var lbl   = makeEl('label', { textContent: labelText });
  field.appendChild(lbl);
  field.appendChild(input);
  return field;
}

function bgFetch(url, opts) {
  return browser.runtime.sendMessage({
    type: 'fetch', url: url,
    method: (opts && opts.method) || 'GET',
    headers: opts && opts.headers,
    timeout: opts && opts.timeout
  });
}

// ── Device item ─────────────────────────────────────────────────
var DEVICE_MODES = [
  { type: 'auto',   label: 'Auto' },
  { type: 'toggle', label: 'Button' },
  { type: 'status', label: 'Status' },
  { type: 'sensor', label: 'Sensor' }
];
var MODE_NAMES = { toggle: 'Button', status: 'Status', sensor: 'Sensor' };

// Fetch one entity from HA using the URL/token currently typed in the form
function fetchEntity(entityId) {
  var url   = document.getElementById('ha-url').value.trim().replace(/\/+$/, '');
  var token = document.getElementById('ha-token').value.trim();
  if (!url || !token) return Promise.reject(new Error('fill in HA URL and token first'));
  return bgFetch(url + '/api/states/' + entityId, {
    headers: { 'Authorization': 'Bearer ' + token }, timeout: 5000
  }).then(function(r) {
    if (!r || r.error) throw new Error(r && r.error ? r.error : 'unreachable');
    if (r.status === 401) throw new Error('401 — token rejected');
    if (r.status === 404) throw new Error(entityId + ' not found');
    if (!r.ok || !r.json) throw new Error('HTTP ' + r.status);
    return r.json;
  });
}

function describeEntity(st) {
  var a = st.attributes || {};
  var reading = HaFormat.primaryReading(st) || { text: HaFormat.describeStatus(st).label };
  var parts = [reading.text];
  if (a.device_class) parts.push(a.device_class);
  var hum = HaFormat.builtinHumidity(st);
  if (hum) parts.push('humidity ' + hum.text);
  return (a.friendly_name ? a.friendly_name + ': ' : '') + parts.join(' · ');
}

function createDeviceItem(dev) {
  var div = makeEl('div', { className: 'list-item' });

  var removeBtn = makeEl('button', { className: 'btn-remove', type: 'button', title: 'Remove', textContent: '×' });
  removeBtn.addEventListener('click', function() { div.remove(); });

  var idInput   = makeEl('input', { type: 'text', className: 'dev-id',   placeholder: 'switch.living_room'   });
  var nameInput = makeEl('input', { type: 'text', className: 'dev-name', placeholder: 'Living Room Light' });
  idInput.value   = dev.id   || '';
  nameInput.value = dev.name || '';

  var row = makeEl('div', { className: 'field-row' });
  row.appendChild(makeField('Entity ID',     idInput));
  row.appendChild(makeField('Display name',  nameInput));

  // Display mode
  var selector = makeEl('div', { className: 'mode-selector' });
  DEVICE_MODES.forEach(function(m) {
    var b = makeEl('button', { type: 'button', className: 'mode-option', textContent: m.label });
    b.dataset.mode = m.type;
    b.addEventListener('click', function() { setMode(m.type); });
    selector.appendChild(b);
  });
  var modeField = makeEl('div', { className: 'field' });
  modeField.appendChild(makeEl('label', { textContent: 'Show as' }));
  modeField.appendChild(selector);
  var modeHint = makeEl('div', { className: 'hint' });
  modeField.appendChild(modeHint);

  // Sensor options
  var secInput = makeEl('input', { type: 'text', className: 'dev-secondary', placeholder: 'sensor.living_room_humidity' });
  secInput.value = dev.secondary || '';
  var decSelect = makeEl('select', { className: 'dev-decimals' });
  [['auto', 'Auto (up to 1)'], ['0', '0'], ['1', '1'], ['2', '2']].forEach(function(o) {
    decSelect.appendChild(makeEl('option', { value: o[0], textContent: o[1] }));
  });
  decSelect.value = dev.decimals !== undefined ? String(dev.decimals) : 'auto';
  var sensorRow = makeEl('div', { className: 'field-row sensor-opts' });
  sensorRow.appendChild(makeField('Second value (optional)', secInput));
  sensorRow.appendChild(makeField('Decimals', decSelect));
  var sensorHint = makeEl('div', { className: 'hint sensor-opts',
    textContent: 'E.g. temperature as entity + humidity as second value. climate.* / weather.* show their built-in humidity automatically.' });

  // Check against HA
  var checkBtn = makeEl('button', { type: 'button', className: 'btn-check', textContent: 'Check' });
  var checkOut = makeEl('span', { className: 'check-result' });
  var checkRow = makeEl('div', { className: 'check-row' });
  checkRow.appendChild(checkBtn);
  checkRow.appendChild(checkOut);

  function showCheck(ok, text) {
    checkOut.className = 'check-result' + (ok === true ? ' ok' : ok === false ? ' err' : '');
    checkOut.textContent = (ok === true ? '✓ ' : ok === false ? '✗ ' : '') + text;
  }
  function currentMode() {
    var active = selector.querySelector('.mode-option.active');
    return active ? active.dataset.mode : 'auto';
  }
  function resolvedMode() {
    return HaFormat.resolveMode({ id: idInput.value.trim(), type: currentMode() });
  }
  function refresh() {
    var mode = currentMode();
    var resolved = resolvedMode();
    modeHint.textContent = mode !== 'auto' ? ''
      : idInput.value.trim() ? 'Detected from domain: ' + MODE_NAMES[resolved]
      : 'Picks Button / Status / Sensor from the entity domain';
    div.querySelectorAll('.sensor-opts').forEach(function(el) {
      el.style.display = resolved === 'sensor' ? '' : 'none';
    });
  }
  function setMode(type) {
    selector.querySelectorAll('.mode-option').forEach(function(b) {
      b.classList.toggle('active', b.dataset.mode === type);
    });
    refresh();
  }

  checkBtn.addEventListener('click', function() {
    var id  = idInput.value.trim();
    var sec = secInput.value.trim();
    if (!id) { showCheck(false, 'enter an entity ID'); return; }
    checkBtn.disabled = true;
    showCheck(null, 'checking…');
    var jobs = [fetchEntity(id)];
    if (sec && resolvedMode() === 'sensor') jobs.push(fetchEntity(sec));
    Promise.all(jobs).then(function(res) {
      var a = res[0].attributes || {};
      if (!nameInput.value.trim() && a.friendly_name) nameInput.value = a.friendly_name;
      showCheck(true, res.map(describeEntity).join('  +  '));
    }).catch(function(e) {
      showCheck(false, e.message);
    }).then(function() { checkBtn.disabled = false; });
  });
  idInput.addEventListener('input', refresh);

  div.appendChild(removeBtn);
  div.appendChild(row);
  div.appendChild(modeField);
  div.appendChild(sensorRow);
  div.appendChild(sensorHint);
  div.appendChild(checkRow);
  setMode(dev.type || 'auto');
  return div;
}

// ── Server item ─────────────────────────────────────────────────
function createServerItem(srv) {
  var div   = makeEl('div', { className: 'list-item' });
  var isExt = (!srv.type || srv.type === 'ext');

  var removeBtn = makeEl('button', { className: 'btn-remove', type: 'button', title: 'Remove', textContent: '\u00d7' });
  removeBtn.addEventListener('click', function() { div.remove(); });

  var nameInput = makeEl('input', { type: 'text', className: 'srv-name', placeholder: 'My Server' });
  var urlInput  = makeEl('input', { type: 'url',  className: 'srv-url',  placeholder: 'https://example.com' });
  nameInput.value = srv.name || '';
  urlInput.value  = srv.url  || '';

  var row = makeEl('div', { className: 'field-row' });
  row.appendChild(makeField('Name', nameInput));
  row.appendChild(makeField('URL',  urlInput));

  var extBtn = makeEl('button', { type: 'button', className: 'type-option type-ext' + (isExt  ? ' active-ext' : ''), textContent: 'EXT (external)' });
  var locBtn = makeEl('button', { type: 'button', className: 'type-option type-loc' + (!isExt ? ' active-loc' : ''), textContent: 'LAN (local)' });
  extBtn.dataset.type = 'ext';
  locBtn.dataset.type = 'loc';

  [extBtn, locBtn].forEach(function(btn) {
    btn.addEventListener('click', function() {
      extBtn.classList.remove('active-ext');
      locBtn.classList.remove('active-loc');
      btn.classList.add(btn.dataset.type === 'ext' ? 'active-ext' : 'active-loc');
    });
  });

  var selector = makeEl('div', { className: 'type-selector' });
  selector.appendChild(extBtn);
  selector.appendChild(locBtn);

  var typeField = makeEl('div', { className: 'field' });
  typeField.appendChild(makeEl('label', { textContent: 'Type' }));
  typeField.appendChild(selector);

  div.appendChild(removeBtn);
  div.appendChild(row);
  div.appendChild(typeField);
  return div;
}

// ── Populate form ───────────────────────────────────────────────
function populateForm(config, plainToken) {
  document.getElementById('ha-url').value   = config.ha.url || '';
  document.getElementById('ha-token').value = plainToken    || '';

  // Page override toggles
  var overrides = config.pageOverrides || { newTab: true, homePage: true, startupPage: true };
  document.getElementById('toggle-newtab').checked   = overrides.newTab   !== false;
  document.getElementById('toggle-homepage').checked  = overrides.homePage !== false;
  document.getElementById('toggle-startup').checked   = overrides.startupPage !== false;

  setLogoScaleUI(config.logoScale || 100);

  // Search engine
  var se = config.searchEngine || { type: 'google', customUrl: '' };
  setEngineUI(se.type || 'google');
  document.getElementById('custom-engine-url').value = se.customUrl || '';

  var devList = document.getElementById('devices-list');
  devList.innerHTML = '';
  (config.ha.devices || []).forEach(function(d) { devList.appendChild(createDeviceItem(d)); });

  var srvList = document.getElementById('servers-list');
  srvList.innerHTML = '';
  (config.servers || []).forEach(function(s) { srvList.appendChild(createServerItem(s)); });

  if (plainToken) document.getElementById('enc-badge').style.display = 'inline-flex';
}

// ── Collect from form ───────────────────────────────────────────
function collectFormData() {
  var devices = [];
  document.querySelectorAll('#devices-list .list-item').forEach(function(el) {
    var id   = el.querySelector('.dev-id').value.trim();
    var name = el.querySelector('.dev-name').value.trim();
    if (!id) return;
    var activeMode = el.querySelector('.mode-option.active');
    var dev = { id: id, name: name, type: activeMode ? activeMode.dataset.mode : 'auto' };
    if (HaFormat.resolveMode(dev) === 'sensor') {
      var secondary = el.querySelector('.dev-secondary').value.trim();
      var decimals  = el.querySelector('.dev-decimals').value;
      if (secondary) dev.secondary = secondary;
      if (decimals !== 'auto') dev.decimals = +decimals;
    }
    devices.push(dev);
  });
  var servers = [];
  document.querySelectorAll('#servers-list .list-item').forEach(function(el) {
    var name      = el.querySelector('.srv-name').value.trim();
    var url       = el.querySelector('.srv-url').value.trim();
    var activeBtn = el.querySelector('.type-option.active-ext, .type-option.active-loc');
    var type      = activeBtn ? activeBtn.dataset.type : 'ext';
    if (url) servers.push({ name: name, url: url, type: type });
  });
  var activeEngine = document.querySelector('.engine-option.active');
  var engineType = activeEngine ? activeEngine.dataset.engine : 'google';
  return {
    haUrl:   document.getElementById('ha-url').value.trim(),
    haToken: document.getElementById('ha-token').value.trim(),
    devices: devices,
    servers: servers,
    pageOverrides: {
      newTab:      document.getElementById('toggle-newtab').checked,
      homePage:    document.getElementById('toggle-homepage').checked,
      startupPage: document.getElementById('toggle-startup').checked
    },
    logoScale: +document.getElementById('logo-scale').value,
    searchEngine: {
      type: engineType,
      customUrl: engineType === 'custom' ? document.getElementById('custom-engine-url').value.trim() : ''
    }
  };
}

// ── Export settings to text file ────────────────────────────────
function exportSettings() {
  var form = collectFormData();
  var lines = [];
  var ts = new Date().toISOString().replace('T', ' ').replace(/\.\d+Z$/, ' UTC');

  lines.push('=== Custom New Tab — Settings Export ===');
  lines.push('Exported: ' + ts);
  lines.push('');

  lines.push('--- Search Engine ---');
  var engineNames = { google: 'Google', ddg: 'DuckDuckGo', custom: 'Custom' };
  var seType = form.searchEngine ? form.searchEngine.type : 'google';
  lines.push('Engine: ' + (engineNames[seType] || seType));
  if (seType === 'custom') lines.push('URL: ' + (form.searchEngine.customUrl || '(not set)'));
  lines.push('');

  lines.push('--- Page Override ---');
  lines.push('New Tab:      ' + (form.pageOverrides.newTab      ? 'ON' : 'OFF'));
  lines.push('Home Page:    ' + (form.pageOverrides.homePage    ? 'ON' : 'OFF'));
  lines.push('Startup Page: ' + (form.pageOverrides.startupPage ? 'ON' : 'OFF'));
  lines.push('');

  lines.push('--- Home Assistant ---');
  lines.push('URL: ' + (form.haUrl || '(not set)'));
  lines.push('Token: (not exported for security)');
  if (form.devices.length) {
    lines.push('Devices:');
    form.devices.forEach(function(d, i) {
      var mode = HaFormat.resolveMode(d);
      lines.push('  ' + (i + 1) + '. [' + MODE_NAMES[mode] + (d.type === 'auto' ? ', auto' : '') + '] ' +
        d.id + (d.secondary ? ' + ' + d.secondary : '') + (d.name ? ' — ' + d.name : ''));
    });
  } else {
    lines.push('Devices: (none)');
  }
  lines.push('');

  lines.push('--- Servers ---');
  if (form.servers.length) {
    form.servers.forEach(function(s, i) {
      var label = s.type === 'loc' ? 'LAN' : 'EXT';
      lines.push('  ' + (i + 1) + '. [' + label + '] ' + (s.name || '(unnamed)') + ' — ' + s.url);
    });
  } else {
    lines.push('(none)');
  }

  var blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  var url  = URL.createObjectURL(blob);
  var a    = document.createElement('a');
  a.href     = url;
  a.download = 'custom-newtab-settings.txt';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast('Settings exported');
}

// ── Logo size UI ─────────────────────────────────────────────────
function setLogoScaleUI(v) {
  document.getElementById('logo-scale').value = v;
  document.getElementById('logo-scale-value').textContent = v + '%';
}
document.getElementById('logo-scale').addEventListener('input', function() {
  setLogoScaleUI(this.value);
});

// ── Search engine UI ─────────────────────────────────────────────
function setEngineUI(type) {
  document.querySelectorAll('.engine-option').forEach(function(btn) {
    btn.classList.toggle('active', btn.dataset.engine === type);
  });
  document.getElementById('custom-engine-field').style.display = type === 'custom' ? 'block' : 'none';
}

document.querySelectorAll('.engine-option').forEach(function(btn) {
  btn.addEventListener('click', function() { setEngineUI(btn.dataset.engine); });
});

// ── Init — load + decrypt ───────────────────────────────────────
var DEFAULTS = {
  ha: { url: '', token: '', devices: [] },
  servers: [],
  pageOverrides: { newTab: true, homePage: true, startupPage: true },
  searchEngine: { type: 'google', customUrl: '' }
};

browser.storage.local.get('config').then(function(data) {
  var config = data.config || DEFAULTS;
  if (!config.ha)            config.ha            = DEFAULTS.ha;
  if (!config.servers)       config.servers        = [];
  if (!config.pageOverrides) config.pageOverrides = DEFAULTS.pageOverrides;
  if (!config.searchEngine)  config.searchEngine  = DEFAULTS.searchEngine;

  var storedToken = config.ha.token;
  if (storedToken && typeof storedToken === 'object' && storedToken.ct) {
    CryptoHelper.decrypt(storedToken).then(function(plain) { populateForm(config, plain); });
  } else {
    populateForm(config, storedToken || '');
  }
}).catch(function() { populateForm(DEFAULTS, ''); });

// ── Add buttons ─────────────────────────────────────────────────
document.getElementById('btn-add-device').addEventListener('click', function() {
  document.getElementById('devices-list').appendChild(createDeviceItem({ id: '', name: '' }));
});
document.getElementById('btn-add-server').addEventListener('click', function() {
  document.getElementById('servers-list').appendChild(createServerItem({ name: '', url: '', type: 'ext' }));
});

// ── Token show/hide ─────────────────────────────────────────────
document.getElementById('token-toggle').addEventListener('click', function() {
  var input = document.getElementById('ha-token');
  if (input.type === 'password') { input.type = 'text';     this.textContent = 'hide'; }
  else                           { input.type = 'password'; this.textContent = 'show'; }
});

// ── Export ───────────────────────────────────────────────────────
document.getElementById('btn-export').addEventListener('click', exportSettings);

// ── Save — encrypt token then store ─────────────────────────────
// Host access is not granted at install time — only the specific sites
// the user configured (HA, servers, IP-info services) are requested on save.
function originPattern(u) {
  try {
    var p = new URL(u);
    if (p.protocol !== 'http:' && p.protocol !== 'https:') return null;
    return p.protocol + '//' + p.hostname + '/*';
  } catch (e) { return null; }
}

function requestHostAccess(form) {
  var urls = [form.haUrl, 'https://ipwho.is/', 'http://ip-api.com/'];
  form.servers.forEach(function(s) { urls.push(s.url); });
  var origins = [];
  urls.forEach(function(u) {
    var o = originPattern(u);
    if (o && origins.indexOf(o) === -1) origins.push(o);
  });
  return browser.permissions.request({ origins: origins }).catch(function() { return false; });
}

document.getElementById('btn-save').addEventListener('click', function() {
  var form = collectFormData();
  // must be called synchronously inside the click handler (user gesture)
  var accessPromise = requestHostAccess(form);

  var tokenPromise = form.haToken
    ? CryptoHelper.encrypt(form.haToken)
    : Promise.resolve(null);

  tokenPromise.then(function(encryptedToken) {
    var config = {
      ha: { url: form.haUrl, token: encryptedToken, devices: form.devices },
      servers: form.servers,
      pageOverrides: form.pageOverrides,
      logoScale: form.logoScale,
      searchEngine: form.searchEngine
    };
    return browser.storage.local.set({ config: config });
  }).then(function() {
    return accessPromise;
  }).then(function(granted) {
    document.getElementById('enc-badge').style.display = form.haToken ? 'inline-flex' : 'none';
    showToast(granted ? 'Settings saved — token encrypted'
                      : 'Saved, but site access was denied — widgets cannot reach your servers');
  }).catch(function(e) {
    showToast('Error: ' + e.message);
  });
});
