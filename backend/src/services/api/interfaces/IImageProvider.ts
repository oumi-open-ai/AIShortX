import { ImageGenParams, TaskResult } from '../types';

/**
 * 图片生成提供商接口
 * 定义了图片生成和任务查询的标准方法
 */
export interface IImageProvider {
  /**
   * 生成图片
   * @param params - 图片生成参数
   * @param apiKey - API密钥
   * @returns 返回图片URL或任务ID
   */
  generateImage(params: ImageGenParams, apiKey: string): Promise<{ url: string; urls?: string[] } | { task_id: string }>;
  
  /**
   * 查询任务状态（可选）
   * @param taskId - 任务ID
   * @param apiKey - API密钥
   * @returns 任务结果
   */
  queryTask?(taskId: string, apiKey: string): Promise<TaskResult>;
}
