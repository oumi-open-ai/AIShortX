/**
 * AI模型配置组件
 * 提供模型选择和提示词配置功能
 * 支持大模型推理、图片生成、视频生成三种类别的模型配置
 */
import React, { useState, useEffect } from 'react';
import { Popover, Button, Form, Select, Segmented, message, Spin } from 'antd';
import { 
  DownOutlined, 
  UpOutlined, 
  CodeSandboxOutlined
} from '@ant-design/icons';
import { settingsService } from '../services/settingsService';
import type { TooltipPlacement } from 'antd/es/tooltip';

import { PromptSettings } from './PromptSettings';

// 类别名称映射
const CATEGORY_NAMES: Record<string, string> = {
  llm: '大模型推理',
  image: '图片生成',
  video: '视频生成'
};

// 类别显示顺序
const CATEGORY_ORDER = ['llm', 'image', 'video'];

interface AIModelConfigProps {
  placement?: TooltipPlacement;
  variant?: 'default' | 'icon-only';
  className?: string;
  style?: React.CSSProperties;
}

export const AIModelConfig: React.FC<AIModelConfigProps> = ({ placement = 'bottomRight', variant = 'default', className, style }) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<any>({});
  const [form] = Form.useForm();
  const [currentModels, setCurrentModels] = useState<Record<string, string>>({});
  
  // UI State
  const [activeMainTab, setActiveMainTab] = useState<'model' | 'prompt'>('model');

  /**
   * 获取AI模型配置数据
   * 加载可用模型列表和用户当前配置
   */
  const fetchData = async () => {
    setLoading(true);
    try {
      const [avail, user] = await Promise.all([
        settingsService.getAvailableAIModels(),
        settingsService.getUserAIConfig()
      ]);
      setConfigs(avail);
      
      // 初始化表单值
      const formValues: any = {};
      const initialModels: Record<string, string> = {};

      Object.keys(avail).forEach(cat => {
        let modelId = '';
        let providerId = '';

        if (user[cat]) {
            modelId = user[cat].model;
            providerId = user[cat].provider;
        }
        
        // 验证model是否存在，如果不存在使用默认
        const catConfig = avail[cat];
        if (!modelId || !catConfig[modelId]) {
             const models = Object.keys(catConfig);
             if (models.length > 0) {
                 modelId = models[0];
                 providerId = catConfig[modelId].default_provider;
             }
        } else {
             const modelConfig = catConfig[modelId];
             if (!providerId || !modelConfig.providers[providerId]) {
                 providerId = modelConfig.default_provider;
             }
        }

        if (modelId) {
            formValues[`${cat}_model`] = modelId;
            formValues[`${cat}_provider`] = providerId;
            initialModels[cat] = modelId;
        }
      });
      
      form.setFieldsValue(formValues);
      setCurrentModels(initialModels);

    } catch (err) {
      console.error(err);
      message.error('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  /**
   * 自动保存配置
   * 当用户更改模型或提供商时自动保存到后端
   */
  const triggerAutoSave = async (updatedValues?: any) => {
    try {
      const currentValues = form.getFieldsValue();
      const values = { ...currentValues, ...updatedValues };

      const newConfig: any = {};
      Object.keys(configs).forEach(cat => {
        const model = values[`${cat}_model`];
        const provider = values[`${cat}_provider`];
        if (model && provider) {
            newConfig[cat] = { model, provider };
        }
      });
      
      await settingsService.saveUserAIConfig(newConfig);
    } catch (err) {
      console.error(err);
      message.error('自动保存失败');
    }
  };

  /**
   * 处理模型变更
   * 自动选择默认提供商并保存配置
   */
  const handleModelChange = (category: string, modelId: string) => {
      const categoryConfig = configs[category];
      if (categoryConfig && categoryConfig[modelId]) {
          const defaultProvider = categoryConfig[modelId].default_provider;
          form.setFieldValue(`${category}_provider`, defaultProvider);
          setCurrentModels(prev => ({ ...prev, [category]: modelId }));
          
          triggerAutoSave({
              [`${category}_model`]: modelId,
              [`${category}_provider`]: defaultProvider
          });
      }
  };

  /**
   * 处理提供商变更
   * 自动保存配置
   */
  const handleProviderChange = (category: string, providerId: string) => {
      triggerAutoSave({
          [`${category}_provider`]: providerId
      });
  };

  /**
   * 渲染类别配置内容
   * 显示模型选择器和提供商选择器
   */
  const renderCategoryContent = (category: string) => {
    const categoryConfig = configs[category];
    if (!categoryConfig) return null;

    const currentModel = currentModels[category];
    const modelConfig = categoryConfig[currentModel];
    const providers = modelConfig?.providers || {};
    const showProviderSelect = Object.keys(providers).length > 0;

    return (
      <div className="flex flex-col gap-2 animate-fade-in">
        <div className="flex gap-2 items-start">
            <Form.Item
              name={`${category}_model`}
              className="!mb-0 flex-1"
            >
              <Select 
                size="middle"
                placeholder="选择模型"
                className="w-full"
                onChange={(val) => handleModelChange(category, val)}
                options={Object.entries(categoryConfig).map(([key, conf]: [string, any]) => ({
                    label: conf.name,
                    value: key
                }))}
              />
            </Form.Item>
            
            {showProviderSelect && (
                 <Form.Item
                    name={`${category}_provider`}
                    className="!mb-0 w-[140px]"
                >
                    <Select 
                        size="middle"
                        placeholder="服务渠道"
                        className="w-full"
                        onChange={(val) => handleProviderChange(category, val)}
                        options={Object.entries(providers).map(([key, conf]: [string, any]) => ({
                            label: conf.name || key,
                            value: key
                        }))}
                    />
                </Form.Item>
            )}
        </div>
      </div>
    );
  };
  
  const content = (
    <div className="w-[380px] flex flex-col bg-bg-card rounded-lg overflow-hidden border border-border/50 shadow-xl">
        <div className="px-4 py-3 border-b border-border/50 bg-bg-card">
          <Segmented 
            block
            options={[
              { label: '默认模型', value: 'model' },
              { label: '提示词', value: 'prompt' }
            ]}
            value={activeMainTab}
            onChange={(val) => setActiveMainTab(val as 'model' | 'prompt')}
            className="custom-segmented"
          />
        </div>

        <div className="max-h-[430px] overflow-y-auto custom-scrollbar bg-bg-page/80">
          {loading ? (
              <div className="flex flex-col items-center justify-center h-[300px] text-text-tertiary gap-3">
                <Spin />
                <span className="text-xs">加载配置中...</span>
              </div>
          ) : (
             <>
               {activeMainTab === 'model' ? (
                 <div className="p-5">
                    <Form form={form} layout="vertical">
                      <div className="flex flex-col gap-6">
                        {CATEGORY_ORDER.filter(c => configs[c]).map((cat) => (
                          <div key={cat} className="flex flex-col gap-3">
                            {/* Section Header */}
                            <div className="flex items-center gap-2">
                                <span className="text-text-secondary font-medium text-sm">{CATEGORY_NAMES[cat]}</span>
                            </div>
                            
                            {/* Content */}
                            {renderCategoryContent(cat)}
                          </div>
                        ))}
                      </div>
                    </Form>
                 </div>
               ) : (
                 <div className="p-5">
                   <PromptSettings />
                 </div>
               )}
             </>
          )}
        </div>
    </div>
  );

  const ArrowIcon = placement.startsWith('top') ? UpOutlined : DownOutlined;

  return (
    <Popover
      content={content}
      trigger="click"
      open={open}
      onOpenChange={setOpen}
      placement={placement}
      destroyTooltipOnHide
      overlayInnerStyle={{ padding: 0 }}
      arrow={false}
    >
      {variant === 'icon-only' ? (
        <Button 
          className={`flex items-center justify-center w-12 h-12 scale-120  rounded-full hover:scale-130 transition-transform duration-300 ${className}`}
          style={style}
          icon={<CodeSandboxOutlined className="text-2xl" />}
        />
      ) : (
        <Button className={`flex items-center gap-2 px-3 ${className}`} style={style}>
          <CodeSandboxOutlined />
          <span>模型配置</span>
          <ArrowIcon style={{ fontSize: '10px' }} />
        </Button>
      )}
    </Popover>
  );
};
