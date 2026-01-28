export interface Style {
  id: number;
  name: string;
  imageUrl?: string;
  prompt: string;
  userId: number;
}

export interface Project {
  id?: number; // 项目ID
  name: string; // 项目名称
  aspectRatio: '16:9' | '9:16'; // 画面比例：16:9, 9:16
  visualStyle: string; // 画面风格 (From Backend: style.name)
  styleId?: number; // 风格ID
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
  characters?: ProjectCharacter[];
  props?: ProjectProp[];
  scenes?: ProjectScene[];
  episodes?: ProjectEpisode[];
}

export interface ProjectEpisode {
  id: number;
  projectId: number;
  name: string;
  script?: string;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectProp {
  id?: number;
  projectId: number;
  episodeId?: number;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'idle' | 'generating' | 'generated' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectScene {
  id?: number;
  projectId: number;
  episodeId?: number;
  name: string;
  description?: string;
  imageUrl?: string;
  status: 'idle' | 'generating' | 'generated' | 'failed';
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCharacter {
  id?: number; // 项目角色ID
  projectId: number; // 关联的项目ID
  episodeId?: number; // 关联的分集ID
  libraryId?: number; // 关联的角色库ID（如果是从库中引用的）
  name: string; // 角色名称
  libraryName?: string; // 角色库中的原始名称
  description: string; // 角色描述
  imageUrl?: string; // 角色图片URL（可能是临时生成的或从库引用的）
  imageStatus?: 'draft' | 'generating' | 'generated' | 'failed'; // 图片生成状态
  videoUrl?: string; // 角色视频URL
  videoStatus: 'draft' | 'generating' | 'generated' | 'failed'; // 视频生成状态 (draft:草稿, generating:生成中, generated:已生成, failed:失败)
  createStatus: 'idle' | 'creating' | 'created' | 'failed'; // 角色创建状态 (idle:未创建, creating:创建中, created:已创建, failed:失败)
  error?: string; // 错误信息
  source: 'ai' | 'library' | 'custom'; // 来源：AI生成、角色库、自定义
  externalId?: string; // 外部ID（如Sora角色ID）
  originalData?: any; // 原始数据（用于恢复匹配前的状态）
  voice?: string; // 生成角色的提示词 (声音设定)
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

export interface UserCharacter {
  id?: number; // 用户角色库ID
  name: string; // 角色名称
  description: string; // 角色描述
  avatar?: string; // 头像 URL
  video?: string; // 视频 URL
  source: 'ai' | 'upload'; // 来源
  externalId?: string; // 外部ID（如Sora角色ID）
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

export interface Storyboard {
  id?: number; // 分镜ID
  projectId: number; // 关联的项目ID
  episodeId?: number; // 关联的分集ID
  text: string; // 分镜文本
  characterIds: number[]; // 关联的角色ID列表
  propIds?: number[]; // 关联的物品ID列表
  sceneId?: number; // 关联的场景ID
  duration: number; // 时长
  prompt?: string; // 提示词
  imageUrl?: string; // 分镜图
  imageStatus?: 'idle' | 'generating' | 'generated' | 'failed'; // 分镜图状态
  videoUrl?: string; // 视频URL
  status: 'draft' | 'generating_prompt' | 'prompt_generated' | 'generating_video' | 'video_generated' | 'failed'; // 状态：草稿、生成提示词中、提示词已生成、生成视频中、视频已生成、失败
  order: number; // 排序
  createdAt: Date; // 创建时间
  updatedAt: Date; // 更新时间
}

export interface Settings {
  id?: number;
  zeroapiKey?: string; // 零界API Key
  jianyingPath?: string; // 剪映路径
  updatedAt: Date; // 更新时间
}

export interface Task {
  id?: number;
  projectId?: number;
  type?: string; // 任务类型: image | video
  model: string;
  category: 'character_image' | 'character_video' | 'storyboard_video' | 'upscale' | 'storyboard_image' | 'scene_image' | 'prop_image';
  relatedId: number;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  inputParams?: any;
  externalTaskId?: string;
  progress?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  assets?: Asset[];
}

export interface Asset {
  id?: number;
  taskId?: number; // taskId might be optional or null for uploaded assets
  projectId?: number;
  userId?: number;
  type?: 'image' | 'video' | 'audio';
  usage?: 'character' | 'scene' | 'prop' | 'storyboard' | 'general';
  relatedId?: number;
  source?: 'upload' | 'generated';
  url?: string;
  width?: number;
  height?: number;
  duration?: number;
  createdAt: Date;
}
