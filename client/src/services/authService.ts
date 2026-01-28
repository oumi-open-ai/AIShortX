import api from './api';

/** 用户信息接口 */
export interface User {
  id: number;
  openid: string;
  nickname: string | null;
  avatar: string | null;
  role: 'REGULAR' | 'TRIAL' | 'VIP' | 'PERMANENT';
  vipExpireAt: string | null;
  createdAt: string;
}

/** 登录状态响应接口 */
export interface LoginStatusResponse {
  status: 'waiting' | 'scanned' | 'confirmed';
  token?: string;
  user?: User;
}

/**
 * 认证服务
 * 提供用户认证、个人信息管理等功能
 */
export const authService = {
  /**
   * 获取当前用户信息
   * @returns 用户信息
   */
  getProfile: async (): Promise<User> => {
    const response = await api.get('/user/profile');
    return response.data;
  },

  /**
   * 更新用户信息
   * @param data 要更新的用户数据
   * @returns 更新后的用户信息
   */
  updateProfile: async (data: { nickname: string }): Promise<User> => {
    const response = await api.put('/user/profile', data);
    return response.data;
  },

  /**
   * 开发环境登录
   * 用于本地开发测试
   * @param userId 用户 ID（可选）
   * @returns 登录状态响应
   */
  devLogin: async (userId?: number): Promise<LoginStatusResponse> => {
    const response = await api.post('/auth/dev-login', { userId });
    return response.data;
  }
};
