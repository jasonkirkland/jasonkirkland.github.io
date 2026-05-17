'use strict';

// ---- BLE UUIDs (must match config.h) ----
const SVC  = '12345678-1234-5678-1234-56789abcdef0';
const CHAR = {
  plugMac:  '12345678-1234-5678-1234-56789abcdef1',
  unitName: '12345678-1234-5678-1234-56789abcdef2',
  status:   '12345678-1234-5678-1234-56789abcdef3',
  command:  '12345678-1234-5678-1234-56789abcdef4',
};

const enc = new TextEncoder();
const dec = new TextDecoder();

let bleDevice = null, bleServer = null, chars = {};
let scanStream = null, scanRafId = null;

// ---- DOM ----
const $ = id => document.getElementById(id);

// ---- Init ----
if (!navigator.bluetooth) {
  $('panel-unsupported').classList.remove('hidden');
  $('panel-connect').classList.add('hidden');
}

// ---- Helpers ----
function showStatus(el, msg, type = '') {
  el.textContent = msg;
  el.className = 'status-bar' + (type ? ` ${type}` : '');
}

function writeChar(char, value) {
  return char.writeValue(enc.encode(value));
}

async function readChar(char) {
  return dec.decode(await char.readValue());
}

// Extract a MAC address from arbitrary text (handles colons, dashes, or no separator)
function extractMac(text) {
  // Colon or dash separated: AA:BB:CC:DD:EE:FF or AA-BB-CC-DD-EE-FF
  let m = text.match(/([0-9A-Fa-f]{2}[:\-]){5}[0-9A-Fa-f]{2}/);
  if (m) return m[0].toUpperCase().replace(/-/g, ':');
  // 12 hex chars with no separator: AABBCCDDEEFF
  m = text.match(/\b([0-9A-Fa-f]{12})\b/);
  if (m) {
    const h = m[1].toUpperCase();
    return `${h[0]}${h[1]}:${h[2]}${h[3]}:${h[4]}${h[5]}:${h[6]}${h[7]}:${h[8]}${h[9]}:${h[10]}${h[11]}`;
  }
  return null;
}

// ---- BLE Connect ----
$('btn-connect').addEventListener('click', async () => {
  try {
    showStatus($('connect-status'), 'Opening Bluetooth scanner…');
    bleDevice = await navigator.bluetooth.requestDevice({
      filters: [{ services: [SVC] }],
      optionalServices: [SVC],
    });
    bleDevice.addEventListener('gattserverdisconnected', onDisconnected);

    showStatus($('connect-status'), 'Connecting…');
    bleServer = await bleDevice.gatt.connect();
    const svc = await bleServer.getPrimaryService(SVC);

    chars.plugMac  = await svc.getCharacteristic(CHAR.plugMac);
    chars.unitName = await svc.getCharacteristic(CHAR.unitName);
    chars.status   = await svc.getCharacteristic(CHAR.status);
    chars.command  = await svc.getCharacteristic(CHAR.command);

    await chars.status.startNotifications();
    chars.status.addEventListener('characteristicvaluechanged', onStatusNotify);

    $('inp-plug-mac').value  = await readChar(chars.plugMac);
    $('inp-unit-name').value = await readChar(chars.unitName);

    $('lbl-device-name').textContent = bleDevice.name || bleDevice.id;
    $('panel-connect').classList.add('hidden');
    $('panel-config').classList.remove('hidden');
    $('connect-status').className = 'status-bar hidden';
  } catch (err) {
    if (err.name !== 'NotFoundError') {
      showStatus($('connect-status'), `Connection failed: ${err.message}`, 'err');
    } else {
      $('connect-status').className = 'status-bar hidden';
    }
    bleDevice = null;
  }
});

// ---- Disconnect ----
function onDisconnected() {
  stopScanner();
  bleDevice = null; bleServer = null; chars = {};
  $('panel-config').classList.add('hidden');
  $('panel-connect').classList.remove('hidden');
  showStatus($('connect-status'), 'Disconnected.', 'warn');
}

$('btn-disconnect').addEventListener('click', () => {
  if (bleDevice?.gatt.connected) bleDevice.gatt.disconnect();
  else onDisconnected();
});

