const { contextBridge, ipcRenderer } = require('electron');
const hljs = require('highlight.js');

// Preload always has Node access (regardless of the renderer's
// nodeIntegration setting), so this is the safe place to require it.
contextBridge.exposeInMainWorld('hljs', hljs);

contextBridge.exposeInMainWorld('api', {
  // window controls
  minimize: () => ipcRenderer.send('minimize-app'),
  maximizeToggle: () => ipcRenderer.send('maximize-toggle-app'),
  close: () => ipcRenderer.send('close-app'),
  toggleOverlay: () => ipcRenderer.send('toggle-overlay-mode'),

  // events from main -> renderer
  onMaximized: (cb) => ipcRenderer.on('window-maximized', cb),
  onUnmaximized: (cb) => ipcRenderer.on('window-unmaximized', cb),
  onOverlayEnabled: (cb) => ipcRenderer.on('overlay-mode-enabled', cb),
  onOverlayDisabled: (cb) => ipcRenderer.on('overlay-mode-disabled', cb),

  // config
  getConfig: () => ipcRenderer.invoke('config:get'),
  setConfig: (cfg) => ipcRenderer.invoke('config:set', cfg),
  setApiKey: (plainKey) => ipcRenderer.invoke('config:setApiKey', plainKey),
  clearApiKey: () => ipcRenderer.invoke('config:clearApiKey'),

  // live overlay opacity preview while dragging the slider
  previewOverlayOpacity: (value) => ipcRenderer.send('overlay:preview-opacity', value),

  // cloud AI streaming - key never touches the renderer
  cloudChat: (prompt, model, { onChunk, onDone, onError }) => {
    const requestId = Math.random().toString(36).slice(2);

    const chunkChannel = `ai:cloud-chunk:${requestId}`;
    const doneChannel = `ai:cloud-done:${requestId}`;
    const errorChannel = `ai:cloud-error:${requestId}`;

    const cleanup = () => {
      ipcRenderer.removeAllListeners(chunkChannel);
      ipcRenderer.removeAllListeners(doneChannel);
      ipcRenderer.removeAllListeners(errorChannel);
    };

    ipcRenderer.on(chunkChannel, (event, text) => onChunk && onChunk(text));
    ipcRenderer.on(doneChannel, () => { onDone && onDone(); cleanup(); });
    ipcRenderer.on(errorChannel, (event, message) => { onError && onError(message); cleanup(); });

    ipcRenderer.send('ai:cloud-chat', { requestId, prompt, model });
  }
});