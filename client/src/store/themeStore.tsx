/**
 * 主题状态管理
 * 使用 Zustand 管理应用主题（亮色/暗色模式）
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * 主题类型
 */
type Theme = 'light' | 'dark';

/**
 * 主题状态接口
 */
interface ThemeState {
  /** 当前主题 */
  theme: Theme;
  /** 切换主题 */
  toggleTheme: () => void;
  /** 设置主题 */
  setTheme: (theme: Theme) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      theme: 'dark', // 默认为暗色主题
      toggleTheme: () => set((state) => {
        const newTheme = state.theme === 'dark' ? 'light' : 'dark';
        // 更新 document 类名
        if (newTheme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { theme: newTheme };
      }),
      setTheme: (theme) => set(() => {
        if (theme === 'dark') {
          document.documentElement.classList.add('dark');
        } else {
          document.documentElement.classList.remove('dark');
        }
        return { theme };
      }),
    }),
    {
      name: 'theme-storage',
    }
  )
);
