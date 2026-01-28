import api from './api';
import { type Style } from '../types';

/**
 * 风格服务
 * 提供画面风格管理相关的 API 调用
 */
export const styleService = {
  /**
   * 获取所有风格列表
   * @returns 风格列表
   */
  async getStyles(): Promise<Style[]> {
    const response = await api.get('/styles');
    return response.data;
  },

  /**
   * 创建新风格
   * @param data 风格数据（不包含 id 和 userId）
   * @returns 创建的风格对象
   */
  async createStyle(data: Omit<Style, 'id' | 'userId'>): Promise<Style> {
    const response = await api.post('/styles', data);
    return response.data;
  },

  /**
   * 更新风格
   * @param id 风格 ID
   * @param data 要更新的字段
   * @returns 更新后的风格对象
   */
  async updateStyle(id: number, data: Partial<Omit<Style, 'id' | 'userId'>>): Promise<Style> {
    const response = await api.put(`/styles/${id}`, data);
    return response.data;
  },

  /**
   * 删除风格
   * @param id 风格 ID
   */
  async deleteStyle(id: number): Promise<void> {
    await api.delete(`/styles/${id}`);
  }
};
