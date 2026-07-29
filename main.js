const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

let win;

// ---------- CONFIG ----------
const configPath = path.join(app.getPath('userData'), 'config.json');

const defaultConfig = {
  theme: 'dark',              // 'dark' | 'light'
  overlayOpacity: 0.8,        // 0.2 - 1.0
  startMaximized: true,
  apiProvider: 'ollama',      // 'ollama' | 'cloud'
  shortenModelNames: false,   // strip ":" and everything after it from local model display names
  cloudApiBaseUrl: 'https://api.openai.com/v1',
  cloudModel: 'gpt-4o-mini',
  cloudModels: [],            // history of cloud model names the user has used, newest last
  apiKeyEncrypted: null,      // base64 string, never sent to renderer as plaintext

  // App lock (PIN). Only a salted hash is ever persisted - the PIN itself
  // is never stored, so it can be verified but never recovered/displayed.
  appLockEnabled: false,
  pinSalt: null,              // hex string, unique per PIN
  pinHash: null                // hex string, scrypt(pin, salt)
};

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      const raw = fs.readFileSync(configPath, 'utf-8');
      return { ...defaultConfig, ...JSON.parse(raw) };
    }
  } catch (err) {
    console.error('Failed to read config, using defaults:', err);
  }
  return { ...defaultConfig };
}

function saveConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Failed to save config:', err);
    return false;
  }
}

let currentConfig = loadConfig();

// Never leak the encrypted/plaintext key blob (or the PIN hash/salt) to the
// renderer - it only ever needs to know WHETHER a key/PIN is saved.
function publicConfig() {
  const { apiKeyEncrypted, pinSalt, pinHash, ...rest } = currentConfig;
  return { ...rest, hasApiKey: !!apiKeyEncrypted };
}

// ---------- APP LOCK (PIN) ----------
// The PIN is never stored in plaintext or in a reversible form. We only ever
// keep a salted scrypt hash, so the original PIN can be verified but not
// recovered from disk - the same principle as how a real password would be
// stored server-side.
function hashPin(pin, saltHex) {
  const salt = Buffer.from(saltHex, 'hex');
  return crypto.scryptSync(String(pin), salt, 64).toString('hex');
}

function generateSalt() {
  return crypto.randomBytes(16).toString('hex');
}

function isValidPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

function verifyPin(pin) {
  if (!currentConfig.pinHash || !currentConfig.pinSalt) return false;
  if (typeof pin !== 'string' || !pin) return false;
  try {
    const attempt = Buffer.from(hashPin(pin, currentConfig.pinSalt), 'hex');
    const stored = Buffer.from(currentConfig.pinHash, 'hex');
    if (attempt.length !== stored.length) return false;
    return crypto.timingSafeEqual(attempt, stored);
  } catch (err) {
    console.error('PIN verification error:', err);
    return false;
  }
}

ipcMain.handle('lock:status', () => ({ enabled: !!currentConfig.appLockEnabled }));

ipcMain.handle('lock:verify', (event, pin) => ({ success: verifyPin(pin) }));

// Turning app lock ON for the first time (or re-enabling after it was off).
// No current PIN is required here since there isn't one yet.
ipcMain.handle('lock:enable', (event, newPin) => {
  if (!isValidPin(newPin)) {
    return { success: false, error: 'PIN must be exactly 4 digits.' };
  }
  const salt = generateSalt();
  currentConfig.pinSalt = salt;
  currentConfig.pinHash = hashPin(newPin, salt);
  currentConfig.appLockEnabled = true;
  const success = saveConfig(currentConfig);
  return { success };
});

// Turning app lock OFF requires proving you know the current PIN first.
ipcMain.handle('lock:disable', (event, currentPin) => {
  if (!verifyPin(currentPin)) {
    return { success: false, error: 'Incorrect PIN.' };
  }
  currentConfig.appLockEnabled = false;
  currentConfig.pinHash = null;
  currentConfig.pinSalt = null;
  const success = saveConfig(currentConfig);
  return { success };
});

// Changing the PIN also requires the current PIN.
ipcMain.handle('lock:changePin', (event, { currentPin, newPin } = {}) => {
  if (!verifyPin(currentPin)) {
    return { success: false, error: 'Incorrect current PIN.' };
  }
  if (!isValidPin(newPin)) {
    return { success: false, error: 'New PIN must be exactly 4 digits.' };
  }
  const salt = generateSalt();
  currentConfig.pinSalt = salt;
  currentConfig.pinHash = hashPin(newPin, salt);
  const success = saveConfig(currentConfig);
  return { success };
});

function getDecryptedApiKey() {
  if (!currentConfig.apiKeyEncrypted) return null;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      return safeStorage.decryptString(Buffer.from(currentConfig.apiKeyEncrypted, 'base64'));
    }
    // Fallback if OS-level encryption isn't available on this machine.
    return Buffer.from(currentConfig.apiKeyEncrypted, 'base64').toString('utf-8');
  } catch (err) {
    console.error('Failed to decrypt API key:', err);
    return null;
  }
}

ipcMain.handle('config:get', () => publicConfig());

