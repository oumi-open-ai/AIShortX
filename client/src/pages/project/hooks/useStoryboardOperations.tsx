import { useState, useRef } from 'react';
import { message, Modal } from 'antd';
import { projectService } from '../../../services/projectService';
import { aiService } from '../../../services/aiService';
import { characterService } from '../../../services/characterService';
import { useTaskStore } from '../../../store/taskStore';
import type { StoryboardFrame, Character, Scene, Prop, ProjectData } from '../../../types/workflow';
import { generateReferenceImage, type ReferenceItem } from '../../../utils/imageGenerator';

/**
 * 准备并生成分镜参考图
 * 根据分镜的参考范围（角色、场景、物品等）收集相关图片，合成为一张参考图
 * 
 * @param frame - 分镜帧对象
 * @param characters - 角色列表
 * @param scenes - 场景列表
 * @param props - 物品列表
 * @param aspectRatio - 画面比例
 * @returns 上传后的参考图URL
 */
export const prepareAndGenerateReferenceImage = async (
  frame: StoryboardFrame,
  characters: Character[],
  scenes: Scene[],
  props: Prop[],
  aspectRatio: '16:9' | '9:16'
): Promise<string | undefined> => {
  // 使用与 UI 一致的默认值逻辑
  const scope = frame.videoRefScope || (frame.imageUrl ? ['storyboard'] : ['character', 'scene', 'prop']);
  const items: ReferenceItem[] = [];

  if (scope.includes('storyboard') && frame.imageUrl) {
    items.push({
      url: frame.imageUrl,
      name: '分镜',
      type: '分镜'
    });
  }

  if (scope.includes('character') && frame.characterIds?.length > 0) {
    frame.characterIds.forEach(id => {
      const char = characters.find(c => c.id === id);
      if (char && char.imageUrl) {
        items.push({
          url: char.imageUrl,
          name: char.name,
          type: '角色'
        });
      }
    });
  }

  if (scope.includes('scene') && frame.sceneId) {
    const scene = scenes.find(s => s.id === frame.sceneId);
    if (scene && scene.imageUrl) {
      items.push({
        url: scene.imageUrl,
        name: scene.name,
        type: '场景'
      });
    }
  }

  if (scope.includes('prop') && frame.propIds && frame.propIds.length > 0) {
    frame.propIds.forEach(id => {
      const prop = props.find(p => p.id === id);
      if (prop && prop.imageUrl) {
        items.push({
          url: prop.imageUrl,
          name: prop.name,
          type: '物品'
        });
      }
    });
  }

  if (items.length === 0) {
    return undefined;
  }

  const file = await generateReferenceImage(items, aspectRatio);
  const url = await characterService.uploadFile(file);
  return url;
};

/**
 * 分镜操作 Hook
 * 
 * 提供分镜相关的所有操作功能：
 * - 分镜的增删改查和移动
 * - 分镜图片、视频、高清视频生成
 * - 提示词推理
 * - 参考图生成
 * - 批量操作
 * - 自动保存
 * 
 * @param projectId - 项目ID
 * @param currentEpisodeId - 当前分集ID
 * @param storyboards - 分镜列表
 * @param setStoryboards - 设置分镜列表的函数
 * @param storyboardsRef - 分镜列表的引用
 * @param characters - 角色列表
 * @param scenes - 场景列表
 * @param props - 物品列表
 * @param projectData - 项目数据
 * @param saveCurrentState - 保存当前状态到历史记录的函数
 */
