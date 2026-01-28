"use strict";
const { ipcRenderer, contextBridge } = require('electron');
// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
const electronAPI = {
    minimize: () => ipcRenderer.send('window-min'),
    maximize: () => ipcRenderer.send('window-max'),
    close: () => ipcRenderer.send('window-close'),
    selectDirectory: () => ipcRenderer.invoke('select-directory'),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
    saveDraft: (folderPath, content, meta) => ipcRenderer.invoke('save-draft', folderPath, content, meta),
    checkCache: (url, type) => ipcRenderer.invoke('check-cache', url, type),
    cacheFile: (url, type) => ipcRenderer.invoke('cache-file', url, type),
    clearCache: (url, type) => ipcRenderer.invoke('clear-cache', url, type),
    copyFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-file', sourcePath, destPath),
    trimVideoWhite: (inputPath) => ipcRenderer.invoke('video:trim-white', inputPath),
    getBackendPort: () => ipcRenderer.invoke('get-backend-port'),
    // Update related
    checkUpdate: (apiBaseUrl) => ipcRenderer.invoke('check-update', apiBaseUrl),
    getVersion: () => ipcRenderer.invoke('get-version'),
    startDownload: (url) => ipcRenderer.send('start-download', url),
    installUpdate: (filePath) => ipcRenderer.send('install-update', filePath),
    onDownloadProgress: (callback) => {
        ipcRenderer.on('download-progress', (_, progress) => callback(progress));
    },
    onDownloadComplete: (callback) => {
        ipcRenderer.on('download-complete', (_, filePath) => callback(filePath));
    },
    onDownloadError: (callback) => {
        ipcRenderer.on('download-error', (_, error) => callback(error));
    },
    removeDownloadListeners: () => {
        ipcRenderer.removeAllListeners('download-progress');
        ipcRenderer.removeAllListeners('download-complete');
        ipcRenderer.removeAllListeners('download-error');
    },
    // Window state listeners
    onMaximize: (callback) => {
        ipcRenderer.on('window-maximized', () => callback());
    },
    onUnmaximize: (callback) => {
        ipcRenderer.on('window-unmaximized', () => callback());
    },
    removeWindowStateListeners: () => {
        ipcRenderer.removeAllListeners('window-maximized');
        ipcRenderer.removeAllListeners('window-unmaximized');
    },
    platform: process.platform,
};
// Use contextBridge to expose the API to the renderer process
try {
    contextBridge.exposeInMainWorld('electronAPI', electronAPI);
}
catch (error) {
    // Fallback for when contextIsolation is disabled (though it should be enabled)
    // @ts-ignore
    window.electronAPI = electronAPI;
}
// @ts-ignore
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector, text) => {
        const element = document.getElementById(selector);
        if (element)
            element.innerText = text;
    };
    for (const type of ['chrome', 'node', 'electron']) {
        // @ts-ignore
        replaceText(`${type}-version`, process.versions[type] || '');
    }
});
