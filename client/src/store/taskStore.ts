/**
 * 任务状态管理
 * 使用 Zustand 管理任务统计信息
 */
import { create } from 'zustand';
import { taskService } from '../services/taskService';

/**
 * 任务状态接口
 */
interface TaskStore {
  /** 进行中的任务数量 */
  inProgressCount: number;
  /** 刷新任务统计 */
  refreshStats: () => Promise<void>;
  /** 设置进行中的任务数量 */
  setInProgressCount: (count: number) => void;
}

export const useTaskStore = create<TaskStore>((set) => ({
  inProgressCount: 0,
  refreshStats: async () => {
    try {
      const stats = await taskService.getTaskStats();
      const count = (stats.pending || 0) + (stats.processing || 0);
      set({ inProgressCount: count });
    } catch (error) {
      console.error('Failed to refresh task stats:', error);
    }
  },
  setInProgressCount: (count) => set({ inProgressCount: count }),
}));
