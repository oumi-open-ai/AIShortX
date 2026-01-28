import api from './api';

/** AI 提供商类型 */
export type AIProvider = 'zeroapi';

/** 分析角色参数接口 */
export interface AnalyzeRolesParams {
  scriptContent: string;
}

/** 角色信息接口 */
export interface Role {
  id?: string;
  name: string;
  description?: string;
  voice?: string;
}

/** 创建角色参数接口 */
export interface CreateCharacterParams {
  url: string;
  timestamps?: string;
}

/**
 * AI 服务
 * 提供剧本分析、分镜生成、提示词推理等 AI 功能
 */
export const aiService = {
  /**
   * 分析剧本元素（角色、场景、物品）
   * @param params 包含项目ID、剧本内容、剧集ID等参数
   * @returns 分析结果
   */
  analyzeElements: async (params: { projectId: number; scriptContent: string; episodeId?: number; isAppend?: boolean; saveToDb?: boolean }): Promise<any> => {
    const response = await api.post('/ai/elements/analyze', params);
    return response.data;
  },

  /**
   * 分析剧本并生成分镜
   * @param params 包含项目ID、剧本内容、剧集ID等参数
   * @returns 分镜列表
   */
  analyzeStoryboards: async (params: { projectId: number; scriptContent: string; episodeId?: number }): Promise<any> => {
    const response = await api.post('/ai/storyboards/analyze', params);
    return response.data;
  },

  /**
   * 创建角色
   * @param params 包含URL和时间戳的参数
   * @returns 角色信息
   */
  createCharacter: async (params: CreateCharacterParams): Promise<{ id: string; username: string; permalink: string; profile_picture_url: string }> => {
    const response = await api.post('/ai/character/create', params);
    return response.data;
  },

  /**
   * 推理分镜（已废弃）
   * @param params 包含剧本内容、原始分镜、角色列表、时长等参数
   * @returns 推理结果
   */
  inferStoryboard: async (params: { scriptContent: string; storyboardOriginal: any; roleList: Role[]; duration: number }): Promise<any> => {
    const response = await api.post('/ai/storyboards/inference', params);
    return response.data;
  },

  /**
   * 推理分镜提示词
   * @param params 包含剧本内容的参数
   * @returns 提示词
   */
  inferStoryboardPrompt: async (params: { scriptContent: string }): Promise<{ prompt: string }> => {
    const response = await api.post('/ai/storyboards/inference', params);
    return response.data;
  },
};