// ---- Status notifications from ESP32 ----
function onStatusNotify(evt) {
  let data;
  try { data = JSON.parse(dec.decode(evt.target.value)); } catch { return; }

  switch (data.state) {
    case 'testing':
      showStatus($('action-status'), 'Testing — scanning for plug on network…');
      $('btn-test').disabled = true;
      break;
    case 'test_ok':
      $('btn-test').disabled = false;
      showStatus($('action-status'),
        `✓ Found "${data.alias}" at ${data.ip} — plug is ${data.relay === 1 ? 'ON' : 'OFF'}`, 'ok');
      break;
    case 'saved':
      $('btn-save').disabled = false;
      showStatus($('action-status'), '✓ Saved! Device is rebooting…', 'ok');
      break;
    case 'error':
      $('btn-test').disabled = false;
      $('btn-save').disabled = false;
      showStatus($('action-status'), `✗ ${data.msg || 'Unknown error'}`, 'err');
      break;
  }
}

// ---- Camera barcode scanner ----
$('btn-scan-barcode').addEventListener('click', startScanner);
$('btn-close-scanner').addEventListener('click', stopScanner);

async function startScanner() {
  if (!('BarcodeDetector' in window)) {
    showStatus($('scan-status'),
      'Camera scanning not supported in this browser. Enter the MAC manually.', 'warn');
    return;
  }
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
    });
    const video = $('scanner-video');
    video.srcObject = scanStream;
    $('scanner-wrap').classList.remove('hidden');
    $('scan-status').className = 'status-bar hidden';
    scanRafId = requestAnimationFrame(scanFrame);
  } catch (err) {
    showStatus($('scan-status'), `Camera error: ${err.message}`, 'err');
  }
}

async function scanFrame() {
  const video = $('scanner-video');
  if (video.readyState < video.HAVE_ENOUGH_DATA) {
    scanRafId = requestAnimationFrame(scanFrame);
    return;
  }

  const canvas = $('scanner-canvas');
  canvas.width  = video.videoWidth;
  canvas.height = video.videoHeight;
  canvas.getContext('2d').drawImage(video, 0, 0);

  try {
    const detector = new BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13'] });
    const barcodes = await detector.detect(canvas);

    for (const barcode of barcodes) {
      const mac = extractMac(barcode.rawValue);
      if (mac) {
        $('inp-plug-mac').value = mac;
        showStatus($('scan-status'), `✓ Found MAC: ${mac}`, 'ok');
        stopScanner();
        return;
      }
    }

    // No MAC found yet — if any barcode was detected, show its raw value
    if (barcodes.length > 0) {
      const raw = barcodes[0].rawValue;
      // Still try to continue scanning — don't stop
      showStatus($('scan-status'), `Scanned: "${raw.substring(0, 60)}" — no MAC found, try another angle`, 'warn');
    }
  } catch {
    // BarcodeDetector failed on this frame — keep trying
  }

  scanRafId = requestAnimationFrame(scanFrame);
}

function stopScanner() {
  if (scanRafId)    { cancelAnimationFrame(scanRafId); scanRafId = null; }
  if (scanStream)   { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  $('scanner-wrap').classList.add('hidden');
  $('scanner-video').srcObject = null;
}

// ---- Test ----
$('btn-test').addEventListener('click', async () => {
  const mac = $('inp-plug-mac').value.trim();
  if (!mac) { showStatus($('action-status'), 'Enter a MAC address first.', 'err'); return; }
  try {
    await writeChar(chars.plugMac, mac);
    await writeChar(chars.command, 'test');
    $('btn-test').disabled = true;
  } catch (err) {
    showStatus($('action-status'), `BLE error: ${err.message}`, 'err');
  }
});

// ---- Save ----
$('btn-save').addEventListener('click', async () => {
  const mac  = $('inp-plug-mac').value.trim();
  const name = $('inp-unit-name').value.trim();
  if (!mac) { showStatus($('action-status'), 'A plug MAC address is required.', 'err'); return; }
  try {
    $('btn-save').disabled = true;
    showStatus($('action-status'), 'Writing to device…');
    await writeChar(chars.plugMac,  mac);
    await writeChar(chars.unitName, name);
    await writeChar(chars.command,  'save');
  } catch (err) {
    $('btn-save').disabled = false;
    showStatus($('action-status'), `BLE error: ${err.message}`, 'err');
  }
});
