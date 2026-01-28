/**
 * AI模型选择器组件
 * 用于选择图片或视频生成模型及其提供商
 */
import React, { useState, useEffect } from 'react';
import { Spin, Button, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { CodeSandboxOutlined, CheckOutlined } from '@ant-design/icons';
import { settingsService } from '../services/settingsService';

interface ModelSelectorProps {
  type: 'image' | 'video';
  value?: { model: string; provider: string };
  onChange?: (value: { model: string; provider: string }) => void;
  size?: 'small' | 'middle' | 'large';
  className?: string;
  placeholder?: string;
  capability?: 'text2image' | 'image2image'; // 过滤模型能力
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({
  type,
  value,
  onChange,
  size: _size = 'small',
  className = '',
  placeholder = '选择模型',
  capability
}) => {
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<any>(null);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(value?.model);
  const [selectedProvider, setSelectedProvider] = useState<string | undefined>(value?.provider);

  useEffect(() => {
    fetchModels();
  }, [type, capability]);

  useEffect(() => {
    if (value?.model) {
      setSelectedModel(value.model);
      setSelectedProvider(value.provider);
    }
  }, [value]);

  /**
   * 获取可用的AI模型列表
   */
  const fetchModels = async () => {
    setLoading(true);
    try {
      const [available, userConfig] = await Promise.all([
        settingsService.getAvailableAIModels(),
        settingsService.getUserAIConfig()
      ]);

      const categoryConfig = available[type];
      setConfigs(categoryConfig);

      // 根据 capability 过滤模型
      const filteredConfigs = capability 
        ? Object.fromEntries(
            Object.entries(categoryConfig || {}).filter(([_, modelConfig]: [string, any]) => {
              const capabilities = modelConfig.capabilities || [];
              return capabilities.includes(capability);
            })
          )
        : categoryConfig;

      // 如果没有传入 value，使用用户配置或默认值
      if (!value && categoryConfig) {
        let modelId = '';
        let providerId = '';

        // 如果有 capability 过滤，优先使用过滤后的第一个模型
        if (capability && Object.keys(filteredConfigs).length > 0) {
          const filteredModels = Object.keys(filteredConfigs);
          modelId = filteredModels[0];
          providerId = filteredConfigs[modelId].default_provider;
        } else if (userConfig[type]) {
          // 否则使用用户配置
          modelId = userConfig[type].model;
          providerId = userConfig[type].provider;
        }

        // 验证并设置默认值
        if (!modelId || !categoryConfig[modelId]) {
          const models = Object.keys(categoryConfig);
          if (models.length > 0) {
            modelId = models[0];
            providerId = categoryConfig[modelId].default_provider;
          }
        } else {
          const modelConfig = categoryConfig[modelId];
          if (!providerId || !modelConfig.providers[providerId]) {
            providerId = modelConfig.default_provider;
          }
        }

        if (modelId && providerId) {
          setSelectedModel(modelId);
          setSelectedProvider(providerId);
          onChange?.({ model: modelId, provider: providerId });
        }
      }
    } catch (error) {
      console.error('Failed to fetch models:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <Spin size="small" />;
  }

  if (!configs) {
    return null;
  }

  /**
   * 获取当前选中的模型显示名称
   */
  const currentModelName = selectedModel && configs[selectedModel] ? configs[selectedModel].name : placeholder;

  /**
   * 根据能力过滤模型配置
   */
  const filteredConfigs = capability 
    ? Object.fromEntries(
        Object.entries(configs).filter(([_, modelConfig]: [string, any]) => {
          const capabilities = modelConfig.capabilities || [];
          return capabilities.includes(capability);
        })
      )
    : configs;

  const items: MenuProps['items'] = Object.entries(filteredConfigs).map(([modelId, modelConfig]: [string, any]) => {
    const modelProviders = modelConfig.providers || {};
    const isModelSelected = selectedModel === modelId;

    return {
      key: modelId,
      label: (
        <div className="flex items-center justify-between min-w-[120px] gap-2">
          <span>{modelConfig.name}</span>
          {isModelSelected && <CheckOutlined className="text-gray-400" />}
        </div>
      ),
      popupOffset: [8, 0],
      children: Object.entries(modelProviders).map(([providerId, providerConfig]: [string, any]) => ({
        key: `${modelId}:${providerId}`,
        label: (
          <div className="flex items-center justify-between min-w-[100px] gap-2">
            <span>{providerConfig.name || providerId}</span>
            {isModelSelected && selectedProvider === providerId && <CheckOutlined />}
          </div>
        ),
        onClick: () => {
          setSelectedModel(modelId);
          setSelectedProvider(providerId);
          onChange?.({ model: modelId, provider: providerId });
        }
      }))
    };
  });

  return (
    <div className='w-[100px]'>
      <Dropdown menu={{ items }} trigger={['click']}>
        <Button
          icon={<CodeSandboxOutlined />}
          className={`flex w-[100%] items-center gap-1 ${className}`}
        >
          <span className="text-xs text-ellipsis overflow-hidden">{currentModelName}</span>
        </Button>
      </Dropdown>
    </div>
  );
};
