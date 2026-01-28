import api from './api';
import { type Project, type ProjectCharacter } from '../types';

/**
 * 辅助函数：解析后端返回的项目数据
 * 确保日期字段为 Date 对象
 */
const parseProjectData = (project: any): Project => {
  const parsed = {
    ...project,
    // 确保日期字段为 Date 对象
    createdAt: new Date(project.createdAt),
    updatedAt: new Date(project.updatedAt)
  };

  if (parsed.storyboards && Array.isArray(parsed.storyboards)) {
    parsed.storyboards = parsed.storyboards.map((s: any) => ({
      ...s,
      // 后端现在统一返回 episodeId
      episodeId: s.episodeId
    }));
  }

  return parsed;
};

/**
 * 辅助函数：解析分镜数据
 * 处理 JSON 字符串字段并转换日期
 */
const parseStoryboardData = (storyboard: any) => {
  return {
    ...storyboard,
    characterIds: typeof storyboard.characterIds === 'string' 
      ? JSON.parse(storyboard.characterIds) 
      : storyboard.characterIds,
    propIds: typeof storyboard.propIds === 'string'
      ? JSON.parse(storyboard.propIds)
      : storyboard.propIds,
    createdAt: new Date(storyboard.createdAt),
    updatedAt: new Date(storyboard.updatedAt)
  };
};

/**
 * 项目服务
 * 提供项目、剧集、角色、场景、物品、分镜等所有相关的 API 调用
 */
