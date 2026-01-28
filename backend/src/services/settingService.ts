import prisma from '../utils/prisma';
import { AIModelManager } from './aiModelManager';
import { AIProvider } from './api/types';

/** 用户设置接口 */
export interface UserSettings {
  zeroapiKey?: string;
  [key: string]: any;
}

/**
 * 设置服务类
 * 处理用户设置和 AI 配置相关的业务逻辑
 */
export class SettingService {

  /**
   * 获取用户的有效 AI 配置
   * 处理提供商选择逻辑（自动/回退）并获取 API 密钥
   * 
   * @param userId 用户 ID
   * @param type AI 服务类型（'llm' | 'video' | 'image'）
   * @returns 包含 provider、apiKey、model（内部 ID）和 modelValue（提供商特定 ID）的对象
   * @throws 如果设置缺失或配置错误则抛出错误
   */
  static async getEffectiveAIConfig(userId: number, type: 'llm' | 'video' | 'image'): Promise<{ provider: AIProvider, apiKey: string, model?: string, modelValue?: string }> {
    try {
      let config;
      if (type === 'llm') {
        config = await AIModelManager.getLLMProvider(userId);
      } else if (type === 'video') {
        config = await AIModelManager.getVideoProvider(userId);
      } else {
        config = await AIModelManager.getImageProvider(userId);
      }

      return {
        provider: config.providerName as any,
        apiKey: config.apiKey,
        model: config.modelId,
        modelValue: config.modelValue
      };
    } catch (error) {
      console.error(`Failed to get effective AI config for ${type}:`, error);
      throw error;
    }
  }
}
