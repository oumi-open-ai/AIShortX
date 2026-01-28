// 缓存应用版本号的 Promise，避免重复调用
let appVersionPromise: Promise<string | null> | null = null;

/**
 * 获取应用版本号
 * 优先级：环境变量 > Electron API
 * 
 * @returns 返回版本号字符串，如果无法获取则返回 null
 */
export const getAppVersion = async (): Promise<string | null> => {
  // 1. 首先尝试从环境变量中获取版本号
  const envVersion = (import.meta.env as any).VITE_APP_VERSION as string | undefined;
  if (envVersion) return envVersion;

  // 2. 尝试从 Electron API 获取版本号
  const electronAPI = (window as any).electronAPI;
  if (electronAPI?.getVersion) {
    // 使用缓存的 Promise，避免多次调用
    if (!appVersionPromise) {
      appVersionPromise = Promise.resolve(electronAPI.getVersion())
        .then((v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null))
        .catch(() => null);
    }
    return appVersionPromise;
  }

  // 3. 无法获取版本号
  return null;
};