export const projectService = {
  /**
   * 获取所有项目列表
   * @param page 页码
   * @param pageSize 每页大小
   * @returns 项目列表和总数
   */
  async getAllProjects(page: number = 1, pageSize: number = 10): Promise<{ list: Project[], total: number }> {
    const response = await api.get('/projects', { params: { page, pageSize } });
    const data = response.data;
    // 检查响应是否为分页格式（新格式）或列表格式（旧格式/回退）
    if (data.list && Array.isArray(data.list)) {
      return {
        list: data.list.map(parseProjectData),
        total: data.total || 0
      };
    } else if (Array.isArray(data)) {
       // 回退处理：扁平数组响应
       return {
         list: data.map(parseProjectData),
         total: data.length
       };
    }
    return { list: [], total: 0 };
  },

  /**
   * 根据 ID 获取单个项目
   * @param id 项目 ID
   * @returns 项目对象或 undefined
   */
  async getProjectById(id: number): Promise<Project | undefined> {
    try {
      const response = await api.get(`/projects/${id}`);
      return parseProjectData(response.data);
    } catch (error) {
      console.error('Failed to get project:', error);
      return undefined;
    }
  },

  /**
   * 创建新项目
   * @param data 项目数据（包括可选的剧本内容）
   * @returns 项目 ID 和第一集 ID
   */
  async createProject(data: Partial<Project> & { script?: string }): Promise<{ id: number; firstEpisodeId?: number }> {
    const response = await api.post('/projects', data);
    const project = response.data;
    return {
      id: project.id,
      firstEpisodeId: project.episodes?.[0]?.id
    };
  },

  /**
   * 更新项目信息
   * @param id 项目 ID
   * @param updates 要更新的字段
   * @returns 项目 ID
   */
  async updateProject(id: number, updates: Partial<Project>): Promise<number> {
    const payload: any = { ...updates };
    const response = await api.put(`/projects/${id}`, payload);
    return response.data.id;
  },

  /**
   * 删除项目
   * @param id 项目 ID
   */
  async deleteProject(id: number): Promise<void> {
    await api.delete(`/projects/${id}`);
  },

  // ==================== 剧集管理 ====================

  /**
   * 获取项目的所有剧集
   * @param projectId 项目 ID
   * @returns 剧集列表
   */
  async getEpisodes(projectId: number): Promise<any[]> {
    const response = await api.get(`/projects/${projectId}/episodes`);
    return response.data;
  },

  /**
   * 创建新剧集
   * @param projectId 项目 ID
   * @param data 剧集数据
   * @returns 创建的剧集
   */
  async createEpisode(projectId: number, data: any): Promise<any> {
    const response = await api.post(`/projects/${projectId}/episodes`, data);
    return response.data;
  },

  /**
   * 更新剧集信息
   * @param _projectId 项目 ID（未使用）
   * @param episodeId 剧集 ID
   * @param data 要更新的数据
   * @returns 更新后的剧集
   */
  async updateEpisode(_projectId: number, episodeId: number, data: any): Promise<any> {
    const response = await api.put(`/projects/episodes/${episodeId}`, data);
    return response.data;
  },

  /**
   * 删除剧集
   * @param _projectId 项目 ID（未使用）
   * @param episodeId 剧集 ID
   */
  async deleteEpisode(_projectId: number, episodeId: number): Promise<void> {
    await api.delete(`/projects/episodes/${episodeId}`);
  },

  // ==================== 角色管理 ====================

  /**
   * 获取项目的所有角色
   * @param projectId 项目 ID
   * @returns 角色列表
   */
  async getCharactersByProjectId(projectId: number): Promise<ProjectCharacter[]> {
    const project = await this.getProjectById(projectId);
    return (project as any)?.characters || [];
  },

  /**
   * 保存角色列表
   * 支持批量创建和更新角色
   * @param projectId 项目 ID
   * @param characters 角色列表
   * @param episodeId 剧集 ID（可选）
   * @returns 保存后的角色列表
   */
  async saveCharacters(projectId: number, characters: any[], episodeId?: number): Promise<ProjectCharacter[]> {
    const payload = characters.map(c => ({
      ...c,
      id: (c.id && !isNaN(Number(c.id)) && Number(c.id) < 1700000000000) ? Number(c.id) : undefined,
      episodeId: c.episodeId || episodeId
    }));
    const config = episodeId ? { params: { episodeId } } : {};
    const response = await api.post(`/projects/${projectId}/characters`, payload, config);
    return response.data;
  },

  async updateCharacter(projectId: number, id: number, updates: Partial<ProjectCharacter>): Promise<number> {
    const response = await api.post(`/projects/${projectId}/characters`, [
      { ...updates, id, projectId }
    ]);
    return response.data[0].id;
  },

  async deleteCharacter(projectId: number, id: number): Promise<void> {
    await api.delete(`/projects/${projectId}/characters/${id}`);
  },

  async generateCharacterImage(projectId: number, charId: number, model?: { model: string; provider: string }): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/characters/${charId}/generate_image`, { model });
    return response.data;
  },

  async generateCharacterVideo(projectId: number, charId: number, model?: { model: string; provider: string }): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/characters/${charId}/generate_video`, { model });
    return response.data;
  },

  async createSoraCharacter(_projectId: number, _charId: number, _timestamps?: string): Promise<ProjectCharacter> {
    // Legacy support: map to new video generation or keep if needed. 
    // Since backend route for sora_create is gone, we should use generate_video but the return type might differ.
    // For now, let's point to generate_video and assume the caller handles the async nature (taskId returned).
    // However, the original returned ProjectCharacter. The new one returns taskId.
    // This implies we need to refactor the caller. 
    // For now, I'll comment this out or leave it broken until I fix the caller.
    // Actually, I'll implement it to throw error or better, remove it and fix callers.
    throw new Error('Deprecated. Use generateCharacterVideo instead.');
  },

  // Scene Management
  async getScenesByProjectId(projectId: number): Promise<any[]> {
    const project = await this.getProjectById(projectId);
    return (project as any)?.scenes || [];
  },

  async upsertScenes(projectId: number, scenes: any[], episodeId?: number): Promise<any[]> {
    const payload = scenes.map(s => ({
      ...s,
      id: (s.id && !isNaN(Number(s.id)) && Number(s.id) < 1700000000000) ? Number(s.id) : undefined,
      projectId,
      episodeId: s.episodeId || episodeId
    }));
    const config = episodeId ? { params: { episodeId } } : {};
    const response = await api.post(`/projects/${projectId}/scenes`, payload, config);
    return response.data;
  },

  async deleteScene(projectId: number, sceneId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/scenes/${sceneId}`);
  },

  async generateSceneImage(projectId: number, sceneId: number, model?: { model: string; provider: string }): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/scenes/${sceneId}/generate_image`, { model });
    return response.data;
  },

  // Prop Management
  async getPropsByProjectId(projectId: number): Promise<any[]> {
    const project = await this.getProjectById(projectId);
    return (project as any)?.props || [];
  },

  async upsertProps(projectId: number, props: any[], episodeId?: number): Promise<any[]> {
    const payload = props.map(p => ({
      ...p,
      id: (p.id && !isNaN(Number(p.id)) && Number(p.id) < 1700000000000) ? Number(p.id) : undefined,
      projectId,
      episodeId: p.episodeId || episodeId
    }));
    const config = episodeId ? { params: { episodeId } } : {};
    const response = await api.post(`/projects/${projectId}/props`, payload, config);
    return response.data;
  },

  async deleteProp(projectId: number, propId: number): Promise<void> {
    await api.delete(`/projects/${projectId}/props/${propId}`);
  },

  async generatePropImage(projectId: number, propId: number, model?: { model: string; provider: string }): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/props/${propId}/generate_image`, { model });
    return response.data;
  },

  // Storyboard Management
  async getStoryboardsByProjectId(projectId: number): Promise<any[]> {
    const project = await this.getProjectById(projectId);
    const storyboards = (project as any)?.storyboards || [];
    return storyboards.map(parseStoryboardData);
  },

  async saveStoryboards(projectId: number, storyboards: any[], episodeId?: number): Promise<any[]> {
    const payload = storyboards.map((s) => {
      const id = (s.id && !isNaN(Number(s.id)) && Number(s.id) < 1700000000000) ? Number(s.id) : undefined;
      return {
        id,
        text: s.text,
        characterIds: s.characterIds,
        propIds: s.propIds,
        sceneId: s.sceneId,
        duration: s.duration,
        prompt: s.prompt,
        order: s.order,
        referenceImageUrl: s.referenceImageUrl,
        imageUrl: s.imageUrl,
        imageStatus: s.imageStatus,
        episodeId: s.episodeId || episodeId
      };
    });
    const config = episodeId ? { params: { episodeId } } : {};
    const response = await api.post(`/projects/${projectId}/storyboards`, payload, config);
    return response.data.map(parseStoryboardData);
  },

  async updateStoryboardMedia(
    projectId: number,
    storyboardId: number,
    updates: Partial<{
      status: 'draft' | 'generating_video' | 'video_generated' | 'failed';
      videoUrl: string | null;
      highResStatus: 'idle' | 'generating' | 'success' | 'failed';
      highResVideoUrl: string | null;
    }>
  ): Promise<any> {
    const response = await api.patch(`/projects/${projectId}/storyboards/${storyboardId}/media`, updates);
    return parseStoryboardData(response.data);
  },

  async updateStoryboard(projectId: number, id: number, updates: Partial<any>): Promise<number> {
    const response = await api.post(`/projects/${projectId}/storyboards`, [
      { ...updates, id, projectId }
    ]);
    return response.data[0].id;
  },

  async deleteStoryboard(projectId: number, id: number): Promise<void> {
    await api.delete(`/projects/${projectId}/storyboards/${id}`);
  },

  async generateStoryboardImage(projectId: number, storyboardId: number, model?: { model: string; provider: string }): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/storyboards/${storyboardId}/generate_image`, { model });
    return response.data;
  },

  async generateStoryboardVideo(projectId: number, storyboardId: number, model?: { model: string; provider: string }): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/storyboards/${storyboardId}/generate_video`, { model });
    return response.data;
  },

  async generateStoryboardHighResVideo(projectId: number, storyboardId: number): Promise<{ taskId: number; status: string }> {
    const response = await api.post(`/projects/${projectId}/storyboards/${storyboardId}/generate_high_res_video`);
    return response.data;
  }
};
