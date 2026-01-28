import api from './api';
import { type Task, type Asset } from '../types';

/**
 * 任务服务
 * 提供任务和资源管理相关的 API 调用
 */
export const taskService = {
  // ==================== 任务操作 ====================

  /**
   * 创建新任务
   * @param task 任务数据
   * @returns 任务 ID
   */
  async createTask(task: Task): Promise<number> {
    const response = await api.post('/tasks', task);
    return response.data.id;
  },

  /**
   * 获取单个任务信息
   * @param id 任务 ID
   * @returns 任务对象或 undefined
   */
  async getTask(id: number): Promise<Task | undefined> {
    try {
      const response = await api.get(`/tasks/${id}`);
      const task = response.data;
      return {
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt)
      };
    } catch (error) {
      console.error('Failed to get task:', error);
      return undefined;
    }
  },

  /**
   * 获取任务统计信息
   * @returns 各状态任务的数量统计
   */
  async getTaskStats(): Promise<{ pending: number, processing: number, completed: number, failed: number }> {
    try {
      const response = await api.get('/tasks/stats');
      return response.data;
    } catch (error) {
      console.error('Failed to get task stats:', error);
      return { pending: 0, processing: 0, completed: 0, failed: 0 };
    }
  },

  /**
   * 获取所有任务列表
   * 支持按状态和类别筛选
   * @param page 页码
   * @param pageSize 每页大小
   * @param status 任务状态（可选）
   * @param category 任务类别（可选）
   * @returns 任务列表和总数
   */
  async getAllTasks(page: number = 1, pageSize: number = 10, status?: string, category?: string): Promise<{ list: Task[], total: number }> {
    try {
      const params: any = { page, pageSize };
      if (status) params.status = status;
      if (category) params.category = category;

      const response = await api.get('/tasks', { params });
      const data = response.data;

      const parseTask = (task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        updatedAt: new Date(task.updatedAt)
      });

      if (data.list && Array.isArray(data.list)) {
        return {
          list: data.list.map(parseTask),
          total: data.total || 0
        };
      } else if (Array.isArray(data)) {
        return {
          list: data.map(parseTask),
          total: data.length
        };
      }
      return { list: [], total: 0 };
    } catch (error) {
      console.error('Failed to get all tasks:', error);
      return { list: [], total: 0 };
    }
  },

  /**
   * 根据关联 ID 获取任务列表
   * @param category 任务类别
   * @param relatedId 关联实体 ID
   * @param page 页码
   * @param pageSize 每页大小
   * @returns 任务列表和总数
   */
  async getTasksByRelatedId(category: string, relatedId: number, page: number = 1, pageSize: number = 10): Promise<{ list: Task[], total: number }> {
    const response = await api.get('/tasks', { 
      params: { category, relatedId, page, pageSize } 
    });
    
    const data = response.data;
    const parseTask = (task: any) => ({
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt)
    });

    if (data.list && Array.isArray(data.list)) {
      return {
        list: data.list.map(parseTask),
        total: data.total || 0
      };
    } else if (Array.isArray(data)) {
      return {
        list: data.map(parseTask),
        total: data.length
      };
    }
    return { list: [], total: 0 };
  },

  /**
   * 根据项目 ID 获取任务列表
   * @param projectId 项目 ID
   * @returns 任务列表
   */
  async getTasksByProjectId(projectId: number): Promise<Task[]> {
    const response = await api.get('/tasks', { 
      params: { projectId } 
    });
    return response.data.map((task: any) => ({
      ...task,
      createdAt: new Date(task.createdAt),
      updatedAt: new Date(task.updatedAt)
    }));
  },

  /**
   * 删除任务
   * 删除数据库中的任务记录
   * @param id 任务 ID
   */
  async deleteTask(id: number): Promise<void> {
    await api.delete(`/tasks/${id}`);
  },

  /**
   * 取消任务
   * 取消正在进行的任务
   * @param id 任务 ID
   */
  async cancelTask(id: number): Promise<void> {
    await api.post(`/tasks/${id}/cancel`);
  },

  // ==================== 资源操作 ====================

  /**
   * 根据任务 ID 获取资源列表
   * @param taskId 任务 ID
   * @returns 资源列表
   */
  async getAssetsByTaskId(taskId: number): Promise<Asset[]> {
    try {
      const response = await api.get(`/tasks/${taskId}`);
      return response.data.assets || [];
    } catch (e) {
      return [];
    }
  },
  
  /**
   * 获取任务的最新资源
   * @param taskId 任务 ID
   * @returns 最新的资源对象或 undefined
   */
  async getLatestAsset(taskId: number): Promise<Asset | undefined> {
    try {
      const assets = await this.getAssetsByTaskId(taskId);
      if (assets.length === 0) return undefined;
      // 按 ID 降序排序，获取最新的资源
      return assets.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
    } catch (e) {
      return undefined;
    }
  }
};
