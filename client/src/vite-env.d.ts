/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

interface ElectronAPI {
  cacheFile: (url: string, type: 'video' | 'image') => Promise<string>;
  copyFile: (source: string, dest: string) => Promise<{ success: boolean; error?: string }>;
  saveDraft: (folderPath: string, content: any, meta: any) => Promise<{ success: boolean; error?: string }>;
  trimVideoWhite: (inputPath: string) => Promise<{ success: boolean; path?: string; trimmed?: boolean; error?: string }>;

  // Window state
  onMaximize: (callback: () => void) => void;
  onUnmaximize: (callback: () => void) => void;
  removeWindowStateListeners: () => void;

  // App version
  getVersion: () => Promise<string>;
  platform: string;
}

interface Window {
  electronAPI: ElectronAPI;
}
