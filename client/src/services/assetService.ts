import api from './api';
import { type Asset } from '../types';

export const assetService = {
  /**
   * 获取资源列表
   * @param relatedId 关联ID (如角色ID, 场景ID)
   * @param category 任务分类 (用于推断用途和类型)
   * @param type 资源类型 (可选, 'image' | 'video')
   */
  async getAssets(relatedId: number, category: string, type?: string): Promise<Asset[]> {
    try {
      const response = await api.get('/assets', {
        params: {
          relatedId,
          category,
          type
        }
      });
      return response.data || [];
    } catch (error) {
      console.error('Failed to get assets:', error);
      return [];
    }
  },

  /**
   * 创建资源
   */
  async createAsset(data: {
    projectId: number;
    type: 'image' | 'video' | 'audio';
    usage: 'character' | 'scene' | 'prop' | 'storyboard' | 'general';
    relatedId?: number;
    url: string;
    source?: string;
  }): Promise<Asset | null> {
    try {
      const response = await api.post('/assets', data);
      return response.data;
    } catch (error) {
      console.error('Failed to create asset:', error);
      return null;
    }
  }
};
