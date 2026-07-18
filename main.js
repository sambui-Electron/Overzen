const { app, BrowserWindow, ipcMain, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');

let win;

// ---------- CONFIG ----------
const configPath = path.join(app.getPath('userData'), 'config.json');

const defaultConfig = {
  theme: 'dark',              // 'dark' | 'light'
  overlayOpacity: 0.8,        // 0.2 - 1.0
  startMaximized: true,
  apiProvider: 'ollama',      // 'ollama' | 'cloud'
  cloudApiBaseUrl: 'https://api.openai.com/v1',
  cloudModel: 'gpt-4o-mini',
  apiKeyEncrypted: null       // base64 string, never sent to renderer as plaintext
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

// Never leak the encrypted/plaintext key blob to the renderer -
// it only ever needs to know WHETHER a key is saved.
function publicConfig() {
  const { apiKeyEncrypted, ...rest } = currentConfig;
  return { ...rest, hasApiKey: !!apiKeyEncrypted };
}

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
  const success = saveConfig(currentConfig);
  return { success, config: publicConfig() };
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