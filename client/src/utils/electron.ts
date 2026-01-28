/**
 * Electron 相关工具函数
 */

/**
 * 在外部浏览器中打开 URL
 * 如果在 Electron 环境中，使用 electronAPI.openExternal
 * 否则使用浏览器的 window.open
 * @param url 要打开的 URL
 */
export const openExternalUrl = (url: string): void => {
  try {
    const electronAPI = (window as any).electronAPI;
    
    if (electronAPI && typeof electronAPI.openExternal === 'function') {
      electronAPI.openExternal(url).catch((err: Error) => {
        console.error('electronAPI.openExternal failed:', err);
        window.open(url, '_blank');
      });
    } else {
      window.open(url, '_blank');
    }
  } catch (error) {
    console.error('openExternalUrl error:', error);
    window.open(url, '_blank');
  }
};

/**
 * 检查是否在 Electron 环境中运行
 * @returns 是否在 Electron 环境中
 */
export const isElectron = (): boolean => {
  return (
    typeof window !== 'undefined' &&
    (window as any).electronAPI !== undefined
  );
};
