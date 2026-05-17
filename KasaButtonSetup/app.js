'use strict';

// ---- BLE UUIDs (must match config.h) ----
const SVC  = '12345678-1234-5678-1234-56789abcdef0';
const CHAR = {
  wifiSsid:  '12345678-1234-5678-1234-56789abcdef1',
  wifiPass:  '12345678-1234-5678-1234-56789abcdef2',
  kasaId:    '12345678-1234-5678-1234-56789abcdef3',
  kasaAlias: '12345678-1234-5678-1234-56789abcdef4',
  unitName:  '12345678-1234-5678-1234-56789abcdef5',
  status:    '12345678-1234-5678-1234-56789abcdef6',
  command:   '12345678-1234-5678-1234-56789abcdef7',
};

// ---- State ----
let bleDevice = null, bleServer = null, chars = {};

// ---- DOM refs ----
const $ = id => document.getElementById(id);
const panelConnect = $('panel-connect');
const panelConfig  = $('panel-config');
const btnConnect   = $('btn-connect');
const btnDisconnect = $('btn-disconnect');
const lblDevice    = $('lbl-device-name');
const connectStatus = $('connect-status');
const btnScanKasa  = $('btn-scan-kasa');
const kasaScanStatus = $('kasa-scan-status');
const deviceList   = $('kasa-device-list');
const btnTest      = $('btn-test');
const btnSave      = $('btn-save');
const actionStatus = $('action-status');

// ---- Helpers ----
const enc = new TextEncoder();
const dec = new TextDecoder();

function showStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = 'status-bar' + (type ? ` ${type}` : '');
}

function writeChar(char, value) {
  return char.writeValue(enc.encode(value));
}

async function readChar(char) {
  const val = await char.readValue();
  return dec.decode(val);
}

// ---- Connect ----
btnConnect.addEventListener('click', async () => {
  if (!navigator.bluetooth) {
    showStatus(connectStatus, 'Web Bluetooth is not available. Use Chrome or Edge.', 'err');
    return;
  }
  try {
    showStatus(connectStatus, 'Opening Bluetooth scanner…');
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SVC] }],
      optionalServices: [SVC],
    });
    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

    showStatus(connectStatus, 'Connecting…');
    bleServer = await bleDevice.gatt.connect();

    const svc = await bleServer.getPrimaryService(SVC);
    chars.wifiSsid  = await svc.getCharacteristic(CHAR.wifiSsid);
    chars.wifiPass  = await svc.getCharacteristic(CHAR.wifiPass);
    chars.kasaId    = await svc.getCharacteristic(CHAR.kasaId);
    chars.kasaAlias = await svc.getCharacteristic(CHAR.kasaAlias);
    chars.unitName  = await svc.getCharacteristic(CHAR.unitName);
    chars.status    = await svc.getCharacteristic(CHAR.status);
    chars.command   = await svc.getCharacteristic(CHAR.command);

    // Subscribe to status notifications
    await chars.status.startNotifications();
    chars.status.addEventListener('characteristicvaluechanged', onStatusNotify);

    // Read existing values from device
    $('inp-unit-name').value = await readChar(chars.unitName);
    $('inp-ssid').value      = await readChar(chars.wifiSsid);
    $('inp-kasa-id').value   = await readChar(chars.kasaId);
    $('inp-kasa-alias').value = await readChar(chars.kasaAlias);

    lblDevice.textContent = bleDevice.name || bleDevice.id;
    panelConnect.classList.add('hidden');
    panelConfig.classList.remove('hidden');
    connectStatus.className = 'status-bar hidden';
  } catch (err) {
    if (err.name !== 'NotFoundError') {  // user cancelled = NotFoundError, don't show error
      showStatus(connectStatus, `Connection failed: ${err.message}`, 'err');
    } else {
      connectStatus.className = 'status-bar hidden';
    }
    bleDevice = null;
  }
});

// ---- Disconnect ----
function onDisconnected() {
  bleDevice = null; bleServer = null; chars = {};
  panelConfig.classList.add('hidden');
  panelConnect.classList.remove('hidden');
  showStatus(connectStatus, 'Disconnected from device.', 'warn');
}

btnDisconnect.addEventListener('click', () => {
  if (bleDevice && bleDevice.gatt.connected) bleDevice.gatt.disconnect();
  else onDisconnected();
});

