import React from 'react';
import { Button, Input, Spin, message, Checkbox, Popover, Tooltip, Modal, Empty } from 'antd';
import {
  ThunderboltOutlined,
  VideoCameraOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  DeleteOutlined,
  PlusOutlined,
  GlobalOutlined,
  PictureOutlined,
  ToolOutlined,
  CloseOutlined
} from '@ant-design/icons';
import { Sparkles } from 'lucide-react';
import type { StoryboardFrame, Character, Scene, Prop } from '../../../types/workflow';
import { AssetBrowserModal } from '../../../components/AssetBrowserModal';
import { VideoPreview } from '../../../components/VideoPreview';
import { StoryboardOperationPanel } from './StoryboardOperationPanel';
import { ResourceSelectionPanel } from './ResourceSelectionPanel';
import { StoryboardBatchToolbar } from './StoryboardBatchToolbar';
import { StoryboardPreviewMode } from './StoryboardPreviewMode';
import { StoryboardBottomBar } from './StoryboardBottomBar';
import { projectService } from '../../../services/projectService';
import { CachedImage } from '../../../components/CachedImage';
import { aiService } from '../../../services/aiService';
import { ProgressSteps, type ProgressStep } from '../../../components/ProgressSteps';

const { TextArea } = Input;

interface ResourceItemProps {
  image?: string;
  name: string;
  onDelete?: (e: React.MouseEvent) => void;
  className?: string;
  showPreview?: boolean;
  isGenerating?: boolean; // 是否正在生成中
}

const ResourceItem: React.FC<ResourceItemProps> = ({ image, name, onDelete, className, showPreview = true, isGenerating = false }) => {
  return (
    <Popover
      placement="left"
      content={
        image ? (
          <div className="p-2 bg-bg-card border border-border rounded-lg shadow-lg">
            <CachedImage src={image} alt={name} className="max-w-[400px] max-h-[400px] object-contain rounded-md shadow-sm" />
            <div className="text-center mt-2 font-medium text-text-primary">{name}</div>
          </div>
        ) : null
      }
      trigger="hover"
      mouseEnterDelay={0.2}
      overlayInnerStyle={{ padding: 0, backgroundColor: 'transparent', boxShadow: 'none' }}
      destroyTooltipOnHide
      open={showPreview && !!image ? undefined : false}
    >
      <div className={`relative group/item ${className}`}>
        {/* 加载状态遮罩 */}
        {isGenerating && (
          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-30 rounded-[8px]">
            <Spin size="small" />
          </div>
        )}

        {image ? (
          <CachedImage src={image} alt={name} className="rounded-[8px] w-full h-full object-cover transition-transform duration-300 group-hover/item:scale-105" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-text-secondary bg-primary/10 text-primary font-bold rounded-[8px]">
            {name[0]}
          </div>
        )}

        <div className="absolute inset-0 bg-black/0 group-hover/item:bg-black/10 transition-colors pointer-events-none" />

        {onDelete && (
          <div
            className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover/item:opacity-100 transition-all z-20 shadow-sm border border-white transform scale-90 hover:scale-110"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(e);
            }}
            title="移除"
          >
            <CloseOutlined className="text-white text-[8px]" />
          </div>
        )}
      </div>
    </Popover>
  );
};

const StoryboardInserter: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <div
    className="h-[10px] -my-[5px] flex items-center justify-center relative group cursor-pointer z-10"
    onClick={onClick}
  >
    <div className="absolute left-0 right-0 h-[2px] bg-primary opacity-0 group-hover:opacity-100 transition-opacity rounded-full" />
    <div className="z-10 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all transform scale-0 group-hover:scale-100 shadow-lg">
      <PlusOutlined style={{ fontSize: '10px' }} />
    </div>
  </div>
);

interface StepStoryboardProps {
  projectId?: number;
  projectName?: string;
  episodeName?: string;
  storyboards: StoryboardFrame[];
  setStoryboards: React.Dispatch<React.SetStateAction<StoryboardFrame[]>>;
  onRetry?: () => void;
  characters: Character[];
  scenes?: Scene[];
  props?: Prop[];
  setPreviewVideoUrl: (url: string | null) => void;
  projectScript?: string; // 添加项目剧本内容
  episodeId?: number; // 添加剧集ID
  onRefreshProject?: () => Promise<void>; // 添加刷新项目的回调

  updateStoryboard: (id: string, field: keyof StoryboardFrame, value: any, skipAutoSave?: boolean, skipHistory?: boolean) => void;
  updateStoryboardAndSave?: (id: string, updates: Partial<StoryboardFrame>) => Promise<void>;
  updateStoryboardMediaAndSave?: (
    id: string,
    updates: Partial<
      Pick<
        StoryboardFrame,
        'status' | 'videoUrl' | 'highResStatus' | 'highResVideoUrl' | 'imageUrl' | 'imageStatus'
      >
    >,
    saveHistory?: boolean,
    historyOperation?: 'apply_storyboard_video_history' | 'apply_storyboard_image_history',
    historyDescription?: string
  ) => Promise<void>;
  deleteStoryboard: (id: string) => void;
  moveStoryboard: (index: number, direction: 'up' | 'down') => Promise<void>;
  generateStoryboardVideo: (id: string, model?: { model: string; provider: string }) => void;
  generateStoryboardImage: (frameId: string, data: { prompt?: string, ratio: string, count: number }, silent?: boolean, model?: { model: string; provider: string }) => Promise<void>;
  inferStoryboardPrompt?: (frameId: string, silent?: boolean) => Promise<void>;
  onSave: () => void;
  addStoryboard?: (insertIndex: number) => Promise<void>;
  aspectRatio?: '16:9' | '9:16';
  saveCurrentState?: (operation: any, description: string) => void; // 添加保存历史状态的方法

  // Character related props
  updateCharacter?: (id: string, field: keyof Character, value: any) => void;
  generateCharacterImage?: (id: string, model?: { model: string; provider: string }, silent?: boolean, skipStateUpdate?: boolean) => void;
  deleteCharacter?: (id: string) => void;
  addCharacter?: () => Promise<Character>;

  // Scene related props
  updateScene?: (id: string, field: keyof Scene, value: any) => void;
  generateSceneImage?: (id: string, model?: { model: string; provider: string }, silent?: boolean, skipStateUpdate?: boolean) => void;
  deleteScene?: (id: string) => void;
  addScene?: () => Promise<Scene>;

  // Prop related props
  updateProp?: (id: string, field: keyof Prop, value: any) => void;
  generatePropImage?: (id: string, model?: { model: string; provider: string }, silent?: boolean, skipStateUpdate?: boolean) => void;
  deleteProp?: (id: string) => void;
  addProp?: () => Promise<Prop>;
}