export const useStoryboardOperations = (
  projectId: number,
  currentEpisodeId: number | null,
  storyboards: StoryboardFrame[],
  setStoryboards: React.Dispatch<React.SetStateAction<StoryboardFrame[]>>,
  storyboardsRef: React.MutableRefObject<StoryboardFrame[]>,
  characters: Character[],
  scenes: Scene[],
  props: Prop[],
  projectData: ProjectData,
  saveCurrentState: (operation: any, description: string) => void
) => {
  const { refreshStats } = useTaskStore();
  const [saving, setSaving] = useState(false);
  const storyboardSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textEditHistoryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textEditBeforeStateRef = useRef<any>(null);

  /**
   * 仅保存分镜数据到数据库
   * 不保存角色、场景、物品等其他数据
   * 
   * @param storyboards - 要保存的分镜列表
   * @param updateLocalState - 是否更新本地状态（默认true）
   */
  const saveStoryboardsOnly = async (storyboards: StoryboardFrame[], updateLocalState: boolean = true) => {
    if (storyboards.length === 0) return;
    
    const framesForDb = storyboards.map((f, idx) => ({
      ...f,
      order: idx,
      characterIds: f.characterIds.map(cid => parseInt(cid)),
      propIds: f.propIds ? f.propIds.map(pid => parseInt(pid)) : [],
      sceneId: f.sceneId ? parseInt(f.sceneId) : undefined
    }));

    const savedStoryboards = await projectService.saveStoryboards(projectId, framesForDb, currentEpisodeId || undefined);
    
    if (updateLocalState) {
      const mappedSavedStoryboards: StoryboardFrame[] = savedStoryboards.map(s => {
        const characterIds = typeof s.characterIds === 'string' ? JSON.parse(s.characterIds) : (s.characterIds || []);
        const propIds = typeof s.propIds === 'string' ? JSON.parse(s.propIds) : (s.propIds || []);

        return {
          id: s.id.toString(),
          episodeId: s.episodeId,
          text: s.text,
          characterIds: characterIds.map((id: number) => id.toString()),
          propIds: propIds.map((id: number) => id.toString()),
          sceneId: s.sceneId ? s.sceneId.toString() : undefined,
          duration: s.duration,
          prompt: s.prompt || '',
          videoUrl: s.videoUrl,
          highResVideoUrl: s.highResVideoUrl,
          highResStatus: s.highResStatus as any,
          errorMsg: s.errorMsg,
          highResErrorMsg: s.highResErrorMsg,
          status: s.status as any,
          order: s.order,
          imageUrl: s.imageUrl,
          imageStatus: s.imageStatus || 'idle',
          referenceImageUrl: s.referenceImageUrl,
          videoRefScope: s.videoRefScope
        };
      });
      
      setStoryboards(mappedSavedStoryboards);
      storyboardsRef.current = mappedSavedStoryboards;
    }
  };

  /**
   * 触发分镜自动保存
   * 使用防抖机制，在用户停止编辑2秒后自动保存到数据库
   * 
   * @param storyboardId - 分镜ID
   */
  const triggerStoryboardAutoSave = (storyboardId: string) => {
    if (storyboardSaveTimerRef.current) {
      clearTimeout(storyboardSaveTimerRef.current);
    }

    storyboardSaveTimerRef.current = setTimeout(async () => {
      const isTempId = !isNaN(Number(storyboardId)) && Number(storyboardId) > 1700000000000;
      if (isTempId) return;

      const frame = storyboardsRef.current.find(f => f.id === storyboardId);

      if (frame) {
        try {
          setSaving(true);
          const framesForDb = storyboardsRef.current.map((f, idx) => ({
            ...f,
            order: idx,
            characterIds: f.characterIds.map(cid => {
              const parsed = parseInt(cid);
              return isNaN(parsed) ? 0 : parsed;
            }),
            propIds: f.propIds ? f.propIds.map(pid => {
              const parsed = parseInt(pid);
              return isNaN(parsed) ? 0 : parsed;
            }) : [],
            sceneId: f.sceneId ? parseInt(f.sceneId) : undefined
          }));
          await projectService.saveStoryboards(projectId, framesForDb, currentEpisodeId || undefined);
        } catch (error) {
          console.error('Auto-save storyboard failed:', error);
        } finally {
          setSaving(false);
        }
      }
    }, 2000);
  };

  /**
   * 更新分镜的某个字段
   * 更新后会触发自动保存，某些操作会记录到历史（如添加/移除角色、编辑文案等）
   * 
   * @param storyboardId - 分镜ID
   * @param field - 要更新的字段名
   * @param value - 新的字段值
   * @param skipAutoSave - 是否跳过自动保存（默认false）
   * @param skipHistory - 是否跳过历史记录（默认false）
   */
  const updateStoryboard = (storyboardId: string, field: keyof StoryboardFrame, value: any, skipAutoSave: boolean = false, skipHistory: boolean = false) => {
    if (!skipHistory) {
      const frame = storyboardsRef.current.find(f => f.id === storyboardId);
      if (frame) {
        let operation: any = null;
        let description = '';
        let shouldSaveHistory = false;
        
        if (field === 'characterIds') {
          const oldIds = frame.characterIds || [];
          const newIds = value || [];
          if (newIds.length > oldIds.length) {
            operation = 'add_character_to_storyboard';
            description = '添加角色到分镜';
            shouldSaveHistory = true;
          } else if (newIds.length < oldIds.length) {
            operation = 'remove_character_from_storyboard';
            description = '从分镜移除角色';
            shouldSaveHistory = true;
          }
        } else if (field === 'sceneId') {
          if (value && !frame.sceneId) {
            operation = 'add_scene_to_storyboard';
            description = '添加场景到分镜';
            shouldSaveHistory = true;
          } else if (!value && frame.sceneId) {
            operation = 'remove_scene_from_storyboard';
            description = '从分镜移除场景';
            shouldSaveHistory = true;
          }
        } else if (field === 'propIds') {
          const oldIds = frame.propIds || [];
          const newIds = value || [];
          if (newIds.length > oldIds.length) {
            operation = 'add_prop_to_storyboard';
            description = '添加物品到分镜';
            shouldSaveHistory = true;
          } else if (newIds.length < oldIds.length) {
            operation = 'remove_prop_from_storyboard';
            description = '从分镜移除物品';
            shouldSaveHistory = true;
          }
        } else if (field === 'imageUrl' && value !== frame.imageUrl) {
          operation = 'apply_storyboard_image_history';
          description = '应用分镜图历史素材';
          shouldSaveHistory = true;
        } else if (field === 'videoUrl' && value !== frame.videoUrl) {
          operation = 'apply_storyboard_video_history';
          description = '应用分镜视频历史素材';
          shouldSaveHistory = true;
        } else if (field === 'highResVideoUrl' && value !== frame.highResVideoUrl) {
          operation = 'apply_storyboard_video_history';
          description = '应用分镜高清视频历史素材';
          shouldSaveHistory = true;
        }
        
        if (shouldSaveHistory && operation) {
          saveCurrentState(operation, description);
        }
      }
    }
    
    setStoryboards(prev => {
      const next = prev.map(f =>
        f.id === storyboardId ? { ...f, [field]: value } : f
      );
      storyboardsRef.current = next;
      return next;
    });
    if (!skipAutoSave) {
      triggerStoryboardAutoSave(storyboardId);
    }
  };

  /**
   * 更新分镜并立即保存到数据库
   * 与updateStoryboard不同，此方法会立即保存而不是等待防抖
   * 
   * @param storyboardId - 分镜ID
   * @param updates - 要更新的字段对象
   */
  const updateStoryboardAndSave = async (storyboardId: string, updates: Partial<StoryboardFrame>) => {
    const currentList = storyboardsRef.current;
    const newList = currentList.map(f =>
      f.id === storyboardId ? { ...f, ...updates } : f
    );

    setStoryboards(newList);
    storyboardsRef.current = newList;

    try {
      setSaving(true);
      const framesForDb = newList.map((f, idx) => ({
        ...f,
        order: idx,
        characterIds: f.characterIds.map(cid => {
          const parsed = parseInt(cid);
          return isNaN(parsed) ? 0 : parsed;
        }),
        propIds: f.propIds ? f.propIds.map(pid => {
          const parsed = parseInt(pid);
          return isNaN(parsed) ? 0 : parsed;
        }) : [],
        sceneId: f.sceneId ? parseInt(f.sceneId) : undefined
      }));

      const savedStoryboards = await projectService.saveStoryboards(projectId, framesForDb, currentEpisodeId || undefined);

      const mappedSavedStoryboards: StoryboardFrame[] = savedStoryboards.map(s => {
        const characterIds = typeof s.characterIds === 'string' ? JSON.parse(s.characterIds) : (s.characterIds || []);
        const propIds = typeof s.propIds === 'string' ? JSON.parse(s.propIds) : (s.propIds || []);

        return {
          id: s.id.toString(),
          text: s.text,
          characterIds: characterIds.map((id: number) => id.toString()),
          propIds: propIds.map((id: number) => id.toString()),
          sceneId: s.sceneId ? s.sceneId.toString() : undefined,
          duration: s.duration,
          prompt: s.prompt || '',
          videoUrl: s.videoUrl,
          highResVideoUrl: s.highResVideoUrl,
          highResStatus: s.highResStatus as any,
          status: s.status as any,
          order: s.order,
          imageUrl: s.imageUrl,
          imageStatus: s.imageStatus || 'idle',
          referenceImageUrl: s.referenceImageUrl,
          videoRefScope: s.videoRefScope
        };
      });

      setStoryboards(mappedSavedStoryboards);
      storyboardsRef.current = mappedSavedStoryboards;
    } catch (e) {
      console.error('Failed to save storyboards:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      message.error('保存分镜失败'+errorMessage);
    } finally {
      setSaving(false);
    }
  };

  /**
   * 更新分镜的媒体资源（图片、视频、高清视频）并保存
   * 专门用于更新媒体相关字段，可选择是否记录历史
   * 
   * @param storyboardId - 分镜ID
   * @param updates - 要更新的媒体字段
   * @param saveHistory - 是否保存到历史记录（默认false）
   * @param historyOperation - 历史操作类型
   * @param historyDescription - 历史操作描述
   */
  const updateStoryboardMediaAndSave = async (
    storyboardId: string,
    updates: Partial<
      Pick<
        StoryboardFrame,
        'status' | 'videoUrl' | 'highResStatus' | 'highResVideoUrl' | 'imageUrl' | 'imageStatus'
      >
    >,
    saveHistory: boolean = false,
    historyOperation?: any,
    historyDescription?: string
  ) => {
    if (saveHistory && historyOperation && historyDescription) {
      saveCurrentState(historyOperation, historyDescription);
    }
    
    const currentList = storyboardsRef.current;
    const newList = currentList.map(f => (f.id === storyboardId ? { ...f, ...updates } : f));

    setStoryboards(newList);
    storyboardsRef.current = newList;

    const numericStoryboardId = Number(storyboardId);
    if (isNaN(numericStoryboardId) || numericStoryboardId >= 1700000000000) return;

    try {
      const allowedStoryboardStatuses = ['draft', 'generating_video', 'video_generated', 'failed'] as const;
      type StoryboardMediaStatus = (typeof allowedStoryboardStatuses)[number];
      const isStoryboardMediaStatus = (value: unknown): value is StoryboardMediaStatus =>
        typeof value === 'string' && (allowedStoryboardStatuses as readonly string[]).includes(value);

      const allowedHighResStatuses = ['idle', 'generating', 'success', 'failed'] as const;
      type HighResMediaStatus = (typeof allowedHighResStatuses)[number];
      const isHighResMediaStatus = (value: unknown): value is HighResMediaStatus =>
        typeof value === 'string' && (allowedHighResStatuses as readonly string[]).includes(value);

      const allowedImageStatuses = ['idle', 'generating', 'generated', 'failed'] as const;
      type ImageStatus = (typeof allowedImageStatuses)[number];
      const isImageStatus = (value: unknown): value is ImageStatus =>
        typeof value === 'string' && (allowedImageStatuses as readonly string[]).includes(value);

      const payload: Partial<{
        status: 'draft' | 'generating_video' | 'video_generated' | 'failed';
        videoUrl: string | null;
        highResStatus: 'idle' | 'generating' | 'success' | 'failed';
        highResVideoUrl: string | null;
        imageUrl: string | null;
        imageStatus: 'idle' | 'generating' | 'generated' | 'failed';
      }> = {};

      if (isStoryboardMediaStatus(updates.status)) {
        payload.status = updates.status;
      }
      if (updates.videoUrl !== undefined) payload.videoUrl = updates.videoUrl ?? null;
      if (isHighResMediaStatus(updates.highResStatus)) {
        payload.highResStatus = updates.highResStatus;
      }
      if (updates.highResVideoUrl !== undefined) payload.highResVideoUrl = updates.highResVideoUrl ?? null;
      if (updates.imageUrl !== undefined) payload.imageUrl = updates.imageUrl ?? null;
      if (isImageStatus(updates.imageStatus)) {
        payload.imageStatus = updates.imageStatus;
      }

      const updated = await projectService.updateStoryboardMedia(projectId, numericStoryboardId, payload);
      setStoryboards(prev => {
        const next = prev.map(f => {
          if (f.id !== storyboardId) return f;
          return {
            ...f,
            status: updated.status as any,
            videoUrl: updated.videoUrl,
            highResStatus: updated.highResStatus as any,
            highResVideoUrl: updated.highResVideoUrl,
            errorMsg: updated.errorMsg,
            highResErrorMsg: updated.highResErrorMsg,
            imageUrl: updated.imageUrl,
            imageStatus: updated.imageStatus as any
          };
        });
        storyboardsRef.current = next;
        return next;
      });
    } catch (e) {
      setStoryboards(currentList);
      storyboardsRef.current = currentList;
      throw e;
    }
  };

  /**
   * 删除分镜
   * 显示确认对话框，确认后从数据库和本地状态中删除分镜，并记录到历史
   * 
   * @param storyboardId - 要删除的分镜ID
   */
  const deleteStoryboard = (storyboardId: string) => {
    Modal.confirm({
      title: '确认删除分镜？',
      content: '删除后无法恢复',
      okType: 'danger',
      okText:'确认删除',
      cancelText:'取消',
      onOk: async () => {
        saveCurrentState('delete_storyboard', '删除分镜');
        
        try {
          const numericId = Number(storyboardId);
          if (!isNaN(numericId) && numericId < 1700000000000) {
            await projectService.deleteStoryboard(projectId, numericId);
          }

          setStoryboards(prev => prev.filter(f => f.id !== storyboardId));
          message.success('分镜已删除');
        } catch (e) {
          console.error('Delete storyboard failed:', e);
          const errorMessage = e instanceof Error ? e.message : String(e);
          message.error('删除分镜失败'+errorMessage);
        }
      }
    });
  };

  /**
   * 移动分镜位置
   * 将指定索引的分镜向上或向下移动一位，并保存新的顺序
   * 
   * @param index - 分镜在列表中的索引
   * @param direction - 移动方向（'up' 或 'down'）
   */
  const moveStoryboard = async (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return;
    if (direction === 'down' && index === storyboards.length - 1) return;

    saveCurrentState('move_storyboard', '移动分镜位置');

    const newStoryboards = [...storyboards];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newStoryboards[index], newStoryboards[targetIndex]] = [newStoryboards[targetIndex], newStoryboards[index]];
    setStoryboards(newStoryboards);

    if (projectId) {
      try {
        await saveStoryboardsOnly(newStoryboards, false);
      } catch (e) {
        console.error('Failed to save storyboard order:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        message.error('保存分镜顺序失败'+errorMessage);
      }
    }
  };

  /**
   * 添加新分镜
   * 在指定位置插入一个新的空白分镜，并保存到数据库
   * 
   * @param insertIndex - 插入位置的索引
   */
  const addStoryboard = async (insertIndex: number) => {
    if (!projectId) {
      message.warning('请先保存项目');
      return;
    }

    saveCurrentState('add_storyboard', '添加分镜');

    try {
      const newFrame: StoryboardFrame = {
        id: Date.now().toString(),
        text: '',
        characterIds: [],
        propIds: [],
        duration: 15,
        prompt: '',
        status: 'draft',
        episodeId: currentEpisodeId || undefined,
        order: insertIndex
      };

      const newStoryboards = [...storyboards];
      newStoryboards.splice(insertIndex, 0, newFrame);
      setStoryboards(newStoryboards);

      const frameForDb = {
        text: newFrame.text,
        characterIds: newFrame.characterIds,
        propIds: newFrame.propIds,
        sceneId: newFrame.sceneId ? parseInt(newFrame.sceneId) : undefined,
        duration: newFrame.duration,
        prompt: newFrame.prompt,
        order: insertIndex,
        episodeId: currentEpisodeId || undefined
      };

      const saved = await projectService.saveStoryboards(projectId, [frameForDb], currentEpisodeId || undefined);
      
      if (saved && saved.length > 0) {
        const savedFrame = saved[0];
        setStoryboards(prev => prev.map(f => 
          f.id === newFrame.id ? {
            ...f,
            id: savedFrame.id.toString(),
            episodeId: savedFrame.episodeId
          } : f
        ));
        message.success('已添加新分镜');
      }
    } catch (e) {
      console.error('Failed to add storyboard:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      message.error('添加分镜失败'+errorMessage);
      setStoryboards(storyboards);
    }
  };

  /**
   * 推理分镜提示词
   * 使用AI根据分镜文案生成视频生成提示词
   * 
   * @param frameId - 分镜ID
   * @param silent - 是否静默模式（不显示提示消息）
   */
  const inferStoryboardPrompt = async (frameId: string, silent = false) => {
    const frame = storyboards.find(f => f.id === frameId);
    if (!frame) return;

    updateStoryboard(frameId, 'status', 'generating_prompt');

    try {
      const result = await aiService.inferStoryboardPrompt({
        scriptContent: frame.text,
      });

      if (result) {
        const promptText = result;

        const updatedFrame = { ...frame, prompt: promptText, status: 'draft' as const };

        updateStoryboard(frameId, 'prompt', promptText);
        updateStoryboard(frameId, 'status', 'draft');

        if (!silent) message.success('提示词推理完成');

        if (projectId) {
          try {
            const frameForDb = {
              ...updatedFrame,
              characterIds: updatedFrame.characterIds.map(cid => parseInt(cid)),
              propIds: updatedFrame.propIds ? updatedFrame.propIds.map(pid => parseInt(pid)) : [],
              sceneId: updatedFrame.sceneId ? parseInt(updatedFrame.sceneId) : undefined
            };

            const saved = await projectService.saveStoryboards(projectId, [frameForDb], currentEpisodeId || undefined);
            if (saved && saved.length > 0) {
              const savedFrame = saved[0];
              if (savedFrame.id.toString() !== frameId) {
                setStoryboards(prev => prev.map(f =>
                  f.id === frameId ? { ...f, id: savedFrame.id.toString() } : f
                ));
              }
            }
          } catch (e) {
            console.error('Failed to save storyboard:', e);
          }
        }
      } else {
        throw new Error('No prompt returned');
      }

    } catch (error: any) {
      window.console.error(`Failed to infer prompt for frame ${frameId}:`, error);
      if (!silent) message.error('提示词推理失败');
      updateStoryboard(frameId, 'status', 'draft');
    }
  };

  /**
   * 生成分镜图片
   * 提交分镜图片生成任务到后台，使用AI根据提示词生成图片
   * 
   * @param frameId - 分镜ID
   * @param _data - 生成参数（提示词、比例、数量）
   * @param silent - 是否静默模式（不显示提示消息）
   * @param model - 可选的AI模型配置
   */
  const generateStoryboardImage = async (frameId: string, _data: { prompt?: string, ratio: string, count: number }, silent?: boolean, model?: { model: string; provider: string }) => {
    const frame = storyboards.find(f => f.id === frameId);
    if (!frame) return;

    if (!projectId || isNaN(Number(frameId)) || Number(frameId) > 1700000000000) {
      if (!silent) {
        message.warning('请先保存项目并确保分镜已保存');
      }
      return;
    }

    updateStoryboard(frameId, 'imageStatus', 'generating', true);

    try {
      await projectService.generateStoryboardImage(projectId, Number(frameId), model);
      refreshStats();
      if (!silent) {
        message.success('分镜生图任务已提交');
      }
    } catch (e) {
      window.console.error('Failed to create storyboard image task:', e);
      if (!silent) {
          const errorMessage = e instanceof Error ? e.message : String(e);
          if (!silent) message.error('任务提交失败：'+errorMessage);
      }
      updateStoryboard(frameId, 'imageStatus', 'failed', true);
    }
  };

  /**
   * 生成分镜视频
   * 自动生成参考图（如果没有），然后提交视频生成任务到后台
   * 
   * @param storyboardId - 分镜ID
   * @param model - 可选的AI模型配置
   */
  const generateStoryboardVideo = async (storyboardId: string, model?: { model: string; provider: string }) => {
    const frame = storyboards.find(f => f.id === storyboardId);
    if (!frame) return;

    let referenceImageUrl = frame.referenceImageUrl;

    if (!referenceImageUrl) {
      try {
        message.loading('正在生成分镜参考图...');
        const url = await prepareAndGenerateReferenceImage(
          frame,
          characters,
          scenes,
          props,
          projectData.aspectRatio || '16:9'
        );

        if (url) {
          message.loading('正在上传参考图...');
          referenceImageUrl = url;
          updateStoryboard(storyboardId, 'referenceImageUrl', referenceImageUrl);
        } else {
          console.warn('No items found for reference image generation, skipping...');
        }
      } catch (error) {
        console.error('Failed to prepare reference image:', error);
        message.error('生成/上传参考图失败: ' + (error instanceof Error ? error.message : String(error)));
        return;
      }
    }

    updateStoryboard(storyboardId, 'status', 'generating_video', true);

    if (projectId && !isNaN(Number(storyboardId)) && Number(storyboardId) < 1700000000000) {
      try {
        await projectService.generateStoryboardVideo(projectId, Number(storyboardId), model);
        refreshStats();
        message.success('任务已提交，后台生成中...');
      } catch (e) {
        console.error('Failed to create task record:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
         message.error(errorMessage);
        updateStoryboard(storyboardId, 'status', 'draft', true);
      }
    } else {
      message.warning('请先保存项目并确保分镜已保存');
      updateStoryboard(storyboardId, 'status', 'draft', true);
    }
  };

  /**
   * 生成高清视频
   * 基于已有的普通视频，提交高清化任务到后台
   * 
   * @param storyboardId - 分镜ID
   */
  const generateHighResVideo = async (storyboardId: string) => {
    const frame = storyboards.find(f => f.id === storyboardId);
    if (!frame) return;

    if (!frame.videoUrl) {
      message.warning('请先生成普通视频');
      return;
    }

    updateStoryboard(storyboardId, 'highResStatus', 'generating', true);

    if (projectId && !isNaN(Number(storyboardId)) && Number(storyboardId) < 1700000000000) {
      try {
        await projectService.generateStoryboardHighResVideo(projectId, Number(storyboardId));
        refreshStats();
        message.success('高清任务已提交，后台生成中...');
      } catch (e) {
        console.error('Failed to create HD task record:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
         message.error(errorMessage);
        updateStoryboard(storyboardId, 'highResStatus', 'failed', true);
      }
    } else {
      message.warning('请先保存项目并确保分镜已保存');
      updateStoryboard(storyboardId, 'highResStatus', 'idle', true);
    }
  };

  /**
   * 批量生成高清视频
   * 对指定的分镜（或所有符合条件的分镜）批量提交高清化任务
   * 
   * @param ids - 可选的分镜ID列表，如果不提供则处理所有符合条件的分镜
   */
  const batchGenerateHighResVideos = (ids?: string[]) => {
    let targetIds: string[] = [];

    if (ids && ids.length > 0) {
      targetIds = storyboards.filter(f =>
        ids.includes(f.id) &&
        f.videoUrl &&
        (f.highResStatus === 'idle' || f.highResStatus === 'failed' || !f.highResStatus)
      ).map(f => f.id);
    } else {
      targetIds = storyboards.filter(f =>
        f.videoUrl &&
        (f.highResStatus === 'idle' || f.highResStatus === 'failed' || !f.highResStatus)
      ).map(f => f.id);
    }

    if (targetIds.length === 0) {
      if (ids && ids.length > 0) {
        message.info('选中的分镜没有可高清化的视频');
      } else {
        message.info('没有需要高清化的分镜');
      }
      return;
    }

    targetIds.forEach(id => generateHighResVideo(id));
    message.loading(`正在批量提交 ${targetIds.length} 个高清任务...`);
  };

  return {
    saving,
    textEditHistoryTimerRef,
    textEditBeforeStateRef,
    saveStoryboardsOnly,
    updateStoryboard,
    updateStoryboardAndSave,
    updateStoryboardMediaAndSave,
    deleteStoryboard,
    moveStoryboard,
    addStoryboard,
    inferStoryboardPrompt,
    generateStoryboardImage,
    generateStoryboardVideo,
    generateHighResVideo,
    batchGenerateHighResVideos
  };
};
