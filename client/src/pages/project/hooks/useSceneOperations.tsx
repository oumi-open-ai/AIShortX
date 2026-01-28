import { useState, useRef } from 'react';
import { message, Modal } from 'antd';
import { projectService } from '../../../services/projectService';
import { useTaskStore } from '../../../store/taskStore';
import type { Scene } from '../../../types/workflow';

/**
 * 场景操作 Hook
 * 
 * 提供场景相关的所有操作功能：
 * - 场景的增删改查
 * - 场景图片生成
 * - 自动保存
 * 
 * @param projectId - 项目ID
 * @param currentEpisodeId - 当前分集ID
 * @param scenes - 场景列表
 * @param setScenes - 设置场景列表的函数
 * @param scenesRef - 场景列表的引用
 * @param saveCurrentState - 保存当前状态到历史记录的函数
 */
export const useSceneOperations = (
  projectId: number,
  currentEpisodeId: number | null,
  scenes: Scene[],
  setScenes: React.Dispatch<React.SetStateAction<Scene[]>>,
  scenesRef: React.MutableRefObject<Scene[]>,
  saveCurrentState: (operation: any, description: string) => void
) => {
  const { refreshStats } = useTaskStore();
  const [saving, setSaving] = useState(false);
  const sceneSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 添加新场景
   * 立即在本地创建场景，然后在后台异步保存到数据库
   * 
   * @returns 新创建的场景对象
   */
  const addScene = async () => {
    const newScene: Scene = {
      id: Date.now().toString(),
      episodeId: currentEpisodeId || undefined,
      name: '新场景',
      description: '',
      status: 'saving' as any
    };

    setScenes([...scenes, newScene]);

    (async () => {
      try {
        if (projectId) {
          const savedScenes = await projectService.upsertScenes(Number(projectId), [newScene], currentEpisodeId || undefined);
          if (savedScenes && savedScenes.length > 0) {
            const savedScene = savedScenes[0];
            const realId = savedScene.id.toString();
            const tempId = newScene.id;
            setScenes(prev => prev.map(s => s.id === tempId ? {
              ...s,
              ...savedScene,
              id: realId,
              status: 'idle'
            } : s));
            
            window.dispatchEvent(new CustomEvent('scene-id-updated', { 
              detail: { oldId: tempId, newId: realId } 
            }));
          }
        }
      } catch (error) {
        console.error('Failed to create scene:', error);
        if ((error as any).response) {
          console.error('Error response:', (error as any).response.data);
        }
        message.error('创建场景失败，请检查网络或重试');
        setScenes(prev => prev.map(s => 
          s.id === newScene.id ? { ...s, status: 'idle' } : s
        ));
      }
    })();
    
    return newScene;
  };

  /**
   * 保存场景到数据库
   * 
   * @param scene - 要保存的场景对象
   */
  const saveScene = async (scene: Scene) => {
    if (!projectId) return;
    try {
      await projectService.upsertScenes(projectId, [scene], currentEpisodeId || undefined);
    } catch (e) {
      console.error('Failed to save scene:', e);
      message.error('保存场景失败');
    }
  };

  /**
   * 触发场景自动保存
   * 使用防抖机制，1秒后自动保存场景信息
   * 
   * @param sceneId - 场景ID
   */
  const triggerSceneAutoSave = (sceneId: string) => {
    if (!projectId || projectId === 'new' as any) return;

    if (sceneSaveTimerRef.current) {
      clearTimeout(sceneSaveTimerRef.current);
    }

    sceneSaveTimerRef.current = setTimeout(async () => {
      const isTempId = !isNaN(Number(sceneId)) && Number(sceneId) > 1700000000000;
      if (isTempId) return;

      const scene = scenesRef.current.find(s => s.id === sceneId);

      if (scene) {
        try {
          setSaving(true);
          await projectService.upsertScenes(projectId, [scene], currentEpisodeId || undefined);
        } catch (error) {
          console.error('Auto-save scene failed:', error);
        } finally {
          setSaving(false);
        }
      }
    }, 1000);
  };

  /**
   * 更新场景字段
   * 
   * @param id - 场景ID
   * @param field - 要更新的字段名
   * @param value - 新值
   * @param skipHistory - 是否跳过历史记录
   */
  const updateScene = (id: string, field: keyof Scene, value: any, skipHistory: boolean = false) => {
    if (!skipHistory) {
      const scene = scenesRef.current.find(s => s.id === id);
      if (scene && field === 'imageUrl' && value !== scene.imageUrl) {
        saveCurrentState('apply_scene_history', '应用场景历史素材');
      }
    }
    
    setScenes(prev => {
      const next = prev.map(s => s.id === id ? { ...s, [field]: value } : s);
      return next;
    });
    triggerSceneAutoSave(id);
  };

  /**
   * 删除场景
   * 显示确认对话框，确认后删除场景
   * 
   * @param sceneId - 场景ID
   */
  const deleteScene = (sceneId: string) => {
    Modal.confirm({
      title: '确认删除场景？',
      content: '删除后无法恢复',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const numericId = Number(sceneId);
          if (!isNaN(numericId) && numericId < 1700000000000) {
            await projectService.deleteScene(projectId, numericId);
          }
          setScenes(prev => prev.filter(s => s.id !== sceneId));
          message.success('场景已删除');
        } catch (error) {
          console.error('Delete scene failed:', error);
          message.error('删除场景失败');
        }
      }
    });
  };

  /**
   * 生成场景图片
   * 
   * @param sceneId - 场景ID
   * @param model - 可选的模型配置
   * @param silent - 是否静默模式（不显示提示）
   * @param skipStateUpdate - 是否跳过状态更新
   */
  const generateSceneImage = async (sceneId: string, model?: { model: string; provider: string }, silent: boolean = false, skipStateUpdate: boolean = false) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;

    const isTempId = !isNaN(Number(sceneId)) && Number(sceneId) > 1700000000000;
    
    if (!projectId) {
      if (!silent) message.warning('请先保存项目');
      return;
    }

    if (isTempId || (scene.status as any) === 'saving') {
      if (!silent) message.warning('场景正在保存中，请稍后再试');
      return;
    }

    if (!scene.imageUrl) {
      if (!silent) message.loading({ content: '正在保存场景信息...', key: 'save-scene', duration: 0 });
      try {
        await projectService.upsertScenes(projectId, [scene]);
        if (!silent) message.success({ content: '场景信息已保存', key: 'save-scene' });
      } catch (error) {
        console.error('Failed to save scene info:', error);
        if (!silent) message.error({ content: '保存场景信息失败', key: 'save-scene' });
        return;
      }
    }

    if (!skipStateUpdate) {
      setScenes(prev => prev.map(s =>
        s.id === sceneId ? { ...s, status: 'generating' } : s
      ));
    }

    try {
      await projectService.generateSceneImage(projectId, Number(sceneId), model);
      refreshStats();
      if (!silent) message.success('场景图生成任务已提交');
    } catch (e) {
      console.error('Failed to create scene image task:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!silent)message.error('任务提交失败：'+errorMessage);
      updateScene(sceneId, 'status', 'failed');
    }
  };

  return {
    saving,
    addScene,
    updateScene,
    saveScene,
    deleteScene,
    generateSceneImage
  };
};
