import { type Settings } from '../types';
import api from './api';

/** 默认设置 */
const DEFAULT_SETTINGS: Omit<Settings, 'id' | 'updatedAt'> = {
  jianyingPath: 'C:\\Users\\Admin\\AppData\\Local\\JianyingPro\\User Data\\Projects'
};

/**
 * 设置服务
 * 提供系统设置、AI 模型配置等管理功能
 */
export const settingsService = {
  /**
   * 获取系统设置
   * 如果远程获取失败，使用默认设置
   * @returns 系统设置对象
   */
  async getSettings(): Promise<Settings> {
    try {
      const response = await api.get('/settings/system');
      const remoteSettings = response.data || {};

      // 合并默认值以确保所有字段都存在
      return {
        ...DEFAULT_SETTINGS,
        ...remoteSettings,
        // 如果 updatedAt 存在，确保它是 Date 对象，否则使用当前时间
        updatedAt: remoteSettings.updatedAt ? new Date(remoteSettings.updatedAt) : new Date()
      } as Settings;
    } catch (error) {
      console.error('Failed to fetch settings from cloud, using defaults:', error);
      // 如果 API 失败（例如离线），则回退到默认值
      return {
        ...DEFAULT_SETTINGS,
        updatedAt: new Date()
      } as Settings;
    }
  },

  /**
   * 获取可用的 AI 模型列表
   * @returns AI 模型配置对象
   */
  async getAvailableAIModels(): Promise<any> {
    try {
      const response = await api.get('/settings/ai-models');
      return response.data || {};
    } catch (error) {
      console.error('Failed to fetch available AI models:', error);
      return {};
    }
  },

  /**
   * 获取用户的 AI 配置
   * @returns AI 配置对象
   */
  async getUserAIConfig(): Promise<any> {
    try {
      const response = await api.get('/settings/ai_model_config');
      return response.data || {};
    } catch (error) {
      console.error('Failed to fetch user AI config:', error);
      return {};
    }
  },

  /**
   * 保存用户的 AI 配置
   * @param config AI 配置对象
   */
  async saveUserAIConfig(config: any): Promise<void> {
    try {
      await api.post('/settings', {
        key: 'ai_model_config',
        value: config
      });
    } catch (error) {
      console.error('Failed to save user AI config:', error);
      throw error;
    }
  },

  /**
   * 更新系统设置
   * @param settings 要更新的设置字段
   */
  async updateSettings(settings: Partial<Settings>): Promise<void> {
    try {
      // 首先获取当前设置进行合并
      const currentSettings = await this.getSettings();
      const newSettings = {
        ...currentSettings,
        ...settings,
        updatedAt: new Date()
      };

      // 移除 'id' 字段，因为不将其存储在 JSON 值中
      const { id, ...settingsToSave } = newSettings;

      await api.post('/settings', {
        key: 'system',
        value: settingsToSave
      });
    } catch (error) {
      console.error('Failed to save settings to cloud:', error);
      throw error;
    }
  },

  /**
   * 获取单个设置项
   * @param key 设置键名
   * @returns 设置值或 undefined
   */
  async getSetting<K extends keyof Settings>(key: K): Promise<Settings[K] | undefined> {
    const settings = await this.getSettings();
    return settings[key];
  },

  // ==================== LLM 配置管理 ====================

  /**
   * 获取用户的 LLM 配置列表
   * @returns LLM 配置列表
   */
  async getUserLLMConfigs(): Promise<any[]> {
    try {
      const response = await api.get('/settings/llm');
      return response.data || [];
    } catch (error) {
      console.error('Failed to fetch user LLM configs:', error);
      return [];
    }
  },

  /**
   * 创建用户 LLM 配置
   * @param config LLM 配置数据
   * @returns 创建的配置对象
   */
  async createUserLLMConfig(config: {
    name: string;
    provider: string;
    modelValue: string;
    baseUrl: string;
    apiKey: string;
  }): Promise<any> {
    const response = await api.post('/settings/llm', config);
    return response.data;
  },

  /**
   * 更新用户 LLM 配置
   * @param id 配置 ID
   * @param config 要更新的字段
   * @returns 更新后的配置对象
   */
  async updateUserLLMConfig(id: number, config: {
    name?: string;
    provider?: string;
    modelValue?: string;
    baseUrl?: string;
    apiKey?: string;
    isActive?: boolean;
  }): Promise<any> {
    const response = await api.put(`/settings/llm/${id}`, config);
    return response.data;
  },

  /**
   * 删除用户 LLM 配置
   * @param id 配置 ID
   */
  async deleteUserLLMConfig(id: number): Promise<void> {
    await api.delete(`/settings/llm/${id}`);
  },

  /**
   * 测试用户 LLM 配置
   * 验证配置是否可用
   * @param config LLM 配置数据
   * @returns 测试结果
   */
  async testUserLLMConfig(config: {
    baseUrl: string;
    apiKey: string;
    modelValue: string;
  }): Promise<any> {
    const response = await api.post('/settings/llm/test', config);
    return response.data;
  }
};
