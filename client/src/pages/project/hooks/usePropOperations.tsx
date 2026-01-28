import { useState, useRef } from 'react';
import { message, Modal } from 'antd';
import { projectService } from '../../../services/projectService';
import { useTaskStore } from '../../../store/taskStore';
import type { Prop } from '../../../types/workflow';

/**
 * 物品操作 Hook
 * 
 * 提供物品相关的所有操作功能：
 * - 物品的增删改查
 * - 物品图片生成
 * - 自动保存
 * 
 * @param projectId - 项目ID
 * @param currentEpisodeId - 当前分集ID
 * @param props - 物品列表
 * @param setProps - 设置物品列表的函数
 * @param propsRef - 物品列表的引用
 * @param saveCurrentState - 保存当前状态到历史记录的函数
 */
export const usePropOperations = (
  projectId: number,
  currentEpisodeId: number | null,
  props: Prop[],
  setProps: React.Dispatch<React.SetStateAction<Prop[]>>,
  propsRef: React.MutableRefObject<Prop[]>,
  saveCurrentState: (operation: any, description: string) => void
) => {
  const { refreshStats } = useTaskStore();
  const [saving, setSaving] = useState(false);
  const propSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * 添加新物品
   * 立即在本地创建物品，然后在后台异步保存到数据库
   * 
   * @returns 新创建的物品对象
   */
  const addProp = async () => {
    const newProp: Prop = {
      id: Date.now().toString(),
      episodeId: currentEpisodeId || undefined,
      name: '新物品',
      description: '',
      status: 'saving' as any
    };

    setProps([...props, newProp]);

    (async () => {
      try {
        if (projectId) {
          const savedProps = await projectService.upsertProps(Number(projectId), [newProp], currentEpisodeId || undefined);
          if (savedProps && savedProps.length > 0) {
            const savedProp = savedProps[0];
            const realId = savedProp.id.toString();
            const tempId = newProp.id;
            setProps(prev => prev.map(p => p.id === tempId ? {
              ...p,
              ...savedProp,
              id: realId,
              status: 'idle'
            } : p));
            
            window.dispatchEvent(new CustomEvent('prop-id-updated', { 
              detail: { oldId: tempId, newId: realId } 
            }));
          }
        }
      } catch (error) {
        console.error('Failed to create prop:', error);
        if ((error as any).response) {
          console.error('Error response:', (error as any).response.data);
        }
        message.error('创建物品失败，请检查网络或重试');
        setProps(prev => prev.map(p => 
          p.id === newProp.id ? { ...p, status: 'idle' } : p
        ));
      }
    })();
    
    return newProp;
  };

  /**
   * 保存物品信息到数据库
   * 
   * @param prop - 要保存的物品对象
   */
  const saveProp = async (prop: Prop) => {
    if (!projectId) return;
    try {
      await projectService.upsertProps(projectId, [prop], currentEpisodeId || undefined);
    } catch (e) {
      console.error('Failed to save prop:', e);
      message.error('保存物品失败');
    }
  };

  /**
   * 触发物品自动保存
   * 使用防抖机制，在用户停止编辑1秒后自动保存到数据库
   * 
   * @param propId - 物品ID
   */
  const triggerPropAutoSave = (propId: string) => {
    if (propSaveTimerRef.current) {
      clearTimeout(propSaveTimerRef.current);
    }

    propSaveTimerRef.current = setTimeout(async () => {
      const isTempId = !isNaN(Number(propId)) && Number(propId) > 1700000000000;
      if (isTempId) return;

      const prop = propsRef.current.find(p => p.id === propId);

      if (prop) {
        try {
          setSaving(true);
          await projectService.upsertProps(projectId, [prop], currentEpisodeId || undefined);
        } catch (error) {
          console.error('Auto-save prop failed:', error);
        } finally {
          setSaving(false);
        }
      }
    }, 1000);
  };

  /**
   * 更新物品的某个字段
   * 更新后会触发自动保存，如果是图片URL变更会记录到历史
   * 
   * @param id - 物品ID
   * @param field - 要更新的字段名
   * @param value - 新的字段值
   * @param skipHistory - 是否跳过历史记录（默认false）
   */
  const updateProp = (id: string, field: keyof Prop, value: any, skipHistory: boolean = false) => {
    if (!skipHistory) {
      const prop = propsRef.current.find(p => p.id === id);
      if (prop && field === 'imageUrl' && value !== prop.imageUrl) {
        saveCurrentState('apply_prop_history', '应用物品历史素材');
      }
    }
    
    setProps(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    triggerPropAutoSave(id);
  };

  /**
   * 删除物品
   * 显示确认对话框，确认后从数据库和本地状态中删除物品
   * 
   * @param propId - 要删除的物品ID
   */
  const deleteProp = (propId: string) => {
    Modal.confirm({
      title: '确认删除物品？',
      content: '删除后无法恢复',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          const numericId = Number(propId);
          if (!isNaN(numericId) && numericId < 1700000000000) {
            await projectService.deleteProp(projectId, numericId);
          }
          setProps(prev => prev.filter(p => p.id !== propId));
          message.success('物品已删除');
        } catch (error) {
          console.error('Delete prop failed:', error);
          message.error('删除物品失败');
        }
      }
    });
  };

  /**
   * 生成物品图片
   * 提交物品图片生成任务到后台，使用AI根据物品描述生成图片
   * 
   * @param propId - 物品ID
   * @param model - 可选的AI模型配置
   * @param silent - 是否静默模式（不显示提示消息）
   * @param skipStateUpdate - 是否跳过状态更新
   */
  const generatePropImage = async (propId: string, model?: { model: string; provider: string }, silent: boolean = false, skipStateUpdate: boolean = false) => {
    const prop = props.find(p => p.id === propId);
    if (!prop) return;

    const isTempId = !isNaN(Number(propId)) && Number(propId) > 1700000000000;
    
    if (!projectId) {
      if (!silent) message.warning('请先保存项目');
      return;
    }

    if (isTempId || (prop.status as any) === 'saving') {
      if (!silent) message.warning('物品正在保存中，请稍后再试');
      return;
    }

    if (!prop.imageUrl) {
      if (!silent) message.loading({ content: '正在保存物品信息...', key: 'save-prop', duration: 0 });
      try {
        await projectService.upsertProps(projectId, [prop]);
        if (!silent) message.success({ content: '物品信息已保存', key: 'save-prop' });
      } catch (error) {
        console.error('Failed to save prop info:', error);
        if (!silent) message.error({ content: '保存物品信息失败', key: 'save-prop' });
        return;
      }
    }

    if (!skipStateUpdate) {
      setProps(prev => prev.map(p =>
        p.id === propId ? { ...p, status: 'generating' } : p
      ));
    }

    try {
      await projectService.generatePropImage(projectId, Number(propId), model);
      refreshStats();
      if (!silent) message.success('物品图生成任务已提交');
    } catch (e) {
      console.error('Failed to create prop image task:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!silent)message.error('任务提交失败：'+errorMessage);
      updateProp(propId, 'status', 'failed');
    }
  };

  return {
    saving,
    addProp,
    updateProp,
    saveProp,
    deleteProp,
    generatePropImage
  };
};
