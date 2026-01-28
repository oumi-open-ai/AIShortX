import { ImageRatio } from '../../constants/enums';

/** AI 提供商类型 */
export type AIProvider = 'zeroapi' | string;

/** 聊天消息接口 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/** 聊天参数接口 */
export interface ChatParams {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/** 角色结构接口 */
export interface Role {
  id?: string;
  name: string;
  description?: string; // 生图提示词
  prompt?: string;      // 视频提示词
}

/** 分镜结构接口 */
export interface Storyboard {
  content: string;
  role_id?: string;
  role_name?: string;
}

/** 视频生成参数接口 */
export interface VideoGenParams {
  prompt: string;
  model?: string;
  images?: string[];
  duration: '10' | '15'; 
  aspect_ratio: '16:9' | '9:16';
  [key: string]: any;
}

/** 图片生成参数接口 */
export interface ImageGenParams {
  prompt: string;
  model?: string;
  ratio?: ImageRatio;
  n?: number;
  image?: string[]; // 参考图
  [key: string]: any;
}

/** 任务结果接口 */
export interface TaskResult {
  status: string;
  url?: string; // 通用 URL
  videoUrl?: string; // 兼容字段
  imageUrl?: string;
  failReason?: string;
}

/** 视频任务结果类型（向后兼容的别名） */
export type VideoTaskResult = TaskResult;

/** 角色创建参数接口 */
export interface CreateCharacterParams {
  url?: string;
  timestamps: string;
  from_task?: string;
}

/** 角色创建结果接口 */
export interface CharacterResult {
  id: string;
  username: string;
  permalink: string;
  profile_picture_url: string;
}

/** AI 提供商接口 */
export interface IAIProvider {
  /** 通用聊天接口 */
  chat(params: ChatParams, apiKey: string): Promise<string>;

  /** 视频生成接口 */
  generateVideo(params: VideoGenParams, apiKey: string): Promise<{ task_id: string }>;
  
  /** 查询任务状态接口 */
  queryTask(taskId: string, apiKey: string): Promise<VideoTaskResult>;
  
  /** 图片生成接口 */
  generateImage(params: ImageGenParams, apiKey: string): Promise<{ url: string; urls?: string[] } | { task_id: string }>;

  /** 创建角色接口 */
  createCharacter(params: CreateCharacterParams, apiKey: string): Promise<CharacterResult>;
}
