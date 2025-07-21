const { contextBridge, ipcRenderer } = require('electron');

// Expose safe APIs to renderer process
contextBridge.exposeInMainWorld('electronAPI', {
    startCapture: () => ipcRenderer.send('start-capture'),
    captureArea: (bounds) => ipcRenderer.send('capture-area', bounds),
    cancelCapture: () => ipcRenderer.send('cancel-capture'),
    onScreenshotReady: (callback) => ipcRenderer.on('screenshot-ready', callback),
    onProcessOCR: (callback) => ipcRenderer.on('process-ocr', callback),
    getLanguageSetting: () => ipcRenderer.send('get-language-setting'),
    onLanguageChanged: (callback) => ipcRenderer.on('language-changed', callback),
    onLanguageSetting: (callback) => ipcRenderer.on('language-setting', callback),
    getAutoCopySetting: () => ipcRenderer.send('get-autocopy-setting'),
    onAutoCopyChanged: (callback) => ipcRenderer.on('autocopy-changed', callback),
    onAutoCopySetting: (callback) => ipcRenderer.on('autocopy-setting', callback),
    autoCopyText: (text) => ipcRenderer.send('auto-copy-text', text),
    removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
    
    // Window control APIs
    minimizeWindow: () => ipcRenderer.send('window-minimize'),
    closeWindow: () => ipcRenderer.send('window-close')
});
