/**
 * 元素分析弹窗组件
 * 用于AI分析剧本内容，提取角色、场景和物品信息
 * 支持选择性添加分析结果到项目中
 */
import { useState, useImperativeHandle, forwardRef } from 'react';
import { Modal, Button, Checkbox, message, Popover } from 'antd';
import { ExclamationCircleOutlined } from '@ant-design/icons';
import { aiService } from '../services/aiService';
import { projectService } from '../services/projectService';
import { ProgressSteps, type ProgressStep } from './ProgressSteps';
import type { Character, Scene, Prop, StoryboardFrame } from '../types/workflow';

interface AnalyzeElementsModalProps {
  projectId: number;
  episodeId: number;
  existingCharacters: Character[];
  existingScenes: Scene[];
  existingProps: Prop[];
  storyboards: StoryboardFrame[];
  onSuccess: (data: {
    characters: Character[];
    scenes: Scene[];
    props: Prop[];
  }) => void;
}

interface AnalyzedElement {
  name: string;
  description: string;
  exists: boolean;
}

export interface AnalyzeElementsModalRef {
  show: () => void;
}

export const AnalyzeElementsModal = forwardRef<AnalyzeElementsModalRef, AnalyzeElementsModalProps>(({
  projectId,
  episodeId,
  existingCharacters,
  existingScenes,
  existingProps,
  storyboards,
  onSuccess,
}, ref) => {
  const [analyzing, setAnalyzing] = useState(false);
  const [showSelection, setShowSelection] = useState(false);
  const [analyzedData, setAnalyzedData] = useState<{
    characters: AnalyzedElement[];
    scenes: AnalyzedElement[];
    props: AnalyzedElement[];
  } | null>(null);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const [selectedScenes, setSelectedScenes] = useState<string[]>([]);
  const [selectedProps, setSelectedProps] = useState<string[]>([]);
  const [adding, setAdding] = useState(false);
  
  // 编辑状态
  const [editingCharacter, setEditingCharacter] = useState<string | null>(null);
  const [editingScene, setEditingScene] = useState<string | null>(null);
  const [editingProp, setEditingProp] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const [steps, setSteps] = useState<ProgressStep[]>([
    { key: 'characters', label: '分析角色', status: 'pending', progress: 0 },
    { key: 'scenes', label: '分析场景', status: 'pending', progress: 0 },
    { key: 'props', label: '分析物品', status: 'pending', progress: 0 },
  ]);

  /**
   * 更新步骤进度
   * @param key - 步骤标识
   * @param updates - 要更新的属性
   */
  const updateStepProgress = (key: string, updates: Partial<ProgressStep>) => {
    setSteps(prev =>
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
   * 执行AI分析
   * 分析剧本内容，提取角色、场景和物品信息
   */
  const handleAnalyze = async () => {
    try {
      // 拼接当前分集的所有分镜文本作为剧本内容
      const scriptContent = storyboards
        .sort((a, b) => a.order - b.order)
        .map(sb => sb.text)
        .join('\n');

      if (!scriptContent.trim()) {
        message.warning('当前分集没有分镜内容，无法解析');
        return;
      }

      setAnalyzing(true);
      setShowSelection(false);

      // 重置步骤状态
      setSteps([
        { key: 'characters', label: '分析角色', status: 'pending', progress: 0 },
        { key: 'scenes', label: '分析场景', status: 'pending', progress: 0 },
        { key: 'props', label: '分析物品', status: 'pending', progress: 0 },
      ]);

      // 分析角色
      updateStepProgress('characters', { status: 'loading', showWaiting: true });

      let analyzeCompleted = false;
      const analyzePromise = aiService.analyzeElements({
        projectId,
        scriptContent,
        episodeId,
        isAppend: false,
        saveToDb: false,
      }).then((result) => {
        analyzeCompleted = true;
        return result;
      });

      // 角色分析进度动画（10秒）
      await Promise.race([
        animateProgress('characters', 10000, 100),
        analyzePromise.catch(err => { throw err; })
      ]);
      updateStepProgress('characters', { status: 'completed', progress: 100 });

      // 场景分析进度动画（10秒）
      updateStepProgress('scenes', { status: 'loading', showWaiting: true });
      await Promise.race([
        animateProgress('scenes', 10000, 100),
        analyzePromise.catch(err => { throw err; })
      ]);
      updateStepProgress('scenes', { status: 'completed', progress: 100 });

      // 物品分析进度动画（10秒，停在95%等待API）
      updateStepProgress('props', { status: 'loading', showWaiting: true });
      await Promise.race([
        animateProgress('props', 10000, 95),
        analyzePromise.catch(err => { throw err; })
      ]);

      // 如果API还没完成，显示等待状态
      if (!analyzeCompleted) {
        updateStepProgress('props', { showWaiting: true });
        await analyzePromise;
      }

      updateStepProgress('props', { status: 'completed', progress: 100, showWaiting: false });

      const response = await analyzePromise;

      // 处理返回的数据，标记已存在的元素
      const characters: AnalyzedElement[] = (response.characters || response.roles || []).map((c: any) => ({
        name: c.name,
        description: c.description || '',
        exists: existingCharacters.some(ec => ec.name === c.name),
      }));

      const scenes: AnalyzedElement[] = (response.scenes || []).map((s: any) => ({
        name: s.name,
        description: s.description || '',
        exists: existingScenes.some(es => es.name === s.name),
      }));

      const props: AnalyzedElement[] = (response.props || []).map((p: any) => ({
        name: p.name,
        description: p.description || '',
        exists: existingProps.some(ep => ep.name === p.name),
      }));

      setAnalyzedData({ characters, scenes, props });

      // 自动选中不存在的元素
      setSelectedCharacters(characters.filter(c => !c.exists).map(c => c.name));
      setSelectedScenes(scenes.filter(s => !s.exists).map(s => s.name));
      setSelectedProps(props.filter(p => !p.exists).map(p => p.name));

      setShowSelection(true);
    } catch (error: any) {
      console.error('分析失败:', error);
      message.error(`分析失败: ${error.message || '未知错误'}`);
      handleClose();
    } finally {
      setAnalyzing(false);
    }
  };

  /**
   * 确认添加选中的元素
   * 将选中的角色、场景和物品添加到项目中
   */
  const handleConfirmAdd = async () => {
    if (!analyzedData) return;

    try {
      setAdding(true);

      // 添加选中的角色
      const newCharacters: Character[] = analyzedData.characters
        .filter(c => selectedCharacters.includes(c.name) && !c.exists)
        .map(c => ({
          id: Date.now().toString() + Math.random(),
          name: c.name,
          description: c.description,
          imageStatus: 'draft' as const,
          videoStatus: 'draft' as const,
          createStatus: 'idle' as const,
          source: 'ai' as const,
        }));

      if (newCharacters.length > 0) {
        await projectService.saveCharacters(projectId, newCharacters, episodeId);
      }

      // 添加选中的场景
      const newScenes: Scene[] = analyzedData.scenes
        .filter(s => selectedScenes.includes(s.name) && !s.exists)
        .map(s => ({
          id: Date.now().toString() + Math.random(),
          name: s.name,
          description: s.description,
          status: 'idle' as const,
        }));

      if (newScenes.length > 0) {
        await projectService.upsertScenes(projectId, newScenes, episodeId);
      }

      // 添加选中的物品
      const newProps: Prop[] = analyzedData.props
        .filter(p => selectedProps.includes(p.name) && !p.exists)
        .map(p => ({
          id: Date.now().toString() + Math.random(),
          name: p.name,
          description: p.description,
          status: 'idle' as const,
        }));

      if (newProps.length > 0) {
        await projectService.upsertProps(projectId, newProps, episodeId);
      }

      message.success('添加成功');
      onSuccess({ characters: newCharacters, scenes: newScenes, props: newProps });
      handleClose();
    } catch (error: any) {
      console.error('添加失败:', error);
      message.error(`添加失败: ${error.message || '未知错误'}`);
    } finally {
      setAdding(false);
    }
  };

  /**
   * 关闭弹窗并重置状态
   */
  const handleClose = () => {
    setAnalyzing(false);
    setShowSelection(false);
    setAnalyzedData(null);
    setSelectedCharacters([]);
    setSelectedScenes([]);
    setSelectedProps([]);
    setEditingCharacter(null);
    setEditingScene(null);
    setEditingProp(null);
    setEditValue('');
    setSteps([
      { key: 'characters', label: '分析角色', status: 'pending', progress: 0 },
      { key: 'scenes', label: '分析场景', status: 'pending', progress: 0 },
      { key: 'props', label: '分析物品', status: 'pending', progress: 0 },
    ]);
  };

  /**
   * 显示确认对话框
   * 提示用户确认开始AI分析
   */
  const showConfirm = () => {
    Modal.confirm({
      title: '确定要解析角色、场景、物品吗？',
      icon: <ExclamationCircleOutlined />,
      content: 'AI 将分析当前分集的所有分镜内容，提取角色、场景和物品信息',
      okText: '确定',
      cancelText: '取消',
      centered: true,
      onOk: () => {
        // 开始解析（Modal.confirm 会自动关闭）
        handleAnalyze();
      },
    });
  };

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    show: showConfirm,
  }));

  // 如果正在分析，显示进度弹窗
  if (analyzing) {
    return (
      <Modal
        title="AI 正在分析"
        open={true}
        footer={null}
        closable={false}
        maskClosable={false}
        keyboard={false}
        width={600}
        centered
      >
        <ProgressSteps steps={steps} title="AI 正在分析剧本" />
      </Modal>
    );
  }

  // 如果显示选择界面
  if (showSelection && analyzedData) {
    return (
      <Modal
        title="选择要添加的角色、场景和物品"
        open={true}
        onCancel={handleClose}
        width={1200}
        footer={[
          <Button 
            key="cancel" 
            onClick={handleClose}
            size="large"
            className="px-8 h-12 text-base bg-white/5 border-white/10 text-text-secondary hover:bg-white/10 hover:border-white/20 hover:text-text-primary transition-all duration-300 rounded-full"
          >
            取消
          </Button>,
          <Button
            key="confirm"
            type="primary"
            size="large"
            onClick={handleConfirmAdd}
            loading={adding}
            disabled={
              selectedCharacters.length === 0 &&
              selectedScenes.length === 0 &&
              selectedProps.length === 0
            }
            className="px-12 h-12 text-lg bg-gradient-to-r from-primary to-purple-600 border-none hover:shadow-lg hover:shadow-primary/30 transition-all duration-300 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            确认添加 ({selectedCharacters.length + selectedScenes.length + selectedProps.length})
          </Button>,
        ]}
        centered
      >
        <div className="py-2">
          <div className="mb-4 px-1">
            <p className="text-text-secondary text-sm">
              已存在的项目无法选择
            </p>
          </div>

          {/* 三列布局 */}
          <div className="grid grid-cols-3 gap-8">
            {/* 角色列表 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  checked={
                    analyzedData.characters.filter(c => !c.exists).length > 0 &&
                    analyzedData.characters.filter(c => !c.exists).every(c => selectedCharacters.includes(c.name))
                  }
                  indeterminate={
                    selectedCharacters.length > 0 &&
                    selectedCharacters.length < analyzedData.characters.filter(c => !c.exists).length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      // 全选：选中所有未存在的角色
                      const allAvailable = analyzedData.characters
                        .filter(c => !c.exists)
                        .map(c => c.name);
                      setSelectedCharacters(allAvailable);
                    } else {
                      // 取消全选
                      setSelectedCharacters([]);
                    }
                  }}
                  disabled={analyzedData.characters.filter(c => !c.exists).length === 0}
                />
                <h3 className="text-base font-medium text-text-primary">
                  角色 ({analyzedData.characters.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {analyzedData.characters.map((char) => (
                  <div
                    key={char.name}
                    className={`p-3 rounded-lg border transition-all ${
                      char.exists
                        ? 'bg-bg-tertiary border-white/10 opacity-60'
                        : selectedCharacters.includes(char.name)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-bg-secondary border-white/30 hover:border-border-primary'
                    }`}
                  >
                    <Checkbox
                      checked={selectedCharacters.includes(char.name)}
                      disabled={char.exists}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedCharacters([...selectedCharacters, char.name]);
                        } else {
                          setSelectedCharacters(selectedCharacters.filter(n => n !== char.name));
                        }
                      }}
                    >
                      <div className="ml-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingCharacter === char.name ? editValue : char.name}
                              onChange={(e) => {
                                if (!char.exists) {
                                  setEditingCharacter(char.name);
                                  setEditValue(e.target.value);
                                }
                              }}
                              onFocus={() => {
                                if (!char.exists) {
                                  setEditingCharacter(char.name);
                                  setEditValue(char.name);
                                }
                              }}
                              onBlur={() => {
                                if (editingCharacter === char.name && editValue.trim() && editValue !== char.name && analyzedData) {
                                  const updatedChars = analyzedData.characters.map(c =>
                                    c.name === char.name ? { ...c, name: editValue.trim() } : c
                                  );
                                  setAnalyzedData({ ...analyzedData, characters: updatedChars });
                                  if (selectedCharacters.includes(char.name)) {
                                    setSelectedCharacters(selectedCharacters.map(n => 
                                      n === char.name ? editValue.trim() : n
                                    ));
                                  }
                                }
                                setEditingCharacter(null);
                                setEditValue('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingCharacter(null);
                                  setEditValue('');
                                  e.currentTarget.blur();
                                }
                              }}
                              disabled={char.exists}
                              className={`flex-1 px-2 py-1 text-sm font-medium bg-transparent border-0 border-b-2 outline-none transition-all ${
                                char.exists 
                                  ? 'border-transparent cursor-not-allowed' 
                                  : 'border-transparent hover:border-primary/50 focus:border-primary cursor-text'
                              } ${char.exists ? 'text-text-tertiary' : 'text-text-primary'}`}
                            />
                          </div>
                          {char.exists && (
                            <div className="text-xs px-2 py-0.5 rounded bg-white/10 text-white/50 shrink-0">
                              已存在
                            </div>
                          )}
                        </div>
                        {char.description && (
                          <Popover 
                            content={
                              <div className="max-w-xs">
                                【身份】{char.description}
                              </div>
                            }
                            placement="top"
                          >
                            <div className="text-sm text-text-secondary mt-1 line-clamp-2 cursor-pointer">
                              【身份】{char.description}
                            </div>
                          </Popover>
                        )}
                      </div>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </div>

            {/* 场景列表 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  checked={
                    analyzedData.scenes.filter(s => !s.exists).length > 0 &&
                    analyzedData.scenes.filter(s => !s.exists).every(s => selectedScenes.includes(s.name))
                  }
                  indeterminate={
                    selectedScenes.length > 0 &&
                    selectedScenes.length < analyzedData.scenes.filter(s => !s.exists).length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      // 全选：选中所有未存在的场景
                      const allAvailable = analyzedData.scenes
                        .filter(s => !s.exists)
                        .map(s => s.name);
                      setSelectedScenes(allAvailable);
                    } else {
                      // 取消全选
                      setSelectedScenes([]);
                    }
                  }}
                  disabled={analyzedData.scenes.filter(s => !s.exists).length === 0}
                />
                <h3 className="text-base font-medium text-text-primary">
                  场景 ({analyzedData.scenes.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {analyzedData.scenes.map((scene) => (
                  <div
                    key={scene.name}
                    className={`p-3 rounded-lg border transition-all ${
                      scene.exists
                        ? 'bg-bg-tertiary border-white/10 opacity-60'
                        : selectedScenes.includes(scene.name)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-bg-secondary border-white/30 hover:border-border-primary'
                    }`}
                  >
                    <Checkbox
                      checked={selectedScenes.includes(scene.name)}
                      disabled={scene.exists}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedScenes([...selectedScenes, scene.name]);
                        } else {
                          setSelectedScenes(selectedScenes.filter(n => n !== scene.name));
                        }
                      }}
                    >
                      <div className="ml-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingScene === scene.name ? editValue : scene.name}
                              onChange={(e) => {
                                if (!scene.exists) {
                                  setEditingScene(scene.name);
                                  setEditValue(e.target.value);
                                }
                              }}
                              onFocus={() => {
                                if (!scene.exists) {
                                  setEditingScene(scene.name);
                                  setEditValue(scene.name);
                                }
                              }}
                              onBlur={() => {
                                if (editingScene === scene.name && editValue.trim() && editValue !== scene.name && analyzedData) {
                                  const updatedScenes = analyzedData.scenes.map(s =>
                                    s.name === scene.name ? { ...s, name: editValue.trim() } : s
                                  );
                                  setAnalyzedData({ ...analyzedData, scenes: updatedScenes });
                                  if (selectedScenes.includes(scene.name)) {
                                    setSelectedScenes(selectedScenes.map(n => 
                                      n === scene.name ? editValue.trim() : n
                                    ));
                                  }
                                }
                                setEditingScene(null);
                                setEditValue('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingScene(null);
                                  setEditValue('');
                                  e.currentTarget.blur();
                                }
                              }}
                              disabled={scene.exists}
                              className={`flex-1 px-2 py-1 text-sm font-medium bg-transparent border-0 border-b-2 outline-none transition-all ${
                                scene.exists 
                                  ? 'border-transparent cursor-not-allowed' 
                                  : 'border-transparent hover:border-primary/50 focus:border-primary cursor-text'
                              } ${scene.exists ? 'text-text-tertiary' : 'text-text-primary'}`}
                            />
                          </div>
                          {scene.exists && (
                            <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-tertiary shrink-0">
                              已存在
                            </span>
                          )}
                        </div>
                        {scene.description && (
                          <Popover 
                            content={
                              <div className="max-w-xs">
                                【地理环境】{scene.description}
                              </div>
                            }
                            placement="top"
                          >
                            <div className="text-sm text-text-secondary mt-1 line-clamp-2 cursor-pointer">
                              【地理环境】{scene.description}
                            </div>
                          </Popover>
                        )}
                      </div>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </div>

            {/* 物品列表 */}
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-3">
                <Checkbox
                  checked={
                    analyzedData.props.filter(p => !p.exists).length > 0 &&
                    analyzedData.props.filter(p => !p.exists).every(p => selectedProps.includes(p.name))
                  }
                  indeterminate={
                    selectedProps.length > 0 &&
                    selectedProps.length < analyzedData.props.filter(p => !p.exists).length
                  }
                  onChange={(e) => {
                    if (e.target.checked) {
                      // 全选：选中所有未存在的物品
                      const allAvailable = analyzedData.props
                        .filter(p => !p.exists)
                        .map(p => p.name);
                      setSelectedProps(allAvailable);
                    } else {
                      // 取消全选
                      setSelectedProps([]);
                    }
                  }}
                  disabled={analyzedData.props.filter(p => !p.exists).length === 0}
                />
                <h3 className="text-base font-medium text-text-primary">
                  物品 ({analyzedData.props.length})
                </h3>
              </div>
              <div className="space-y-2 max-h-[500px] overflow-y-auto custom-scrollbar pr-2">
                {analyzedData.props.map((prop) => (
                  <div
                    key={prop.name}
                    className={`p-3 rounded-lg border transition-all ${
                      prop.exists
                        ? 'bg-bg-tertiary border-white/10 opacity-60'
                        : selectedProps.includes(prop.name)
                        ? 'bg-primary/10 border-primary'
                        : 'bg-bg-secondary border-white/30 hover:border-border-primary'
                    }`}
                  >
                    <Checkbox
                      checked={selectedProps.includes(prop.name)}
                      disabled={prop.exists}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedProps([...selectedProps, prop.name]);
                        } else {
                          setSelectedProps(selectedProps.filter(n => n !== prop.name));
                        }
                      }}
                    >
                      <div className="ml-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <input
                              type="text"
                              value={editingProp === prop.name ? editValue : prop.name}
                              onChange={(e) => {
                                if (!prop.exists) {
                                  setEditingProp(prop.name);
                                  setEditValue(e.target.value);
                                }
                              }}
                              onFocus={() => {
                                if (!prop.exists) {
                                  setEditingProp(prop.name);
                                  setEditValue(prop.name);
                                }
                              }}
                              onBlur={() => {
                                if (editingProp === prop.name && editValue.trim() && editValue !== prop.name && analyzedData) {
                                  const updatedProps = analyzedData.props.map(p =>
                                    p.name === prop.name ? { ...p, name: editValue.trim() } : p
                                  );
                                  setAnalyzedData({ ...analyzedData, props: updatedProps });
                                  if (selectedProps.includes(prop.name)) {
                                    setSelectedProps(selectedProps.map(n => 
                                      n === prop.name ? editValue.trim() : n
                                    ));
                                  }
                                }
                                setEditingProp(null);
                                setEditValue('');
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur();
                                } else if (e.key === 'Escape') {
                                  setEditingProp(null);
                                  setEditValue('');
                                  e.currentTarget.blur();
                                }
                              }}
                              disabled={prop.exists}
                              className={`flex-1 px-2 py-1 text-sm font-medium bg-transparent border-0 border-b-2 outline-none transition-all ${
                                prop.exists 
                                  ? 'border-transparent cursor-not-allowed' 
                                  : 'border-transparent hover:border-primary/50 focus:border-primary cursor-text'
                              } ${prop.exists ? 'text-text-tertiary' : 'text-text-primary'}`}
                            />
                          </div>
                          {prop.exists && (
                            <span className="text-xs px-2 py-0.5 rounded bg-bg-tertiary text-text-tertiary shrink-0">
                              已存在
                            </span>
                          )}
                        </div>
                        {prop.description && (
                          <Popover 
                            content={
                              <div className="max-w-xs">
                                【名称】{prop.description}
                              </div>
                            }
                            placement="top"
                          >
                            <div className="text-sm text-text-secondary mt-1 line-clamp-2 cursor-pointer">
                              【名称】{prop.description}
                            </div>
                          </Popover>
                        )}
                      </div>
                    </Checkbox>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </Modal>
    );
  }

  // 默认返回 null，通过 showConfirm 触发
  return null;
});

AnalyzeElementsModal.displayName = 'AnalyzeElementsModal';
