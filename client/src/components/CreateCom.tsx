/**
 * 创建项目/剧集组件
 * 支持两种模式：
 * 1. 创建项目：包含项目名称、剧本、视频比例和风格选择
 * 2. 创建剧集：仅包含剧集名称和剧本
 * 支持AI自动解析或跳过解析
 */
import React, { useState, useEffect } from 'react';
import { Button, Input, Modal, message, Tag } from 'antd';
import {
  RocketOutlined,
  EditOutlined,
  FileTextOutlined,
  DesktopOutlined,
  PictureOutlined,
  PlusOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { projectService } from '../services/projectService';
import { aiService } from '../services/aiService';
import { styleService } from '../services/styleService';
import type { Style } from '../types';
import { AIModelConfig } from './AIModelConfig';
import { CachedImage } from './CachedImage';
import { ProgressSteps, type ProgressStep } from './ProgressSteps';
import { StyleFormModal } from './StyleFormModal';

const { TextArea } = Input;

type CreateType = 'project' | 'episode';

interface CreateComProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: (result: any) => void;
  type?: CreateType;
  projectId?: number;
}

export const CreateCom: React.FC<CreateComProps> = ({
  visible,
  onCancel,
  onSuccess,
  type = 'project',
  projectId
}) => {
  const [creating, setCreating] = useState(false);
  const [formScript, setFormScript] = useState('');
  const [formName, setFormName] = useState('');
  const [formAspectRatio, setFormAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [formStyleId, setFormStyleId] = useState<number>(1);
  const [styles, setStyles] = useState<Style[]>([]);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);

  // Add Style State
  const [addStyleModalVisible, setAddStyleModalVisible] = useState(false);
  const [editingStyle, setEditingStyle] = useState<Style | null>(null);

  const isProject = type === 'project';
  const isEpisode = type === 'episode';

  useEffect(() => {
    if (visible && isProject) {
      loadStyles();
    }
  }, [visible, isProject]);

  /**
   * 加载风格列表
   */
  const loadStyles = async () => {
    try {
      const data = await styleService.getStyles();
      setStyles(data || []);
      if (data && data.length > 0 && !formStyleId) {
        setFormStyleId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load styles:', error);
    }
  };

  /**
   * 打开添加风格弹窗
   */
  const handleOpenAddStyle = () => {
    setEditingStyle(null);
    setAddStyleModalVisible(true);
  };

  /**
   * 打开编辑风格弹窗
   * @param style 要编辑的风格对象
   */
  const handleEditStyle = (style: Style) => {
    setEditingStyle(style);
    setAddStyleModalVisible(true);
  };

  /**
   * 删除风格
   * @param style 要删除的风格对象
   */
  const handleDeleteStyle = (style: Style) => {
    Modal.confirm({
      title: '确认删除',
      content: `确定要删除风格"${style.name}"吗？此操作无法恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await styleService.deleteStyle(style.id);
          message.success('删除成功');
          // 如果删除的是当前选中的风格，切换到默认风格
          if (formStyleId === style.id) {
            setFormStyleId(1);
          }
          const updatedStyles = await styleService.getStyles();
          setStyles(updatedStyles);
        } catch (error: any) {
          console.error('Failed to delete style:', error);
          message.error(error.response?.data?.message || '删除失败');
        }
      }
    });
  };

  /**
   * 保存风格成功回调
   */
  const handleStyleSuccess = async (style: Style) => {
    if (editingStyle) {
      message.success('风格更新成功');
    } else {
      message.success('风格添加成功');
      setFormStyleId(style.id);
    }
    
    setAddStyleModalVisible(false);
    setEditingStyle(null);
    
    // 刷新风格列表
    const updatedStyles = await styleService.getStyles();
    setStyles(updatedStyles);
  };

  /**
   * 取消风格编辑
   */
  const handleStyleCancel = () => {
    setAddStyleModalVisible(false);
    setEditingStyle(null);
  };

  /**
   * 更新进度步骤状态
   * @param key 步骤的唯一标识
   * @param updates 要更新的字段
   */
  const updateStepProgress = (key: string, updates: Partial<ProgressStep>) => {
    setProgressSteps(prev =>
      prev.map(step => step.key === key ? { ...step, ...updates } : step)
    );
  };

  /**
   * 动画显示进度条
   * @param key 步骤的唯一标识
   * @param duration 动画持续时间（毫秒）
   * @param stopAt 停止的进度值（0-100）
   * @returns Promise，在动画完成时 resolve
   */
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

  /**
   * 创建项目或剧集
   * @param skipAnalysis 是否跳过 AI 分析
   */
  const handleCreate = async (skipAnalysis = false) => {
    if (!formName.trim()) {
      message.warning(isProject ? '请输入项目名称' : '请输入剧集名称');
      return;
    }
    if (!formScript.trim()) {
      message.warning('请输入剧本内容');
      return;
    }

    if (isEpisode && !projectId) {
      message.error('缺少项目ID');
      return;
    }

    setCreating(true);

    const allSteps: ProgressStep[] = [
      { key: 'character', label: '分析角色', status: 'pending', progress: 0 },
      { key: 'scene', label: '分析场景', status: 'pending', progress: 0 },
      { key: 'prop', label: '分析物品', status: 'pending', progress: 0 },
      { key: 'script', label: '分析剧本', status: 'pending', progress: 0 },
      { key: 'storyboard', label: '规划分镜', status: 'pending', progress: 0 },
    ];

    if (skipAnalysis) {
      setProgressSteps([]);
    } else {
      setProgressSteps(allSteps);
    }

    try {
      let resultProjectId: number;
      let episodeId: number;

      if (isProject) {
        // 创建项目
        const { id, firstEpisodeId } = await projectService.createProject({
          script: formScript,
          aspectRatio: formAspectRatio,
          styleId: formStyleId,
          name: formName
        });
        resultProjectId = id;
        episodeId = firstEpisodeId || 0;
        
        if (!episodeId) {
          throw new Error('创建项目失败：未返回剧集ID');
        }
      } else {
        // 创建剧集
        if (!projectId) {
          throw new Error('缺少项目ID');
        }
        
        const result = await projectService.createEpisode(projectId, {
          name: formName,
          script: formScript
        });
        
        resultProjectId = projectId;
        episodeId = result.id;
      }

      if (!skipAnalysis) {
        // 分析角色、场景、物品
        updateStepProgress('character', { status: 'loading' });

        let analyzeElementsCompleted = false;
        let analyzeElementsFailed = false;
        // 调用 AI 分析元素接口（角色、场景、物品）
        const analyzeElementsPromise = aiService.analyzeElements({
          projectId: resultProjectId,
          scriptContent: formScript,
          episodeId
        }).then((result) => {
          analyzeElementsCompleted = true;
          return result;
        }).catch((err) => {
          analyzeElementsFailed = true;
          console.error('analyzeElements failed:', err);
          message.warning('角色/场景/物品分析失败');
          return null;
        });

        await Promise.race([
          animateProgress('character', 15000, 100),
          analyzeElementsPromise
        ]);
        updateStepProgress('character', { 
          status: analyzeElementsFailed ? 'error' : 'completed', 
          progress: 100 
        });

        // 步骤 3: 分析场景
        updateStepProgress('scene', { status: 'loading' });
        await Promise.race([
          animateProgress('scene', 15000, 100),
          analyzeElementsPromise
        ]);
        updateStepProgress('scene', { 
          status: analyzeElementsFailed ? 'error' : 'completed', 
          progress: 100 
        });

        // 步骤 4: 分析物品
        updateStepProgress('prop', { status: 'loading' });
        await Promise.race([
          animateProgress('prop', 15000, 95),
          analyzeElementsPromise
        ]);

        // 如果接口还没完成，显示等待提示并等待
        if (!analyzeElementsCompleted && !analyzeElementsFailed) {
          updateStepProgress('prop', { showWaiting: true });
          await analyzeElementsPromise;
        }

        // 完成物品分析步骤
        updateStepProgress('prop', { 
          status: analyzeElementsFailed ? 'error' : 'completed', 
          progress: 100, 
          showWaiting: false 
        });

        // 步骤 5-6: 分析剧本和分镜
        updateStepProgress('script', { status: 'loading' });

        let analyzeStoryboardsCompleted = false;
        let analyzeStoryboardsFailed = false;
        // 调用 AI 分析分镜接口
        const analyzeStoryboardsPromise = aiService.analyzeStoryboards({
          projectId: resultProjectId,
          scriptContent: formScript,
          episodeId
        }).then((result) => {
          analyzeStoryboardsCompleted = true;
          return result;
        }).catch((err) => {
          analyzeStoryboardsFailed = true;
          console.error('analyzeStoryboards failed:', err);
          message.warning('分镜分析失败');
          return null;
        });

        await Promise.race([
          animateProgress('script', 15000, 100),
          analyzeStoryboardsPromise
        ]);
        updateStepProgress('script', { 
          status: analyzeStoryboardsFailed ? 'error' : 'completed', 
          progress: 100 
        });

        // 步骤 6: 规划分镜
        updateStepProgress('storyboard', { status: 'loading' });
        await Promise.race([
          animateProgress('storyboard', 15000, 95),
          analyzeStoryboardsPromise
        ]);

        // 如果接口还没完成，显示等待提示并等待
        if (!analyzeStoryboardsCompleted && !analyzeStoryboardsFailed) {
          updateStepProgress('storyboard', { showWaiting: true });
          await analyzeStoryboardsPromise;
        }

        // 完成分镜规划步骤
        updateStepProgress('storyboard', { 
          status: analyzeStoryboardsFailed ? 'error' : 'completed', 
          progress: 100, 
          showWaiting: false 
        });
      }

      message.success(isProject ? '项目已创建' : '剧集已创建');
      setFormScript('');
      setFormName('');
      setProgressSteps([]);
      
      if (onSuccess) {
        onSuccess(isProject ? { projectId: resultProjectId } : { episodeId });
      }
    } catch (error) {
      console.error('Create failed:', error);
      message.error(isProject ? 'AI 创建项目失败' : 'AI 创建剧集失败');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = () => {
    if (creating) return;
    setFormScript('');
    setFormName('');
    setProgressSteps([]);
    onCancel();
  };

  return (
    <Modal
      title={null}
      open={visible}
      closable={!creating}
      maskClosable={!creating}
      keyboard={!creating}
      onCancel={handleCancel}
      footer={null}
      width={isProject ? 900 : 600}
      destroyOnClose
    >
      {creating ? (
        <ProgressSteps 
          steps={progressSteps} 
          title={`AI 正在${isProject ? '创建项目' : '创建剧集'}`}
        />
      ) : (
        <div className="flex flex-col h-[550px] pt-5">
          <div className="flex-1 min-h-0">
            {isProject ? (
              <div className="grid grid-cols-12 gap-6 h-full">
                {/* Left Column: Script Content */}
                <div className="col-span-7 flex flex-col h-full gap-4">
                  <div>
                    <div className="mb-2 text-base font-bold text-text-primary flex items-center gap-2">
                      <EditOutlined />
                      项目名称
                      <span className="text-red-500 text-sm font-normal">*</span>
                    </div>
                    <Input
                      className="!bg-bg-element/50 !border-border/50 hover:!border-primary/50 focus:!border-primary !text-text-primary !text-base !py-2 !px-4 !rounded-xl"
                      placeholder="请输入项目名称"
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      maxLength={50}
                    />
                  </div>

                  <div className="flex flex-col flex-1 min-h-0">
                    <div className="mb-2 text-base font-bold text-text-primary flex items-center gap-2">
                      <FileTextOutlined />
                      剧本内容
                      <span className="text-red-500 text-sm font-normal">*</span>
                    </div>
                    <div className="flex-1 relative">
                      <TextArea
                        className="!h-full !resize-none !bg-bg-element/50 !border-border/50 hover:!border-primary/50 focus:!border-primary !text-text-primary !text-base !leading-relaxed !p-4 !rounded-xl custom-scrollbar"
                        placeholder="请输入或粘贴你的短剧/漫剧剧本，AI 将自动解析并生成角色、场景和分镜..."
                        value={formScript}
                        onChange={e => setFormScript(e.target.value)}
                        style={{ height: '100%' }}
                      />
                      <div className="absolute bottom-4 right-4 text-xs text-text-secondary/50 pointer-events-none">
                        {formScript.length} 字
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Settings */}
                <div className="col-span-5 flex flex-col h-full overflow-hidden">
                  {/* Aspect Ratio */}
                  <div className="mb-6 shrink-0">
                    <div className="mb-3 text-base font-bold text-text-primary flex items-center gap-2">
                      <DesktopOutlined />
                      视频比例
                    </div>
                    <div className="bg-bg-element/50 p-1.5 rounded-xl flex gap-2 border border-border/50">
                      <div
                        className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg cursor-pointer transition-all duration-300 ${formAspectRatio === '16:9' ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                        onClick={() => setFormAspectRatio('16:9')}
                      >
                        <div className={`border-2 rounded w-8 h-5 mb-1.5 transition-colors ${formAspectRatio === '16:9' ? 'border-primary' : 'border-current'}`}></div>
                        <span className="font-medium text-sm">16:9 横屏</span>
                      </div>

                      <div
                        className={`flex-1 flex flex-col items-center justify-center py-3 rounded-lg cursor-pointer transition-all duration-300 ${formAspectRatio === '9:16' ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20' : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'}`}
                        onClick={() => setFormAspectRatio('9:16')}
                      >
                        <div className={`border-2 rounded w-5 h-8 mb-1.5 transition-colors ${formAspectRatio === '9:16' ? 'border-primary' : 'border-current'}`}></div>
                        <span className="font-medium text-sm">9:16 竖屏</span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Style */}
                  <div className="flex-1 flex flex-col min-h-0">
                    <div className="mb-3 flex items-center justify-between">
                      <div className="text-base font-bold text-text-primary flex items-center gap-2">
                        <PictureOutlined />
                        视频风格
                      </div>
                      <Button 
                        type="link" 
                        size="small" 
                        icon={<PlusOutlined />} 
                        className="text-primary hover:text-primary-light p-0 flex items-center"
                        onClick={handleOpenAddStyle}
                      >
                        新增
                      </Button>
                    </div>
                    <div className="flex-1 overflow-y-auto pr-1 custom-scrollbar -mr-2 pt-1 pl-1">
                      <div className="grid grid-cols-3 gap-3 pb-2 pr-2">
                        {styles.map(style => (
                          <div
                            key={style.id}
                            className="relative cursor-pointer group flex flex-col gap-2 transition-all duration-300"
                            onClick={() => setFormStyleId(style.id)}
                          >
                            <div className={`aspect-[3/4] relative overflow-hidden rounded-xl transition-all duration-300 ${formStyleId === style.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#1f1f1f] shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                              {style.imageUrl ? (
                                <CachedImage src={style.imageUrl} alt={style.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-white/5 text-text-secondary">
                                  <PictureOutlined className="text-2xl opacity-50" />
                                </div>
                              )}

                              {formStyleId === style.id && (
                                <div className="absolute inset-0 bg-primary/10 flex items-center justify-center animate-fade-in">
                                  <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg scale-100 animate-bounce-short">
                                    <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                      <polyline points="20 6 9 17 4 12"></polyline>
                                    </svg>
                                  </div>
                                </div>
                              )}

                              {/* "我的" Label and Edit/Delete Controls (Only for user styles) */}
                              {style.userId !== 0 && (
                                <>
                                  <div className="absolute top-1 left-1 z-10">
                        <Tag color="cyan" className="mr-0 scale-75 origin-top-left shadow-md border-none font-bold">我的</Tag>
                      </div>
                                  <div className="absolute top-2 right-2 flex gap-1 z-20 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button 
                                      type="text" 
                                      size="small" 
                                      icon={<EditOutlined className="text-xs" />} 
                                      className="bg-black/60 text-white hover:text-primary hover:bg-black/80 rounded-full w-6 h-6 min-w-0 flex items-center justify-center border-none p-0 backdrop-blur-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleEditStyle(style);
                                      }}
                                    />
                                    <Button 
                                      type="text" 
                                      size="small" 
                                      icon={<DeleteOutlined className="text-xs" />} 
                                      className="bg-black/60 text-white hover:text-red-500 hover:bg-black/80 rounded-full w-6 h-6 min-w-0 flex items-center justify-center border-none p-0 backdrop-blur-sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDeleteStyle(style);
                                      }}
                                    />
                                  </div>
                                </>
                              )}
                            </div>

                            <div className={`text-center text-xs transition-colors px-1 truncate ${formStyleId === style.id ? 'text-primary font-bold' : 'text-text-secondary group-hover:text-text-primary'}`}>
                              {style.name}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // Episode Mode - Only Script
              <div className="flex flex-col h-full gap-4">
                <div>
                  <div className="mb-2 text-base font-bold text-text-primary flex items-center gap-2">
                    <EditOutlined />
                    剧集名称
                    <span className="text-red-500 text-sm font-normal">*</span>
                  </div>
                  <Input
                    className="!bg-bg-element/50 !border-border/50 hover:!border-primary/50 focus:!border-primary !text-text-primary !text-base !py-2 !px-4 !rounded-xl"
                    placeholder="请输入剧集名称"
                    value={formName}
                    onChange={e => setFormName(e.target.value)}
                    maxLength={50}
                  />
                </div>

                <div className="flex flex-col flex-1 min-h-0">
                  <div className="mb-2 text-base font-bold text-text-primary flex items-center gap-2">
                    <FileTextOutlined />
                    剧本内容
                    <span className="text-red-500 text-sm font-normal">*</span>
                  </div>
                  <div className="flex-1 relative">
                    <TextArea
                      className="!h-full !resize-none !bg-bg-element/50 !border-border/50 hover:!border-primary/50 focus:!border-primary !text-text-primary !text-base !leading-relaxed !p-4 !rounded-xl custom-scrollbar"
                      placeholder="请输入或粘贴剧本内容，AI 将自动解析并生成角色、场景和分镜..."
                      value={formScript}
                      onChange={e => setFormScript(e.target.value)}
                      style={{ height: '100%' }}
                    />
                    <div className="absolute bottom-4 right-4 text-xs text-text-secondary/50 pointer-events-none">
                      {formScript.length} 字
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-between items-center mt-6">
            <AIModelConfig placement="top" variant="icon-only" />
            <div className="flex gap-3">
              <Button
                size="large"
                onClick={() => handleCreate(true)}
                loading={creating}
                className="px-8 h-12 text-base bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:border-white/20 hover:text-text-primary transition-all duration-300 rounded-full"
              >
                跳过解析
              </Button>
              <Button
                type="primary"
                size="large"
                onClick={() => handleCreate(false)}
                icon={<RocketOutlined />}
                loading={creating}
                className="px-12 h-12 text-lg bg-gradient-to-r from-primary to-purple-600 border-none hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 rounded-full"
              >
                {isEpisode?'解析剧本':'开始创作'}
              </Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Add Style Modal */}
      <StyleFormModal
        visible={addStyleModalVisible}
        editingStyle={editingStyle}
        onCancel={handleStyleCancel}
        onSuccess={handleStyleSuccess}
      />
    </Modal>
  );
};
