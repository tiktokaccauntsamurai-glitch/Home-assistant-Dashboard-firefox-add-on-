// ── ha-format.js — interpret Home Assistant state objects for display ──
// Shared by newtab.js and options.js.
//
// State object shape (GET /api/states/<entity_id>):
//   { entity_id: "sensor.kitchen_temperature",
//     state: "22.46",                       // always a string, may be "unavailable" / "unknown"
//     attributes: { unit_of_measurement: "°C", device_class: "temperature",
//                   state_class: "measurement", friendly_name: "Kitchen Temperature" },
//     last_changed: "...", last_updated: "...", last_reported: "..." }
//
// climate.* keeps readings in attributes.current_temperature / current_humidity,
// weather.* in attributes.temperature / humidity (+ temperature_unit).

var HaFormat = (function() {

  // Domains shown as read-only tiles when the device mode is "auto"
  var SENSOR_DOMAINS = ['sensor', 'climate', 'weather', 'number', 'input_number', 'counter'];
  var STATUS_DOMAINS = ['binary_sensor', 'person', 'device_tracker', 'lock', 'cover', 'alarm_control_panel',
                        'sun', 'update', 'event', 'select', 'input_select', 'input_text', 'vacuum', 'lawn_mower'];

  function domainOf(entityId) { return (entityId || '').split('.')[0]; }

  // dev: { id, type: 'auto' | 'toggle' | 'status' | 'sensor' }
  function resolveMode(dev) {
    if (dev.type && dev.type !== 'auto') return dev.type;
    var domain = domainOf(dev.id);
    if (SENSOR_DOMAINS.indexOf(domain) !== -1) return 'sensor';
    if (STATUS_DOMAINS.indexOf(domain) !== -1) return 'status';
    return 'toggle';
  }

  function isUnavailable(st) {
    return !st || st.state === 'unavailable' || st.state === 'unknown' || st.state === 'not_found';
  }

  // binary_sensor device_class → [off label, on label], same wording as the HA frontend
  var BINARY_LABELS = {
    battery:          ['Normal', 'Low'],
    battery_charging: ['Not charging', 'Charging'],
    carbon_monoxide:  ['Clear', 'Detected'],
    cold:             ['Normal', 'Cold'],
    connectivity:     ['Disconnected', 'Connected'],
    door:             ['Closed', 'Open'],
    garage_door:      ['Closed', 'Open'],
    gas:              ['Clear', 'Detected'],
    heat:             ['Normal', 'Hot'],
    light:            ['No light', 'Light'],
    lock:             ['Locked', 'Unlocked'],
    moisture:         ['Dry', 'Wet'],
    motion:           ['Clear', 'Detected'],
    moving:           ['Not moving', 'Moving'],
    occupancy:        ['Clear', 'Detected'],
    opening:          ['Closed', 'Open'],
    plug:             ['Unplugged', 'Plugged in'],
    presence:         ['Away', 'Home'],
    problem:          ['OK', 'Problem'],
    running:          ['Not running', 'Running'],
    safety:           ['Safe', 'Unsafe'],
    smoke:            ['Clear', 'Detected'],
    sound:            ['Clear', 'Detected'],
    tamper:           ['Clear', 'Tampering'],
    update:           ['Up-to-date', 'Update available'],
    vibration:        ['Clear', 'Detected'],
    window:           ['Closed', 'Open']
  };
  // device classes where "on" means something is wrong
  var ALERT_CLASSES = ['battery', 'carbon_monoxide', 'cold', 'gas', 'heat', 'moisture',
                       'problem', 'safety', 'smoke', 'tamper'];

  var STATE_LABELS = {
    on: 'On', off: 'Off', home: 'Home', not_home: 'Away',
    open: 'Open', closed: 'Closed', opening: 'Opening', closing: 'Closing', stopped: 'Stopped',
    locked: 'Locked', unlocked: 'Unlocked', locking: 'Locking', unlocking: 'Unlocking', jammed: 'Jammed',
    disarmed: 'Disarmed', armed_home: 'Armed home', armed_away: 'Armed away', armed_night: 'Armed night',
    armed_vacation: 'Armed vacation', armed_custom_bypass: 'Armed', arming: 'Arming', pending: 'Pending',
    triggered: 'Triggered', above_horizon: 'Above horizon', below_horizon: 'Below horizon',
    playing: 'Playing', paused: 'Paused', idle: 'Idle', standby: 'Standby',
    cleaning: 'Cleaning', docked: 'Docked', returning: 'Returning', mowing: 'Mowing', error: 'Error',
    unavailable: 'Unavailable', unknown: 'Unknown', not_found: 'Not found'
  };
  var ACTIVE_STATES = ['on', 'home', 'open', 'opening', 'closing', 'unlocked', 'unlocking', 'playing',
                       'armed_home', 'armed_away', 'armed_night', 'armed_vacation', 'armed_custom_bypass',
                       'cleaning', 'mowing', 'above_horizon'];
  var ALERT_STATES  = ['jammed', 'triggered', 'error', 'problem'];

  function prettify(s) {
    s = String(s).replace(/_/g, ' ');
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  function isNumeric(v) {
    return v !== null && v !== '' && typeof v !== 'boolean' && isFinite(Number(v));
  }

  // decimals: 'auto' (up to 1, whole numbers for percentages) or a number of fixed digits
  function formatNumber(v, decimals, unit) {
    var n = Number(v);
    var opts = (decimals === undefined || decimals === '' || decimals === 'auto')
      ? { minimumFractionDigits: 0, maximumFractionDigits: unit === '%' ? 0 : 1 }
      : { minimumFractionDigits: +decimals, maximumFractionDigits: +decimals };
    return n.toLocaleString(undefined, opts);
  }

  // HA frontend puts no space before "°" and "%"
  function joinUnit(value, unit) {
    if (!unit) return value;
    return value + (unit === '%' || unit.charAt(0) === '°' ? '' : ' ') + unit;
  }

  // Returns { label, tone } — tone: 'active' | 'inactive' | 'alert' | 'unavail' | '' (not loaded)
  function describeStatus(st, decimals) {
    if (!st) return { label: '', tone: '' };
    if (isUnavailable(st)) return { label: STATE_LABELS[st.state], tone: 'unavail' };
    var s = st.state;
    var attrs = st.attributes || {};
    var dc = attrs.device_class;

    if (domainOf(st.entity_id) === 'binary_sensor' && (s === 'on' || s === 'off')) {
      var pair = BINARY_LABELS[dc] || ['Off', 'On'];
      if (s === 'off') return { label: pair[0], tone: 'inactive' };
      return { label: pair[1], tone: ALERT_CLASSES.indexOf(dc) !== -1 ? 'alert' : 'active' };
    }
    if (isNumeric(s)) {
      return { label: joinUnit(formatNumber(s, decimals, attrs.unit_of_measurement), attrs.unit_of_measurement), tone: 'inactive' };
    }
    return {
      label: STATE_LABELS[s] || prettify(s),
      tone:  ACTIVE_STATES.indexOf(s) !== -1 ? 'active' : ALERT_STATES.indexOf(s) !== -1 ? 'alert' : 'inactive'
    };
  }

  // Main reading of an entity → { text, value, unit, kind } or null when unavailable.
  // text is value + unit; kind is the device_class ('temperature', 'humidity', ...) used to pick an icon.
  function primaryReading(st, decimals) {
    if (isUnavailable(st)) return null;
    var attrs = st.attributes || {};
    var domain = domainOf(st.entity_id);
    var value, unit, kind;

    if (domain === 'climate') {
      value = attrs.current_temperature; unit = '°'; kind = 'temperature';
    } else if (domain === 'weather') {
      value = attrs.temperature; unit = attrs.temperature_unit || '°'; kind = 'temperature';
    } else {
      value = st.state; unit = attrs.unit_of_measurement || ''; kind = attrs.device_class || null;
    }
    if (value === undefined || value === null) return null;
    if (!isNumeric(value)) return { text: prettify(value), value: prettify(value), unit: '', kind: kind };
    var num = formatNumber(value, decimals, unit);
    return { text: joinUnit(num, unit), value: num, unit: unit, kind: kind };
  }

  // Humidity carried inside a climate/weather entity, if any
  function builtinHumidity(st, decimals) {
    if (isUnavailable(st)) return null;
    var attrs = st.attributes || {};
    var domain = domainOf(st.entity_id);
    var v = domain === 'climate' ? attrs.current_humidity
          : domain === 'weather' ? attrs.humidity
          : undefined;
    if (!isNumeric(v)) return null;
    var num = formatNumber(v, decimals, '%');
    return { text: joinUnit(num, '%'), value: num, unit: '%', kind: 'humidity' };
  }

  // Short text tag shown before a reading, keyed by HA device_class
  var KIND_TAGS = {
    temperature: 'T', humidity: 'H', moisture: 'H', power: 'W', energy: 'E', pressure: 'P',
    atmospheric_pressure: 'P', battery: 'B', voltage: 'V', current: 'A', illuminance: 'L',
    carbon_dioxide: 'CO2', pm25: 'PM', pm10: 'PM', wind_speed: 'WS', speed: 'S'
  };

  // → { tag, text }. The unit is dropped when it repeats the tag ("W 412.7", not "W 412.7 W"),
  // and kept when it adds information ("T 22.5°C", "W 1.2 kW", "A 350 mA").
  function taggedReading(reading) {
    if (!reading) return { tag: '', text: '—' };
    var tag = KIND_TAGS[reading.kind] || '';
    var text = tag && reading.unit === tag ? reading.value : reading.text;
    return { tag: tag, text: text };
  }

  function formatAgo(iso) {
    if (!iso) return '';
    var sec = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
    if (!isFinite(sec)) return '';
    if (sec < 60)    return 'just now';
    if (sec < 3600)  return Math.floor(sec / 60) + ' min ago';
    if (sec < 86400) return Math.floor(sec / 3600) + ' h ago';
    return Math.floor(sec / 86400) + ' d ago';
  }

  // Newer HA versions (2024.3+) report last_reported even when the value did not change
  function lastSeen(st) {
    return st ? (st.last_reported || st.last_updated || st.last_changed) : null;
  }

  return {
    domainOf: domainOf,
    resolveMode: resolveMode,
    isUnavailable: isUnavailable,
    describeStatus: describeStatus,
    primaryReading: primaryReading,
    builtinHumidity: builtinHumidity,
    taggedReading: taggedReading,
    formatAgo: formatAgo,
    lastSeen: lastSeen
  };
})();
