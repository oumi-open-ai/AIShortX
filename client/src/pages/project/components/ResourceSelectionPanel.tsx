/**
 * 资源选择面板组件
 * 用于管理和选择项目中的角色、场景和物品资源
 */
import React, { useState, useEffect } from 'react';
import { Empty, Tooltip, Button, Dropdown, message, Spin } from 'antd';
import { PlusOutlined, MinusOutlined, DeleteOutlined, ThunderboltOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { Character, Scene, Prop, StoryboardFrame } from '../../../types/workflow';
import { CharacterDetailPanel } from './CharacterDetailPanel';
import { SceneDetailPanel } from './SceneDetailPanel';
import { PropDetailPanel } from './PropDetailPanel';
import { CachedImage } from '../../../components/CachedImage';

/**
 * 资源选择面板属性
 */
interface ResourceSelectionPanelProps {
  /** 当前分镜 */
  storyboard?: StoryboardFrame;
  /** 分镜索引 */
  index?: number;
  /** 角色列表 */
  characters: Character[];
  /** 场景列表 */
  scenes: Scene[];
  /** 物品列表 */
  props: Prop[];
  /** 更新分镜回调 */
  onUpdateStoryboard?: (field: keyof StoryboardFrame, value: any) => void;
  /** 当前激活的标签页 */
  activeTab?: 'character' | 'scene' | 'prop';
  /** 标签页切换回调 */
  onTabChange?: (tab: 'character' | 'scene' | 'prop') => void;
  /** 更新角色回调 */
  onUpdateCharacter?: (id: string, field: keyof Character, value: any) => void;
  /** 生成角色图片回调 */
  onGenerateCharacterImage?: (id: string, model?: { model: string; provider: string }, silent?: boolean, skipStateUpdate?: boolean) => void;
  /** 删除角色回调 */
  onDeleteCharacter?: (id: string) => void;
  /** 添加角色回调 */
  onAddCharacter?: () => Promise<Character>;
  /** 更新场景回调 */
  onUpdateScene?: (id: string, field: keyof Scene, value: any) => void;
  /** 生成场景图片回调 */
  onGenerateSceneImage?: (id: string, model?: { model: string; provider: string }, silent?: boolean, skipStateUpdate?: boolean) => void;
  /** 删除场景回调 */
  onDeleteScene?: (id: string) => void;
  /** 添加场景回调 */
  onAddScene?: () => Promise<Scene>;
  /** 更新物品回调 */
  onUpdateProp?: (id: string, field: keyof Prop, value: any) => void;
  /** 生成物品图片回调 */
  onGeneratePropImage?: (id: string, model?: { model: string; provider: string }, silent?: boolean, skipStateUpdate?: boolean) => void;
  /** 删除物品回调 */
  onDeleteProp?: (id: string) => void;
  /** 添加物品回调 */
  onAddProp?: () => Promise<Prop>;
  /** 项目ID */
  projectId?: number;
  /** 选中的资源ID */
  selectedResourceId?: string | null;
}

/**
 * 资源选择面板组件
 */
export const ResourceSelectionPanel: React.FC<ResourceSelectionPanelProps> = ({
  storyboard,
  index = 0,
  characters = [],
  scenes = [],
  props = [],
  onUpdateStoryboard,
  activeTab: propsActiveTab,
  onTabChange,
  onUpdateCharacter,
  onGenerateCharacterImage,
  onDeleteCharacter,
  onAddCharacter,
  onUpdateScene,
  onGenerateSceneImage,
  onDeleteScene,
  onAddScene,
  onUpdateProp,
  onGeneratePropImage,
  onDeleteProp,
  onAddProp,
  projectId,
  selectedResourceId
}) => {
  // 本地标签页状态
  const [localActiveTab, setLocalActiveTab] = useState<'character' | 'scene' | 'prop'>('character');
  const activeTab = propsActiveTab || localActiveTab;
  
  /**
   * 设置激活的标签页
   */
  const setActiveTab = (tab: 'character' | 'scene' | 'prop') => {
    if (onTabChange) {
      onTabChange(tab);
    }
    setLocalActiveTab(tab);
  };

  // 详情视图状态
  const [selectedCharacterId, setSelectedCharacterId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [selectedPropId, setSelectedPropId] = useState<string | null>(null);
  
  const selectedCharacter = selectedCharacterId ? characters.find(c => c.id === selectedCharacterId) : null;
  const selectedScene = selectedSceneId ? scenes.find(s => s.id === selectedSceneId) : null;
  const selectedProp = selectedPropId ? props.find(p => p.id === selectedPropId) : null;

  /**
   * 监听资源 ID 更新事件
   * 当资源保存到数据库后，ID 会从临时 ID 更新为数据库 ID
   */
  useEffect(() => {
    const handleCharacterIdUpdate = (e: CustomEvent) => {
      const { oldId, newId } = e.detail;
      if (selectedCharacterId === oldId) {
        setSelectedCharacterId(newId);
      }
    };
    
    const handleSceneIdUpdate = (e: CustomEvent) => {
      const { oldId, newId } = e.detail;
      if (selectedSceneId === oldId) {
        setSelectedSceneId(newId);
      }
    };
    
    const handlePropIdUpdate = (e: CustomEvent) => {
      const { oldId, newId } = e.detail;
      if (selectedPropId === oldId) {
        setSelectedPropId(newId);
      }
    };

    window.addEventListener('character-id-updated', handleCharacterIdUpdate as EventListener);
    window.addEventListener('scene-id-updated', handleSceneIdUpdate as EventListener);
    window.addEventListener('prop-id-updated', handlePropIdUpdate as EventListener);

    return () => {
      window.removeEventListener('character-id-updated', handleCharacterIdUpdate as EventListener);
      window.removeEventListener('scene-id-updated', handleSceneIdUpdate as EventListener);
      window.removeEventListener('prop-id-updated', handlePropIdUpdate as EventListener);
    };
  }, [selectedCharacterId, selectedSceneId, selectedPropId]);

  /**
   * 当分镜变化时重置详情视图
   */
  useEffect(() => {
    setSelectedCharacterId(null);
    setSelectedSceneId(null);
    setSelectedPropId(null);
  }, [storyboard?.id]);

  /**
   * 切换标签页时退出详情页
   */
  useEffect(() => {
    setSelectedCharacterId(null);
    setSelectedSceneId(null);
    setSelectedPropId(null);
  }, [activeTab]);

  /**
   * 处理外部资源选择
   * 根据当前标签页选择对应的资源
   */
  useEffect(() => {
    if (selectedResourceId) {
      // Use activeTab to determine which resource type to select
      if (activeTab === 'character' && characters.find(c => c.id === selectedResourceId)) {
        setSelectedCharacterId(selectedResourceId);
        setSelectedSceneId(null);
        setSelectedPropId(null);
      } else if (activeTab === 'scene' && scenes.find(s => s.id === selectedResourceId)) {
        setSelectedSceneId(selectedResourceId);
        setSelectedCharacterId(null);
        setSelectedPropId(null);
      } else if (activeTab === 'prop' && props.find(p => p.id === selectedResourceId)) {
        setSelectedPropId(selectedResourceId);
        setSelectedCharacterId(null);
        setSelectedSceneId(null);
      }
    }
    // 注意：只依赖 selectedResourceId，避免角色/场景/道具状态更新时触发
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedResourceId]);

  /**
   * 切换角色选择状态
   * @param charId - 角色ID
   */
  const handleToggleCharacter = (charId: string) => {
    if (!storyboard || !onUpdateStoryboard) return;
    const currentIds = storyboard.characterIds || [];
    const newIds = currentIds.includes(charId)
      ? currentIds.filter(id => id !== charId)
      : [...currentIds, charId];
    onUpdateStoryboard('characterIds', newIds);
  };

  /**
   * 选择场景
   * @param sceneId - 场景ID
   */
  const handleSelectScene = (sceneId: string) => {
    if (!storyboard || !onUpdateStoryboard) return;
    onUpdateStoryboard('sceneId', sceneId === storyboard.sceneId ? null : sceneId);
  };

  /**
   * 切换物品选择状态
   * @param propId - 物品ID
   */
  const handleToggleProp = (propId: string) => {
    if (!storyboard || !onUpdateStoryboard) return;
    const currentIds = storyboard.propIds || [];
    const newIds = currentIds.includes(propId)
      ? currentIds.filter(id => id !== propId)
      : [...currentIds, propId];
    onUpdateStoryboard('propIds', newIds);
  };

  /**
   * 批量生成功能
   * @param mode - 生成模式：'all' 全部生成，'missing' 只生成缺失的
   */
  const handleBatchGenerate = async (mode: 'all' | 'missing') => {
    if (activeTab === 'character') {
      if (!onGenerateCharacterImage || !onUpdateCharacter) {
        message.error('角色生成功能不可用');
        return;
      }
      
      const targetCharacters = mode === 'all' 
        ? characters 
        : characters.filter(c => !c.imageUrl);
      
      if (targetCharacters.length === 0) {
        message.info('没有需要生成的角色');
        return;
      }
      
      // 先一次性批量设置所有目标角色为生成中状态
      for (const char of targetCharacters) {
        onUpdateCharacter(char.id, 'imageStatus', 'generating');
      }
      
      // 显示一次加载提示
      message.loading({ content: `正在批量生成 ${targetCharacters.length} 个角色...`, key: 'batch-generate', duration: 0 });
      
      // 逐个提交生成任务（静默模式，跳过状态更新）
      let successCount = 0;
      for (const char of targetCharacters) {
        try {
          await onGenerateCharacterImage(char.id, undefined, true, true); // silent = true, skipStateUpdate = true
          successCount++;
          // 添加小延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`生成角色 ${char.name} 失败:`, error);
        }
      }
      
      // 只显示一次成功提示
      message.success({ content: `已提交 ${successCount} 个角色的生成任务`, key: 'batch-generate' });
      
    } else if (activeTab === 'scene') {
      if (!onGenerateSceneImage || !onUpdateScene) {
        message.error('场景生成功能不可用');
        return;
      }
      
      const targetScenes = mode === 'all' 
        ? scenes 
        : scenes.filter(s => !s.imageUrl);
      
      if (targetScenes.length === 0) {
        message.info('没有需要生成的场景');
        return;
      }
      
      // 先一次性批量设置所有目标场景为生成中状态
      for (const scene of targetScenes) {
        onUpdateScene(scene.id, 'status', 'generating');
      }
      
      // 显示一次加载提示
      message.loading({ content: `正在批量生成 ${targetScenes.length} 个场景...`, key: 'batch-generate', duration: 0 });
      
      // 逐个提交生成任务（静默模式，跳过状态更新）
      let successCount = 0;
      for (const scene of targetScenes) {
        try {
          await onGenerateSceneImage(scene.id, undefined, true, true); // silent = true, skipStateUpdate = true
          successCount++;
          // 添加小延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`生成场景 ${scene.name} 失败:`, error);
        }
      }
      
      // 只显示一次成功提示
      message.success({ content: `已提交 ${successCount} 个场景的生成任务`, key: 'batch-generate' });
      
    } else if (activeTab === 'prop') {
      if (!onGeneratePropImage || !onUpdateProp) {
        message.error('物品生成功能不可用');
        return;
      }
      
      const targetProps = mode === 'all' 
        ? props 
        : props.filter(p => !p.imageUrl);
      
      if (targetProps.length === 0) {
        message.info('没有需要生成的物品');
        return;
      }
      
      // 先一次性批量设置所有目标物品为生成中状态
      for (const prop of targetProps) {
        onUpdateProp(prop.id, 'status', 'generating');
      }
      
      // 显示一次加载提示
      message.loading({ content: `正在批量生成 ${targetProps.length} 个物品...`, key: 'batch-generate', duration: 0 });
      
      // 逐个提交生成任务（静默模式，跳过状态更新）
      let successCount = 0;
      for (const prop of targetProps) {
        try {
          await onGeneratePropImage(prop.id, undefined, true, true); // silent = true, skipStateUpdate = true
          successCount++;
          // 添加小延迟避免请求过快
          await new Promise(resolve => setTimeout(resolve, 300));
        } catch (error) {
          console.error(`生成物品 ${prop.name} 失败:`, error);
        }
      }
      
      // 只显示一次成功提示
      message.success({ content: `已提交 ${successCount} 个物品的生成任务`, key: 'batch-generate' });
    }
  };

  /**
   * 计算当前标签页下缺失图片的资源数量
   */
  const getMissingCount = () => {
    if (activeTab === 'character') {
      return characters.filter(c => !c.imageUrl).length;
    } else if (activeTab === 'scene') {
      return scenes.filter(s => !s.imageUrl).length;
    } else if (activeTab === 'prop') {
      return props.filter(p => !p.imageUrl).length;
    }
    return 0;
  };

  /**
   * 获取当前标签页的资源类型名称
   */
  const getResourceTypeName = () => {
    if (activeTab === 'character') return '角色';
    if (activeTab === 'scene') return '场景';
    if (activeTab === 'prop') return '物品';
    return '';
  };

  // 批量生成按钮hover状态
  const [isBatchButtonHovered, setIsBatchButtonHovered] = React.useState(false);

  // 如果没有选中分镜，显示空状态
  if (!storyboard) {
    return (
      <div className="w-full h-full bg-bg-card p-6 flex items-center justify-center text-text-secondary">
        <Empty description="请选择分镜" image={Empty.PRESENTED_IMAGE_SIMPLE} />
      </div>
    );
  }

  /**
   * 显示角色详情面板
   */
  if (selectedCharacter) {
    if (!onUpdateCharacter || !onGenerateCharacterImage) {
      return (
        <div className="w-full h-full bg-bg-card p-6 flex flex-col items-center justify-center text-text-secondary gap-4">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">角色详情</div>
            <div className="text-sm">功能暂不可用</div>
          </div>
          <Button onClick={() => setSelectedCharacterId(null)}>返回</Button>
        </div>
      );
    }

    return (
      <CharacterDetailPanel
        character={selectedCharacter}
        onBack={() => setSelectedCharacterId(null)}
        onUpdateCharacter={(field, value) => onUpdateCharacter(selectedCharacter.id, field, value)}
        onGenerateImage={(model) => onGenerateCharacterImage(selectedCharacter.id, model)}
        projectId={projectId}
      />
    );
  }

  /**
   * 显示场景详情面板
   */
  if (selectedScene) {
    if (!onUpdateScene || !onGenerateSceneImage) {
      return (
        <div className="w-full h-full bg-bg-card p-6 flex flex-col items-center justify-center text-text-secondary gap-4">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">场景详情</div>
            <div className="text-sm">功能暂不可用</div>
          </div>
          <Button onClick={() => setSelectedSceneId(null)}>返回</Button>
        </div>
      );
    }

    return (
      <SceneDetailPanel
        scene={selectedScene}
        onBack={() => setSelectedSceneId(null)}
        onUpdateScene={(field, value) => onUpdateScene(selectedScene.id, field, value)}
        onGenerateImage={(model) => onGenerateSceneImage(selectedScene.id, model)}
        projectId={projectId}
      />
    );
  }

  /**
   * 显示物品详情面板
   */
  if (selectedProp) {
    if (!onUpdateProp || !onGeneratePropImage) {
      return (
        <div className="w-full h-full bg-bg-card p-6 flex flex-col items-center justify-center text-text-secondary gap-4">
          <div className="text-center">
            <div className="text-lg font-medium mb-2">物品详情</div>
            <div className="text-sm">功能暂不可用</div>
          </div>
          <Button onClick={() => setSelectedPropId(null)}>返回</Button>
        </div>
      );
    }

    return (
      <PropDetailPanel
        prop={selectedProp}
        onBack={() => setSelectedPropId(null)}
        onUpdateProp={(field, value) => onUpdateProp(selectedProp.id, field, value)}
        onGenerateImage={(model) => onGeneratePropImage(selectedProp.id, model)}
        projectId={projectId}
      />
    );
  }

  return (
    <div className="w-full h-full bg-bg-card flex flex-col overflow-hidden">
      {/* 固定头部 */}
      <div className="flex-none bg-bg-card z-10 mb-2">
        {/* 标签切换器和批量生成按钮 */}
        <div className="flex items-center justify-between bg-bg-element p-1.5">
          <div className="flex">
            <div
              className={`px-6 py-1.5 text-sm rounded-full cursor-pointer transition-all duration-300 ${
                activeTab === 'character'
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('character')}
            >
              角色
            </div>
            <div
              className={`px-6 py-1.5 text-sm rounded-full cursor-pointer transition-all duration-300 ${
                activeTab === 'scene'
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('scene')}
            >
              场景
            </div>
            <div
              className={`px-6 py-1.5 text-sm rounded-full cursor-pointer transition-all duration-300 ${
                activeTab === 'prop'
                  ? 'bg-bg-card text-text-primary shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
              onClick={() => setActiveTab('prop')}
            >
              物品
            </div>
          </div>
          
          {/* 批量生成按钮 */}
          <div className="pr-1">
            <Dropdown
              dropdownRender={(menu) => (
                <div className="bg-bg-card border border-border bg-bg-element rounded-lg shadow-lg overflow-hidden w-60">
                  {/* Dropdown Header */}
                  <div className="px-4 py-3 border-b border-border ">
                    <div className="flex items-center gap-2">
                      <ThunderboltOutlined className="text-base" style={{ color: 'var(--color-primary)' }} />
                      <span className="font-medium text-white">批量生成{getResourceTypeName()}</span>
                    </div>
                  </div>
                  {/* Menu Items */}
                  <div className="py-1">
                    {menu}
                  </div>
                </div>
              )}
              menu={{
                items: [
                  {
                    key: 'all',
                    label: (
                      <div className="py-1 ">
                        <div className="font-medium mb-1">全部生成</div>
                        <div className="text-xs text-text-secondary">
                          覆盖并重新生成所有素材。
                        </div>
                      </div>
                    ),
                    onClick: () => handleBatchGenerate('all')
                  },
                  {
                    key: 'missing',
                    label: (
                      <div className="py-1">
                        <div className="font-medium mb-1">缺失生成</div>
                        <div className="text-xs text-text-secondary">
                          {getMissingCount() > 0 
                            ? `生成 ${getMissingCount()} 个缺失${getResourceTypeName()}图片。`
                            : '没有缺失的素材可生成。'
                          }
                        </div>
                      </div>
                    ),
                    onClick: () => handleBatchGenerate('missing'),
                    disabled: getMissingCount() === 0
                  }
                ] as MenuProps['items']
              }}
              placement="bottomRight"
              trigger={['click']}
            >
            <Tooltip title={`为所有${getResourceTypeName()}批量生成图片`} placement="top">
              <div 
                className="bg-primary/10 hover:bg-primary/20 flex flex-ac px-3 py-1.5 rounded-full cursor-pointer transition-colors group h-[34px] items-center"
                onMouseEnter={() => setIsBatchButtonHovered(true)}
                onMouseLeave={() => setIsBatchButtonHovered(false)}
              >
                <ThunderboltOutlined 
                  className="text-base transition-colors" 
                  style={{ color: isBatchButtonHovered ? 'white' : 'var(--color-primary)' }} 
                />
                <div 
                  className='ml-2 font-primary transition-colors text-sm'
                  style={{ color: isBatchButtonHovered ? 'white' : 'var(--color-primary)' }}
                >
                  批量生成
                </div>
              </div>
            </Tooltip>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* 可滚动内容区域 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 pt-0">
          {activeTab === 'character' && (
            <div>
              <div className="text-text-secondary text-xs mb-3">
                项目中角色 ({characters.length})
              </div>
              <div className="grid grid-cols-4 gap-2">
                {characters.map((char) => {
                  const isSelected = (storyboard.characterIds || []).includes(char.id);
                  const isGenerating = (char.imageStatus as string) === 'generating';
                  // 计算真实存在的已选角色数量
                  const validSelectedCount = (storyboard.characterIds || []).filter(id => 
                    id && characters.find(c => c.id === id)
                  ).length;
                  return (
                    <div 
                      key={char.id} 
                      className="flex flex-col gap-1 cursor-pointer group/item"
                      onClick={() => setSelectedCharacterId(char.id)}
                    >
                      <div
                        className={`relative aspect-square rounded-lg overflow-hidden group/card transition-all border-2 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent group-hover/item:border-primary/50'
                        }`}
                      >
                        {/* 加载状态遮罩 */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                            <Spin />
                            <span className="text-white text-xs mt-2">生成中...</span>
                          </div>
                        )}
                        
                        {char.imageUrl ? (
                          <CachedImage
                            src={char.imageUrl}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                            {char.name[0]}
                          </div>
                        )}
                        
                        {/* 删除按钮 - 右上角 */}
                        <Tooltip title={`删除角色 ${char.name}`} placement="top">
                          <div
                            className="absolute top-0 right-0 w-5 h-5 bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transform transition-all opacity-0 group-hover/card:opacity-100 cursor-pointer hover:scale-105 z-20 rounded-tr-[5px] rounded-bl-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteCharacter) {
                                onDeleteCharacter(char.id);
                              }
                            }}
                          >
                            <DeleteOutlined className="text-white text-xs" />
                          </div>
                        </Tooltip>
                        
                        {/* Action Button - Bottom Right - hover时显示 */}
                        <Tooltip 
                          title={
                            !isSelected && validSelectedCount >= 4
                              ? `分镜${index + 1} 已满 4个角色`
                              : isSelected 
                                ? `将角色 ${char.name} 从分镜${index + 1}移除` 
                                : `将角色 ${char.name} 添加到分镜${index + 1}`
                          }
                          placement="top"
                        >
                          <div
                            className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transform transition-all opacity-0 group-hover/card:opacity-100 hover:scale-110 z-20 ${
                              !isSelected && validSelectedCount >= 4
                                ? 'bg-gray-400 cursor-not-allowed'
                                : isSelected 
                                  ? 'bg-red-500 hover:bg-red-600 cursor-pointer' 
                                  : 'bg-green-500 hover:bg-green-600 cursor-pointer'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 如果未选中且已达到4个，不执行操作
                              if (!isSelected && validSelectedCount >= 4) {
                                return;
                              }
                              handleToggleCharacter(char.id);
                            }}
                          >
                            {isSelected ? (
                              <MinusOutlined className="text-white text-sm" />
                            ) : (
                              <PlusOutlined className="text-white text-sm" />
                            )}
                          </div>
                        </Tooltip>
                      </div>
                      <div className="text-[10px] text-center truncate text-text-secondary px-1 group-hover/item:text-text-primary transition-colors">
                        {char.name}
                      </div>
                    </div>
                  );
                })}
                
                {/* 创建角色按钮 */}
                {onAddCharacter && (
                  <div
                    onClick={() => {
                      // 异步调用创建函数
                      onAddCharacter().then(newChar => {
                        // 创建完成后自动进入详情页
                        setSelectedCharacterId(newChar.id);
                      });
                    }}
                    className="flex flex-col gap-1 cursor-pointer group/add"
                  >
                    <div className="aspect-square rounded-lg border-2 border-dashed border-border group-hover/add:border-primary group-hover/add:bg-primary/5 flex items-center justify-center transition-all">
                      <div className="w-8 h-8 rounded-full bg-bg-element group-hover/add:bg-primary/20 flex items-center justify-center transition-colors">
                        <PlusOutlined className="text-base text-text-secondary group-hover/add:text-primary transition-colors" />
                      </div>
                    </div>
                    <div className="text-[10px] text-center text-text-secondary group-hover/add:text-primary font-medium transition-colors">创建角色</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'scene' && (
            <div>
              <div className="text-text-secondary text-xs mb-3">
                项目中场景 ({scenes.length})
              </div>
              <div className="grid grid-cols-4 gap-2">
                {scenes.map((scene) => {
                  const isSelected = storyboard.sceneId === scene.id;
                  const isGenerating = scene.status === 'generating';
                  return (
                    <div 
                      key={scene.id} 
                      className="flex flex-col gap-1 cursor-pointer group/item"
                      onClick={() => setSelectedSceneId(scene.id)}
                    >
                      <div
                        className={`relative aspect-square rounded-lg overflow-hidden group/card transition-all border-2 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent group-hover/item:border-primary/50'
                        }`}
                      >
                        {/* 加载状态遮罩 */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                            <Spin />
                            <span className="text-white text-xs mt-2">生成中...</span>
                          </div>
                        )}
                        
                        {scene.imageUrl ? (
                          <CachedImage
                            src={scene.imageUrl}
                            alt={scene.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                            {scene.name[0]}
                          </div>
                        )}
                        
                        {/* 删除按钮 - 右上角 */}
                        <Tooltip title={`删除场景 ${scene.name}`} placement="top">
                          <div
                            className="absolute top-0 right-0 w-5 h-5 bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transform transition-all opacity-0 group-hover/card:opacity-100 cursor-pointer hover:scale-105 z-20 rounded-tr-[5px] rounded-bl-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteScene) {
                                onDeleteScene(scene.id);
                              }
                            }}
                          >
                            <DeleteOutlined className="text-white text-xs" />
                          </div>
                        </Tooltip>
                        
                        {/* Action Button - Bottom Right - hover时显示 */}
                        <Tooltip 
                          title={
                            isSelected 
                              ? `将 ${scene.name} 从分镜${index + 1} 移除`
                              : `将 ${scene.name} 设置为分镜${index + 1} 场景`
                          }
                          placement="top"
                        >
                          <div
                            className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transform transition-all opacity-0 group-hover/card:opacity-100 hover:scale-110 cursor-pointer ${
                              isSelected 
                                ? 'bg-red-500 hover:bg-red-600' 
                                : 'bg-green-500 hover:bg-green-600'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectScene(scene.id);
                            }}
                          >
                            {isSelected ? (
                              <MinusOutlined className="text-white text-sm" />
                            ) : (
                              <PlusOutlined className="text-white text-sm" />
                            )}
                          </div>
                        </Tooltip>
                      </div>
                      <div className="text-[10px] text-center truncate text-text-secondary px-1 group-hover/item:text-text-primary transition-colors">
                        {scene.name}
                      </div>
                    </div>
                  );
                })}
                
                {/* 创建场景按钮 */}
                {onAddScene && (
                  <div
                    onClick={() => {
                      // 异步调用创建函数
                      onAddScene().then(newScene => {
                        // 创建完成后自动进入详情页
                        setSelectedSceneId(newScene.id);
                      });
                    }}
                    className="flex flex-col gap-1 cursor-pointer group/add"
                  >
                    <div className="aspect-square rounded-lg border-2 border-dashed border-border group-hover/add:border-primary group-hover/add:bg-primary/5 flex items-center justify-center transition-all">
                      <div className="w-8 h-8 rounded-full bg-bg-element group-hover/add:bg-primary/20 flex items-center justify-center transition-colors">
                        <PlusOutlined className="text-base text-text-secondary group-hover/add:text-primary transition-colors" />
                      </div>
                    </div>
                    <div className="text-[10px] text-center text-text-secondary group-hover/add:text-primary font-medium transition-colors">创建场景</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'prop' && (
            <div>
              <div className="text-text-secondary text-xs mb-3">
                项目中物品 ({props.length})
              </div>
              <div className="grid grid-cols-4 gap-2">
                {props.map((prop) => {
                  const isSelected = (storyboard.propIds || []).includes(prop.id);
                  const isGenerating = prop.status === 'generating';
                  // 计算真实存在的已选物品数量
                  const validSelectedCount = (storyboard.propIds || []).filter(id => 
                    id && props.find(p => p.id === id)
                  ).length;
                  return (
                    <div 
                      key={prop.id} 
                      className="flex flex-col gap-1 cursor-pointer group/item"
                      onClick={() => setSelectedPropId(prop.id)}
                    >
                      <div
                        className={`relative aspect-square rounded-lg overflow-hidden group/card transition-all border-2 ${
                          isSelected
                            ? 'border-primary ring-2 ring-primary/20'
                            : 'border-transparent group-hover/item:border-primary/50'
                        }`}
                      >
                        {/* 加载状态遮罩 */}
                        {isGenerating && (
                          <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-10">
                            <Spin />
                            <span className="text-white text-xs mt-2">生成中...</span>
                          </div>
                        )}
                        
                        {prop.imageUrl ? (
                          <CachedImage
                            src={prop.imageUrl}
                            alt={prop.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                            {prop.name[0]}
                          </div>
                        )}
                        
                        {/* 删除按钮 - 右上角 */}
                        <Tooltip title={`删除物品 ${prop.name}`} placement="top">
                          <div
                            className="absolute top-0 right-0 w-5 h-5 bg-red-500 hover:bg-red-600 flex items-center justify-center shadow-lg transform transition-all opacity-0 group-hover/card:opacity-100 cursor-pointer hover:scale-105 z-20 rounded-tr-[5px] rounded-bl-lg"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (onDeleteProp) {
                                onDeleteProp(prop.id);
                              }
                            }}
                          >
                            <DeleteOutlined className="text-white text-xs" />
                          </div>
                        </Tooltip>
                        
                        {/* Action Button - Bottom Right - hover时显示 */}
                        <Tooltip 
                          title={
                            !isSelected && validSelectedCount >= 4
                              ? `分镜${index + 1} 已满 4个物品`
                              : isSelected 
                                ? `将物品 ${prop.name} 从分镜${index + 1}移除` 
                                : `将物品 ${prop.name} 添加到分镜${index + 1}`
                          }
                          placement="top"
                        >
                          <div
                            className={`absolute bottom-1 right-1 w-5 h-5 rounded-full flex items-center justify-center shadow-lg transform transition-all opacity-0 group-hover/card:opacity-100 hover:scale-110 z-20 ${
                              !isSelected && validSelectedCount >= 4
                                ? 'bg-gray-400 cursor-not-allowed'
                                : isSelected 
                                  ? 'bg-red-500 hover:bg-red-600 cursor-pointer' 
                                  : 'bg-green-500 hover:bg-green-600 cursor-pointer'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              // 如果未选中且已达到4个，不执行操作
                              if (!isSelected && validSelectedCount >= 4) {
                                return;
                              }
                              handleToggleProp(prop.id);
                            }}
                          >
                            {isSelected ? (
                              <MinusOutlined className="text-white text-sm" />
                            ) : (
                              <PlusOutlined className="text-white text-sm" />
                            )}
                          </div>
                        </Tooltip>
                      </div>
                      <div className="text-[10px] text-center truncate text-text-secondary px-1 group-hover/item:text-text-primary transition-colors">
                        {prop.name}
                      </div>
                    </div>
                  );
                })}
                
                {/* 创建物品按钮 */}
                {onAddProp && (
                  <div
                    onClick={() => {
                      // 异步调用创建函数
                      onAddProp().then(newProp => {
                        // 创建完成后自动进入详情页
                        setSelectedPropId(newProp.id);
                      });
                    }}
                    className="flex flex-col gap-1 cursor-pointer group/add"
                  >
                    <div className="aspect-square rounded-lg border-2 border-dashed border-border group-hover/add:border-primary group-hover/add:bg-primary/5 flex items-center justify-center transition-all">
                      <div className="w-8 h-8 rounded-full bg-bg-element group-hover/add:bg-primary/20 flex items-center justify-center transition-colors">
                        <PlusOutlined className="text-base text-text-secondary group-hover/add:text-primary transition-colors" />
                      </div>
                    </div>
                    <div className="text-[10px] text-center text-text-secondary group-hover/add:text-primary font-medium transition-colors">创建物品</div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
