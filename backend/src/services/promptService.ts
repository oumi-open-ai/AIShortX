import prisma from '../utils/prisma';
import type { Role } from './api/types';

/**
 * 提示词服务类
 * 管理系统提示词模板和用户自定义提示词
 * 支持变量替换和多种场景的提示词生成
 */
export class PromptService {
  /**
   * 通用的获取提示词模板函数
   * 优先使用用户自定义提示词，否则使用系统默认提示词
   * @param type 提示词类型
   * @param userId 用户 ID（可选）
   * @returns 提示词模板内容
   */
  private static async getPromptTemplate(type: string, userId?: number): Promise<string> {
    if (userId) {
      const userConfig = await prisma.userPromptConfig.findUnique({
        where: {
          userId_type: {
            userId,
            type
          }
        }
      });
      if (userConfig && userConfig.enabled && userConfig.content) {
        return userConfig.content;
      }
    }

    const systemPrompt = await prisma.systemPrompt.findFirst({
      where: {
        type,
        isDefault: true
      }
    });

    return systemPrompt?.content || '';
  }

  /**
   * 简单的变量替换辅助函数
   * 将模板中的 {{key}} 替换为对应的值
   * @param template 模板字符串
   * @param variables 变量键值对
   * @returns 替换后的字符串
   */
  private static replaceVariables(template: string, variables: Record<string, string>): string {
    let result = template;
    for (const [key, value] of Object.entries(variables)) {
      // 替换 {{key}}
      const regex = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result = result.replace(regex, value || '');
    }
    return result;
  }

  // ==========================================
  // 元素分析提示词（角色、场景、物品）
  // ==========================================
  
  /**
   * 获取元素分析提示词
   * 用于从剧本中提取角色、场景、物品信息
   * @param userId 用户 ID
   * @param variables 包含剧本内容的变量
   * @returns 元素分析提示词
   */
  static async getAnalyzeElementsPrompt(userId: number | undefined, variables: { script: string }): Promise<string> {
    const template = await this.getPromptTemplate('analyze_elements', userId);
    return this.replaceVariables(template, {
      script: variables.script.substring(0, 5000)
    });
  }

  // ==========================================
  // 分镜拆解提示词
  // ==========================================
  
  /**
   * 获取分镜分析提示词
   * 用于将剧本拆解为分镜
   * @param userId 用户 ID
   * @param variables 包含剧本内容的变量
   * @returns 分镜分析提示词
   */
  static async getStoryboardAnalysisPrompt(userId: number | undefined, variables: { script: string }): Promise<string> {
    const template = await this.getPromptTemplate('storyboard_analysis', userId);
    return this.replaceVariables(template, {
      script: variables.script.substring(0, 5000)
    });
  }

  // ==========================================
  // 分镜视频提示词推理
  // ==========================================
  
  /**
   * 获取分镜视频提示词推理
   * 用于生成分镜的视频提示词
   * @param userId 用户 ID
   * @param variables 包含剧本内容的变量
   * @returns 推理提示词
   */
  static async getInferencePrompt(userId: number | undefined, variables: {
    script: string
  }): Promise<string> {
    const template = await this.getPromptTemplate('storyboard_video_gen', userId);
    return this.replaceVariables(template, {
      script: variables.script.substring(0, 5000)
    });
  }

  // ==========================================
  // 分镜生图提示词
  // ==========================================
  
  /**
   * 获取分镜生图提示词
   * @param userId 用户 ID
   * @param variables 包含描述和风格的变量
   * @returns 分镜生图提示词
   */
  static async getStoryboardImagePrompt(userId: number | undefined, variables: { description: string, style: string }): Promise<string> {
    const template = await this.getPromptTemplate('storyboard_image_gen', userId);
    if (!template) {
      return [variables.style, variables.description].filter(Boolean).join('；');
    }
    return this.replaceVariables(template, variables as any);
  }

  // ==========================================
  // 角色生图提示词
  // ==========================================
  
  /**
   * 获取角色生图提示词
   * @param userId 用户 ID
   * @param variables 包含描述和风格的变量
   * @returns 角色生图提示词
   */
  static async getRoleImageGenPrompt(userId: number | undefined, variables: { description: string, style: string }): Promise<string> {
    const template = await this.getPromptTemplate('role_image_gen', userId);
    if (!template) {
      return [variables.style, variables.description].filter(Boolean).join('；');
    }
    return this.replaceVariables(template, variables as any);
  }

  // ==========================================
  // 场景生图提示词
  // ==========================================
  
  /**
   * 获取场景生图提示词
   * @param userId 用户 ID
   * @param variables 包含描述和风格的变量
   * @returns 场景生图提示词
   */
  static async getSceneImageGenPrompt(userId: number | undefined, variables: { description: string, style: string }): Promise<string> {
    const template = await this.getPromptTemplate('scene_image_gen', userId);
    if (!template) {
      return [variables.style, variables.description].filter(Boolean).join('；');
    }
    return this.replaceVariables(template, variables as any);
  }

  // ==========================================
  // 物品生图提示词
  // ==========================================
  
  /**
   * 获取物品生图提示词
   * @param userId 用户 ID
   * @param variables 包含描述和风格的变量
   * @returns 物品生图提示词
   */
  static async getPropImageGenPrompt(userId: number | undefined, variables: { description: string, style: string }): Promise<string> {
    const template = await this.getPromptTemplate('prop_image_gen', userId);
    if (!template) {
      return [variables.style, variables.description].filter(Boolean).join('；');
    }
    return this.replaceVariables(template, variables as any);
  }

  // ==========================================
  // 角色视频生成提示词
  // ==========================================
  
  /**
   * 获取角色视频生成提示词
   * @param userId 用户 ID
   * @param variables 包含描述、风格和配音的变量
   * @returns 角色视频生成提示词
   */
  static async getRoleVideoPrompt(userId: number | undefined, variables: { description: string, style: string, voice?: string }): Promise<string> {
    const template = await this.getPromptTemplate('role_video_gen', userId);
    if (!template) {
      return `视频画面风格：${variables.style}；${variables.description}${variables.voice ? '；' + variables.voice : ''}；角色说："我将作为你的角色出现在视频中，这是我的声音你感觉如何呢！"；`;
    }
    return this.replaceVariables(template, variables as any);
  }

  // ==========================================
  // 分镜视频生成提示词（直接生成）
  // ==========================================
  
  /**
   * 获取分镜视频生成提示词
   * @param userId 用户 ID
   * @param variables 包含描述和风格的变量
   * @returns 分镜视频生成提示词
   */
  static async getStoryboardVideoPrompt(userId: number | undefined, variables: { description: string, style: string }): Promise<string> {
    const template = await this.getPromptTemplate('storyboard_video_gen_direct', userId);
    if (!template) {
      return [variables.style, variables.description].filter(Boolean).join('；');
    }
    return this.replaceVariables(template, variables as any);
  }
}
