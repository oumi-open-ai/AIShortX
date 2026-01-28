/**
 * 追加剧本弹窗组件
 * 支持两种模式：
 * 1. 自动模式：AI解析剧本内容，自动创建角色、场景、物品和分镜
 * 2. 手动模式：按分隔符切割文本，直接导入为分镜
 */
import React, { useState } from 'react';
import { Button, Input, Modal, message, Dropdown } from 'antd';
import { DownOutlined } from '@ant-design/icons';
import { Sparkles } from 'lucide-react';
import { aiService } from '../services/aiService';
import { projectService } from '../services/projectService';
import { ProgressSteps, type ProgressStep } from './ProgressSteps';

const { TextArea } = Input;

interface AppendScriptModalProps {
  visible: boolean;
  onCancel: () => void;
  onSuccess?: () => void | Promise<void>;
  projectId: number;
  episodeId: number;
}

export const AppendScriptModal: React.FC<AppendScriptModalProps> = ({
  visible,
  onCancel,
  onSuccess,
  projectId,
  episodeId
}) => {
  const [processing, setProcessing] = useState(false);
  const [scriptContent, setScriptContent] = useState('');
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [separator, setSeparator] = useState<'empty-line' | 'period' | 'semicolon'>('empty-line');

  /**
   * 更新步骤进度
   * @param key - 步骤标识
   * @param updates - 要更新的属性
   */
  const updateStepProgress = (key: string, updates: Partial<ProgressStep>) => {
    setProgressSteps(prev =>
      prev.map(step => step.key === key ? { ...step, ...updates } : step)
    );
  };

  /**
   * 动画显示进度条
   * @param key - 步骤标识
   * @param duration - 动画持续时间（毫秒）
   * @param stopAt - 停止的进度值（0-100）
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
   * 处理追加剧本
   * 根据模式选择自动解析或手动导入
   */
  const handleAppend = async () => {
    if (!scriptContent.trim()) {
      message.warning('请输入剧本内容');
      return;
    }

    setProcessing(true);

    try {
      if (mode === 'manual') {
        // 手动模式：按分隔符切割并导入
        await handleManualImport();
      } else {
        // 自动模式：原有的AI解析逻辑
        await handleAutoAnalyze();
      }
    } catch (error) {
      console.error('Append script failed:', error);
      message.error(mode === 'manual' ? '导入分镜失败' : '追加剧本失败');
    } finally {
      setProcessing(false);
    }
  };

  /**
   * 手动导入模式
   * 按分隔符切割文本并直接创建分镜
   */
  const handleManualImport = async () => {
    // 根据分隔符切割文本
    let storyboardTexts: string[] = [];
    
    if (separator === 'empty-line') {
      // 按空行切割
      storyboardTexts = scriptContent
        .split(/\n\s*\n/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else if (separator === 'period') {
      // 按句号切割
      storyboardTexts = scriptContent
        .split(/[。]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    } else if (separator === 'semicolon') {
      // 按分号切割
      storyboardTexts = scriptContent
        .split(/[；;]/)
        .map(s => s.trim())
        .filter(s => s.length > 0);
    }

    if (storyboardTexts.length === 0) {
      message.warning('未检测到有效的分镜内容');
      return;
    }

    // 获取当前最大的order值
    const existingStoryboards = await projectService.getStoryboardsByProjectId(projectId);
    const maxOrder = existingStoryboards
      .filter(s => s.episodeId === episodeId)
      .reduce((max, s) => Math.max(max, s.order || 0), 0);

    // 批量创建分镜
    const newStoryboards = storyboardTexts.map((text, index) => ({
      text,
      order: maxOrder + index + 1,
      episodeId,
      characterIds: [],
      propIds: [],
      sceneId: null,
      duration: 5,
      imageStatus: 'idle' as const
    }));

    try {
      await projectService.saveStoryboards(projectId, newStoryboards, episodeId);
      
      // 清理状态
      setScriptContent('');
      
      // 提示成功
      // message.success(`成功添加 ${storyboardTexts.length} 个分镜`);
      
      // 调用成功回调
      if (onSuccess) {
        await onSuccess();
      }
    } catch (error) {
      console.error('Failed to create storyboards:', error);
      throw error;
    }
  };

  /**
   * 自动解析模式
   * AI分析剧本内容，自动创建角色、场景、物品和分镜
   */
  const handleAutoAnalyze = async () => {
    const allSteps: ProgressStep[] = [
      { key: 'character', label: '分析角色', status: 'pending', progress: 0 },
      { key: 'scene', label: '分析场景', status: 'pending', progress: 0 },
      { key: 'prop', label: '分析物品', status: 'pending', progress: 0 },
      { key: 'script', label: '分析剧本', status: 'pending', progress: 0 },
      { key: 'storyboard', label: '规划分镜', status: 'pending', progress: 0 },
    ];

    setProgressSteps(allSteps);
      // 分析角色、场景、物品
      updateStepProgress('character', { status: 'loading' });

      let analyzeElementsCompleted = false;
      const analyzeElementsPromise = aiService.analyzeElements({
        projectId,
        scriptContent,
        episodeId,
        isAppend: true // 标记为追加模式，启用重复检查
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

      // 分析剧本和分镜
      updateStepProgress('script', { status: 'loading' });

      let analyzeStoryboardsCompleted = false;
      const analyzeStoryboardsPromise = aiService.analyzeStoryboards({
        projectId,
        scriptContent,
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
      setScriptContent('');
      setProgressSteps([]);
      
      // 调用成功回调，由父组件处理刷新和提示
      if (onSuccess) {
        await onSuccess();
      }
  };

  /**
   * 取消操作并重置状态
   */
  const handleCancel = () => {
    if (processing) return;
    setScriptContent('');
    setProgressSteps([]);
    setMode('auto');
    setSeparator('empty-line');
    onCancel();
  };

  /**
   * 获取分隔符的显示标签
   */
  const getSeparatorLabel = () => {
    switch (separator) {
      case 'empty-line':
        return '空行';
      case 'period':
        return '句号';
      case 'semicolon':
        return '分号';
      default:
        return '空行';
    }
  };

  /**
   * 计算预计生成的分镜数量
   * 仅在手动模式下有效
   */
  const getEstimatedStoryboardCount = () => {
    if (!scriptContent.trim() || mode !== 'manual') return 0;
    
    let count = 0;
    if (separator === 'empty-line') {
      count = scriptContent
        .split(/\n\s*\n/)
        .filter(s => s.trim().length > 0).length;
    } else if (separator === 'period') {
      count = scriptContent
        .split(/[。]/)
        .filter(s => s.trim().length > 0).length;
    } else if (separator === 'semicolon') {
      count = scriptContent
        .split(/[；;]/)
        .filter(s => s.trim().length > 0).length;
    }
    return count;
  };

  const separatorMenu = {
    items: [
      {
        key: 'empty-line',
        label: '空行',
        onClick: () => setSeparator('empty-line')
      },
      {
        key: 'period',
        label: '句号',
        onClick: () => setSeparator('period')
      },
      {
        key: 'semicolon',
        label: '分号',
        onClick: () => setSeparator('semicolon')
      }
    ]
  };

  const renderTextAreaWithHighlight = () => {
    if (mode !== 'manual' || !scriptContent) {
      return (
        <TextArea
          className="!h-full !resize-none !bg-bg-element/50 !border-border/50 hover:!border-primary/50 focus:!border-primary !text-text-primary !text-base !leading-relaxed !p-4 !rounded-xl custom-scrollbar"
          placeholder={mode === 'manual' ? '在此处输入或粘贴剧本内容，每个分镜之间使用分隔符切割...' : '在此处输入或粘贴新的剧本内容...'}
          value={scriptContent}
          onChange={e => setScriptContent(e.target.value)}
          style={{ height: '100%' }}
        />
      );
    }

    // 手动模式下的文本输入
    return (
      <div className="relative h-full">
        <TextArea
          className="!h-full !resize-none !bg-bg-element/50 !border-border/50 hover:!border-primary/50 focus:!border-primary !text-text-primary !text-base !leading-relaxed !p-4 !rounded-xl custom-scrollbar"
          placeholder="在此处输入或粘贴剧本内容，每个分镜之间使用分隔符切割..."
          value={scriptContent}
          onChange={e => setScriptContent(e.target.value)}
          style={{ height: '100%' }}
        />
      </div>
    );
  };

  return (
    <Modal
      title={
        <div className="flex items-center justify-between w-full pr-6">
          <span className="text-xl font-bold">追加剧本</span>
          {!processing && (
            <div className="absolute left-1/2 transform -translate-x-1/2 flex bg-bg-element/50 p-1 rounded-full border border-border/30">
              <div
                className={`px-4 py-1 text-sm rounded-full cursor-pointer transition-all duration-300 ${
                  mode === 'auto'
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`}
                onClick={() => setMode('auto')}
              >
                自动
              </div>
              <div
                className={`px-4 py-1 text-sm rounded-full cursor-pointer transition-all duration-300 ${
                  mode === 'manual'
                    ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                    : 'text-text-secondary hover:bg-white/5 hover:text-text-primary'
                }`}
                onClick={() => setMode('manual')}
              >
                手动
              </div>
            </div>
          )}
        </div>
      }
      open={visible}
      closable={!processing}
      maskClosable={!processing}
      keyboard={!processing}
      onCancel={handleCancel}
      footer={null}
      width={800}
      destroyOnClose
    >
      {processing && mode === 'auto' ? (
        <ProgressSteps 
          steps={progressSteps} 
          title="AI 正在解析剧本"
        />
      ) : (
        <div className="flex flex-col h-[550px]">
          <div className="mb-6 mt-5">
            <div className="flex items-center justify-between">
              <p className="text-text-secondary text-sm">
                {mode === 'manual' 
                  ? '导入剧本，每个分镜之间使用分隔符切割。'
                  : '在此处粘贴新的剧本内容，系统将解析内容，创建新的角色和场景物品（如果它们尚不存在），并将新的分镜追加到当前剧本的末尾。'
                }
              </p>
              {mode === 'manual' && (
                <Dropdown menu={separatorMenu} trigger={['hover', 'click']}>
                  <Button 
                    size="small"
                    className="ml-4 flex items-center gap-1"
                  >
                    分隔符: {getSeparatorLabel()} <DownOutlined />
                  </Button>
                </Dropdown>
              )}
            </div>
          </div>

          <div className="flex-1 min-h-0 flex flex-col">
            <div className="flex-1 relative">
              {renderTextAreaWithHighlight()}
              <div className="absolute bottom-4 right-4 text-xs text-text-secondary/50 pointer-events-none">
                {scriptContent.length} 字
              </div>
            </div>
          </div>

          <div className="flex justify-end items-center mt-3 gap-3">
            {mode === 'manual' && scriptContent.trim() && (
              <div className="mr-auto text-sm text-text-secondary">
                预计导入 <span className="text-primary font-semibold">{getEstimatedStoryboardCount()}</span> 个分镜
              </div>
            )}
            <Button
              size="large"
              onClick={handleCancel}
              className="px-8 h-12 text-base bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:border-white/20 hover:text-text-primary transition-all duration-300 rounded-full"
            >
              取消
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleAppend}
              loading={processing}
              disabled={!scriptContent.trim()}
              icon={mode === 'auto' ? <Sparkles size={18} /> : undefined}
              className="px-12 h-12 text-lg bg-gradient-to-r from-primary to-purple-600 border-none hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {mode === 'manual' ? '导入' : '解析剧本'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
