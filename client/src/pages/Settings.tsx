/**
 * 设置页面
 * 管理系统配置，包括接口服务商、剪映设置和大模型配置
 */
import { Card, Form, Input, Button, message, Space, Table, Modal, Select, Radio } from 'antd';
import { LeftOutlined, FolderOpenOutlined, LinkOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { settingsService } from '../services/settingsService';
import { useAuthStore } from '../store/authStore';
import { openExternalUrl } from '../utils/electron';

const SettingsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setLoginModalOpen } = useAuthStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('provider');
  
  // LLM Config State
  const [llmConfigs, setLlmConfigs] = useState<any[]>([]);
  const [llmModalVisible, setLlmModalVisible] = useState(false);
  const [llmForm] = Form.useForm();
  const [editingLlmId, setEditingLlmId] = useState<number | null>(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      navigate('/');
      return;
    }

    const loadSettings = async () => {
      try {
        const settings = await settingsService.getSettings();
        form.setFieldsValue(settings);
      } catch (error) {
        console.error('Failed to load settings:', error);
        message.error('加载设置失败');
      }
    };
    
    const loadLlmConfigs = async () => {
      try {
        const configs = await settingsService.getUserLLMConfigs();
        setLlmConfigs(configs);
      } catch (error) {
        console.error('Failed to load LLM configs:', error);
      }
    };
    
    loadSettings();
    loadLlmConfigs();
  }, [form, isAuthenticated, navigate, setLoginModalOpen]);

  /**
   * 保存设置
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      
      // 保存基础设置
      await settingsService.updateSettings(values);
      
      // 如果 zeroapiKey 不为空，检查是否需要自动创建 zeroapi 配置
      if (values.zeroapiKey && values.zeroapiKey.trim()) {
        const hasZeroapiConfig = llmConfigs.some(config => config.provider === 'zeroapi');
        
        if (!hasZeroapiConfig) {
          // 自动创建 zeroapi 配置
          const zeroapiConfig = {
            name: 'gemini-3-pro-preview',
            provider: 'zeroapi',
            baseUrl: LLM_PROVIDERS.zeroapi.baseUrl,
            modelValue: LLM_PROVIDERS.zeroapi.modelValue,
            apiKey: values.zeroapiKey,
            isActive: true
          };
          
          await settingsService.createUserLLMConfig(zeroapiConfig);
          
          // 重新加载配置列表
          const configs = await settingsService.getUserLLMConfigs();
          setLlmConfigs(configs);
          
          message.success('设置已保存');
        } else {
          message.success('设置已保存');
        }
      } else {
        message.success('设置已保存');
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Validation or save failed:', error);
      message.error('保存失败');
      setLoading(false);
    }
  };

  /**
   * 大模型服务商配置
   */
  const LLM_PROVIDERS: Record<string, { label: string; baseUrl: string; modelValue: string }> = {
    deepseek: {
      label: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/chat/completions',
      modelValue: 'deepseek-chat'
    },
    doubao: {
      label: '豆包',
      baseUrl: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
      modelValue: 'doubao-seed-1-6-251015'
    },
    zeroapi: {
      label: '零界',
      baseUrl: 'https://zeroapi.cn/v1/chat/completions',
      modelValue: 'gemini-3-pro-preview'
    },
    custom: {
      label: '自定义',
      baseUrl: '',
      modelValue: ''
    }
  };

  /**
   * 切换服务商时自动填充配置
   */
  const handleProviderChange = (value: string) => {
    const providerConfig = LLM_PROVIDERS[value];
    if (providerConfig && value !== 'custom') {
      llmForm.setFieldsValue({
        baseUrl: providerConfig.baseUrl,
        modelValue: providerConfig.modelValue
      });
    }
  };

  /**
   * 打开添加大模型配置弹窗
   */
  const handleAddLlm = () => {
    setEditingLlmId(null);
    llmForm.resetFields();
    // 默认选中 DeepSeek 并触发自动填充
    const defaultProvider = 'deepseek';
    llmForm.setFieldsValue({ provider: defaultProvider });
    handleProviderChange(defaultProvider);
    setLlmModalVisible(true);
  };

  /**
   * 打开编辑大模型配置弹窗
   */
  const handleEditLlm = (record: any) => {
    setEditingLlmId(record.id);
    llmForm.setFieldsValue(record);
    setLlmModalVisible(true);
  };

  /**
   * 删除大模型配置
   */
  const handleDeleteLlm = async (id: number) => {
    Modal.confirm({
      title: '确认删除',
      content: '确定要删除这个大模型配置吗？',
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await settingsService.deleteUserLLMConfig(id);
          message.success('删除成功');
          const configs = await settingsService.getUserLLMConfigs();
          setLlmConfigs(configs);
        } catch (error) {
          console.error('Failed to delete LLM config:', error);
          message.error('删除失败');
        }
      }
    });
  };

  /**
   * 保存大模型配置
   */
  const handleLlmModalOk = async () => {
    try {
      const values = await llmForm.validateFields();
      setLoading(true);
      
      if (editingLlmId) {
        await settingsService.updateUserLLMConfig(editingLlmId, values);
        message.success('更新成功');
      } else {
        await settingsService.createUserLLMConfig(values);
        message.success('添加成功');
      }
      
      const configs = await settingsService.getUserLLMConfigs();
      setLlmConfigs(configs);
      setLlmModalVisible(false);
      llmForm.resetFields();
    } catch (error) {
      console.error('Failed to save LLM config:', error);
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 测试大模型连接
   */
  const handleTestLlm = async () => {
    try {
      // 验证必填字段
      await llmForm.validateFields(['baseUrl', 'apiKey', 'modelValue']);
      
      const values = llmForm.getFieldsValue(['baseUrl', 'apiKey', 'modelValue']);
      setTesting(true);
      
      await settingsService.testUserLLMConfig(values);
      message.success('连接测试成功！');
    } catch (error: any) {
      console.error('Failed to test LLM config:', error);
      if (error.errorFields) {
        message.error('请先填写必填字段');
      } else {
        message.error(error.message || '连接测试失败，请检查配置');
      }
    } finally {
      setTesting(false);
    }
  };

  const llmColumns = [
    {
      title: '名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '模型服务商',
      key: 'provider',
      render: (_: any, record: any) => {
        const providerName = LLM_PROVIDERS[record.provider]?.label || record.provider;
        return (
          <div className="flex flex-col">
            <span className="font-medium">{providerName}</span>
            <span className="text-xs text-text-secondary truncate max-w-[300px]" title={record.baseUrl}>
              {record.baseUrl}
            </span>
          </div>
        );
      },
    },
    {
      title: '模型标识',
      dataIndex: 'modelValue',
      key: 'modelValue',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <span className={isActive ? 'text-green-500' : 'text-text-secondary'}>
          {isActive ? '启用' : '禁用'}
        </span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 220,
      render: (_: any, record: any) => (
        <Space size="small">
          <Button 
            type="link" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEditLlm(record)}
          >
            编辑
          </Button>
          <Button 
            type="link" 
            size="small" 
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteLlm(record.id)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  const items = [
    { key: 'provider', label: '接口服务商' },
    { key: 'jianying', label: '剪映设置' },
    { key: 'llm', label: '大模型配置' },
  ];

  /**
   * 渲染大模型配置界面
   */
  const renderLlmSettings = () => (
    <div className="animate-fade-in">
      <Card className="bg-bg-card border-border">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-medium text-text-primary">大模型配置</span>
          <Button 
            type="primary" 
            icon={<PlusOutlined />}
            onClick={handleAddLlm}
          >
            添加配置
          </Button>
        </div>
        
        <Table
          columns={llmColumns}
          dataSource={llmConfigs}
          rowKey="id"
          pagination={false}
          className="custom-table"
        />
      </Card>
    </div>
  );

  /**
   * 渲染接口服务商配置界面
   */
  const renderProviderSettings = () => (
    <div className="animate-fade-in flex flex-col gap-6">
      <Card className="bg-bg-card border-border">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-medium text-text-primary">接口服务商</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* 零界API */}
          <div className="p-4 bg-bg-element rounded-lg border border-border/50">
            <div className="flex items-center justify-between mb-4">
              <div className="flex flex-col">
                <span className="text-base font-medium text-text-primary mb-1">零界API</span>
                <span className="text-xs text-text-secondary">提供稳定的大模型与视频生成服务</span>
              </div>
              <Button 
                type="primary" 
                ghost 
                icon={<LinkOutlined />}
                onClick={() => openExternalUrl('https://zeroapi.cn/')}
              >
                去注册
              </Button>
            </div>
            <Form.Item 
              name="zeroapiKey" 
              label="服务商秘钥" 
              className="mb-0"
              style={{ marginBottom: 0 }}
            >
              <Input.Password placeholder="请输入 API Key" />
            </Form.Item>
          </div>

        </div>
      </Card>
    </div>
  );

  /**
   * 渲染剪映设置界面
   */
  const renderJianyingSettings = () => (
    <div className="animate-fade-in">
       <Card className="bg-bg-card border-border mb-6">
        <div className="flex items-center justify-between mb-6">
          <span className="text-lg font-medium text-text-primary">剪映设置</span>
        </div>
        <div className="grid grid-cols-1 gap-6">
          <Form.Item
            label={<span className="text-text-secondary">剪映草稿目录</span>}
          >
             <Space.Compact style={{ width: '100%' }}>
                <Form.Item
                  name="jianyingPath"
                  noStyle
                  initialValue="C:\\Users\\Admin\\AppData\\Local\\JianyingPro\\User Data\\Projects"
                >
                  <Input size="large" />
                </Form.Item>
                <Button 
                  size="large" 
                  icon={<FolderOpenOutlined />}
                  onClick={async () => {
                    try {
                      const result = await (window as any).electronAPI.selectDirectory();
                      console.log('Selected result:', result);
                      
                      // Handle both array return (standard electron) and string return
                      const path = Array.isArray(result) ? result[0] : result;
                      
                      if (path) {
                        form.setFieldsValue({ jianyingPath: path });
                      }
                    } catch (e) {
                      console.error(e);
                      message.error('无法打开目录选择器，请确保在 Electron 环境中运行');
                    }
                  }}
                >
                  选择
                </Button>
             </Space.Compact>
          </Form.Item>
        </div>
      </Card>
    </div>
  );

  /**
   * 根据当前标签渲染对应内容
   */
  const renderContent = () => {
    switch (activeTab) {
      case 'llm':
        return renderLlmSettings();
      case 'provider':
        return renderProviderSettings();
      case 'jianying':
        return renderJianyingSettings();
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      <style>{`
        .custom-table .ant-table {
          background: transparent;
        }
        .custom-table .ant-table-thead > tr > th {
          background: var(--bg-element);
          color: var(--text-primary);
          border-bottom: 1px solid var(--border-color);
        }
        .custom-table .ant-table-tbody > tr > td {
          border-bottom: 1px solid var(--border-color);
        }
        .custom-table .ant-table-tbody > tr:hover > td {
          background: var(--bg-element);
        }
      `}</style>
      
      {/* Header Bar */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
        <div className="flex items-center gap-8">
          <Button 
            type="text" 
            icon={<LeftOutlined />} 
            className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center"
            onClick={() => navigate(-1)}
          />
          
          <div className="flex gap-6">
            {items.map(item => (
              <div 
                key={item.key}
                onClick={() => setActiveTab(item.key)}
                className={`cursor-pointer text-base font-medium pb-1 transition-colors relative ${
                  activeTab === item.key ? 'text-text-primary' : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                {item.label}
                {activeTab === item.key && (
                  <div className="absolute bottom-[-21px] left-0 w-full h-0.5 bg-primary rounded-full" />
                )}
              </div>
            ))}
          </div>
        </div>

        <Button 
          type="primary" 
          onClick={handleSave}
          loading={loading}
        >
          保存设置
        </Button>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-auto pr-2">
        <Form
          form={form}
          layout="vertical"
        >
          {renderContent()}
        </Form>
      </div>

      {/* LLM Config Modal */}
      <Modal
        title={editingLlmId ? '编辑大模型配置' : '添加大模型配置'}
        open={llmModalVisible}
        onOk={handleLlmModalOk}
        onCancel={() => {
          setLlmModalVisible(false);
          llmForm.resetFields();
        }}
        confirmLoading={loading}
        width={600}
        okText="保存"
        cancelText="取消"
        footer={[
          <Button
            key="test"
            loading={testing}
            onClick={handleTestLlm}
          >
            测试连接
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={loading}
            onClick={handleLlmModalOk}
          >
            保存
          </Button>,
        ]}
      >
        <Form
          form={llmForm}
          layout="vertical"
          className="mt-4"
        >
          <Form.Item
            name="name"
            label="配置名称"
            rules={[{ required: true, message: '请输入配置名称' }]}
          >
            <Input placeholder="例如：DeepSeek 主配置" />
          </Form.Item>

          <Form.Item label="模型服务商" required style={{ marginBottom: 0 }}>
            <div className="flex gap-3">
              <Form.Item
                name="provider"
                rules={[{ required: true, message: '请选择提供商' }]}
                className="w-[140px]"
              >
                <Select placeholder="选择提供商" onChange={handleProviderChange}>
                  {Object.entries(LLM_PROVIDERS).map(([key, config]) => (
                    <Select.Option key={key} value={key}>
                      {config.label}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
              <Form.Item
                name="baseUrl"
                rules={[{ required: true, message: '请输入 Base URL' }]}
                className="flex-1"
              >
                <Input placeholder="Base URL" />
              </Form.Item>
            </div>
          </Form.Item>

          <Form.Item
            name="modelValue"
            label="模型标识"
            rules={[{ required: true, message: '请输入模型标识' }]}
          >
            <Input placeholder="例如：deepseek-chat" />
          </Form.Item>

          <Form.Item
            name="apiKey"
            label="API Key"
            rules={[{ required: true, message: '请输入 API Key' }]}
          >
            <Input.Password placeholder="请输入 API Key" />
          </Form.Item>

          <Form.Item
            name="isActive"
            label="状态"
            initialValue={true}
          >
            <Radio.Group>
              <Radio value={true}>启用</Radio>
              <Radio value={false}>禁用</Radio>
            </Radio.Group>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default SettingsPage;