ipcMain.handle('config:set', (event, newConfig) => {
  // apiKeyEncrypted is only ever written via config:setApiKey, never here
  const { apiKeyEncrypted, hasApiKey, ...safeUpdates } = newConfig || {};
  currentConfig = { ...currentConfig, ...safeUpdates };

  // Remember this model name in the cloud model history so it shows up
  // in the "saved models" list next time, without duplicating entries.
  const trimmedModel = (safeUpdates.cloudModel || '').trim();
  if (trimmedModel) {
    const existing = Array.isArray(currentConfig.cloudModels) ? currentConfig.cloudModels : [];
    currentConfig.cloudModels = [trimmedModel, ...existing.filter((m) => m !== trimmedModel)];
  }

  const success = saveConfig(currentConfig);
  return { success, config: publicConfig() };
});

// Lets the renderer explicitly pull the saved cloud-model history (e.g. when
// the user switches the "Source" dropdown to Cloud API in Settings).
ipcMain.handle('cloud:getModels', () => {
  return Array.isArray(currentConfig.cloudModels) ? currentConfig.cloudModels : [];
});

ipcMain.handle('config:setApiKey', (event, plainKey) => {
  if (!plainKey) {
    currentConfig.apiKeyEncrypted = null;
  } else if (safeStorage.isEncryptionAvailable()) {
    currentConfig.apiKeyEncrypted = safeStorage.encryptString(plainKey).toString('base64');
  } else {
    console.warn('OS-level encryption unavailable; storing key with basic encoding only.');
    currentConfig.apiKeyEncrypted = Buffer.from(plainKey, 'utf-8').toString('base64');
  }
  const success = saveConfig(currentConfig);
  return { success, hasApiKey: !!currentConfig.apiKeyEncrypted };
});

ipcMain.handle('config:clearApiKey', () => {
  currentConfig.apiKeyEncrypted = null;
  const success = saveConfig(currentConfig);
  return { success, hasApiKey: false };
});

// ---------- WINDOW ----------
function createWindow() {
  win = new BrowserWindow({
    width: 1000,
    height: 900,
    frame: false,
    transparent: true,
    thickFrame: true,
    backgroundColor: '#00000000',

    resizable: false,
    fullscreenable: false,
    simpleFullscreen: false,

    webPreferences: {
      nodeIntegration: false,       // was true
      contextIsolation: true,       // was false
      sandbox: false,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
  win.maximize();

  win.on('maximize', () => {
    win.webContents.send('window-maximized');
  });

  win.on('unmaximize', () => {
    win.webContents.send('window-unmaximized');
  });

  win.on('enter-full-screen', () => {
    win.setFullScreen(false);
  });
}

// ---------- BASIC WINDOW CONTROLS ----------
ipcMain.on('minimize-app', () => {
  if (win) win.minimize();
});

ipcMain.on('maximize-toggle-app', () => {
  if (win) {
    if (win.isMaximized()) {
      win.unmaximize();
    } else {
      win.maximize();
    }
  }
});

ipcMain.on('close-app', () => {
  if (win) win.close();
});

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Lets the settings panel live-preview opacity if overlay mode happens to be on already
ipcMain.on('overlay:preview-opacity', (event, value) => {
  if (win && isOverlayMode) {
    win.setOpacity(value);
  }
});

// ---------- OVERLAY MODE ----------
let isOverlayMode = false;

ipcMain.on('toggle-overlay-mode', () => {
  if (!win) return;

  if (!isOverlayMode) {
    isOverlayMode = true;

    win.unmaximize();
    win.setResizable(true);
    win.setSize(650, 400);
    win.setAlwaysOnTop(true, 'screen-saver');
    win.setOpacity(currentConfig.overlayOpacity);

    win.webContents.send('overlay-mode-enabled');
  } else {
    isOverlayMode = false;

    win.setAlwaysOnTop(false);
    win.setOpacity(1.0);

    win.setResizable(true);
    win.setSize(1000, 900);
    win.setResizable(false);

    win.maximize();

    win.webContents.send('overlay-mode-disabled');
  }
});

// ---------- CLOUD AI PROXY ----------
// The renderer never sees the API key - it just asks main to run the
// request, and main streams text chunks back tagged with the requestId.
ipcMain.on('ai:cloud-chat', async (event, { requestId, prompt, model }) => {
  const apiKey = getDecryptedApiKey();
  const baseUrl = (currentConfig.cloudApiBaseUrl || 'https://api.openai.com/v1').replace(/\/$/, '');
  const useModel = model || currentConfig.cloudModel || 'gpt-4o-mini';

  if (!apiKey) {
    win.webContents.send(`ai:cloud-error:${requestId}`, 'No API key saved. Add one in Settings.');
    return;
  }

  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: useModel,
        messages: [{ role: 'user', content: prompt }],
        stream: true
      })
    });

    if (!response.ok || !response.body) {
      const errText = await response.text().catch(() => 'Request failed');
      win.webContents.send(`ai:cloud-error:${requestId}`, errText || `HTTP ${response.status}`);
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep the last (possibly incomplete) line

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed.startsWith('data:')) continue;
        const payload = trimmed.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          const parsed = JSON.parse(payload);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) win.webContents.send(`ai:cloud-chunk:${requestId}`, delta);
        } catch (_) {
          // ignore malformed SSE fragments
        }
      }
    }

    win.webContents.send(`ai:cloud-done:${requestId}`);
  } catch (err) {
    win.webContents.send(`ai:cloud-error:${requestId}`, err.message || 'Connection error');
  }
});
