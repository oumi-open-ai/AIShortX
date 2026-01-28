/**
 * 提示词设置组件
 * 用于管理和编辑AI提示词配置
 */
import React, { useState, useEffect, useRef } from 'react';
import { Switch, Button, Modal, message, Spin, Select } from 'antd';
import { EditOutlined } from '@ant-design/icons';
import { promptService, type PromptConfig, type PromptVariable } from '../services/promptService';

/**
 * 高亮编辑器组件
 * 支持变量高亮显示和智能插入
 */
const HighlightEditor = React.forwardRef<
  { insertVariable: (variable: string) => void },
  {
    value: string;
    onChange: (value: string) => void;
    variables?: PromptVariable[];
  }
>(({ value, onChange, variables: _variables = [] }, ref) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);

  /**
   * 暴露插入变量方法给父组件
   */
  React.useImperativeHandle(ref, () => ({
    insertVariable: (variable: string) => {
      const textarea = textareaRef.current;
      if (!textarea) return;

      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = value.substring(0, start);
      const after = value.substring(end);
      const variableText = `{{${variable}}}`;
      
      const newValue = before + variableText + after;
      onChange(newValue);
      
      // 设置光标位置到插入变量之后
      setTimeout(() => {
        const newPosition = start + variableText.length;
        textarea.setSelectionRange(newPosition, newPosition);
        textarea.focus();
      }, 0);
    }
  }));

  /**
   * 同步编辑器和高亮层的滚动位置
   */
  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
      highlightRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  /**
   * 调整光标位置，避免光标停留在变量内部
   */
  const adjustCursorPosition = (position: number) => {
    const textarea = textareaRef.current;
    if (!textarea) return position;

    // 找到所有变量的位置
    const regex = /\{\{[^}]+\}\}/g;
    let match;
    
    while ((match = regex.exec(value)) !== null) {
      const varStart = match.index;
      const varEnd = match.index + match[0].length;
      
      // 如果光标在变量内部（不包括起始位置，包括结束位置）
      if (position > varStart && position < varEnd) {
        // 移动到变量后面
        return varEnd;
      }
    }

    return position;
  };

  /**
   * 处理文本选择事件，确保光标不在变量内部
   */
  const handleSelect = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    // 只在光标位置（非选择）时调整
    if (start === end) {
      const newPosition = adjustCursorPosition(start);
      if (newPosition !== start) {
        setTimeout(() => {
          textarea.setSelectionRange(newPosition, newPosition);
        }, 0);
      }
    }
  };

  /**
   * 处理键盘事件，实现变量的整体删除
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    /**
     * 处理退格键：删除整个变量而不是单个字符
     */
    if (e.key === 'Backspace' && start === end && start > 0) {
      const textBefore = value.substring(0, start);
      
      // 情况1：光标在变量结束符后面，删除整个变量
      if (textBefore.endsWith('}}')) {
        const beforeClosing = textBefore.substring(0, textBefore.length - 2);
        const varMatch = beforeClosing.match(/\{\{[^}]*$/);
        
        if (varMatch) {
          e.preventDefault();
          const varStart = beforeClosing.length - varMatch[0].length;
          const newValue = value.substring(0, varStart) + value.substring(start);
          onChange(newValue);
          
          setTimeout(() => {
            textarea.setSelectionRange(varStart, varStart);
          }, 0);
          return;
        }
      }
      
      // 情况2：光标在变量内部
      const varMatch = textBefore.match(/\{\{[^}]*$/);
      if (varMatch) {
        e.preventDefault();
        const varStart = textBefore.length - varMatch[0].length;
        const textAfter = value.substring(start);
        const closingMatch = textAfter.match(/^[^}]*\}\}/);
        
        if (closingMatch) {
          const varEnd = start + closingMatch[0].length;
          const newValue = value.substring(0, varStart) + value.substring(varEnd);
          onChange(newValue);
          
          setTimeout(() => {
            textarea.setSelectionRange(varStart, varStart);
          }, 0);
        }
      }
    }
    
    /**
     * 处理删除键：删除整个变量而不是单个字符
     */
    if (e.key === 'Delete' && start === end) {
      const textAfter = value.substring(start);
      
      // 情况1：光标在变量开始符前面，删除整个变量
      if (textAfter.startsWith('{{')) {
        const varMatch = textAfter.match(/^\{\{[^}]*\}\}/);
        if (varMatch) {
          e.preventDefault();
          const newValue = value.substring(0, start) + value.substring(start + varMatch[0].length);
          onChange(newValue);
          
          setTimeout(() => {
            textarea.setSelectionRange(start, start);
          }, 0);
          return;
        }
      }
      
      // 情况2：光标在变量内部
      const textBefore = value.substring(0, start);
      const beforeMatch = textBefore.match(/\{\{[^}]*$/);
      
      if (beforeMatch) {
        e.preventDefault();
        const varStart = start - beforeMatch[0].length;
        const afterMatch = textAfter.match(/^[^}]*\}\}/);
        
        if (afterMatch) {
          const varEnd = start + afterMatch[0].length;
          const newValue = value.substring(0, varStart) + value.substring(varEnd);
          onChange(newValue);
          
          setTimeout(() => {
            textarea.setSelectionRange(varStart, varStart);
          }, 0);
        }
      }
    }
  };

  /**
   * 渲染带高亮的文本内容
   */
  const renderHighlightedText = () => {
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    const regex = /\{\{([^}]+)\}\}/g;
    let match;

    while ((match = regex.exec(value)) !== null) {
      // 添加变量前的普通文本
      if (match.index > lastIndex) {
        parts.push(
          <span key={`text-${lastIndex}`} className="text-white">
            {value.substring(lastIndex, match.index)}
          </span>
        );
      }

      // 添加高亮的变量
      const variableName = match[1];
      
      let displayName = variableName;
      // if (matchedVar) {
      //   displayName = typeof matchedVar === 'string' ? matchedVar : matchedVar.label;
      // }

      parts.push(
        <span
          key={`var-${match.index}`}
          className=" bg-primary/20 text-primary rounded "
          style={{ fontWeight: 500 }}
        >
          {`{{${displayName}}}`}
        </span>
      );

      lastIndex = match.index + match[0].length;
    }

    // 添加剩余的普通文本
    if (lastIndex < value.length) {
      parts.push(
        <span key={`text-${lastIndex}`} className="text-white">
          {value.substring(lastIndex)}
        </span>
      );
    }

    return parts;
  };

  return (
    <div className="relative w-full h-full">
      {/* 输入层 */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
        }}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        onClick={handleSelect}
        onKeyUp={handleSelect}
        className="absolute inset-0 w-full h-full font-mono text-sm resize-none"
        style={{
          padding: '12px',
          lineHeight: '1.5715',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '6px',
          outline: 'none',
          caretColor: '#fff',
          color: 'transparent',
          background: 'transparent',
          WebkitTextFillColor: 'transparent',
          zIndex: 1,
        }}
        onFocus={(e) => {
          e.target.style.borderColor = '#0EF283';
          e.target.style.boxShadow = '0 0 0 2px rgba(5, 145, 255, 0.1)';
        }}
        onBlur={(e) => {
          e.target.style.borderColor = 'rgba(255,255,255,0.1)';
          e.target.style.boxShadow = 'none';
        }}
      />

      {/* 高亮层 */}
      <div
        ref={highlightRef}
        className="absolute inset-0 pointer-events-none overflow-auto font-mono text-sm whitespace-pre-wrap wrap-break-word"
        style={{
          padding: '12px',
          lineHeight: '1.5715',
          border: '1px solid transparent',
          zIndex: 2,
        }}
      >
        {renderHighlightedText()}
      </div>
    </div>
  );
});

