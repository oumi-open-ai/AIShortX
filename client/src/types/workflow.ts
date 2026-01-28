export interface Character {
  id: string;
  episodeId?: number;
  name: string;
  description: string;
  imageUrl?: string;
  imageStatus?: 'draft' | 'generating' | 'generated' | 'failed'; // Added image generation status
  videoUrl?: string;
  videoStatus: 'draft' | 'generating' | 'generated' | 'failed';
  createStatus: 'idle' | 'creating' | 'created' | 'failed';
  error?: string;
  characterId?: string; // Backend ID / Sora ID (External ID)
  libraryId?: string; // Local Library ID
  libraryName?: string; // Original Name in Library
  source: 'ai' | 'library' | 'custom';
  voice?: string;
  originalData?: {
    name: string;
    description: string;
    voice?: string;
    imageUrl?: string;
    videoUrl?: string;
    videoStatus: 'draft' | 'generating' | 'generated' | 'failed';
    createStatus: 'idle' | 'creating' | 'created' | 'failed';
  };
}

export interface Prop {
  id: string;
  episodeId?: number;
  name: string;
  description: string;
  imageUrl?: string;
  status?: 'idle' | 'generating' | 'generated' | 'failed';
}

export interface Scene {
  id: string;
  episodeId?: number;
  name: string;
  description: string;
  imageUrl?: string;
  status?: 'idle' | 'generating' | 'generated' | 'failed';
}

export interface StoryboardFrame {
  id: string;
  episodeId?: number;
  text: string; // 分镜原文
  characterIds: string[]; // 包含角色ID
  propIds?: string[]; // 包含物品ID
  sceneId?: string; // 关联场景ID
  duration: 10 | 15; // 时长
  prompt: string; // 视频提示词
  videoUrl?: string;
  imageUrl?: string; // 分镜图
  imageStatus?: 'idle' | 'generating' | 'generated' | 'failed';
  referenceImageUrl?: string; // 参考图URL
  videoRefScope?: ('storyboard' | 'character' | 'scene' | 'prop')[]; // 视频参考图范围
  highResVideoUrl?: string;
  highResStatus?: 'idle' | 'generating' | 'success' | 'failed';
  errorMsg?: string;
  highResErrorMsg?: string;
  status: 'draft' | 'generating_prompt' | 'prompt_generated' | 'generating_video' | 'video_generated' | 'failed';
  order: number; // 排序
}

export interface ProjectData {
  name: string;
  script: string;
  aspectRatio: '16:9' | '9:16';
  visualStyle: string;
  styleId?: number;
}
