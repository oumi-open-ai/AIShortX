import { useState, useRef } from 'react';
import { message, Modal } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { projectService } from '../../../services/projectService';
import { characterService } from '../../../services/characterService';
import { useTaskStore } from '../../../store/taskStore';
import type { Character } from '../../../types/workflow';
import type { UserCharacter } from '../../../types';

/**
 * 角色操作 Hook
 * 
 * 提供角色相关的所有操作功能：
 * - 角色的增删改查
 * - 角色图片/视频生成
 * - 角色库匹配与管理
 * - 批量操作
 * 
 * @param projectId - 项目ID
 * @param currentEpisodeId - 当前分集ID
 * @param characters - 角色列表
 * @param setCharacters - 设置角色列表的函数
 * @param charactersRef - 角色列表的引用
 * @param saveCurrentState - 保存当前状态到历史记录的函数
 */
export const useCharacterOperations = (
  projectId: number,
  currentEpisodeId: number | null,
  characters: Character[],
  setCharacters: React.Dispatch<React.SetStateAction<Character[]>>,
  charactersRef: React.MutableRefObject<Character[]>,
  saveCurrentState: (operation: any, description: string) => void
) => {
  const { refreshStats } = useTaskStore();
  const [saving, setSaving] = useState(false);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 角色库相关状态
  const [libraryModalOpen, setLibraryModalOpen] = useState(false);
  const [currentMatchingId, setCurrentMatchingId] = useState<string | null>(null);
  const [libraryCharacters, setLibraryCharacters] = useState<UserCharacter[]>([]);

  /**
   * 加载角色库列表
   */
  const loadLibraryCharacters = async () => {
    try {
      const chars = await characterService.getLibraryCharacters();
      setLibraryCharacters(chars.list);
    } catch (error) {
      console.error('Failed to load library characters:', error);
      message.error('加载角色库失败');
    }
  };

  /**
   * 添加新角色
   * 立即在本地创建角色，然后在后台异步保存到数据库
   * 
   * @returns 新创建的角色对象
   */
  const addCharacter = async () => {
    const newChar: Character = {
      id: Date.now().toString(),
      episodeId: currentEpisodeId || undefined,
      name: '新角色',
      description: '',
      videoStatus: 'draft',
      createStatus: 'idle',
      source: 'ai',
      imageStatus: 'saving' as any
    };
    
    setCharacters([...characters, newChar]);
    
    (async () => {
      try {
        if (projectId) {
          const savedChars = await projectService.saveCharacters(projectId, [...characters, newChar], currentEpisodeId || undefined);
          const savedChar = savedChars.find(c => c.name === newChar.name && !characters.find(existing => existing.id === c.id?.toString()));
          
          if (savedChar && savedChar.id) {
            const realId = savedChar.id.toString();
            const tempId = newChar.id;
            setCharacters(prev => prev.map(c => 
              c.id === tempId ? { ...c, id: realId, episodeId: savedChar.episodeId, imageStatus: 'draft' } : c
            ));
            
            window.dispatchEvent(new CustomEvent('character-id-updated', { 
              detail: { oldId: tempId, newId: realId } 
            }));
          }
        }
      } catch (error) {
        console.error('Failed to save new character:', error);
        message.error('创建角色失败');
        setCharacters(prev => prev.map(c => 
          c.id === newChar.id ? { ...c, imageStatus: 'draft' } : c
        ));
      }
    })();
    
    return newChar;
  };

  /**
   * 删除角色
   * 显示确认对话框，确认后删除角色
   * 
   * @param charId - 角色ID
   */
  const deleteCharacter = (charId: string) => {
    Modal.confirm({
      title: '确认删除角色？',
      icon: <ExclamationCircleOutlined />,
      content: '删除后将无法恢复该角色信息',
      okText: '确认删除',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          if (!isNaN(Number(charId)) && Number(charId) < 1700000000000) {
            await projectService.deleteCharacter(projectId, Number(charId));
          }
          setCharacters(prev => prev.filter(c => c.id !== charId));
          message.success('角色已删除');
        } catch (error) {
          console.error('Delete character failed:', error);
          message.error('删除失败');
        }
      },
    });
  };

  /**
   * 触发角色自动保存
   * 使用防抖机制，1秒后自动保存角色信息
   * 
   * @param charId - 角色ID
   */
  const triggerAutoSave = (charId: string) => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = setTimeout(async () => {
      const isTempId = !isNaN(Number(charId)) && Number(charId) > 1700000000000;
      if (isTempId) return;

      const charToSave = charactersRef.current.find(c => c.id === charId);

      if (charToSave) {
        try {
          setSaving(true);
          await projectService.updateCharacter(projectId, parseInt(charId), {
            name: charToSave.name,
            description: charToSave.description,
            voice: charToSave.voice,
            source: charToSave.source,
            imageUrl: charToSave.imageUrl,
            imageStatus: charToSave.imageStatus,
            videoUrl: charToSave.videoUrl,
            videoStatus: charToSave.videoStatus
          });
        } catch (error) {
          console.error('Auto-save failed:', error);
        } finally {
          setSaving(false);
        }
      }
    }, 1000);
  };

  /**
   * 更新角色字段
   * 
   * @param charId - 角色ID
   * @param field - 要更新的字段名
   * @param value - 新值
   * @param skipAutoSave - 是否跳过自动保存
   * @param skipHistory - 是否跳过历史记录
   */
  const updateCharacter = (charId: string, field: keyof Character, value: any, skipAutoSave: boolean = false, skipHistory: boolean = false) => {
    if (!skipHistory) {
      const char = charactersRef.current.find(c => c.id === charId);
      if (char && field === 'imageUrl' && value !== char.imageUrl) {
        saveCurrentState('apply_character_history', '应用角色历史素材');
      }
    }
    
    setCharacters(prev => {
      const next = prev.map(c =>
        c.id === charId ? { ...c, [field]: value } : c
      );
      charactersRef.current = next;
      return next;
    });
    if (!skipAutoSave) {
      triggerAutoSave(charId);
    }
  };

  const updateCharacterAndSave = async (charId: string, updates: Partial<Character>) => {
    const currentList = charactersRef.current;
    const newList = currentList.map(c =>
      c.id === charId ? { ...c, ...updates } : c
    );

    setCharacters(newList);
    charactersRef.current = newList;

    try {
      setSaving(true);

      const savedChars = await projectService.saveCharacters(projectId, newList);

      const mappedSaved: Character[] = savedChars.map(c => ({
        id: c.id!.toString(),
        name: c.name,
        description: c.description,
        imageUrl: c.imageUrl,
        imageStatus: c.imageStatus || 'draft',
        videoUrl: c.videoUrl,
        videoStatus: c.videoStatus || 'draft',
        createStatus: c.createStatus || 'idle',
        error: c.error,
        characterId: c.externalId,
        libraryId: c.libraryId ? c.libraryId.toString() : undefined,
        source: c.source as any,
        voice: c.voice
      }));

      setCharacters(mappedSaved);
      charactersRef.current = mappedSaved;
    } catch (error) {
      console.error('Failed to save characters:', error);
      message.error('保存角色失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 生成角色图片
   * 
   * @param charId - 角色ID
   * @param model - 可选的模型配置
   * @param silent - 是否静默模式（不显示提示）
   * @param skipStateUpdate - 是否跳过状态更新
   */
  const generateCharacterImage = async (charId: string, model?: { model: string; provider: string }, silent: boolean = false, skipStateUpdate: boolean = false) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    const isTempId = !isNaN(Number(charId)) && Number(charId) > 1700000000000;
    
    if (!projectId) {
      if (!silent) message.warning('请先保存项目');
      return;
    }

    if (isTempId || (char.imageStatus as any) === 'saving') {
      if (!silent) message.warning('角色正在保存中，请稍后再试');
      return;
    }

    if (!char.imageUrl) {
      if (!silent) message.loading({ content: '正在保存角色信息...', key: 'save-char', duration: 0 });
      try {
        await projectService.updateCharacter(projectId, Number(charId), {
          name: char.name,
          description: char.description,
          voice: char.voice,
          source: char.source,
          imageUrl: char.imageUrl,
          imageStatus: char.imageStatus,
          videoUrl: char.videoUrl,
          videoStatus: char.videoStatus
        });
        if (!silent) message.success({ content: '角色信息已保存', key: 'save-char' });
      } catch (error) {
        console.error('Failed to save character info:', error);
        if (!silent) message.error({ content: '保存角色信息失败', key: 'save-char' });
        return;
      }
    }

    if (!skipStateUpdate) {
      setCharacters(prev => prev.map(c =>
        c.id === charId ? { ...c, imageStatus: 'generating', error: undefined } : c
      ));
    }

    try {
      await projectService.generateCharacterImage(projectId, Number(charId), model);
      refreshStats();
      if (!silent) message.success('角色图生成任务已提交');
    } catch (e) {
      console.error('Failed to create image task:', e);
      const errorMessage = e instanceof Error ? e.message : String(e);
      if (!silent)message.error('任务提交失败'+errorMessage);
      updateCharacter(charId, 'imageStatus', 'failed');
    }
  };

  /**
   * 生成角色视频
   * 
   * @param charId - 角色ID
   */
  const generateCharacterVideo = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;
 
    setCharacters(prev => prev.map(c => {
      if (c.id === charId) {
        return {
          ...c,
          videoStatus: 'generating',
          error: undefined,
          videoUrl: undefined,
          createStatus: 'idle',
          characterId: c.createStatus === 'created' ? undefined : c.characterId
        };
      }
      return c;
    }));

    if (projectId && !isNaN(Number(charId)) && Number(charId) < 1700000000000) {
      try {
        await projectService.generateCharacterVideo(projectId, Number(charId));
        refreshStats();
        message.success('任务已提交，后台生成中...');
      } catch (e) {
        console.error('Failed to create task record:', e);
        const errorMessage = e instanceof Error ? e.message : String(e);
        message.error('任务提交失败'+errorMessage);
        updateCharacter(charId, 'videoStatus', 'draft');
      }
    } else {
      message.warning('请先保存项目并确保角色已保存');
      updateCharacter(charId, 'videoStatus', 'draft');
    }
  };

  /**
   * 创建角色（入库到 Sora）
   * 将角色视频/图片上传到 Sora 平台，创建数字人
   * 
   * @param charId - 角色ID
   */
  const createCharacter = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    if (!char.videoUrl && !char.imageUrl) {
      message.error('角色缺少视频或图片URL，无法创建');
      return;
    }

    const dbCharId = parseInt(charId);
    if (!projectId || isNaN(dbCharId) || dbCharId > 1700000000000) {
      message.error('请先保存项目并确保角色已同步');
      return;
    }

    updateCharacter(charId, 'createStatus', 'creating', true);

    try {
      const result = await projectService.createSoraCharacter(projectId, dbCharId, '1,4');

      setCharacters(prev => prev.map(c => {
        if (c.id === charId) {
          return {
            ...c,
            createStatus: 'created',
            characterId: result.externalId || undefined
          };
        }
        return c;
      }));

      message.success('角色创建成功，已入库');
    } catch (error: any) {
      console.error('Create character failed:', error);
      message.error('创建失败: ' + (error.message || '未知错误'));
      updateCharacter(charId, 'createStatus', 'failed');
    }
  };

  /**
   * 保存角色到角色库
   * 将已创建的角色保存到用户的角色库中，方便复用
   * 
   * @param charId - 角色ID
   */
  const saveToLibrary = async (charId: string) => {
    const char = characters.find(c => c.id === charId);
    if (!char) return;

    if (char.source === 'library') {
      message.warning('该角色已在角色库中');
      return;
    }

    if (char.createStatus !== 'created') {
      message.warning('角色未创建成功，无法保存到角色库');
      return;
    }

    try {
      if (char.characterId) {
        const { list } = await characterService.getLibraryCharacters(1, 1000);
        const exists = list.some(c => c.externalId === char.characterId);
        if (exists) {
          message.warning('该角色已存在于角色库中（Sora ID重复）');
          return;
        }
      }

      await characterService.createLibraryCharacter({
        name: char.name,
        description: char.description,
        avatar: char.imageUrl,
        video: char.videoUrl,
        externalId: char.characterId,
        source: 'ai'
      });
      message.success('角色已保存到角色库');
    } catch (error) {
      console.error('Failed to save to library:', error);
      message.error('保存到角色库失败');
    }
  };

  /**
   * 打开角色库匹配弹窗
   * 
   * @param charId - 要匹配的角色ID
   */
  const openLibraryModal = (charId: string) => {
    setCurrentMatchingId(charId);
    setLibraryModalOpen(true);
  };

  /**
   * 匹配角色库角色
   * 将项目中的角色与角色库中的角色关联，使用角色库的图片和视频
   * 
   * @param libChar - 角色库中的角色
   */
  const handleMatchLibrary = async (libChar: UserCharacter) => {
    if (!currentMatchingId) return;

    let updatedChar: Character | undefined;

    setCharacters(prev => prev.map(c => {
      if (c.id === currentMatchingId) {
        const originalData = c.originalData || {
          name: c.name,
          description: c.description,
          imageUrl: c.imageUrl,
          videoUrl: c.videoUrl,
          videoStatus: c.videoStatus,
          createStatus: c.createStatus,
          voice: c.voice
        };

        updatedChar = {
          ...c,
          originalData,
          name: c.name,
          libraryName: libChar.name,
          description: libChar.description,
          imageUrl: libChar.avatar,
          videoUrl: libChar.video,
          videoStatus: libChar.video ? 'generated' : 'draft',
          createStatus: libChar.externalId ? 'created' : 'idle',
          characterId: libChar.externalId,
          libraryId: libChar.id?.toString(),
          source: 'library'
        };
        return updatedChar;
      }
      return c;
    }));

    setLibraryModalOpen(false);
    setCurrentMatchingId(null);

    if (updatedChar) {
      try {
        const charId = parseInt(updatedChar.id);

        if (!isNaN(charId) && charId < 1700000000000) {
          await projectService.updateCharacter(projectId, charId, {
            description: updatedChar.description,
            imageUrl: updatedChar.imageUrl,
            videoUrl: updatedChar.videoUrl || '',
            videoStatus: updatedChar.videoStatus,
            createStatus: updatedChar.createStatus,
            externalId: updatedChar.characterId || '',
            libraryId: updatedChar.libraryId ? parseInt(updatedChar.libraryId) : undefined,
            source: 'library',
            originalData: updatedChar.originalData
          });
        } else {
          const charToSave = {
            ...updatedChar,
            libraryId: updatedChar.libraryId ? parseInt(updatedChar.libraryId) : undefined
          };
          const saved = await projectService.saveCharacters(projectId, [charToSave]);
          if (saved && saved.length > 0) {
            const savedId = saved[0].id!.toString();
            setCharacters(prev => prev.map(c => c.id === updatedChar!.id ? { ...c, id: savedId } : c));
          }
        }
      } catch (e) {
        console.error('Failed to save match:', e);
        message.warning('保存匹配信息失败，刷新后可能会丢失');
      }
    }

    message.success(`已匹配角色库角色：${libChar.name}`);
  };

  /**
   * 取消角色库匹配
   * 恢复角色的原始状态，取消与角色库的关联
   * 
   * @param charId - 角色ID
   */
  const cancelMatchLibrary = async (charId: string) => {
    let updatedChar: Character | undefined;

    setCharacters(prev => prev.map(c => {
      if (c.id === charId) {
        if (c.originalData) {
          const { originalData, ...rest } = c;
          updatedChar = {
            ...rest,
            name: originalData.name,
            libraryName: undefined,
            description: originalData.description,
            imageUrl: originalData.imageUrl,
            videoUrl: originalData.videoUrl,
            videoStatus: originalData.videoStatus || 'draft',
            createStatus: originalData.createStatus || 'idle',
            voice: originalData.voice,
            source: 'ai',
            characterId: undefined,
            libraryId: undefined,
            originalData: undefined
          };
          return updatedChar;
        }

        updatedChar = {
          ...c,
          videoStatus: 'draft',
          createStatus: 'idle',
          source: 'ai',
          characterId: undefined,
          videoUrl: undefined,
          libraryId: undefined,
          libraryName: undefined
        };
        return updatedChar;
      }
      return c;
    }));

    if (updatedChar) {
      try {
        const cId = parseInt(charId);

        if (!isNaN(cId) && cId < 1700000000000) {
          await projectService.updateCharacter(projectId, cId, {
            description: updatedChar.description,
            imageUrl: updatedChar.imageUrl,
            videoUrl: updatedChar.videoUrl || '',
            videoStatus: updatedChar.videoStatus,
            createStatus: updatedChar.createStatus,
            voice: updatedChar.voice,
            externalId: '',
            libraryId: null as any,
            source: 'ai',
            originalData: null
          });
        }
      } catch (e) {
        console.error('Failed to save unmatch:', e);
      }
    }

    message.success('已取消匹配，恢复为原始状态');
  };

  /**
   * 批量生成角色视频
   * 为所有未生成视频或生成失败的角色生成视频
   */
  const batchGenerateVideos = () => {
    const draftIds = characters.filter(c => c.videoStatus === 'draft' || c.videoStatus === 'failed').map(c => c.id);
    if (draftIds.length === 0) {
      message.info('没有需要生成的角色');
      return;
    }

    draftIds.forEach(id => generateCharacterVideo(id));
    message.loading(`正在批量生成 ${draftIds.length} 个角色视频...`);
  };

  /**
   * 批量生成角色图片
   * 为所有没有图片的角色生成图片
   */
  const batchGenerateImages = () => {
    const targetIds = characters.filter(c => !c.imageUrl).map(c => c.id);
    if (targetIds.length === 0) {
      message.info('所有角色都已有图片');
      return;
    }

    targetIds.forEach(id => generateCharacterImage(id));
    message.loading(`正在批量生成 ${targetIds.length} 个角色图片...`);
  };

  /**
   * 批量创建角色
   * 将所有已生成视频但未入库的角色批量创建到 Sora 平台
   */
  const batchCreateCharacters = () => {
    const generatedIds = characters.filter(c => c.videoStatus === 'generated' && c.createStatus !== 'created').map(c => c.id);
    if (generatedIds.length === 0) {
      message.info('没有待入库的角色');
      return;
    }

    generatedIds.forEach(id => createCharacter(id));
    message.loading(`正在批量创建 ${generatedIds.length} 个角色...`);
  };

  return {
    saving,
    libraryModalOpen,
    libraryCharacters,
    currentMatchingId,
    setLibraryModalOpen,
    loadLibraryCharacters,
    addCharacter,
    deleteCharacter,
    updateCharacter,
    updateCharacterAndSave,
    generateCharacterImage,
    generateCharacterVideo,
    createCharacter,
    saveToLibrary,
    openLibraryModal,
    handleMatchLibrary,
    cancelMatchLibrary,
    batchGenerateVideos,
    batchGenerateImages,
    batchCreateCharacters
  };
};