export const PromptSettings: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [prompts, setPrompts] = useState<PromptConfig[]>([]);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [currentPrompt, setCurrentPrompt] = useState<PromptConfig | null>(null);
  const [editContent, setEditContent] = useState('');
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<{ insertVariable: (variable: string) => void } | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | undefined>(undefined);
  const [systemTemplates, setSystemTemplates] = useState<{ id: number; name: string; content: string; isDefault: boolean }[]>([]);

  /**
   * 获取提示词配置列表
   */
  const fetchPrompts = async () => {
    setLoading(true);
    try {
      const data = await promptService.getPromptConfigs();
      setPrompts(data);
    } catch (err) {
      message.error('加载提示词配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrompts();
  }, []);

  /**
   * 切换提示词启用状态
   */
  const handleToggleEnable = async (prompt: PromptConfig, enabled: boolean) => {
    try {
      // 乐观更新
      setPrompts(prev => prev.map(p => p.type === prompt.type ? { ...p, enabled } : p));
      
      await promptService.updatePromptConfig(prompt.type, {
        enabled
      });
      message.success(enabled ? '已启用自定义提示词' : '已恢复默认提示词');
    } catch (err) {
      message.error('更新失败');
      // 回滚
      setPrompts(prev => prev.map(p => p.type === prompt.type ? { ...p, enabled: !enabled } : p));
    }
  };

  /**
   * 打开编辑弹窗
   */
  const openEditModal = async (prompt: PromptConfig) => {
    setCurrentPrompt(prompt);
    setEditContent(prompt.userContent || prompt.systemContent);
    setEditModalOpen(true);
    setSelectedTemplate(undefined);
    
    // 获取系统模板
    try {
        const templates = await promptService.getSystemPromptsByType(prompt.type);
        setSystemTemplates(templates);
    } catch (e) {
        console.error(e);
        setSystemTemplates([]);
    }
  };

  /**
   * 保存提示词内容
   */
  const handleSaveContent = async () => {
    if (!currentPrompt) return;
    
    setSaving(true);
    try {
      await promptService.updatePromptConfig(currentPrompt.type, {
        content: editContent,
        enabled: true // 编辑保存后自动启用
      });
      
      message.success('保存成功');
      setEditModalOpen(false);
      
      // 更新本地状态
      setPrompts(prev => prev.map(p => 
        p.type === currentPrompt.type 
          ? { ...p, userContent: editContent, enabled: true } 
          : p
      ));
    } catch (err) {
      message.error('保存失败');
    } finally {
      setSaving(false);
    }
  };

  /**
   * 切换模板选择
   */
  const handleTemplateChange = (value: string) => {
    setSelectedTemplate(value);
    
    const template = systemTemplates.find(t => t.id.toString() === value);
    if (template) {
      setEditContent(template.content);
    }
  };

  /**
   * 处理内容变化，清除模板选择状态
   */
  const handleContentChange = (newContent: string) => {
    setEditContent(newContent);
    setSelectedTemplate(undefined);
  };

  /**
   * 插入变量到编辑器
   */
  const insertVariable = (variable: string) => {
    if (editorRef.current) {
      editorRef.current.insertVariable(variable);
    }
  };

  /**
   * 按类型分组提示词
   */
  const groupedPrompts = React.useMemo(() => {
    const groups: Record<string, PromptConfig[]> = {
      llm: [],
      image: [],
      video: []
    };
    
    prompts.forEach(p => {
      const group = p.group || 'llm'; // Default to llm if no group
      if (groups[group]) {
        groups[group].push(p);
      }
    });
    
    return groups;
  }, [prompts]);

  const groupNames: Record<string, string> = {
    llm: '大模型推理',
    image: '图片生成',
    video: '视频生成'
  };

  const templateOptions = React.useMemo(() => {
      return systemTemplates.map(t => ({
          label: t.name + (t.isDefault ? ' (默认)' : ''),
          value: t.id.toString()
      }));
  }, [systemTemplates]);

  return (
    <div className="flex flex-col h-full">
      {loading ? (
        <div className="flex justify-center p-8"><Spin tip="加载配置中..." /></div>
      ) : (
        <div className="flex flex-col gap-6">
          {Object.entries(groupedPrompts).map(([groupKey, groupPrompts]) => {
            if (groupPrompts.length === 0) return null;
            
            return (
              <div key={groupKey} className="flex flex-col gap-2">
                <div className="text-text-secondary text-sm px-1">{groupNames[groupKey]}</div>
                <div className="flex flex-col rounded-lg border border-border/50 overflow-hidden bg-bg-card">
                  {groupPrompts.map((item) => (
                    <div 
                      key={item.type}
                      className={`flex items-center justify-between p-2 hover:bg-bg-main/50 transition-colors`}
                    >
                      <span className="text-sm text-text-primary">{item.name}</span>
                      <div className="flex items-center gap-2">
                        <Switch 
                          size="small" 
                          checked={item.enabled} 
                          onChange={(checked) => handleToggleEnable(item, checked)} 
                        />
                        <Button 
                          type="text" 
                          size="small" 
                          icon={<EditOutlined />} 
                          className={item.enabled ? "text-primary hover:text-primary-hover" : "text-text-tertiary"}
                          disabled={!item.enabled}
                          onClick={() => openEditModal(item)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title={<span className="text-text-primary">编辑提示词 - {currentPrompt?.name}</span>}
        open={editModalOpen}
        onCancel={() => setEditModalOpen(false)}
        footer={
          <div className="flex justify-between items-center w-full">
             <div className="flex items-center gap-2">
                {/* <span className="text-text-secondary text-sm">指令模板:</span> */}
                <Select
                  className="w-40"
                  options={templateOptions}
                  value={selectedTemplate}
                  onChange={handleTemplateChange}
                  placeholder="选择指令模板"
                  size="middle"
                  loading={systemTemplates.length === 0}
                />
             </div>
             <div className="flex gap-2">
               <Button onClick={() => setEditModalOpen(false)}>取消</Button>
               <Button type="primary" loading={saving} onClick={handleSaveContent}>保存</Button>
             </div>
          </div>
        }
        width={800}
        styles={{ body: { paddingBottom: 0 } }}
        className="dark-theme-modal"
      >
        <div className="flex flex-col gap-4 h-[500px]">
          <div>
            <div className="mb-2 text-sm text-text-secondary">插入变量:</div>
            <div className="flex flex-wrap gap-2">
              {currentPrompt?.variables && currentPrompt.variables.length > 0 ? (
                currentPrompt.variables.map(v => {
                  const val = typeof v === 'string' ? v : v.value;
                  const label = typeof v === 'string' ? v : v.label;
                  
                  // 检查变量是否已在内容中被使用
                  // 假设 val 格式为 "{{variable}}" 或 "variable"
                  // 如果 val 包含 {{ }}，则直接检查
                  // 如果不包含，则构造 {{val}} 检查
                  const checkVal = val.startsWith('{{') ? val : `{{${val}}}`;
                  const isUsed = editContent.includes(checkVal);

                  return (
                    <Button
                      key={val}
                      size="small"
                      type={isUsed ? "default" : "primary"}
                      ghost={!isUsed}
                      disabled={isUsed}
                      onClick={() => insertVariable(val.replace(/^\{\{|\}\}$/g, ''))}
                      className={`text-xs ${
                        isUsed 
                          ? 'text-text-tertiary border-border bg-bg-card opacity-50 cursor-not-allowed' 
                          : 'border-primary/50 hover:border-primary text-primary hover:bg-primary/10'
                      }`}
                    >
                      {label}
                    </Button>
                  );
                })
              ) : (
                <span className="text-text-tertiary text-xs">无可用变量</span>
              )}
            </div>
          </div>
          
          <div className="relative flex-1 border border-border rounded-md overflow-hidden bg-bg-main">
            <HighlightEditor
              ref={editorRef}
              value={editContent}
              onChange={handleContentChange}
              variables={currentPrompt?.variables}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
