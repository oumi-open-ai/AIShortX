import fs from 'fs';
import path from 'path';
import prisma from '../utils/prisma';
import { ZeroapiProvider } from './api/providers/ZeroapiProvider';
import { StandardLLMProvider } from './api/llm/StandardLLMProvider';
import { ILLMProvider } from './api/interfaces/ILLMProvider';
import { IVideoProvider } from './api/interfaces/IVideoProvider';
import { IImageProvider } from './api/interfaces/IImageProvider';

/** 模型提供商配置接口 */
export interface ModelProviderConfig {
  name: string;
  model_value: string;
  endpoint?: string;
}

/** 模型配置接口 */
export interface ModelConfig {
  name: string;
  type: string;
  capabilities?: string[]; // 模型能力列表，如 ['text2image', 'image2image']
  default_provider: string;
  providers: Record<string, ModelProviderConfig>;
}

/** LLM 配置结果接口 */
export interface LLMConfigResult {
  provider: ILLMProvider;
  apiKey: string;
  modelValue: string;
  providerName: string;
  modelId: string;
}

/** 视频配置结果接口 */
export interface VideoConfigResult {
  provider: IVideoProvider;
  apiKey: string;
  modelValue: string;
  providerName: string;
  modelId: string;
}

/** 图片配置结果接口 */
export interface ImageConfigResult {
  provider: IImageProvider;
  apiKey: string;
  modelValue: string;
  providerName: string;
  modelId: string;
}

/**
 * AI 模型管理器
 * 负责加载和管理 AI 模型配置，提供统一的模型访问接口
 * 支持 LLM、图片生成、视频生成等多种模型类型
 */
export class AIModelManager {
  /** 模型配置缓存 */
  private static configs: Record<string, Record<string, ModelConfig>> = {};
  /** 配置是否已加载 */
  private static loaded = false;

  /**
   * 加载模型配置文件
   * 从 config/ai_models 目录加载图片和视频模型配置
   * LLM 配置从数据库加载
   */
  private static loadConfigs() {
    if (this.loaded) return;

    const configDir = path.join(__dirname, '../../config/ai_models');
    // 只从文件加载图片和视频配置，LLM 配置从数据库处理
    const files = ['image.json', 'video.json'];

    files.forEach(file => {
      try {
        const filePath = path.join(configDir, file);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const categoryConfig = JSON.parse(content);

          // 从文件名确定类别
          const category = file.replace('.json', ''); // image, video
          this.configs[category] = categoryConfig;
        }
      } catch (error) {
        console.error(`Failed to load AI config file ${file}:`, error);
      }
    });

