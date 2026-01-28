import { useEffect, useState, useRef } from 'react';
import { message, Modal } from 'antd';
import { useNavigate, useParams } from 'react-router-dom';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { projectService } from '../../../services/projectService';
import { aiService } from '../../../services/aiService';
import type { Character, StoryboardFrame, ProjectData, Prop, Scene } from '../../../types/workflow';
import type { ProjectEpisode } from '../../../types';
import { useUndoRedo, type HistoryState, type OperationType } from './useUndoRedo';
import { useCharacterOperations } from './useCharacterOperations';
import { useSceneOperations } from './useSceneOperations';
import { usePropOperations } from './usePropOperations';
import { useStoryboardOperations } from './useStoryboardOperations';

/**
 * 项目工作流主 Hook
 * 
 * 这是项目页面的核心Hook，整合了所有子模块的功能：
 * - 项目数据管理（加载、保存、更新）
 * - 角色、场景、物品、分镜的完整操作
 * - 撤回/重做功能
 * - AI分析（剧本分析、分镜拆解、提示词推理）
 * - 批量操作
 * - 分集管理
 * - 状态轮询和同步
 * 
 * @returns 包含所有项目操作方法和状态的对象
 */
export const useProjectWorkflow = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectId = parseInt(id!);
  const [saving, setSaving] = useState(false);
  const [loadingProject, setLoadingProject] = useState(true);

  // 撤回/重做功能
  const {
    saveState,
    undo,
    redo,
    pushToRedoStack,
    pushToUndoStack,
    canUndo,
    canRedo,
    getLastOperation,
    getNextOperation
  } = useUndoRedo();

  // 项目基本数据
  const [projectData, setProjectData] = useState<ProjectData>({
    name: '',
    script: '',
    aspectRatio: '16:9',
    visualStyle: '日本动漫风格',
    styleId: 1,
  });

  // 角色列表及其引用
  const [characters, setCharacters] = useState<Character[]>([]);
  const charactersRef = useRef(characters);
  useEffect(() => {
    charactersRef.current = characters;
  }, [characters]);

  // 场景列表及其引用
  const [scenes, setScenes] = useState<Scene[]>([]);
  const scenesRef = useRef(scenes);
  useEffect(() => {
    scenesRef.current = scenes;
  }, [scenes]);

  // 物品列表及其引用
  const [props, setProps] = useState<Prop[]>([]);
  const propsRef = useRef(props);
  useEffect(() => {
    propsRef.current = props;
  }, [props]);

  // 分镜列表及其引用
  const [storyboards, setStoryboards] = useState<StoryboardFrame[]>([]);
  const storyboardsRef = useRef(storyboards);
  useEffect(() => {
    storyboardsRef.current = storyboards;
  }, [storyboards]);

  // 分集相关状态
  const [episodes, setEpisodes] = useState<ProjectEpisode[]>([]);
  const [currentEpisodeId, setCurrentEpisodeId] = useState<number | null>(null);

  // 预览视频URL
  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  /**
   * 保存当前状态到历史记录的辅助函数
   * 用于撤回/重做功能
   * 
   * @param operation - 操作类型
   * @param description - 操作描述
   */
  const saveCurrentState = (operation: OperationType, description: string) => {
    const state: HistoryState = {
      characters: charactersRef.current,
      scenes: scenesRef.current,
      props: propsRef.current,
      storyboards: storyboardsRef.current,
      projectData: {
        name: projectData.name,
        aspectRatio: projectData.aspectRatio,
        styleId: projectData.styleId,
        visualStyle: projectData.visualStyle
      }
    };
    saveState(state, operation, description);
  };

  /**
   * 恢复历史状态的辅助函数
   * 将指定的历史状态应用到当前界面
   * 
   * @param state - 要恢复的历史状态
   */
  const restoreState = (state: HistoryState) => {
    setCharacters(state.characters);
    charactersRef.current = state.characters;
    
    setScenes(state.scenes);
    scenesRef.current = state.scenes;
    
    setProps(state.props);
    propsRef.current = state.props;
    
    setStoryboards(state.storyboards);
    storyboardsRef.current = state.storyboards;
    
    setProjectData(prev => ({
      ...prev,
      name: state.projectData.name,
      aspectRatio: state.projectData.aspectRatio,
      styleId: state.projectData.styleId,
      visualStyle: state.projectData.visualStyle || prev.visualStyle
    }));
  };

  // 使用拆分的子 hooks，整合各模块功能
  const characterOps = useCharacterOperations(
    projectId,
    currentEpisodeId,
    characters,
    setCharacters,
    charactersRef,
    saveCurrentState
  );

  const sceneOps = useSceneOperations(
    projectId,
    currentEpisodeId,
    scenes,
    setScenes,
    scenesRef,
    saveCurrentState
  );

  const propOps = usePropOperations(
    projectId,
    currentEpisodeId,
    props,
    setProps,
    propsRef,
    saveCurrentState
  );

  const storyboardOps = useStoryboardOperations(
    projectId,
    currentEpisodeId,
    storyboards,
    setStoryboards,
    storyboardsRef,
    characters,
    scenes,
    props,
    projectData,
    saveCurrentState
  );

  /**
   * 撤回操作
   * 撤回到上一个历史状态，并将当前状态推入重做栈
   * 异步同步到数据库
   */
  const handleUndo = async () => {
    // 清除文案编辑的防抖定时器和编辑前状态
    if (storyboardOps.textEditHistoryTimerRef.current) {
      clearTimeout(storyboardOps.textEditHistoryTimerRef.current);
      storyboardOps.textEditHistoryTimerRef.current = null;
    }
    storyboardOps.textEditBeforeStateRef.current = null;
    
    const lastOperation = getLastOperation();
    
    const beforeUndoState: HistoryState = {
      characters: [...charactersRef.current],
      scenes: [...scenesRef.current],
      props: [...propsRef.current],
      storyboards: [...storyboardsRef.current],
      projectData: {
        name: projectData.name,
        aspectRatio: projectData.aspectRatio,
        styleId: projectData.styleId,
        visualStyle: projectData.visualStyle
      }
    };
    
    const previousState = undo();
    if (!previousState) return;
    
    if (lastOperation) {
      const operationType = lastOperation.includes('添加角色') ? 'add_character_to_storyboard' :
                           lastOperation.includes('移除角色') ? 'remove_character_from_storyboard' :
                           lastOperation.includes('添加场景') ? 'add_scene_to_storyboard' :
                           lastOperation.includes('移除场景') ? 'remove_scene_from_storyboard' :
                           lastOperation.includes('添加物品') ? 'add_prop_to_storyboard' :
                           lastOperation.includes('移除物品') ? 'remove_prop_from_storyboard' :
                           lastOperation.includes('编辑分镜文案') ? 'edit_storyboard_text' :
                           lastOperation.includes('添加分镜') ? 'add_storyboard' :
                           lastOperation.includes('删除分镜') ? 'delete_storyboard' :
                           lastOperation.includes('移动分镜') ? 'move_storyboard' :
                           'add_character_to_storyboard' as any;
      
      pushToRedoStack(beforeUndoState, operationType, lastOperation);
    }
    
    restoreState(previousState);
    
    const stateSnapshot = {
      charactersLength: charactersRef.current.length,
      scenesLength: scenesRef.current.length,
      propsLength: propsRef.current.length,
      storyboardsLength: storyboardsRef.current.length,
      projectName: projectData.name
    };
    
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const isModified = 
        charactersRef.current.length !== stateSnapshot.charactersLength ||
        scenesRef.current.length !== stateSnapshot.scenesLength ||
        propsRef.current.length !== stateSnapshot.propsLength ||
        storyboardsRef.current.length !== stateSnapshot.storyboardsLength ||
        projectData.name !== stateSnapshot.projectName;
      
      if (isModified) {
        return;
      }
      
      try {
        await applyStateChange(previousState, lastOperation, false, beforeUndoState);
      } catch (error) {
        console.error('Failed to sync undo to database:', error);
        message.error({ content: '撤回同步失败，刷新页面可能会丢失更改', key: 'undo-sync', duration: 3 });
      }
    })();
  };

  /**
   * 重做操作
   * 重做到下一个历史状态，并将当前状态推入撤回栈
   * 异步同步到数据库
   */
  const handleRedo = async () => {
    if (storyboardOps.textEditHistoryTimerRef.current) {
      clearTimeout(storyboardOps.textEditHistoryTimerRef.current);
      storyboardOps.textEditHistoryTimerRef.current = null;
    }
    storyboardOps.textEditBeforeStateRef.current = null;
    
    const nextOperation = getNextOperation();
    
    const beforeRedoState: HistoryState = {
      characters: [...charactersRef.current],
      scenes: [...scenesRef.current],
      props: [...propsRef.current],
      storyboards: [...storyboardsRef.current],
      projectData: {
        name: projectData.name,
        aspectRatio: projectData.aspectRatio,
        styleId: projectData.styleId,
        visualStyle: projectData.visualStyle
      }
    };
    
    const nextState = redo();
    if (!nextState) {
      return;
    }
    
    if (nextOperation) {
      const operationType = nextOperation.includes('添加角色') ? 'add_character_to_storyboard' :
                           nextOperation.includes('移除角色') ? 'remove_character_from_storyboard' :
                           nextOperation.includes('添加场景') ? 'add_scene_to_storyboard' :
                           nextOperation.includes('移除场景') ? 'remove_scene_from_storyboard' :
                           nextOperation.includes('添加物品') ? 'add_prop_to_storyboard' :
                           nextOperation.includes('移除物品') ? 'remove_prop_from_storyboard' :
                           nextOperation.includes('编辑分镜文案') ? 'edit_storyboard_text' :
                           nextOperation.includes('添加分镜') ? 'add_storyboard' :
                           nextOperation.includes('删除分镜') ? 'delete_storyboard' :
                           nextOperation.includes('移动分镜') ? 'move_storyboard' :
                           'add_character_to_storyboard' as any;
      
      pushToUndoStack(beforeRedoState, operationType, nextOperation);
    }
    
    restoreState(nextState);
    
    const stateSnapshot = {
      charactersLength: charactersRef.current.length,
      scenesLength: scenesRef.current.length,
      propsLength: propsRef.current.length,
      storyboardsLength: storyboardsRef.current.length,
      projectName: projectData.name
    };
    
    (async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const isModified = 
        charactersRef.current.length !== stateSnapshot.charactersLength ||
        scenesRef.current.length !== stateSnapshot.scenesLength ||
        propsRef.current.length !== stateSnapshot.propsLength ||
        storyboardsRef.current.length !== stateSnapshot.storyboardsLength ||
        projectData.name !== stateSnapshot.projectName;
      
      if (isModified) {
        return;
      }
      
      try {
        await applyStateChange(nextState, nextOperation, false, beforeRedoState);
      } catch (error) {
        console.error('Failed to sync redo to database:', error);
        message.error({ content: '重做同步失败，刷新页面可能会丢失更改', key: 'redo-sync', duration: 3 });
      }
    })();
  };

  /**
   * 根据操作类型应用状态变更到数据库
   * 根据不同的操作类型，选择性地更新数据库中的相应数据
   * 
   * @param newState - 新的状态
   * @param operationDesc - 操作描述
   * @param updateLocalState - 是否更新本地状态
   * @param oldState - 旧的状态（用于对比）
   */
  const applyStateChange = async (
    newState: HistoryState, 
    operationDesc: string | null, 
    updateLocalState: boolean = false,
    oldState?: HistoryState
  ) => {
    if (!operationDesc) {
      if (!updateLocalState) {
        await projectService.updateProject(projectId, {
          name: newState.projectData.name,
          aspectRatio: newState.projectData.aspectRatio,
          styleId: newState.projectData.styleId
        });
        
        if (newState.characters.length > 0) {
          await projectService.saveCharacters(projectId, newState.characters, currentEpisodeId || undefined);
        }
        
        if (newState.scenes.length > 0) {
          await projectService.upsertScenes(projectId, newState.scenes, currentEpisodeId || undefined);
        }
        
        if (newState.props.length > 0) {
          await projectService.upsertProps(projectId, newState.props, currentEpisodeId || undefined);
        }
        
        if (newState.storyboards.length > 0) {
          await storyboardOps.saveStoryboardsOnly(newState.storyboards, false);
        }
      } else {
        await saveProject(
          true,
          newState.storyboards,
          newState.characters,
          {
            name: newState.projectData.name,
            aspectRatio: newState.projectData.aspectRatio,
            styleId: newState.projectData.styleId,
            visualStyle: newState.projectData.visualStyle
          },
          true
        );
      }
      return;
    }

    // const currentChars = oldState?.characters || charactersRef.current;
    // const currentScenes = oldState?.scenes || scenesRef.current;
    // const currentProps = oldState?.props || propsRef.current;
    const currentStoryboards = oldState?.storyboards || storyboardsRef.current;

    if (operationDesc.includes('角色') && operationDesc.includes('分镜')) {
      await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
    } else if (operationDesc.includes('场景') && operationDesc.includes('分镜')) {
      await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
    } else if (operationDesc.includes('物品') && operationDesc.includes('分镜')) {
      await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
    } else if (operationDesc.includes('添加分镜')) {
      await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
    } else if (operationDesc.includes('删除分镜')) {
      const deletedIds = currentStoryboards
        .filter(s => !newState.storyboards.find(ns => ns.id === s.id))
        .map(s => s.id);
      
      const addedIds = newState.storyboards
        .filter(ns => !currentStoryboards.find(s => s.id === ns.id))
        .map(ns => ns.id);
      
      if (deletedIds.length > 0 && !updateLocalState) {
        for (const id of deletedIds) {
          const numericId = Number(id);
          if (!isNaN(numericId) && numericId < 1700000000000) {
            await projectService.deleteStoryboard(projectId, numericId);
          }
        }
      }
      
      if (addedIds.length > 0 || updateLocalState) {
        await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
      }
    } else if (operationDesc.includes('移动分镜')) {
      await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
    } else if (operationDesc.includes('编辑分镜文案')) {
      await storyboardOps.saveStoryboardsOnly(newState.storyboards, updateLocalState);
    } else if (operationDesc.includes('角色历史素材')) {
      if (!updateLocalState) {
        await projectService.saveCharacters(projectId, newState.characters, currentEpisodeId || undefined);
      }
    } else if (operationDesc.includes('场景历史素材')) {
      if (!updateLocalState) {
        await projectService.upsertScenes(projectId, newState.scenes, currentEpisodeId || undefined);
      }
    } else if (operationDesc.includes('物品历史素材')) {
      if (!updateLocalState) {
        await projectService.upsertProps(projectId, newState.props, currentEpisodeId || undefined);
      }
    } else if (operationDesc.includes('历史素材')) {
      const changedStoryboards = newState.storyboards.filter((ns, idx) => {
        const current = currentStoryboards[idx];
        return current && (
          ns.imageUrl !== current.imageUrl ||
          ns.videoUrl !== current.videoUrl ||
          ns.highResVideoUrl !== current.highResVideoUrl
        );
      });
      
      for (const sb of changedStoryboards) {
        const numericId = Number(sb.id);
        if (!isNaN(numericId) && numericId < 1700000000000) {
          if (sb.videoUrl !== currentStoryboards.find(s => s.id === sb.id)?.videoUrl ||
              sb.highResVideoUrl !== currentStoryboards.find(s => s.id === sb.id)?.highResVideoUrl) {
            await projectService.updateStoryboardMedia(projectId, numericId, {
              videoUrl: sb.videoUrl || null,
              highResVideoUrl: sb.highResVideoUrl || null,
              status: sb.status as any,
              highResStatus: sb.highResStatus as any
            });
          }
          if (sb.imageUrl !== currentStoryboards.find(s => s.id === sb.id)?.imageUrl) {
            await storyboardOps.saveStoryboardsOnly([sb], updateLocalState);
          }
        }
      }
    } else if (operationDesc.includes('项目名称') || operationDesc.includes('画面比例') || operationDesc.includes('画面风格')) {
      await projectService.updateProject(projectId, {
        name: newState.projectData.name,
        aspectRatio: newState.projectData.aspectRatio,
        styleId: newState.projectData.styleId
      });
    } else {
      if (!updateLocalState) {
        await projectService.updateProject(projectId, {
          name: newState.projectData.name,
          aspectRatio: newState.projectData.aspectRatio,
          styleId: newState.projectData.styleId
        });
        
        if (newState.characters.length > 0) {
          await projectService.saveCharacters(projectId, newState.characters, currentEpisodeId || undefined);
        }
        
        if (newState.storyboards.length > 0) {
          await storyboardOps.saveStoryboardsOnly(newState.storyboards, false);
        }
      } else {
        await saveProject(
          true,
          newState.storyboards,
          newState.characters,
          {
            name: newState.projectData.name,
            aspectRatio: newState.projectData.aspectRatio,
            styleId: newState.projectData.styleId,
            visualStyle: newState.projectData.visualStyle
          },
          true
        );
      }
    }
  };

  // 轮询更新：当有生成任务进行时，定期从服务器获取最新状态
  useEffect(() => {
    let mounted = true;
    const hasGeneratingChars = characters.some(c => c.videoStatus === 'generating' || c.imageStatus === 'generating');
    const hasGeneratingStoryboards = storyboards.some(s => s.status === 'generating_video' || s.highResStatus === 'generating' || s.imageStatus === 'generating');
    const hasGeneratingScenes = scenes.some(s => s.status === 'generating');
    const hasGeneratingProps = props.some(p => p.status === 'generating');

    if (!hasGeneratingChars && !hasGeneratingStoryboards && !hasGeneratingScenes && !hasGeneratingProps) return;

    const pollProjectData = async () => {
      try {
        const project = await projectService.getProjectById(projectId);
        if (!project || !mounted) return;

        if (hasGeneratingChars) {
          const savedChars = (project as any).characters || [];
          setCharacters(prev => prev.map(p => {
            const updated = savedChars.find((s: any) => s.id?.toString() === p.id);
            if (updated) {
              let newImageStatus = (updated.imageStatus as any) || 'draft';

              if (p.imageStatus === 'generating' && (newImageStatus === 'draft' || newImageStatus === 'idle')) {
                newImageStatus = 'generating';
              }

              if (p.imageStatus === 'generating') {
                if (updated.imageUrl && updated.imageUrl !== p.imageUrl) {
                  newImageStatus = 'generated';
                } else if (updated.error && updated.error !== p.error) {
                  newImageStatus = 'failed';
                } else if (updated.imageStatus === 'generated') {
                  newImageStatus = 'generated';
                }
              }

              let newVideoStatus = updated.videoStatus || 'draft';
              if (p.videoStatus === 'generating' && newVideoStatus === 'draft' && !updated.videoUrl) {
                newVideoStatus = p.videoStatus;
              } else {
                newVideoStatus = updated.videoStatus || 'draft';
              }

              if (newVideoStatus !== p.videoStatus ||
                updated.videoUrl !== p.videoUrl ||
                updated.imageUrl !== p.imageUrl ||
                newImageStatus !== p.imageStatus) {

                return {
                  ...p,
                  videoStatus: newVideoStatus,
                  videoUrl: updated.videoUrl,
                  imageUrl: updated.imageUrl,
                  imageStatus: newImageStatus,
                  error: updated.error,
                  characterId: updated.externalId || p.characterId
                };
              }
            }
            return p;
          }));
        }

        if (hasGeneratingStoryboards) {
          const savedStoryboards = (project as any).storyboards || [];
          setStoryboards(prev => prev.map(p => {
            const updated = savedStoryboards.find((s: any) => s.id?.toString() === p.id);
            if (updated) {
              if (updated.status !== p.status ||
                updated.videoUrl !== p.videoUrl ||
                updated.highResStatus !== p.highResStatus ||
                updated.imageStatus !== p.imageStatus ||
                updated.imageUrl !== p.imageUrl) {
                return {
                  ...p,
                  status: updated.status as any,
                  videoUrl: updated.videoUrl,
                  highResVideoUrl: updated.highResVideoUrl,
                  highResStatus: updated.highResStatus as any,
                  errorMsg: updated.errorMsg,
                  highResErrorMsg: updated.highResErrorMsg,
                  prompt: updated.prompt,
                  imageUrl: updated.imageUrl,
                  imageStatus: updated.imageStatus as any
                };
              }
            }
            return p;
          }));
        }

        if (hasGeneratingScenes) {
          const savedScenes = (project as any).scenes || [];
          setScenes(prev => prev.map(s => {
            const updated = savedScenes.find((remote: any) => remote.id?.toString() === s.id);
            if (updated) {
              let newStatus = (updated.status as any) || 'idle';
              if (s.status === 'generating' && (newStatus === 'idle')) {
                newStatus = 'generating';
              }

              if (s.status === 'generating') {
                if (updated.imageUrl && updated.imageUrl !== s.imageUrl) {
                  newStatus = 'generated';
                } else if (updated.status === 'failed') {
                  newStatus = 'failed';
                }
              }

              if (newStatus !== s.status || updated.imageUrl !== s.imageUrl) {
                return {
                  ...s,
                  imageUrl: updated.imageUrl || s.imageUrl,
                  status: newStatus
                };
              }
            }
            return s;
          }));
        }

        if (hasGeneratingProps) {
          const savedProps = (project as any).props || [];
          setProps(prev => prev.map(p => {
            const updated = savedProps.find((remote: any) => remote.id?.toString() === p.id);
            if (updated) {
              let newStatus = (updated.status as any) || 'idle';
              if (p.status === 'generating' && (newStatus === 'idle')) {
                newStatus = 'generating';
              }

              if (p.status === 'generating') {
                if (updated.imageUrl && updated.imageUrl !== p.imageUrl) {
                  newStatus = 'generated';
                } else if (updated.status === 'failed') {
                  newStatus = 'failed';
                }
              }

              if (newStatus !== p.status || updated.imageUrl !== p.imageUrl) {
                return {
                  ...p,
                  imageUrl: updated.imageUrl || p.imageUrl,
                  status: newStatus
                };
              }
            }
            return p;
          }));
        }

      } catch (e) {
        console.error('Failed to poll project updates:', e);
      }
    };

    const interval = setInterval(pollProjectData, 5000);
    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id, characters, storyboards, scenes, props]);

  // 加载项目数据
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId]);

  // 当角色库弹窗打开时，加载角色库数据
  useEffect(() => {
    if (characterOps.libraryModalOpen) {
      characterOps.loadLibraryCharacters();
    }
  }, [characterOps.libraryModalOpen]);

  /**
   * 加载项目数据
   * 从服务器加载项目的所有数据，包括角色、场景、物品、分镜和分集
   * 
   * @param projectId - 项目ID
   * @param specificEpisodeId - 指定要加载的分集ID（可选）
   */
  const loadProject = async (projectId: number, specificEpisodeId?: number, silent: boolean = false) => {
    try {
      if (!silent) {
        setLoadingProject(true);
      }
      
      const episodesList = await projectService.getEpisodes(projectId);
      setEpisodes(episodesList);

      let targetEpisodeId = specificEpisodeId || currentEpisodeId;
      if (!targetEpisodeId && episodesList && episodesList.length > 0) {
          targetEpisodeId = episodesList[0].id;
          setCurrentEpisodeId(targetEpisodeId);
      }

      const project = await projectService.getProjectById(projectId);
      if (project) {
        setProjectData({
          name: project.name,
          script: (project as any).script || '',
          aspectRatio: project.aspectRatio || '16:9',
          visualStyle: project.visualStyle || '日本动漫风格',
          styleId: project.styleId,
        });

        const savedCharacters = (project as any).characters || [];
        if (savedCharacters.length > 0) {
          const mappedCharacters: Character[] = savedCharacters.map((c: any) => ({
            id: c.id!.toString(),
            episodeId: c.episodeId,
            name: c.name,
            description: c.description,
            imageUrl: c.imageUrl,
            imageStatus: c.imageStatus || 'draft',
            videoUrl: c.videoUrl,
            videoStatus: c.videoStatus || 'draft',
            createStatus: c.createStatus || 'idle',
            error: c.error,
            characterId: c.externalId,
            libraryId: c.libraryId,
            source: c.source as any,
            voice: c.voice,
            originalData: c.originalData
          }));
          setCharacters(mappedCharacters);
        }

        const savedScenes = (project as any).scenes || [];
        if (savedScenes.length > 0) {
          setScenes(savedScenes.map((s: any) => ({
            ...s,
            id: s.id.toString(),
            episodeId: s.episodeId,
          })));
        }

        const savedProps = (project as any).props || [];
        if (savedProps.length > 0) {
          setProps(savedProps.map((p: any) => ({
            ...p,
            id: p.id.toString(),
            episodeId: p.episodeId,
          })));
        }

        const rawStoryboards = (project as any).storyboards || [];
        if (rawStoryboards.length > 0) {
          const mappedStoryboards: StoryboardFrame[] = rawStoryboards.map((s: any) => {
            const characterIds = typeof s.characterIds === 'string' ? JSON.parse(s.characterIds) : (s.characterIds || []);
            const propIds = typeof s.propIds === 'string' ? JSON.parse(s.propIds) : (s.propIds || []);

            return {
              id: s.id!.toString(),
              episodeId: s.episodeId,
              text: s.text,
              characterIds: characterIds.map((id: any) => id.toString()),
              propIds: propIds.map((id: any) => id.toString()),
              sceneId: s.sceneId ? s.sceneId.toString() : undefined,
              duration: s.duration,
              prompt: s.prompt || '',
              videoUrl: s.videoUrl,
              highResVideoUrl: s.highResVideoUrl,
              highResStatus: s.highResStatus,
              status: s.status as any,
              order: s.order,
              imageUrl: s.imageUrl,
              imageStatus: s.imageStatus || 'idle',
              referenceImageUrl: s.referenceImageUrl,
              videoRefScope: s.videoRefScope
            };
          });
          
          const filteredStoryboards = targetEpisodeId 
            ? mappedStoryboards.filter(s => s.episodeId === targetEpisodeId)
            : mappedStoryboards;

          setStoryboards(filteredStoryboards);
        } else {
            setStoryboards([]);
        }
      } else {
        message.error('项目不存在');
        navigate('/projects');
      }
    } catch (error) {
      console.error('Failed to load project:', error);
      message.error('加载项目失败');
    } finally {
      if (!silent) {
        setLoadingProject(false);
      }
    }
  };

  /**
   * 保存项目
   * 保存项目的所有数据到数据库，包括基本信息、角色、场景、物品和分镜
   * 
   * @param silent - 是否静默模式（不显示提示消息）
   * @param storyboardsOverride - 可选的分镜列表覆盖
   * @param charactersOverride - 可选的角色列表覆盖
   * @param projectDataOverride - 可选的项目数据覆盖
   * @param skipScriptValidation - 是否跳过剧本验证
   * @returns 项目ID
   */
  const saveProject = async (
    silent = false,
    storyboardsOverride?: StoryboardFrame[],
    charactersOverride?: Character[],
    projectDataOverride?: Partial<ProjectData>,
    skipScriptValidation = false
  ) => {
    const currentProjectData = { ...projectData, ...projectDataOverride };
    if (!currentProjectData.name.trim()) {
      if (!silent) message.warning('请输入项目名称');
      return;
    }
    if (!skipScriptValidation && !currentProjectData.script.trim()) {
      if (!silent) message.warning('请输入剧本内容');
      return;
    }

    try {
      setSaving(true);
      const currentCharacters = charactersOverride || charactersRef.current;
      const currentStoryboards = storyboardsOverride || storyboardsRef.current;

      await projectService.updateProject(projectId, {
        name: currentProjectData.name,
        aspectRatio: currentProjectData.aspectRatio,
        styleId: currentProjectData.styleId,
      } as any);

      if (currentCharacters.length > 0) {
        const savedChars = await projectService.saveCharacters(projectId, currentCharacters, currentEpisodeId || undefined);
        const mappedSaved: Character[] = savedChars.map(c => ({
          id: c.id!.toString(),
          episodeId: c.episodeId,
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
      }

      if (scenesRef.current.length > 0) {
        const savedScenes = await projectService.upsertScenes(projectId, scenesRef.current, currentEpisodeId || undefined);
        setScenes(savedScenes.map(s => ({ ...s, id: s.id.toString(), episodeId: s.episodeId })));
      }

      if (propsRef.current.length > 0) {
        const savedProps = await projectService.upsertProps(projectId, propsRef.current, currentEpisodeId || undefined);
        setProps(savedProps.map(p => ({ ...p, id: p.id.toString(), episodeId: p.episodeId })));
      }

      if (currentStoryboards.length > 0) {
        const framesForDb = currentStoryboards.map((f, idx) => ({
          ...f,
          order: idx,
          characterIds: f.characterIds.map(cid => parseInt(cid)),
          propIds: f.propIds ? f.propIds.map(pid => parseInt(pid)) : [],
          sceneId: f.sceneId ? parseInt(f.sceneId) : undefined
        }));

        const savedStoryboards = await projectService.saveStoryboards(projectId, framesForDb, currentEpisodeId || undefined);
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
          }
        });
        setStoryboards(mappedSavedStoryboards);
      }

      if (!silent) message.success('保存成功');
      return projectId;
    } catch (error) {
      console.error('Failed to save project:', error);
      if (!silent) message.error('保存失败');
      throw error;
    } finally {
      setSaving(false);
    }
  };

  /**
   * 分析剧本
   * 使用AI分析剧本内容，自动提取角色、场景和物品信息
   * 
   * @param projectId - 项目ID（可选，默认使用当前项目）
   */
  const analyzeScript = async (projectId?: number) => {
    const targetId = projectId || (projectId);

    if (!targetId) {
      message.error('请先保存项目再进行AI分析');
      return;
    }

    try {
      await aiService.analyzeElements({
        projectId: targetId,
        scriptContent: projectData.script
      });

      const project = await projectService.getProjectById(targetId);

      if (project) {
        const chars = (project.characters || []).map((c: any) => ({
          id: c.id!.toString(),
          episodeId: c.episodeId,
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
        setCharacters(chars);

        const scenes = (project.scenes || []).map((s: any) => ({ 
          ...s, 
          id: s.id.toString(),
          episodeId: s.episodeId,
        }));
        setScenes(scenes);

        const props = (project.props || []).map((p: any) => ({ 
          ...p, 
          id: p.id.toString(),
          episodeId: p.episodeId,
        }));
        setProps(props);
      }

      message.success(`分析完成，已更新角色、场景和物品`);
    } catch (error: any) {
      console.error('Analysis failed:', error);
      message.error(error.response?.data?.error || '分析失败');
    }
  };

  /**
   * 重新分析剧本
   * 清空当前所有角色、场景和物品，重新从剧本分析
   * 显示确认对话框，操作不可撤销
   */
  const handleReAnalyze = () => {
    Modal.confirm({
      title: '确认重新分析剧本？',
      icon: <ExclamationCircleOutlined />,
      content: '这将清空当前所有角色、场景和物品信息（包括已生成的资源），并重新从剧本分析。此操作无法撤销。',
      okText: '确认重新分析',
      okType: 'danger',
      cancelText: '取消',
      async onOk() {
        try {
          const [currentChars, currentScenes, currentProps] = await Promise.all([
            projectService.getCharactersByProjectId(projectId),
            projectService.getScenesByProjectId(projectId),
            projectService.getPropsByProjectId(projectId)
          ]);

          await Promise.all([
            ...currentChars.map(c => c.id ? projectService.deleteCharacter(projectId, c.id) : Promise.resolve()),
            ...currentScenes.map(s => s.id ? projectService.deleteScene(projectId, s.id) : Promise.resolve()),
            ...currentProps.map(p => p.id ? projectService.deleteProp(projectId, p.id) : Promise.resolve())
          ]);

          setCharacters([]);
          setScenes([]);
          setProps([]);

          analyzeScript(projectId);

        } catch (error) {
          console.error('Re-analyze failed:', error);
          message.error('重置失败');
        }
      },
    });
  };

  /**
   * 生成分镜
   * 使用AI根据剧本内容自动拆解生成分镜列表
   * 会自动匹配角色并保存到数据库
   */
  const generateStoryboards = async () => {
    if (!projectId) {
      message.warning('请先保存项目');
      return;
    }

    try {
      const result = await aiService.analyzeStoryboards({
        projectId,
        scriptContent: projectData.script,
        episodeId: currentEpisodeId || undefined
      });

      const frames: StoryboardFrame[] = result.map((item: any, index: number) => {
        const matchedIds: string[] = [];
        if (item.roles && Array.isArray(item.roles)) {
          item.roles.forEach((roleName: string) => {
            const matchedChar = characters.find(c => c.name === roleName);
            if (matchedChar) {
              matchedIds.push(matchedChar.id);
            }
          });
        }

        return {
          id: Date.now().toString() + index,
          text: item.text,
          characterIds: matchedIds,
          duration: parseInt(item.duration) || 10,
          prompt: '',
          status: 'draft'
        };
      });

      setStoryboards(frames);
      message.success(`分镜拆解完成，共 ${frames.length} 个分镜`);

      if (projectId) {
        try {
          const framesForDb = frames.map((f, idx) => ({
            ...f,
            order: idx,
            characterIds: f.characterIds.map(cid => {
              const parsed = parseInt(cid);
              return isNaN(parsed) ? 0 : parsed;
            })
          }));

          const saved = await projectService.saveStoryboards(projectId, framesForDb, currentEpisodeId || undefined);
          if (saved && saved.length > 0) {
            const savedFrames = saved.map(s => ({
              id: s.id.toString(),
              text: s.text,
              characterIds: (s.characterIds || []).map((id: number) => id.toString()),
              duration: s.duration,
              prompt: s.prompt || '',
              videoUrl: s.videoUrl,
              status: s.status as any,
              order: s.order
            }));
            setStoryboards(savedFrames);
          }
        } catch (e) {
          console.error('Failed to save generated storyboards:', e);
          message.error('分镜保存失败，请手动保存项目');
        }
      } else {
        console.warn('No projectId found, skipping auto-save of storyboards');
      }
    } catch (error: any) {
      console.error('Failed to generate storyboards:', error);
      message.error(error.message || '分镜拆解失败，请重试');
    }
  };

  /**
   * 批量推理分镜提示词
   * 对指定的分镜（或所有没有提示词的分镜）批量生成视频提示词
   * 
   * @param ids - 可选的分镜ID列表，如果不提供则处理所有没有提示词的分镜
   */
  const batchInferStoryboardPrompts = async (ids?: string[]) => {
    let framesToProcess: StoryboardFrame[] = [];

    if (ids && ids.length > 0) {
      framesToProcess = storyboards.filter(f => ids.includes(f.id));
    } else {
      framesToProcess = storyboards.filter(f => !f.prompt);
    }

    if (framesToProcess.length === 0) {
      if (ids && ids.length > 0) {
        message.info('未找到选中的分镜');
      } else {
        message.info('所有分镜都已有提示词');
      }
      return;
    }

    message.loading(`正在批量推理 ${framesToProcess.length} 个分镜视频提示词...`);

    const concurrency = 5;
    const queue = [...framesToProcess];
    let completed = 0;

    const processNext = async () => {
      if (queue.length === 0) return;
      const frame = queue.shift()!;

      try {
        await storyboardOps.inferStoryboardPrompt(frame.id, true);
      } catch (e) {
        console.error(e);
      } finally {
        completed++;
        if (queue.length > 0) {
          await processNext();
        }
      }
    };

    const workers = [];
    for (let i = 0; i < Math.min(concurrency, queue.length); i++) {
      workers.push(processNext());
    }

    await Promise.all(workers);
    message.success(`批量推理完成`);
  };

  /**
   * 批量生成分镜视频
   * 对所有未在生成中的分镜批量提交视频生成任务
   */
  const batchGenerateStoryboardVideos = () => {
    const targetIds = storyboards.filter(f => f.status !== 'generating_video').map(f => f.id);

    if (targetIds.length === 0) {
      message.info('没有可生成视频的分镜');
      return;
    }

    targetIds.forEach(id => storyboardOps.generateStoryboardVideo(id));
    message.loading(`正在批量生成 ${targetIds.length} 个分镜视频...`);
  };

  /**
   * 添加新分集
   * 创建一个新的分集并添加到项目中
   * 
   * @param name - 分集名称
   * @returns 新创建的分集对象
   */
  const addEpisode = async (name: string) => {
    if (!projectId) return;
    try {
      const newEpisode = await projectService.createEpisode(projectId, { name, projectId });
      setEpisodes(prev => [...prev, newEpisode]);
      message.success('分集创建成功');
      return newEpisode;
    } catch (error) {
      console.error('Failed to create episode:', error);
      message.error('创建分集失败');
    }
  };

  /**
   * 更新分集信息
   * 更新分集的名称或剧本内容
   * 
   * @param episodeId - 分集ID
   * @param data - 要更新的数据（名称、剧本）
   */
  const updateEpisode = async (episodeId: number, data: { name: string, script?: string }) => {
    try {
      const updated = await projectService.updateEpisode(projectId, episodeId, data);
      setEpisodes(prev => prev.map(e => e.id === episodeId ? { ...e, ...updated } : e));
      message.success('分集更新成功');
    } catch (error) {
      console.error('Failed to update episode:', error);
      message.error('更新分集失败');
    }
  };

  /**
   * 删除分集
   * 删除指定的分集，如果删除的是当前分集，会自动切换到其他分集
   * 
   * @param episodeId - 要删除的分集ID
   */
  const deleteEpisode = async (episodeId: number) => {
    try {
      await projectService.deleteEpisode(projectId, episodeId);
      setEpisodes(prev => prev.filter(e => e.id !== episodeId));
      if (currentEpisodeId === episodeId) {
        const remaining = episodes.filter(e => e.id !== episodeId);
        if (remaining.length > 0) {
          setCurrentEpisodeId(remaining[0].id);
        } else {
          setCurrentEpisodeId(null);
        }
      }
      message.success('分集删除成功');
    } catch (error) {
      console.error('Failed to delete episode:', error);
      message.error('删除分集失败');
    }
  };

  /**
   * 切换分集
   * 切换到指定的分集，重新加载该分集的数据
   * 
   * @param episodeId - 要切换到的分集ID
   * @param silent - 是否静默切换（不显示loading状态）
   */
  const switchEpisode = (episodeId: number, silent: boolean = false) => {
    if (loadingProject && !silent) {
      return;
    }
    setCurrentEpisodeId(episodeId);
    loadProject(projectId, episodeId, silent);
  };

  return {
    saving: saving || characterOps.saving || sceneOps.saving || propOps.saving || storyboardOps.saving,
    loadingProject,
    projectData,
    characters,
    scenes,
    props,
    storyboards,
    previewVideoUrl,
    episodes,
    currentEpisodeId,

    setProjectData,
    setPreviewVideoUrl,
    setStoryboards,
    setCurrentEpisodeId,
    switchEpisode,
    addEpisode,
    deleteEpisode,
    updateEpisode,

    saveProject,
    retryGenerateStoryboard: generateStoryboards,

    // 撤回/重做
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    getLastOperation,
    getNextOperation,
    saveCurrentState,

    // Characters
    libraryModalOpen: characterOps.libraryModalOpen,
    libraryCharacters: characterOps.libraryCharacters,
    setLibraryModalOpen: characterOps.setLibraryModalOpen,
    addCharacter: characterOps.addCharacter,
    deleteCharacter: characterOps.deleteCharacter,
    updateCharacter: characterOps.updateCharacter,
    updateCharacterAndSave: characterOps.updateCharacterAndSave,
    generateCharacterImage: characterOps.generateCharacterImage,
    generateCharacterVideo: characterOps.generateCharacterVideo,
    createCharacter: characterOps.createCharacter,
    batchGenerateVideos: characterOps.batchGenerateVideos,
    batchGenerateImages: characterOps.batchGenerateImages,
    batchCreateCharacters: characterOps.batchCreateCharacters,
    handleReAnalyze,
    openLibraryModal: characterOps.openLibraryModal,
    handleMatchLibrary: characterOps.handleMatchLibrary,
    cancelMatchLibrary: characterOps.cancelMatchLibrary,
    saveToLibrary: characterOps.saveToLibrary,

    // Scenes
    addScene: sceneOps.addScene,
    updateScene: sceneOps.updateScene,
    saveScene: sceneOps.saveScene,
    deleteScene: sceneOps.deleteScene,
    generateSceneImage: sceneOps.generateSceneImage,

    // Props
    addProp: propOps.addProp,
    updateProp: propOps.updateProp,
    saveProp: propOps.saveProp,
    deleteProp: propOps.deleteProp,
    generatePropImage: propOps.generatePropImage,

    // Storyboards
    addStoryboard: storyboardOps.addStoryboard,
    updateStoryboard: storyboardOps.updateStoryboard,
    updateStoryboardAndSave: storyboardOps.updateStoryboardAndSave,
    updateStoryboardMediaAndSave: storyboardOps.updateStoryboardMediaAndSave,
    deleteStoryboard: storyboardOps.deleteStoryboard,
    moveStoryboard: storyboardOps.moveStoryboard,
    inferStoryboardPrompt: storyboardOps.inferStoryboardPrompt,
    regenerateStoryboardContent: storyboardOps.inferStoryboardPrompt,
    batchRegenerateContent: batchInferStoryboardPrompts,
    generateStoryboardVideo: storyboardOps.generateStoryboardVideo,
    batchGenerateStoryboardVideos,
    generateStoryboardImage: storyboardOps.generateStoryboardImage,
    generateHighResVideo: storyboardOps.generateHighResVideo,
    batchGenerateHighResVideos: storyboardOps.batchGenerateHighResVideos,
  };
};
