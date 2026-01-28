/**
 * 认证状态管理
 * 使用 Zustand 管理用户认证状态（本地模式）
 */
import { create } from 'zustand';
import { type User, authService } from '../services/authService';

/**
 * 认证状态接口
 */
interface AuthState {
  /** 是否已认证 */
  isAuthenticated: boolean;
  /** 是否已初始化 */
  isInitialized: boolean;
  /** 当前用户信息 */
  user: User | null;
  /** 认证令牌 */
  token: string | null;
  /** 登录弹窗是否打开 */
  loginModalOpen: boolean;
  /** 登录方法 */
  login: (token: string, user: User) => void;
  /** 登出方法 */
  logout: () => void;
  /** 刷新用户资料 */
  refreshProfile: () => Promise<void>;
  /** 初始化认证状态 */
  initialize: () => Promise<void>;
  /** 设置登录弹窗状态 */
  setLoginModalOpen: (open: boolean) => void;
}

/**
 * 本地模式：默认用户
 */
const DEFAULT_USER: User = {
    id: 1,
    openid: 'local_default_user',
    nickname: 'Local Admin',
    avatar: '',
    role: 'PERMANENT',
    vipExpireAt: null,
    createdAt: new Date().toISOString()
};

export const useAuthStore = create<AuthState>((set) => ({
  isAuthenticated: true, // 本地模式始终已认证
  isInitialized: false,
  user: DEFAULT_USER,
  token: 'local_token', // 虚拟令牌
  loginModalOpen: false,
  
  login: (token, user) => {
    set({ isAuthenticated: true, user, token, loginModalOpen: false });
  },
  
  logout: () => {
    console.log('Logout ignored in local mode');
    // 可选：重置为默认用户
    // set({ user: DEFAULT_USER });
  },

  setLoginModalOpen: (_open) => set({ loginModalOpen: false }), // 防止打开登录弹窗

  refreshProfile: async () => {
    try {
      const user = await authService.getProfile();
      set({ user });
    } catch (error) {
      console.error('Failed to refresh profile', error);
    }
  },

  initialize: async () => {
    try {
        // 尝试与后端用户同步
        const user = await authService.getProfile();
        set({ isAuthenticated: true, user, isInitialized: true });
    } catch (error) {
        console.error('Failed to init profile, using default', error);
        set({ isAuthenticated: true, user: DEFAULT_USER, isInitialized: true });
    }
  }
}));