    this.loaded = true;
  }

  /**
   * 获取提供商实例
   * 根据提供商名称创建对应的提供商实例
   * @param providerName 提供商名称
   * @param type 类型（video 或 image）
   * @returns 提供商实例
   */
  private static getProviderInstance(providerName: string, type: 'video' | 'image'): any {
    switch (providerName) {
      case 'zeroapi':
        return new ZeroapiProvider();
      default:
        return undefined;
    }
  }

  /**
   * 获取所有模型配置
   * 包括文件配置的图片/视频模型和数据库中的 LLM 配置
   * @param userId 用户 ID
   * @returns 所有模型配置
   */
  static async getAllConfigs(userId: number) {
    this.loadConfigs();
    const result = { ...this.configs };

    // 获取用户的 LLM 配置
    const userLLMs = await prisma.userLLMConfig.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' }
    });

    const llmConfigs: Record<string, any> = {};
    userLLMs.forEach(c => {
      const key = `user_llm_${c.id}`;
      llmConfigs[key] = {
        name: c.name,
        type: 'llm',
        default_provider: 'custom',
        providers: {
          custom: {
            name: c.provider,
            model_value: c.modelValue
          }
        }
      };
    });

    result['llm'] = llmConfigs;
    return result;
  }

  /**
   * 获取 LLM 提供商配置
   * 优先使用指定的模型 ID，否则使用用户的第一个可用配置
   * @param userId 用户 ID
   * @param modelId 模型 ID（可选）
   * @returns LLM 配置结果
   */
  static async getLLMProvider(userId: number, modelId?: string): Promise<LLMConfigResult> {
    let config;

    // 如果提供了 modelId，尝试查找特定配置
    if (modelId && modelId.startsWith('user_llm_')) {
      const dbId = parseInt(modelId.replace('user_llm_', ''));
      config = await prisma.userLLMConfig.findUnique({
        where: { id: dbId }
      });
    }

    // 如果未找到或不可用，回退到第一个可用配置
    if (!config || config.userId !== userId || !config.isActive) {
      config = await prisma.userLLMConfig.findFirst({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'desc' }
      });
    }

    if (!config) {
      throw new Error('No LLM configuration found. Please add a model in settings.');
    }

    return {
      provider: new StandardLLMProvider(config.baseUrl),
      apiKey: config.apiKey,
      modelValue: config.modelValue,
      providerName: config.provider,
      modelId: `user_llm_${config.id}`
    };
  }

  /**
   * 解析媒体配置（图片或视频）
   * 根据用户偏好和系统默认值解析模型和提供商配置
   * @param userId 用户 ID
   * @param category 类别（image 或 video）
   * @param modelId 模型 ID（可选）
   * @param providerId 提供商 ID（可选）
   * @returns 解析后的配置
   */
  private static async resolveMediaConfig(userId: number, category: 'image' | 'video', modelId?: string, providerId?: string) {
    this.loadConfigs();

    // 如果未提供 modelId，检查用户偏好设置
    if (!modelId && userId > 0) {
      const userSetting = await prisma.userSetting.findUnique({
        where: { userId_key: { userId, key: 'ai_model_config' } }
      });
      if (userSetting && userSetting.value) {
        try {
          const userConfig = JSON.parse(userSetting.value);
          if (userConfig[category]) {
            modelId = userConfig[category].model;
            if (!providerId) providerId = userConfig[category].provider;
          }
        } catch (e) {
          console.error('Failed to parse user AI config:', e);
        }
      }
    }

    // 回退到系统默认配置
    if (!modelId || !this.configs[category]?.[modelId]) {
      const keys = Object.keys(this.configs[category] || {});
      if (keys.length > 0) {
        modelId = keys[0];
      } else {
        // 硬编码的回退值，以防万一
        if (category === 'video') modelId = 'sora-2';
        if (category === 'image') modelId = 'jimeng-4.0';
      }
    }

    // 解析提供商
    if (!modelId) throw new Error(`Model configuration for ${category} not found`);

    const modelConfig = this.configs[category]?.[modelId];
    if (!modelConfig) throw new Error(`Model configuration for ${category}:${modelId} not found`);

    if (!providerId) providerId = modelConfig.default_provider;

    // 检查该模型是否存在该提供商
    let providerConfig = modelConfig.providers[providerId];
    if (!providerConfig) {
      // 回退到第一个可用的提供商
      const providerKeys = Object.keys(modelConfig.providers);
      if (providerKeys.length > 0) providerId = providerKeys[0];
      else throw new Error(`Provider configuration for ${modelId}:${providerId} not found`);
    }

    // 获取 API 密钥
    let apiKey = '';
    if (userId > 0) {
      const systemSetting = await prisma.userSetting.findUnique({
        where: { userId_key: { userId, key: 'system' } }
      });
      if (systemSetting && systemSetting.value) {
        try {
          const sysConfig = JSON.parse(systemSetting.value);
          // 将 providerId 映射到系统设置键
          if (providerId === 'zeroapi') apiKey = sysConfig.zeroapiKey;
        } catch (e) {
          console.error('Failed to parse system settings for keys:', e);
        }
      }
    }

    return {
      modelId,
      providerId,
      apiKey,
      modelValue: modelConfig.providers[providerId!].model_value
    };
  }

  /**
   * 获取视频提供商配置
   * @param userId 用户 ID
   * @param modelId 模型 ID（可选）
   * @param providerId 提供商 ID（可选）
   * @returns 视频配置结果
   */
  static async getVideoProvider(userId: number, modelId?: string, providerId?: string): Promise<VideoConfigResult> {
    const config = await this.resolveMediaConfig(userId, 'video', modelId, providerId);
    const provider = this.getProviderInstance(config.providerId!, 'video');
    
    if (!provider) throw new Error(`Provider ${config.providerId} not found or does not support video`);

    return {
      provider: provider as IVideoProvider,
      apiKey: config.apiKey,
      modelValue: config.modelValue,
      providerName: config.providerId!,
      modelId: config.modelId!
    };
  }

  /**
   * 获取图片提供商配置
   * @param userId 用户 ID
   * @param modelId 模型 ID（可选）
   * @param providerId 提供商 ID（可选）
   * @returns 图片配置结果
   */
  static async getImageProvider(userId: number, modelId?: string, providerId?: string): Promise<ImageConfigResult> {
    const config = await this.resolveMediaConfig(userId, 'image', modelId, providerId);
    const provider = this.getProviderInstance(config.providerId!, 'image');

    if (!provider) throw new Error(`Provider ${config.providerId} not found or does not support image`);

    return {
      provider: provider as IImageProvider,
      apiKey: config.apiKey,
      modelValue: config.modelValue,
      providerName: config.providerId!,
      modelId: config.modelId!
    };
  }
}
