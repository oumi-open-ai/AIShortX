/**
 * 提示词服务
 * 用于管理和获取 AI 提示词配置
 */
import api from './api';

/**
 * 提示词变量接口
 */
export interface PromptVariable {
  /** 变量标签 */
  label: string;
  /** 变量值 */
  value: string;
}

/**
 * 提示词配置接口
 */
export interface PromptConfig {
  /** 提示词类型 */
  type: string;
  /** 提示词名称 */
  name: string;
  /** 提示词分组 */
  group?: string;
  /** 系统提示词内容 */
  systemContent: string;
  /** 用户提示词内容 */
  userContent: string | null;
  /** 是否启用 */
  enabled: boolean;
  /** 变量列表 */
  variables: PromptVariable[];
  /** 更新时间 */
  updatedAt: string;
}

export const promptService = {
  /**
   * 获取所有提示词配置
   * @returns 提示词配置列表
   */
  async getPromptConfigs(): Promise<PromptConfig[]> {
    try {
      const response = await api.get('/prompts/configs');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch prompt configs:', error);
      return [];
    }
  },

  /**
   * 更新提示词配置
   * @param type - 提示词类型
   * @param data - 更新数据（内容或启用状态）
   * @returns 更新结果
   */
  async updatePromptConfig(type: string, data: { content?: string; enabled?: boolean }): Promise<any> {
    try {
      const response = await api.post('/prompts/configs', {
        type,
        ...data
      });
      return response.data;
    } catch (error) {
      console.error('Failed to update prompt config:', error);
      throw error;
    }
  },

  /**
   * 根据类型获取系统提示词模板
   * @param type - 提示词类型
   * @returns 系统提示词模板列表
   */
  async getSystemPromptsByType(type: string): Promise<{ id: number; name: string; content: string; isDefault: boolean }[]> {
    try {
      const response = await api.get(`/prompts/system-templates/${type}`);
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch system prompts:', error);
      return [];
    }
  }
};