export const StepStoryboard: React.FC<StepStoryboardProps> = ({
  projectId,
  projectName = '项目',
  episodeName = '剧集',
  storyboards,
  setStoryboards,
  characters,
  scenes = [],
  props = [],
  updateStoryboard,
  updateStoryboardMediaAndSave,
  deleteStoryboard,
  moveStoryboard,
  generateStoryboardVideo,
  generateStoryboardImage,
  inferStoryboardPrompt,
  setPreviewVideoUrl,
  aspectRatio = '16:9',
  addStoryboard: addStoryboardProp,
  saveCurrentState,
  updateCharacter,
  generateCharacterImage,
  deleteCharacter,
  addCharacter,
  updateScene,
  generateSceneImage,
  deleteScene,
  addScene,
  updateProp,
  generatePropImage,
  deleteProp,
  addProp,
  projectScript,
  episodeId,
  onRefreshProject
}) => {
  const [historyModalVisible, setHistoryModalVisible] = React.useState(false);
  const [historyTargetStoryboardId, setHistoryTargetStoryboardId] = React.useState<number | null>(null);
  const [editingScriptId, setEditingScriptId] = React.useState<string | null>(null);

  // 视图模式：list 或 preview
  const [viewMode, setViewMode] = React.useState<'list' | 'preview'>('list');
  const [previewIndex, setPreviewIndex] = React.useState(0);

  // Active Storyboard for Operation Panel
  const [activeStoryboardId, setActiveStoryboardId] = React.useState<string | null>(null);
  const [operationPanelTab, setOperationPanelTab] = React.useState<'image' | 'video'>('image');

  // Panel mode: 'resource' for resource selection, 'operation' for storyboard operation
  const [panelMode, setPanelMode] = React.useState<'resource' | 'operation'>('resource');
  const [resourceTab, setResourceTab] = React.useState<'character' | 'scene' | 'prop'>('character');
  const [selectedResourceId, setSelectedResourceId] = React.useState<string | null>(null);

  // 右侧面板闪烁高亮状态
  const [isHighlighting, setIsHighlighting] = React.useState(false);

  // Selection state
  const [selectedIds, setSelectedIds] = React.useState<string[]>([]);

  // 匹配结果弹窗状态
  const [matchResultVisible, setMatchResultVisible] = React.useState(false);
  const [matchResultContent, setMatchResultContent] = React.useState('');

  // 播放控制状态
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [currentTime, setCurrentTime] = React.useState(0);
  const [videoDuration, setVideoDuration] = React.useState(0);
  const [videoDurations, setVideoDurations] = React.useState<Record<string, number>>({});

  // 自动解析状态
  const [isAutoAnalyzing, setIsAutoAnalyzing] = React.useState(false);
  const [progressSteps, setProgressSteps] = React.useState<ProgressStep[]>([]);

  const handlePlayPause = React.useCallback(() => {
    setIsPlaying(prev => !prev);
  }, []);

  const handleTimeUpdate = React.useCallback((time: number) => {
    setCurrentTime(time);
  }, []);

  const handleDurationChange = React.useCallback((duration: number) => {
    setVideoDuration(duration);
    // 更新当前分镜的视频时长记录
    const currentStoryboardId = storyboards[previewIndex]?.id;
    if (currentStoryboardId) {
        setVideoDurations(prev => {
            // 如果时长没有变化，不更新
            if (prev[currentStoryboardId] === duration) return prev;
            return {
                ...prev,
                [currentStoryboardId]: duration
            };
        });
    }
  }, [storyboards, previewIndex]);

  const handleVideoEnded = React.useCallback(() => {
    setIsPlaying(false);
  }, []);

  // 切换分镜时重置播放状态
  React.useEffect(() => {
    setIsPlaying(false);
    setCurrentTime(0);
    setVideoDuration(0);
  }, [previewIndex]);

  React.useEffect(() => {
    if (storyboards.length > 0 && !activeStoryboardId) {
      setActiveStoryboardId(storyboards[0].id);
    }
  }, [storyboards, activeStoryboardId]);

  // 触发右侧面板闪烁高亮效果
  const triggerHighlight = () => {
    setIsHighlighting(true);
    setTimeout(() => setIsHighlighting(false), 1000); // 1秒后移除高亮
  };

  // 跳转到资源选择面板并触发高亮
  const navigateToResourceTab = (tab: 'character' | 'scene' | 'prop') => {
    setPanelMode('resource');
    setResourceTab(tab);
    setSelectedResourceId(null);
    triggerHighlight();
  };

  // 自动匹配角色
  const autoMatchCharacters = () => {
    let totalMatched = 0;
    let affectedStoryboards = 0;

    storyboards.forEach(frame => {
      const text = frame.text.toLowerCase();
      const currentCharacterIds = frame.characterIds || [];
      const newCharacterIds = [...currentCharacterIds];
      let frameMatched = 0;

      characters.forEach(char => {
        const charName = char.name.toLowerCase();
        // 如果文案中包含角色名称，且该角色还未添加到当前分镜
        if (text.includes(charName) && !currentCharacterIds.includes(char.id)) {
          newCharacterIds.push(char.id);
          frameMatched++;
          totalMatched++;
        }
      });

      if (frameMatched > 0) {
        updateStoryboard(frame.id, 'characterIds', newCharacterIds);
        affectedStoryboards++;
      }
    });

    if (totalMatched > 0) {
      setMatchResultContent(`共为 ${affectedStoryboards} 个分镜添加了 ${totalMatched} 个角色。`);
    } else {
      setMatchResultContent('未找到可匹配的角色。');
    }
    setMatchResultVisible(true);
  };

  // 自动匹配场景
  const autoMatchScenes = () => {
    let totalMatched = 0;
    let affectedStoryboards = 0;

    storyboards.forEach(frame => {
      const text = frame.text.toLowerCase();

      // 如果当前分镜已有场景，跳过
      if (frame.sceneId) return;

      scenes.forEach(scene => {
        const sceneName = scene.name.toLowerCase();
        // 如果文案中包含场景名称
        if (text.includes(sceneName)) {
          updateStoryboard(frame.id, 'sceneId', scene.id);
          totalMatched++;
          affectedStoryboards++;
          return; // 每个分镜只匹配一个场景
        }
      });
    });

    if (totalMatched > 0) {
      setMatchResultContent(`共为 ${affectedStoryboards} 个分镜添加了 ${totalMatched} 个场景。`);
    } else {
      setMatchResultContent('未找到可匹配的场景。');
    }
    setMatchResultVisible(true);
  };

  // 自动匹配物品
  const autoMatchProps = () => {
    let totalMatched = 0;
    let affectedStoryboards = 0;

    storyboards.forEach(frame => {
      const text = frame.text.toLowerCase();
      const currentPropIds = frame.propIds || [];
      const newPropIds = [...currentPropIds];
      let frameMatched = 0;

      props.forEach(prop => {
        const propName = prop.name.toLowerCase();
        // 如果文案中包含物品名称，且该物品还未添加到当前分镜
        if (text.includes(propName) && !currentPropIds.includes(prop.id)) {
          newPropIds.push(prop.id);
          frameMatched++;
          totalMatched++;
        }
      });

      if (frameMatched > 0) {
        updateStoryboard(frame.id, 'propIds', newPropIds);
        affectedStoryboards++;
      }
    });

    if (totalMatched > 0) {
      setMatchResultContent(`共为 ${affectedStoryboards} 个分镜添加了 ${totalMatched} 个物品。`);
    } else {
      setMatchResultContent('未找到可匹配的物品。');
    }
    setMatchResultVisible(true);
  };

  const handleAddStoryboard = async (insertIndex: number) => {
    // 如果传入了 addStoryboard 方法，使用它（会保存到后端）
    if (addStoryboardProp) {
      await addStoryboardProp(insertIndex);
      return;
    }

    // 否则只在本地添加（旧逻辑，保持向后兼容）
    const newFrame: StoryboardFrame = {
      id: Date.now().toString(),
      text: '',
      characterIds: [],
      propIds: [],
      duration: 10,
      prompt: '',
      status: 'draft',
      order: insertIndex,
    };

    const newStoryboards = [...storyboards];
    newStoryboards.splice(insertIndex, 0, newFrame);
    setStoryboards(newStoryboards);
    message.success('已添加新分镜');
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const toggleAll = () => {
    if (selectedIds.length === storyboards.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(storyboards.map(s => s.id));
    }
  };

  const handleBatchGenerateImages = async (mode: 'all' | 'missing') => {
    const selectedStoryboards = storyboards.filter(s => selectedIds.includes(s.id));

    let targetStoryboards = selectedStoryboards;
    if (mode === 'missing') {
      targetStoryboards = selectedStoryboards.filter(s => !s.imageUrl);
    }

    if (targetStoryboards.length === 0) {
      message.warning(mode === 'missing' ? '选中的分镜都已有图片' : '没有可生成的分镜');
      return;
    }

    // 先一次性批量设置所有目标分镜为生成中状态
    for (const frame of targetStoryboards) {
      updateStoryboard(frame.id, 'imageStatus', 'generating');
    }

    // 显示一次加载提示
    message.loading({
      content: `正在批量生成 ${targetStoryboards.length} 个分镜图...`,
      key: 'batch-generate',
      duration: 0
    });

    // 逐个提交生成任务（静默模式）
    let successCount = 0;
    for (const frame of targetStoryboards) {
      try {
        await generateStoryboardImage(frame.id, {
          ratio: aspectRatio,
          count: 1
        }, true); // silent = true
        successCount++;
        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`生成分镜 ${frame.id} 失败:`, error);
      }
    }

    // 只显示一次成功提示
    message.success({
      content: `已提交 ${successCount} 个分镜的生成任务`,
      key: 'batch-generate'
    });
  };

  // 计算缺失图片的数量
  const missingImagesCount = storyboards.filter(s => selectedIds.includes(s.id) && !s.imageUrl).length;

  // 计算缺失视频的数量
  const missingVideosCount = storyboards.filter(s => selectedIds.includes(s.id) && !s.videoUrl).length;

  // 计算缺失提示词的数量
  const missingPromptsCount = storyboards.filter(s => selectedIds.includes(s.id) && (!s.prompt || !s.prompt.trim())).length;

  const handleBatchGenerateVideos = async (mode: 'all' | 'missing') => {
    const selectedStoryboards = storyboards.filter(s => selectedIds.includes(s.id));

    let targetStoryboards = selectedStoryboards;
    if (mode === 'missing') {
      targetStoryboards = selectedStoryboards.filter(s => !s.videoUrl);
    }

    if (targetStoryboards.length === 0) {
      message.warning(mode === 'missing' ? '选中的分镜都已有视频' : '没有可生成的分镜');
      return;
    }

    // 先一次性批量设置所有目标分镜为生成中状态
    for (const frame of targetStoryboards) {
      updateStoryboard(frame.id, 'status', 'generating_video');
    }

    // 显示一次加载提示
    message.loading({
      content: `正在批量生成 ${targetStoryboards.length} 个分镜视频...`,
      key: 'batch-generate-video',
      duration: 0
    });

    // 逐个提交生成任务
    let successCount = 0;
    for (const frame of targetStoryboards) {
      try {
        await generateStoryboardVideo(frame.id);
        successCount++;
        // 添加小延迟避免请求过快
        await new Promise(resolve => setTimeout(resolve, 300));
      } catch (error) {
        console.error(`生成分镜视频 ${frame.id} 失败:`, error);
      }
    }

    // 只显示一次成功提示
    message.success({
      content: `已提交 ${successCount} 个分镜视频的生成任务`,
      key: 'batch-generate-video'
    });
  };

  const handleBatchDelete = async () => {
    const selectedStoryboards = storyboards.filter(s => selectedIds.includes(s.id));

    if (selectedStoryboards.length === 0) {
      message.warning('没有选中的分镜');
      throw new Error('没有选中的分镜');
    }

    try {
      // 删除已保存到数据库的分镜
      for (const frame of selectedStoryboards) {
        const numericId = Number(frame.id);
        // 如果是数据库ID（小于时间戳），调用删除接口
        if (!isNaN(numericId) && numericId < 1700000000000 && projectId) {
          await projectService.deleteStoryboard(projectId, numericId);
        }
      }

      // 从本地状态中移除
      const newStoryboards = storyboards.filter(s => !selectedIds.includes(s.id));
      setStoryboards(newStoryboards);

      // 清空选择
      setSelectedIds([]);

      // 删除完成后显示成功提示
      message.success(`已删除 ${selectedStoryboards.length} 个分镜`);
    } catch (error) {
      console.error('批量删除分镜失败:', error);
      message.error('删除分镜失败');
      throw error; // 重新抛出错误，让弹窗能捕获
    }
  };

  const handleBatchInferPrompts = async (mode: 'all' | 'missing') => {
    const selectedStoryboards = storyboards.filter(s => selectedIds.includes(s.id));

    // 根据模式过滤分镜
    let targetStoryboards = selectedStoryboards;
    if (mode === 'missing') {
      // 只处理缺失提示词的分镜
      targetStoryboards = selectedStoryboards.filter(s => !s.prompt || !s.prompt.trim());
    }

    // 过滤出有文本描述的分镜
    const validStoryboards = targetStoryboards.filter(s => s.text && s.text.trim());

    if (validStoryboards.length === 0) {
      if (mode === 'missing') {
        message.info('没有缺失提示词的分镜');
      } else {
        message.warning('选中的分镜都没有文本描述');
      }
      return;
    }

    // 先一次性批量设置所有目标分镜为推理中状态
    for (const frame of validStoryboards) {
      updateStoryboard(frame.id, 'status', 'generating_prompt');
    }

    // 显示加载提示
    message.loading({
      content: `正在批量推理 ${validStoryboards.length} 个分镜的视频提示词...`,
      key: 'batch-infer-prompts',
      duration: 0
    });

    // 并发推理所有提示词
    const results = await Promise.allSettled(
      validStoryboards.map(frame =>
        inferStoryboardPrompt ? inferStoryboardPrompt(frame.id, true) : Promise.resolve()
      )
    );

    // 统计成功数量
    const successCount = results.filter(r => r.status === 'fulfilled').length;
    const failedCount = results.filter(r => r.status === 'rejected').length;

    // 显示结果提示
    if (failedCount > 0) {
      message.warning({
        content: `推理完成：成功 ${successCount} 个，失败 ${failedCount} 个`,
        key: 'batch-infer-prompts'
      });
    } else {
      message.success({
        content: `已成功推理 ${successCount} 个分镜的视频提示词`,
        key: 'batch-infer-prompts'
      });
    }
  };

  const updateStepProgress = (key: string, updates: Partial<ProgressStep>) => {
    setProgressSteps(prev =>
      prev.map(step => step.key === key ? { ...step, ...updates } : step)
    );
  };

  const animateProgress = (key: string, duration: number, stopAt: number = 100): Promise<void> => {
    return new Promise((resolve) => {
      const startTime = Date.now();
      const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min((elapsed / duration) * stopAt, stopAt);

        updateStepProgress(key, { progress });

        if (progress >= stopAt) {
          clearInterval(interval);
          resolve();
        }
      }, 50);
    });
  };

  const handleAutoAnalyze = async () => {
    if (!projectId || !projectScript || !episodeId) {
      message.warning('缺少必要参数，无法自动解析');
      return;
    }

    setIsAutoAnalyzing(true);

    // 判断当前剧集的角色、场景、物品是否都为空
    const currentEpisodeCharacters = characters.filter(c => c.episodeId === episodeId);
    const currentEpisodeScenes = scenes.filter(s => s.episodeId === episodeId);
    const currentEpisodeProps = props.filter(p => p.episodeId === episodeId);
    
    const needAnalyzeElements = 
      currentEpisodeCharacters.length === 0 && 
      currentEpisodeScenes.length === 0 && 
      currentEpisodeProps.length === 0;

    // 根据是否需要分析元素来设置步骤
    const allSteps: ProgressStep[] = needAnalyzeElements ? [
      { key: 'character', label: '分析角色', status: 'pending', progress: 0 },
      { key: 'scene', label: '分析场景', status: 'pending', progress: 0 },
      { key: 'prop', label: '分析物品', status: 'pending', progress: 0 },
      { key: 'script', label: '分析剧本', status: 'pending', progress: 0 },
      { key: 'storyboard', label: '规划分镜', status: 'pending', progress: 0 },
    ] : [
      { key: 'script', label: '分析剧本', status: 'pending', progress: 0 },
      { key: 'storyboard', label: '规划分镜', status: 'pending', progress: 0 },
    ];

    setProgressSteps(allSteps);

    try {
      // 如果需要，先分析角色、场景、物品
      if (needAnalyzeElements) {
        updateStepProgress('character', { status: 'loading' });

        let analyzeElementsCompleted = false;
        const analyzeElementsPromise = aiService.analyzeElements({
          projectId,
          scriptContent: projectScript,
          episodeId,
          saveToDb: true
        }).then((result) => {
          analyzeElementsCompleted = true;
          return result;
        });

        await Promise.race([
          animateProgress('character', 15000, 100),
          analyzeElementsPromise.catch(err => { throw err; })
        ]);
        updateStepProgress('character', { status: 'completed', progress: 100 });

        updateStepProgress('scene', { status: 'loading' });
        await Promise.race([
          animateProgress('scene', 15000, 100),
          analyzeElementsPromise.catch(err => { throw err; })
        ]);
        updateStepProgress('scene', { status: 'completed', progress: 100 });

        updateStepProgress('prop', { status: 'loading' });
        await Promise.race([
          animateProgress('prop', 15000, 95),
          analyzeElementsPromise.catch(err => { throw err; })
        ]);

        if (!analyzeElementsCompleted) {
          updateStepProgress('prop', { showWaiting: true });
          await analyzeElementsPromise;
        }

        updateStepProgress('prop', { status: 'completed', progress: 100, showWaiting: false });
      }

      // 分析剧本和分镜
      updateStepProgress('script', { status: 'loading' });

      let analyzeStoryboardsCompleted = false;
      const analyzeStoryboardsPromise = aiService.analyzeStoryboards({
        projectId,
        scriptContent: projectScript,
        episodeId
      }).then((result) => {
        analyzeStoryboardsCompleted = true;
        return result;
      });

      await Promise.race([
        animateProgress('script', 15000, 100),
        analyzeStoryboardsPromise.catch(err => { throw err; })
      ]);
      updateStepProgress('script', { status: 'completed', progress: 100 });

      updateStepProgress('storyboard', { status: 'loading' });
      await Promise.race([
        animateProgress('storyboard', 15000, 95),
        analyzeStoryboardsPromise.catch(err => { throw err; })
      ]);

      if (!analyzeStoryboardsCompleted) {
        updateStepProgress('storyboard', { showWaiting: true });
        await analyzeStoryboardsPromise;
      }

      updateStepProgress('storyboard', { status: 'completed', progress: 100, showWaiting: false });

      // 清理状态
      setProgressSteps([]);

      // 刷新项目数据
      if (onRefreshProject) {
        await onRefreshProject();
      }
      setIsAutoAnalyzing(false);
      message.success('解析完成');

    } catch (error) {
      console.error('Auto analyze failed:', error);
      message.error('解析失败');
      setIsAutoAnalyzing(false);
      setProgressSteps([]);
    }
  };

  return (
    <div className="w-full h-full flex flex-col px-4 pt-4 animate-fade-in overflow-hidden relative">
      <div className="flex-1 min-h-0 flex gap-4 overflow-hidden">
        {/* List Container with Horizontal Scroll */}
        <div className="flex-1 min-h-0 flex flex-col rounded-lg overflow-hidden relative">
          <div className="flex justify-between items-center px-4 py-3 bg-bg-card z-30">
            <div className="text-lg font-bold text-text-primary">分镜列表 ({storyboards.length})</div>
            <div className="flex bg-bg-element p-0.5 rounded-full">
              <div
                className={`px-2 py-1 text-xs rounded-full cursor-pointer transition-all duration-300 ${viewMode === 'list'
                    ? 'bg-bg-card text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
                onClick={() => setViewMode('list')}
              >
                列表模式
              </div>
              <div
                className={`px-2 py-1 text-xs rounded-full cursor-pointer transition-all duration-300 ${viewMode === 'preview'
                    ? 'bg-bg-card text-text-primary shadow-sm'
                    : 'text-text-secondary hover:text-text-primary'
                  }`}
                onClick={() => setViewMode('preview')}
              >
                预览模式
              </div>
            </div>
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden relative bg-bg-card rounded-bl-lg rounded-br-lg">
            {viewMode === 'list' ? (
              <div className="absolute inset-0 overflow-auto">
                <div className="min-w-[1340px] flex flex-col min-h-full">
                  {/* List Header */}
                  <div className="flex-none grid grid-cols-[30px_40px_minmax(300px,3fr)_minmax(140px,1.5fr)_minmax(70px,0.75fr)_minmax(140px,1.5fr)_100px_minmax(200px,2fr)_100px_60px] gap-4 bg-bg-element px-4 py-3 border-b border-border text-text-secondary font-medium text-sm sticky top-0 z-20">
                    <div className="flex items-center justify-center">
                      <Checkbox
                        checked={selectedIds.length === storyboards.length && storyboards.length > 0}
                        indeterminate={selectedIds.length > 0 && selectedIds.length < storyboards.length}
                        onChange={toggleAll}
                      />
                    </div>
                    <div className="flex items-center justify-center">序号</div>
                    <div className="flex items-center gap-2">剧本 <ThunderboltOutlined className="text-xs" /></div>
                    <Tooltip title="点击自动匹配角色">
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={autoMatchCharacters}
                      >
                        出场角色 <GlobalOutlined className="text-xs" />
                      </div>
                    </Tooltip>
                    <Tooltip title="点击自动匹配场景">
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={autoMatchScenes}
                      >
                        场景 <PictureOutlined className="text-xs" />
                      </div>
                    </Tooltip>
                    <Tooltip title="点击自动匹配物品">
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={autoMatchProps}
                      >
                        物品 <ToolOutlined className="text-xs" />
                      </div>
                    </Tooltip>
                    <div className="flex items-center gap-2">分镜图</div>
                    <div className="flex items-center gap-2">视频提示词</div>
                    <div className="flex items-center gap-2">视频</div>
                    <div className="text-center">操作</div>
                  </div>
                  {/* 分镜表格 */}
                  <div className="flex-1">
                    {storyboards.length === 0 ? (
                      // 空状态缺省图
                      <div className="flex flex-col items-center justify-center h-full py-20">
                        <Empty
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                          description={
                            <div className="text-center ">
                              <div className="text-text-secondary text-base mb-1">暂无分镜</div>
                              <div className="text-text-tertiary text-sm mt-5">点击下方按钮自动解析或者添加分镜</div>
                            </div>
                          }
                        >
                          <div className="flex gap-3">
                            {projectScript && projectId && episodeId && (
                              <Button
                                type="primary"
                                icon={<Sparkles size={18} />}
                                size="large"
                                onClick={handleAutoAnalyze}
                                className="bg-primary hover:opacity-90"
                              >
                                自动解析
                              </Button>
                            )}
                            <Button
                              type="default"
                              icon={<PlusOutlined />}
                              size="large"
                              onClick={() => handleAddStoryboard(0)}
                              className="bg-linear-to-r from-primary to-purple-600 text-white border-none hover:shadow-lg hover:shadow-primary/30 transition-all duration-300"
                            >
                              添加分镜
                            </Button>
                          </div>
                        </Empty>
                      </div>
                    ) : (
                      <div className="flex flex-col divide-y divide-border/50">
                        {storyboards.length > 0 && (
                          <div className="px-4">
                            <StoryboardInserter onClick={() => handleAddStoryboard(0)} />
                          </div>
                        )}
                        {storyboards.map((frame, index) => (
                          <React.Fragment key={frame.id}>
                            <div
                              className={`grid grid-cols-[30px_40px_minmax(300px,3fr)_minmax(140px,1.5fr)_minmax(70px,0.75fr)_minmax(140px,1.5fr)_100px_minmax(200px,2fr)_100px_60px] gap-4 px-4 py-6 hover:bg-bg-element/20 transition-colors group relative cursor-pointer ${selectedIds.includes(frame.id) ? 'bg-primary/5' : ''} ${activeStoryboardId === frame.id ? 'bg-primary/5 ring-1 ring-primary ring-inset' : ''}`}
                              onClick={() => {
                                setActiveStoryboardId(frame.id);
                                setPanelMode('resource');
                              }}
                            >

                              {/* Checkbox */}
                              <div className="flex items-start justify-center pt-2">
                                <Checkbox
                                  checked={selectedIds.includes(frame.id)}
                                  onChange={() => toggleSelection(frame.id)}
                                />
                              </div>

                              {/* Index */}
                              <div className="flex items-start justify-center pt-2">
                                <div className="w-6 h-6 rounded-full bg-bg-element flex items-center justify-center text-text-secondary text-xs font-bold">
                                  {index + 1}
                                </div>
                              </div>

                              {/* Script & Prompt */}
                              <div className="flex flex-col gap-3">
                                <div
                                  className="flex items-start gap-2 min-h-[48px]"
                                  onDoubleClick={() => setEditingScriptId(frame.id)}
                                >
                                  {editingScriptId === frame.id ? (
                                    <TextArea
                                      value={frame.text}
                                      onChange={(e) => updateStoryboard(frame.id, 'text', e.target.value)}
                                      autoSize={{ minRows: 2, maxRows: 10 }}
                                      className="bg-transparent border-none p-0 text-text-primary text-xs focus:ring-0 focus:shadow-none resize-none !shadow-none"
                                      placeholder="输入分镜描述..."
                                      autoFocus
                                      onFocus={() => {
                                        // 聚焦时记录编辑前的状态
                                        const currentFrame = storyboards.find(f => f.id === frame.id);
                                        if (currentFrame) {
                                          (window as any).__textEditBeforeValue = currentFrame.text;
                                        }
                                      }}
                                      onBlur={() => {
                                        setEditingScriptId(null);
                                        // 失去焦点时，如果文案有变化，保存撤回操作
                                        const beforeValue = (window as any).__textEditBeforeValue;
                                        const currentFrame = storyboards.find(f => f.id === frame.id);
                                       
                                        if (currentFrame && beforeValue !== currentFrame.text && saveCurrentState) {
                                          // 保存编辑后的值
                                          const afterValue = currentFrame.text;
                                          
                                          // 先临时恢复到编辑前的状态
                                          updateStoryboard(frame.id, 'text', beforeValue, true, true);
                                          
                                          // 使用 setTimeout 确保状态更新后再保存历史
                                          setTimeout(() => {
                                            // 保存编辑前的状态到历史记录
                                            saveCurrentState('edit_storyboard_text', '编辑分镜文案');
                                            // 再恢复到编辑后的状态
                                            updateStoryboard(frame.id, 'text', afterValue, true, true);
                                          }, 0);
                                        }
                                        delete (window as any).__textEditBeforeValue;
                                      }}
                                    />
                                  ) : (
                                    <div
                                      className="text-text-primary text-xs whitespace-pre-wrap cursor-pointer w-full select-none hover:bg-primary/10  rounded p-2 -m-2 transition-colors duration-200"
                                      title="双击编辑"
                                    >
                                      {/* hover:text-primary   */}
                                      {frame.text ? (
                                        (() => {
                                          // 获取当前分镜的角色、场景、物品名字列表
                                          const characterNames = (frame.characterIds || [])
                                            .map(charId => characters.find(c => c.id === charId)?.name)
                                            .filter(Boolean) as string[];

                                          const sceneName = frame.sceneId 
                                            ? scenes?.find(s => s.id === frame.sceneId)?.name 
                                            : null;

                                          const propNames = (frame.propIds || [])
                                            .map(propId => props?.find(p => p.id === propId)?.name)
                                            .filter(Boolean) as string[];

                                          // 如果没有任何资源，直接显示原文
                                          if (characterNames.length === 0 && !sceneName && propNames.length === 0) {
                                            return frame.text.split(/(?=▲)/g).map((line, i) => (
                                              <div key={i} className="mb-0.5 last:mb-0">
                                                {line}
                                              </div>
                                            ));
                                          }

                                          // 合并所有需要高亮的名字
                                          const allNames = [
                                            ...characterNames.map(name => ({ name, type: 'character' })),
                                            ...(sceneName ? [{ name: sceneName, type: 'scene' }] : []),
                                            ...propNames.map(name => ({ name, type: 'prop' }))
                                          ];

                                          // 创建正则表达式匹配所有名字
                                          const regex = new RegExp(
                                            `(${allNames.map(item => item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 
                                            'g'
                                          );

                                          return frame.text.split(/(?=▲)/g).map((line, i) => {
                                            const parts = line.split(regex);
                                            return (
                                              <div key={i} className="mb-0.5 last:mb-0">
                                                {parts.map((part, j) => {
                                                  // 判断这部分是什么类型的资源
                                                  const matchedItem = allNames.find(item => item.name === part);
                                                  
                                                  if (matchedItem) {
                                                    // 根据类型应用不同的样式
                                                    if (matchedItem.type === 'character') {
                                                      return (
                                                        <span key={j} className="text-primary/80 font-medium bg-primary/5 px-0.5 rounded">
                                                          {part}
                                                        </span>
                                                      );
                                                    } else if (matchedItem.type === 'scene') {
                                                      return (
                                                        <span key={j} className="text-blue-300 font-medium bg-blue-500/5 px-0.5 rounded">
                                                          {part}
                                                        </span>
                                                      );
                                                    } else if (matchedItem.type === 'prop') {
                                                      return (
                                                        <span key={j} className="text-orange-300 font-medium bg-orange-500/5 px-0.5 rounded">
                                                          {part}
                                                        </span>
                                                      );
                                                    }
                                                  }
                                                  return <span key={j}>{part}</span>;
                                                })}
                                              </div>
                                            );
                                          });
                                        })()
                                      ) : (
                                        <span className="text-text-tertiary">输入分镜描述...</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Characters */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveStoryboardId(frame.id);
                                  setPanelMode('resource');
                                  setResourceTab('character');
                                  setSelectedResourceId(null);
                                }}
                              >
                                <div className="grid grid-cols-2 gap-2">
                                  {/* 显示所有选中的角色（最多4个） */}
                                  {(frame.characterIds || []).map(charId => {
                                    const char = characters.find(c => c.id === charId);
                                    return char ? (
                                      <div
                                        key={charId}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveStoryboardId(frame.id);
                                          setPanelMode('resource');
                                          setResourceTab('character');
                                          setSelectedResourceId(charId);
                                        }}
                                      >
                                        <ResourceItem
                                          image={char.imageUrl}
                                          name={char.name}
                                          isGenerating={(char.imageStatus as string) === 'generating'}
                                          onDelete={(e) => {
                                            e.stopPropagation();
                                            updateStoryboard(frame.id, 'characterIds', frame.characterIds.filter(id => id !== charId));
                                          }}
                                          className="aspect-square overflow-visible bg-bg-element"
                                        />
                                      </div>
                                    ) : null;
                                  })}

                                  {/* 角色添加按钮 - 点击跳转到资源选择面板 - 最多4个角色时隐藏 */}
                                  {/* 计算真实存在的已选角色数量（过滤掉已删除的角色ID） */}
                                  {(frame.characterIds || []).filter(id => id && characters.find(c => c.id === id)).length < 4 && (
                                    <div
                                      className="aspect-square rounded border border-dashed border-border hover:border-primary hover:text-primary flex items-center justify-center cursor-pointer transition-colors text-text-secondary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveStoryboardId(frame.id);
                                        navigateToResourceTab('character');
                                      }}
                                      title="添加角色"
                                    >
                                      <PlusOutlined />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Scene - 场景选择区域 */}
                              <div>
                                {/* 注释掉下拉选择功能，改为点击跳转到资源面板 */}
                                {/* <Popover
                            trigger="click"
                            placement="bottom"
                            content={
                              <div className="w-64">
                                <div className="mb-2 text-xs text-text-secondary">选择场景</div>
                                <Select
                                  className="w-full"
                                  allowClear
                                  placeholder="选择场景"
                                  value={frame.sceneId}
                                  onChange={(val) => updateStoryboard(frame.id, 'sceneId', val)}
                                  options={scenes?.map(s => ({ 
                                    label: (
                                      <div className="flex items-center gap-2">
                                        {s.imageUrl ? (
                                          <CachedImage src={s.imageUrl} alt={s.name} className="w-6 h-6 rounded object-cover border border-border" />
                                        ) : (
                                          <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center text-[10px] text-primary font-bold">
                                            {s.name[0]}
                                          </div>
                                        )}
                                        <span>{s.name}</span>
                                      </div>
                                    ), 
                                    value: s.id,
                                    searchLabel: s.name
                                  }))}
                                  optionFilterProp="searchLabel"
                                />
                              </div>
                            }
                          > */}
                                <div
                                  className={`aspect-square rounded bg-bg-element overflow-visible relative group/scene cursor-pointer mr-1 ${frame.sceneId ? '' : 'border border-dashed border-border hover:border-primary hover:text-primary'}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveStoryboardId(frame.id);
                                    // 如果已有场景，打开场景详情；否则跳转到场景列表
                                    if (frame.sceneId) {
                                      setPanelMode('resource');
                                      setResourceTab('scene');
                                      setSelectedResourceId(frame.sceneId);
                                    } else {
                                      navigateToResourceTab('scene');
                                    }
                                  }}
                                  title={frame.sceneId ? "查看场景详情" : "添加场景"}
                                >
                                  {frame.sceneId && scenes?.find(s => s.id === frame.sceneId) ? (
                                    <ResourceItem
                                      image={scenes.find(s => s.id === frame.sceneId)?.imageUrl}
                                      name={scenes.find(s => s.id === frame.sceneId)?.name || '未知场景'}
                                      isGenerating={scenes.find(s => s.id === frame.sceneId)?.status === 'generating'}
                                      onDelete={(e) => {
                                        e.stopPropagation();
                                        updateStoryboard(frame.id, 'sceneId', null);
                                      }}
                                      className="w-full h-full rounded overflow-visible"
                                    />
                                  ) : (
                                    <div className="w-full h-full flex items-center justify-center text-text-secondary/50 group-hover/scene:text-primary transition-colors">
                                      <PlusOutlined />
                                    </div>
                                  )}
                                </div>
                                {/* </Popover> */}
                              </div>

                              {/* Props */}
                              <div>
                                <div
                                  className="grid grid-cols-2 gap-2"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveStoryboardId(frame.id);
                                    setPanelMode('resource');
                                    setResourceTab('prop');
                                    setSelectedResourceId(null);
                                  }}
                                >
                                  {/* 显示所有选中的物品（最多4个） */}
                                  {(frame.propIds || []).map(pid => {
                                    const p = props?.find(prop => prop.id === pid);
                                    return p ? (
                                      <div
                                        key={pid}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setActiveStoryboardId(frame.id);
                                          setPanelMode('resource');
                                          setResourceTab('prop');
                                          setSelectedResourceId(pid);
                                        }}
                                      >
                                        <ResourceItem
                                          image={p.imageUrl}
                                          name={p.name}
                                          isGenerating={p.status === 'generating'}
                                          onDelete={(e) => {
                                            e.stopPropagation();
                                            updateStoryboard(frame.id, 'propIds', (frame.propIds || []).filter(id => id !== pid));
                                          }}
                                          className="aspect-square rounded overflow-visible bg-bg-element"
                                        />
                                      </div>
                                    ) : null;
                                  })}

                                  {/* 物品添加按钮 - 点击跳转到资源选择面板 - 最多4个物品时隐藏 */}
                                  {/* 计算真实存在的已选物品数量（过滤掉已删除的物品ID） */}
                                  {(frame.propIds || []).filter(id => id && props.find(p => p.id === id)).length < 4 && (
                                    <div
                                      className="aspect-square rounded border border-dashed border-border hover:border-primary hover:text-primary flex items-center justify-center cursor-pointer transition-colors text-text-secondary"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setActiveStoryboardId(frame.id);
                                        navigateToResourceTab('prop');
                                      }}
                                      title="添加物品"
                                    >
                                      <PlusOutlined />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Storyboard Image (Reference Image or Placeholder) */}
                              <div>
                                <div
                                  className="aspect-square bg-bg-element rounded overflow-hidden border border-border/50 relative group/img hover:border-primary/50 transition-colors cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveStoryboardId(frame.id);
                                    setPanelMode('operation');
                                    setOperationPanelTab('image');
                                  }}
                                >
                                  {frame.imageStatus === 'generating' ? (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                      <Spin size="small" />
                                      <span className="text-[10px] text-text-secondary">生成中...</span>
                                    </div>
                                  ) : frame.imageUrl ? (
                                    <Popover
                                      placement="right"
                                      content={
                                        <div className="p-2 bg-bg-card border border-border rounded-lg shadow-lg">
                                          <CachedImage src={frame.imageUrl} alt={`分镜${index + 1}`} className="max-w-[400px] max-h-[400px] object-contain rounded-md shadow-sm " />
                                        </div>
                                      }
                                      trigger="hover"
                                      mouseEnterDelay={0.2}
                                      overlayInnerStyle={{ padding: 0, backgroundColor: 'transparent', boxShadow: 'none' }}
                                    >
                                      <div className="relative w-full h-full">
                                        <CachedImage src={frame.imageUrl} className="w-full h-full object-cover" />
                                      </div>
                                    </Popover>
                                    //    frame.referenceImageUrl ? (
                                    //   <img src={frame.referenceImageUrl} className="w-full h-full object-cover" />
                                    // ) : 
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 group-hover/img:bg-bg-element/80 transition-colors">
                                      <svg viewBox="0 0 1024 1024" className="w-5 h-5 text-text-secondary group-hover/img:text-primary transition-colors" fill="currentColor">
                                        <path d="M378.902489 215.782121c14.396738-31.880686 59.721889-31.880686 74.123746 0l78.869755 174.644926a203.197774 203.197774 0 0 0 101.499052 101.575848l174.619327 78.879994c31.880686 14.396738 31.880686 59.670691 0 74.06743l-174.619327 78.885114a203.146577 203.146577 0 0 0-101.499052 101.509291l-78.874875 174.706364c-14.401858 31.865327-59.716769 31.865327-74.118626 0l-78.874875-174.706364a203.146577 203.146577 0 0 0-101.499052-101.509291L23.909234 644.950319c-31.880686-14.396738-31.880686-59.670691 0-74.06743l174.619328-78.885114a203.202894 203.202894 0 0 0 101.499052-101.575848l78.874875-174.639806zM842.828672 13.633895c8.20696-18.175114 34.036101-18.175114 42.248181 0l14.934311 33.068468a154.590864 154.590864 0 0 0 77.185358 77.257034l33.124785 14.939432c18.169994 8.217199 18.175114 34.04634 0 42.2533l-33.124785 14.939432a154.534546 154.534546 0 0 0-77.185358 77.195596l-14.934311 33.124785c-8.217199 18.169994-34.036101 18.169994-42.248181 0l-14.939432-33.124785a154.514067 154.514067 0 0 0-77.185357-77.195596l-33.124785-14.939432c-18.169994-8.21208-18.169994-34.036101 0-42.2533l33.124785-14.939432a154.590864 154.590864 0 0 0 77.185357-77.257034l14.939432-33.068468z" />
                                      </svg>
                                      <span className="text-[10px] text-text-secondary group-hover/img:text-primary transition-colors">生成</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* 视频提示词 */}
                              <div
                                className="flex items-start py-2 relative"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveStoryboardId(frame.id);
                                  setPanelMode('operation');
                                  setOperationPanelTab('video');
                                }}
                              >
                                {(
                                  <Tooltip title={frame.prompt} placement="top">
                                    <div
                                      className="text-xs text-text-secondary hover:text-primary transition-colors cursor-pointer leading-relaxed overflow-hidden"
                                      style={{
                                        display: '-webkit-box',
                                        WebkitLineClamp: 4,
                                        WebkitBoxOrient: 'vertical',
                                        wordBreak: 'break-word'
                                      }}
                                    >
                                      {frame.prompt}
                                    </div>
                                  </Tooltip>
                                )}

                                {/* 推理中蒙层 */}
                                {frame.status === 'generating_prompt' && (
                                  <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] rounded flex items-center justify-center z-10">
                                    <div className="flex flex-col items-center gap-1">
                                      <Spin size="small" />
                                      <span className="text-white text-[10px]">推理中</span>
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Video */}
                              <div>
                                <div
                                  className="aspect-square bg-bg-element rounded overflow-hidden border border-border/50 relative group/video hover:border-primary/50 transition-colors cursor-pointer"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveStoryboardId(frame.id);
                                    setPanelMode('operation');
                                    setOperationPanelTab('video');
                                    // if (frame.status !== 'generating_video') {

                                    // }
                                  }}
                                >
                                  {frame.videoUrl ? (
                                    <VideoPreview
                                      src={frame.highResVideoUrl || frame.videoUrl}
                                      onClick={() => setPreviewVideoUrl(frame.highResVideoUrl || frame.videoUrl!)}
                                    />
                                  ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 group-hover/video:bg-bg-element/80 transition-colors">
                                      {frame.status === 'generating_video' ? (
                                        <Spin size="small" />
                                      ) : (
                                        <>
                                          <div className="text-xl text-text-secondary group-hover/video:text-primary transition-colors flex items-center justify-center">
                                            <VideoCameraOutlined />
                                          </div>
                                          <span className="text-[10px] text-text-secondary group-hover/video:text-primary transition-colors">生成</span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col items-center gap-1">
                                <Tooltip title="上移">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ArrowUpOutlined />}
                                    disabled={index === 0}
                                    onClick={() => moveStoryboard(index, 'up')}
                                    className="text-text-secondary hover:text-text-primary h-6 w-6"
                                  />
                                </Tooltip>
                                <Tooltip title="下移">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<ArrowDownOutlined />}
                                    disabled={index === storyboards.length - 1}
                                    onClick={() => moveStoryboard(index, 'down')}
                                    className="text-text-secondary hover:text-text-primary h-6 w-6"
                                  />
                                </Tooltip>
                                {/* <Tooltip title="历史记录">
                            <Button
                              type="text"
                              size="small"
                              icon={<HistoryOutlined />}
                              onClick={() => openHistoryModal(frame)}
                              className="text-text-secondary hover:text-primary h-6 w-6"
                            />
                          </Tooltip> */}
                                <Tooltip title="删除">
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    onClick={() => deleteStoryboard(frame.id)}
                                    className="text-text-secondary hover:text-red-500 h-6 w-6"
                                  />
                                </Tooltip>
                              </div>

                            </div>
                            <div className="px-4">
                              <StoryboardInserter onClick={() => handleAddStoryboard(index + 1)} />
                            </div>
                          </React.Fragment>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className='h-[30px]'></div>
                </div>
              </div>
            ) : (
              <>
                <div className="flex-1 min-h-0 relative bg-bg-card">
                  <StoryboardPreviewMode
                    storyboards={storyboards}
                    characters={characters}
                    scenes={scenes}
                    props={props}
                    currentIndex={previewIndex}
                    onIndexChange={setPreviewIndex}
                    onOpenImagePanel={(frameId) => {
                      setActiveStoryboardId(frameId);
                      setPanelMode('operation');
                      setOperationPanelTab('image');
                    }}
                    onOpenVideoPanel={(frameId) => {
                      setActiveStoryboardId(frameId);
                      setPanelMode('operation');
                      setOperationPanelTab('video');
                    }}
                    onStoryboardClick={(frameId) => {
                      setActiveStoryboardId(frameId);
                      setPanelMode('operation');
                      // 如果有视频，跳转到视频标签页；否则跳转到图片标签页
                      const frame = storyboards.find(s => s.id === frameId);
                      setOperationPanelTab(frame?.videoUrl ? 'video' : 'image');
                    }}
                    onGenerateImage={(frameId) => {
                      generateStoryboardImage(frameId, {
                        ratio: aspectRatio,
                        count: 1
                      });
                    }}
                    onGenerateVideo={(frameId) => {
                      generateStoryboardVideo(frameId);
                    }}
                    isPlaying={isPlaying}
                    onPlayPause={setIsPlaying}
                    onTimeUpdate={handleTimeUpdate}
                    onDurationChange={handleDurationChange}
                    onEnded={handleVideoEnded}
                  />
                </div>
              </>
            )}
          </div>
          {viewMode === 'preview' && (
            <StoryboardBottomBar
              storyboards={storyboards}
              currentIndex={previewIndex}
              onIndexChange={setPreviewIndex}
              isPlaying={isPlaying}
              onPlayPause={handlePlayPause}
              currentTime={currentTime}
              videoDuration={videoDuration}
              videoDurations={videoDurations}
            />
          )}
          
        </div>

        {/* 右侧操作面板 - 带闪烁高亮效果 */}
        <div className="flex-none w-[350px] h-full flex flex-col rounded-lg bg-bg-card overflow-hidden">
          <div className="flex-none px-4 py-3 bg-bg-card">
            <div className="text-lg font-bold text-text-primary">
              {activeStoryboardId
                ? `分镜${storyboards.findIndex(s => s.id === activeStoryboardId) + 1}`
                : '分镜'
              }
            </div>
          </div>
          <div className="relative flex-1 min-h-0">
            {/* 闪烁高亮边框层 */}
            {isHighlighting && (
              <div
                className="absolute inset-0 pointer-events-none z-50 border-[3px] border-primary/40 rounded-lg shadow-[0_0_15px_2px_rgba(14,242,131,0.3)] animate-[highlight-pulse_1s_ease-in-out]"
              />
            )}
            <style>{`
            @keyframes highlight-pulse {
              0%, 100% { 
                opacity: 0;
              }
              50% { 
                opacity: 1;
              }
            }
          `}</style>
            <div className="w-full h-full overflow-hidden">
              {panelMode === 'resource' ? (
                <ResourceSelectionPanel
                  storyboard={storyboards.find(s => s.id === activeStoryboardId)}
                  index={storyboards.findIndex(s => s.id === activeStoryboardId)}
                  characters={characters}
                  scenes={scenes}
                  props={props}
                  activeTab={resourceTab}
                  onTabChange={setResourceTab}
                  onUpdateStoryboard={(field, value) => {
                    if (activeStoryboardId) {
                      updateStoryboard(activeStoryboardId, field, value);
                    }
                  }}
                  onUpdateCharacter={updateCharacter}
                  onGenerateCharacterImage={generateCharacterImage}
                  onDeleteCharacter={deleteCharacter}
                  onAddCharacter={addCharacter}
                  onUpdateScene={updateScene}
                  onGenerateSceneImage={generateSceneImage}
                  onDeleteScene={deleteScene}
                  onAddScene={addScene}
                  onUpdateProp={updateProp}
                  onGeneratePropImage={generatePropImage}
                  onDeleteProp={deleteProp}
                  onAddProp={addProp}
                  projectId={projectId}
                  selectedResourceId={selectedResourceId}
                />
              ) : (
                <StoryboardOperationPanel
                  storyboard={storyboards.find(s => s.id === activeStoryboardId)}
                  index={storyboards.findIndex(s => s.id === activeStoryboardId)}
                  characters={characters}
                  activeTab={operationPanelTab}
                  onTabChange={setOperationPanelTab}
                  onUpdateStoryboard={(field, value) => {
                    if (activeStoryboardId) {
                      updateStoryboard(activeStoryboardId, field, value);
                    }
                  }}
                  onGenerateImage={(model) => {
                    if (activeStoryboardId) {
                      generateStoryboardImage(activeStoryboardId, {
                        ratio: '16:9',
                        count: 1
                      }, false, model);
                    }
                  }}
                  onGenerateVideo={(model) => {
                    if (activeStoryboardId) {
                      generateStoryboardVideo(activeStoryboardId, model);
                    }
                  }}
                  onInferPrompt={inferStoryboardPrompt}
                  onBack={() => setPanelMode('resource')}
                  scenes={scenes}
                  props={props}
                  aspectRatio={aspectRatio}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 批量操作工具栏 */}
      <StoryboardBatchToolbar
        selectedCount={selectedIds.length}
        onBatchGenerateImages={handleBatchGenerateImages}
        onBatchGenerateVideos={handleBatchGenerateVideos}
        onBatchDelete={handleBatchDelete}
        onBatchInferPrompts={handleBatchInferPrompts}
        missingImagesCount={missingImagesCount}
        missingVideosCount={missingVideosCount}
        missingPromptsCount={missingPromptsCount}
        selectedStoryboards={storyboards.filter(s => selectedIds.includes(s.id))}
        characters={characters}
        scenes={scenes}
        props={props}
        projectName={projectName}
        episodeName={episodeName}
      />

      <AssetBrowserModal
        visible={historyModalVisible}
        onCancel={() => {
          setHistoryModalVisible(false);
          setHistoryTargetStoryboardId(null);
        }}
        category="storyboard_video,upscale"
        relatedId={historyTargetStoryboardId!}
        title={(() => {
          const index = storyboards.findIndex(s => parseInt(s.id) === historyTargetStoryboardId);
          return index !== -1 ? `分镜 ${index + 1} - 资源库` : undefined;
        })()}
        onSelect={async (task, asset) => {
          if (asset && asset.url) {
            if (task.model === 'flash_vsr') {
              if (updateStoryboardMediaAndSave) {
                await updateStoryboardMediaAndSave(
                  historyTargetStoryboardId!.toString(),
                  { highResVideoUrl: asset.url, highResStatus: 'success' },
                  true,
                  'apply_storyboard_video_history',
                  '应用分镜视频历史素材'
                );
              } else {
                updateStoryboard(historyTargetStoryboardId!.toString(), 'highResVideoUrl', asset.url);
                updateStoryboard(historyTargetStoryboardId!.toString(), 'highResStatus', 'success');
              }
            } else {
              if (updateStoryboardMediaAndSave) {
                await updateStoryboardMediaAndSave(
                  historyTargetStoryboardId!.toString(),
                  { videoUrl: asset.url, status: 'video_generated' },
                  true,
                  'apply_storyboard_video_history',
                  '应用分镜视频历史素材'
                );
              } else {
                updateStoryboard(historyTargetStoryboardId!.toString(), 'videoUrl', asset.url);
                updateStoryboard(historyTargetStoryboardId!.toString(), 'status', 'video_generated');
              }
            }
            message.success('已应用历史生成结果');
            setHistoryModalVisible(false);
          } else {
            message.error('该历史记录无可用资源');
          }
        }}
      />

      {/* 匹配结果提示弹窗 */}
      <Modal
        title={<div className="text-center w-full text-[20px]">提示</div>}
        open={matchResultVisible}
        onCancel={() => setMatchResultVisible(false)}
        footer={
          <div className="flex justify-center ">
            <Button key="ok" type="primary" onClick={() => setMatchResultVisible(false)} className="px-8 w-50">
              确定
            </Button>
          </div>
        }
        centered
        width={400}
      >
        <div className="text-center py-4">
          <div className="mb-4 flex justify-center">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <svg viewBox="0 0 1024 1024" className="w-6 h-6 text-primary" fill="currentColor">
                <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm0 820c-205.4 0-372-166.6-372-372s166.6-372 372-372 372 166.6 372 372-166.6 372-372 372z" />
                <path d="M464 336a48 48 0 1 0 96 0 48 48 0 1 0-96 0zm72 112h-48c-4.4 0-8 3.6-8 8v272c0 4.4 3.6 8 8 8h48c4.4 0 8-3.6 8-8V456c0-4.4-3.6-8-8-8z" />
              </svg>
            </div>
          </div>
          <div className="text-text-primary/60 text-base">{matchResultContent}</div>
        </div>
      </Modal>

      {/* 自动解析进度弹窗 */}
      <Modal
        title={'解析剧本'}
        open={isAutoAnalyzing}
        footer={null}
        closable={false}
        maskClosable={false}
        centered
        width={600}
      >
        <ProgressSteps 
          steps={progressSteps} 
          title="AI 正在解析剧本"
        />
      </Modal>

    </div>
  );
};

