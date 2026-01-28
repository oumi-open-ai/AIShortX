/**
 * Electron 预加载脚本
 * 在渲染进程中安全地暴露 Electron API
 * 使用 contextBridge 确保安全的进程间通信
 */

const { ipcRenderer, contextBridge } = require('electron');

// 定义暴露给渲染进程的 Electron API
const electronAPI: any = {
  // ========== 窗口控制 ==========
  minimize: () => ipcRenderer.send('window-min'),  // 最小化窗口
  maximize: () => ipcRenderer.send('window-max'),  // 最大化/还原窗口
  close: () => ipcRenderer.send('window-close'),   // 关闭窗口
  
  // ========== 文件系统操作 ==========
  selectDirectory: () => ipcRenderer.invoke('select-directory'),  // 选择目录对话框
  openExternal: (url: string) => ipcRenderer.invoke('open-external', url),  // 打开外部链接
  saveDraft: (folderPath: string, content: any, meta: any) => 
    ipcRenderer.invoke('save-draft', folderPath, content, meta),  // 保存剪映草稿
  
  // ========== 文件缓存管理 ==========
  checkCache: (url: string, type: 'video' | 'image') => 
    ipcRenderer.invoke('check-cache', url, type),  // 检查缓存是否存在
  cacheFile: (url: string, type: 'video' | 'image') => 
    ipcRenderer.invoke('cache-file', url, type),  // 下载并缓存文件
  clearCache: (url: string, type: 'video' | 'image') => 
    ipcRenderer.invoke('clear-cache', url, type),  // 清除损坏的缓存
  copyFile: (sourcePath: string, destPath: string) => 
    ipcRenderer.invoke('copy-file', sourcePath, destPath),  // 复制文件
  
  // ========== 视频处理 ==========
  trimVideoWhite: (inputPath: string) => 
    ipcRenderer.invoke('video:trim-white', inputPath),  // 裁剪视频开头白屏
  
  // ========== 后端通信 ==========
  getBackendPort: () => ipcRenderer.invoke('get-backend-port'),  // 获取后端服务端口
  
  // ========== 应用更新相关 ==========
  checkUpdate: (apiBaseUrl?: string) => 
    ipcRenderer.invoke('check-update', apiBaseUrl),  // 检查更新
  getVersion: () => 
    ipcRenderer.invoke('get-version'),  // 获取应用版本号
  startDownload: (url: string) => 
    ipcRenderer.send('start-download', url),  // 开始下载更新
  installUpdate: (filePath: string) => 
    ipcRenderer.send('install-update', filePath),  // 安装更新
  
  // 下载进度监听
  onDownloadProgress: (callback: any) => {
    ipcRenderer.on('download-progress', (_: any, progress: any) => callback(progress));
  },
  // 下载完成监听
  onDownloadComplete: (callback: any) => {
    ipcRenderer.on('download-complete', (_: any, filePath: any) => callback(filePath));
  },
  // 下载错误监听
  onDownloadError: (callback: any) => {
    ipcRenderer.on('download-error', (_: any, error: any) => callback(error));
  },
  // 移除下载相关监听器
  removeDownloadListeners: () => {
    ipcRenderer.removeAllListeners('download-progress');
    ipcRenderer.removeAllListeners('download-complete');
    ipcRenderer.removeAllListeners('download-error');
  },
  
  // ========== 窗口状态监听 ==========
  // 窗口最大化监听
  onMaximize: (callback: any) => {
    ipcRenderer.on('window-maximized', () => callback());
  },
  // 窗口还原监听
  onUnmaximize: (callback: any) => {
    ipcRenderer.on('window-unmaximized', () => callback());
  },
  // 移除窗口状态监听器
  removeWindowStateListeners: () => {
    ipcRenderer.removeAllListeners('window-maximized');
    ipcRenderer.removeAllListeners('window-unmaximized');
  },
  
  // ========== 平台信息 ==========
  platform: process.platform,  // 当前操作系统平台
};

// 使用 contextBridge 安全地暴露 API 到渲染进程
try {
  contextBridge.exposeInMainWorld('electronAPI', electronAPI);
} catch (error) {
  // 降级方案：当 contextIsolation 被禁用时（虽然应该启用）
  // @ts-ignore
  window.electronAPI = electronAPI;
}

// DOM 加载完成后显示版本信息
// @ts-ignore
window.addEventListener('DOMContentLoaded', () => {
    const replaceText = (selector: string, text: string) => {
      const element = document.getElementById(selector);
      if (element) element.innerText = text;
    };
  
    // 显示 Chrome、Node.js、Electron 版本号
    for (const type of ['chrome', 'node', 'electron']) {
      // @ts-ignore
      replaceText(`${type}-version`, process.versions[type as keyof NodeJS.ProcessVersions] || '');
    }
  });