// ---- Status notifications from ESP32 ----
function onStatusNotify(evt) {
  const raw = dec.decode(evt.target.value);
  let data;
  try { data = JSON.parse(raw); } catch { return; }

  switch (data.state) {
    case 'scanning':
      showStatus(kasaScanStatus, 'Scanning network for Kasa devices…');
      btnScanKasa.disabled = true;
      break;

    case 'wifi_connecting':
      showStatus(kasaScanStatus, 'Connecting to WiFi first…');
      break;

    case 'scan_result':
      btnScanKasa.disabled = false;
      renderDeviceList(data.devices || []);
      break;

    case 'testing':
      showStatus(actionStatus, 'Testing connection…');
      btnTest.disabled = true;
      break;

    case 'test_ok':
      btnTest.disabled = false;
      showStatus(actionStatus,
        `✓ Found "${data.alias}" at ${data.ip} — plug is ${data.relay === 1 ? 'ON' : 'OFF'}`, 'ok');
      break;

    case 'saved':
      showStatus(actionStatus, '✓ Saved! Device is rebooting…', 'ok');
      btnSave.disabled = false;
      break;

    case 'error':
      btnScanKasa.disabled = false;
      btnTest.disabled = false;
      btnSave.disabled = false;
      const target = data.msg?.includes('WiFi') ? kasaScanStatus : actionStatus;
      showStatus(target, `✗ ${data.msg || 'Unknown error'}`, 'err');
      break;
  }
}

// ---- Kasa device list ----
function renderDeviceList(devices) {
  deviceList.innerHTML = '';
  if (devices.length === 0) {
    showStatus(kasaScanStatus, 'No Kasa devices found on the network.', 'warn');
    return;
  }
  showStatus(kasaScanStatus, `Found ${devices.length} device${devices.length > 1 ? 's' : ''} — tap to select:`, 'ok');
  deviceList.classList.remove('hidden');

  devices.forEach(dev => {
    const item = document.createElement('div');
    item.className = 'kasa-device-item';
    item.innerHTML = `
      <div>
        <div class="name">${esc(dev.alias)}</div>
        <div class="meta">${esc(dev.model)} · ${esc(dev.ip)}</div>
        <div class="meta" style="word-break:break-all;margin-top:2px;opacity:0.6">${esc(dev.id)}</div>
      </div>
      <span class="relay-badge ${dev.state === 1 ? 'relay-on' : 'relay-off'}">${dev.state === 1 ? 'on' : 'off'}</span>
    `;
    item.addEventListener('click', () => {
      document.querySelectorAll('.kasa-device-item').forEach(el => el.classList.remove('selected'));
      item.classList.add('selected');
      $('inp-kasa-id').value   = dev.id;
      $('inp-kasa-alias').value = dev.alias;
    });
    deviceList.appendChild(item);
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ---- Scan for Kasa devices ----
btnScanKasa.addEventListener('click', async () => {
  // Write WiFi creds first so the ESP32 can connect
  try {
    await writeChar(chars.wifiSsid, $('inp-ssid').value.trim());
    const pass = $('inp-pass').value;
    if (pass) await writeChar(chars.wifiPass, pass);
    await writeChar(chars.command, 'scan');
    deviceList.classList.add('hidden');
    deviceList.innerHTML = '';
  } catch (err) {
    showStatus(kasaScanStatus, `BLE write failed: ${err.message}`, 'err');
  }
});

// ---- Test ----
btnTest.addEventListener('click', async () => {
  try {
    await pushAllChars();
    await writeChar(chars.command, 'test');
    btnTest.disabled = true;
  } catch (err) {
    showStatus(actionStatus, `BLE write failed: ${err.message}`, 'err');
  }
});

// ---- Save ----
btnSave.addEventListener('click', async () => {
  if (!$('inp-ssid').value.trim()) {
    showStatus(actionStatus, 'WiFi SSID is required.', 'err');
    return;
  }
  if (!$('inp-kasa-id').value.trim()) {
    showStatus(actionStatus, 'Kasa Device ID is required. Run a scan or paste an ID.', 'err');
    return;
  }
  try {
    btnSave.disabled = true;
    showStatus(actionStatus, 'Writing config to device…');
    await pushAllChars();
    await writeChar(chars.command, 'save');
  } catch (err) {
    btnSave.disabled = false;
    showStatus(actionStatus, `BLE write failed: ${err.message}`, 'err');
  }
});

async function pushAllChars() {
  await writeChar(chars.unitName,  $('inp-unit-name').value.trim());
  await writeChar(chars.wifiSsid,  $('inp-ssid').value.trim());
  const pass = $('inp-pass').value;
  if (pass) await writeChar(chars.wifiPass, pass);
  await writeChar(chars.kasaId,    $('inp-kasa-id').value.trim());
  await writeChar(chars.kasaAlias, $('inp-kasa-alias').value.trim());
}
