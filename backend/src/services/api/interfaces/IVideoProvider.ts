import { VideoGenParams, VideoTaskResult, CreateCharacterParams, CharacterResult } from '../types';

/**
 * 视频生成提供商接口
 * 定义了视频生成、任务查询和角色创建的标准方法
 */
export interface IVideoProvider {
  /**
   * 生成视频
   * @param params - 视频生成参数
   * @param apiKey - API密钥
   * @returns 返回任务ID
   */
  generateVideo(params: VideoGenParams, apiKey: string): Promise<{ task_id: string }>;
  
  /**
   * 查询任务状态
   * @param taskId - 任务ID
   * @param apiKey - API密钥
   * @returns 视频任务结果
   */
  queryTask(taskId: string, apiKey: string): Promise<VideoTaskResult>;
  
  /**
   * 创建角色
   * @param params - 角色创建参数
   * @param apiKey - API密钥
   * @returns 角色创建结果
   */
  createCharacter(params: CreateCharacterParams, apiKey: string): Promise<CharacterResult>;
}
