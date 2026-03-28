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

// ── Device item ─────────────────────────────────────────────────
function createDeviceItem(dev) {
  var div = makeEl('div', { className: 'list-item' });

  var removeBtn = makeEl('button', { className: 'btn-remove', type: 'button', title: 'Remove', textContent: '\u00d7' });
  removeBtn.addEventListener('click', function() { div.remove(); });

  var idInput   = makeEl('input', { type: 'text', className: 'dev-id',   placeholder: 'switch.living_room'   });
  var nameInput = makeEl('input', { type: 'text', className: 'dev-name', placeholder: 'Living Room Light' });
  idInput.value   = dev.id   || '';
  nameInput.value = dev.name || '';

  var row = makeEl('div', { className: 'field-row' });
  row.appendChild(makeField('Entity ID',     idInput));
  row.appendChild(makeField('Display name',  nameInput));

  div.appendChild(removeBtn);
  div.appendChild(row);
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
    if (id) devices.push({ id: id, name: name });
  });
  var servers = [];
  document.querySelectorAll('#servers-list .list-item').forEach(function(el) {
    var name      = el.querySelector('.srv-name').value.trim();
    var url       = el.querySelector('.srv-url').value.trim();
    var activeBtn = el.querySelector('.type-option.active-ext, .type-option.active-loc');
    var type      = activeBtn ? activeBtn.dataset.type : 'ext';
    if (url) servers.push({ name: name, url: url, type: type });
  });
  return {
    haUrl:   document.getElementById('ha-url').value.trim(),
    haToken: document.getElementById('ha-token').value.trim(),
    devices: devices,
    servers: servers,
    pageOverrides: {
      newTab:      document.getElementById('toggle-newtab').checked,
      homePage:    document.getElementById('toggle-homepage').checked,
      startupPage: document.getElementById('toggle-startup').checked
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
      lines.push('  ' + (i + 1) + '. ' + d.id + (d.name ? ' — ' + d.name : ''));
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

// ── Init — load + decrypt ───────────────────────────────────────
var DEFAULTS = {
  ha: { url: '', token: '', devices: [] },
  servers: [],
  pageOverrides: { newTab: true, homePage: true, startupPage: true }
};

browser.storage.local.get('config').then(function(data) {
  var config = data.config || DEFAULTS;
  if (!config.ha)            config.ha            = DEFAULTS.ha;
  if (!config.servers)       config.servers        = [];
  if (!config.pageOverrides) config.pageOverrides = DEFAULTS.pageOverrides;

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
document.getElementById('btn-save').addEventListener('click', function() {
  var form = collectFormData();

  var tokenPromise = form.haToken
    ? CryptoHelper.encrypt(form.haToken)
    : Promise.resolve(null);

  tokenPromise.then(function(encryptedToken) {
    var config = {
      ha: { url: form.haUrl, token: encryptedToken, devices: form.devices },
      servers: form.servers,
      pageOverrides: form.pageOverrides
    };
    return browser.storage.local.set({ config: config });
  }).then(function() {
    document.getElementById('enc-badge').style.display = form.haToken ? 'inline-flex' : 'none';
    showToast('Settings saved — token encrypted');
  }).catch(function(e) {
    showToast('Error: ' + e.message);
  });
});
