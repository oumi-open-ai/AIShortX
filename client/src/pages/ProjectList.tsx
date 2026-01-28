/**
 * 项目列表页面
 * 显示用户的所有项目，支持创建、编辑和删除
 */
import { useEffect, useState, useRef, useCallback } from 'react';
import { Card, Modal, Spin, Button, Typography, message, Input, Form } from 'antd';
import { 
  ClockCircleOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  PictureOutlined, 
  MobileOutlined,
  DesktopOutlined,
  BulbOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { projectService } from '../services/projectService';
import { settingsService } from '../services/settingsService';
import { useAuthStore } from '../store/authStore';
import type { Project } from '../types';
import { openExternalUrl } from '../utils/electron';

import { CreateCom } from '../components/CreateCom';

const { Title } = Typography;

const ProjectList = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setLoginModalOpen } = useAuthStore();
  const [projects, setProjects] = useState<Project[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [apiKeyModalVisible, setApiKeyModalVisible] = useState(false);
  const [apiKeyForm] = Form.useForm();
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [aiModels, setAiModels] = useState<any>({ image: {}, video: {} });

  /**
   * 加载项目列表，支持分页和重试机制
   */
  const loadProjects = useCallback(async (pageNum = 1, size = 12, append = false) => {
    if (!isAuthenticated) {
      setProjects([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // 重试逻辑：最多重试3次
    let retries = 3;
    let lastError: any = null;
    
    while (retries > 0) {
      try {
        const { list, total } = await projectService.getAllProjects(pageNum, size);
        if (append) {
          setProjects(prev => [...prev, ...list]);
        } else {
          setProjects(list);
        }
        setTotal(total);
        setPage(pageNum);
        setPageSize(size);
        setHasMore(list.length === size);
        setLoading(false);
        return; // 成功后退出
      } catch (error: any) {
        lastError = error;
        retries--;
        
        // 如果是网络错误或连接被拒绝，等待后重试
        if (retries > 0 && (error.code === 'ERR_NETWORK' || error.code === 'ECONNREFUSED')) {
          console.log(`Failed to load projects, retrying... (${3 - retries}/3)`);
          await new Promise(resolve => setTimeout(resolve, 1000)); // 等待1秒后重试
        } else {
          break;
        }
      }
    }
    
    // 所有重试都失败
    console.error('Failed to load projects after retries:', lastError);
    message.error('加载项目失败，请稍后重试');
    setLoading(false);
  }, [isAuthenticated]);



  useEffect(() => {
    loadProjects(1, 12, false);
    loadAIModels();
  }, [isAuthenticated, loadProjects]);

  /**
   * 加载可用的AI模型配置
   */
  const loadAIModels = async () => {
    try {
      const models = await settingsService.getAvailableAIModels();
      setAiModels(models);
    } catch (error) {
      console.error('Failed to load AI models:', error);
    }
  };

  /**
   * 整合并显示图片模型列表
   */
  const getImageModelsDisplay = () => {
    const imageModels = aiModels.image || {};
    const modelNames: string[] = [];
    
    // 提取所有支持 zeroapi 的模型名称
    Object.values(imageModels).forEach((model: any) => {
      if (model.providers?.zeroapi) {
        modelNames.push(model.name);
      }
    });

    if (modelNames.length === 0) return '暂无';

    // 整合 Nano Banana 系列
    const nanoBananaVersions: string[] = [];
    // 整合即梦系列
    const jimengVersions: string[] = [];
    const otherModels: string[] = [];
    
    modelNames.forEach(name => {
      // 匹配 Nano Banana 系列
      if (name.includes('Nano Banana')) {
        if (name === 'Nano Banana') {
          nanoBananaVersions.push('');
        } else {
          const match = name.match(/Nano Banana\s+(.+)/);
          if (match) {
            nanoBananaVersions.push(match[1]);
          }
        }
      }
      // 匹配即梦系列
      else {
        const match = name.match(/即梦\s*([\d.]+)/);
        if (match) {
          jimengVersions.push(match[1]);
        } else {
          otherModels.push(name);
        }
      }
    });

    const result: string[] = [];
    
    // Nano Banana 放在最前面
    if (nanoBananaVersions.length > 0) {
      const versions = nanoBananaVersions.filter(v => v).join('/');
      result.push(versions ? `Nano Banana/${versions}` : 'Nano Banana');
    }
    
    // 即梦系列
    if (jimengVersions.length > 0) {
      result.push(`即梦 ${jimengVersions.join('/')}`);
    }
    
    // 其他模型
    result.push(...otherModels);

    return result.join('、');
  };

  /**
   * 整合并显示视频模型列表
   */
  const getVideoModelsDisplay = () => {
    const videoModels = aiModels.video || {};
    const modelNames: string[] = [];
    
    // 提取所有支持 zeroapi 的模型名称
    Object.values(videoModels).forEach((model: any) => {
      if (model.providers?.zeroapi) {
        modelNames.push(model.name);
      }
    });

    if (modelNames.length === 0) return '暂无';
    return modelNames.join('、');
  };

  /**
   * 无限滚动监听器
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadProjects(page + 1, pageSize, true);
        }
      },
      { threshold: 0.1 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, page, pageSize, loadProjects]);

  /**
   * 打开创建项目弹窗，检查API密钥配置
   */
  const openCreateModal = async () => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      return;
    }

    try {
      // 检查零界API密钥是否配置
      const settings = await settingsService.getSettings();
      
      if (!settings.zeroapiKey || !settings.zeroapiKey.trim()) {
        // 密钥为空，显示配置弹窗
        setApiKeyModalVisible(true);
        return;
      }
      
      // 密钥存在，直接打开创建项目弹窗
      setCreateModalVisible(true);
    } catch (error) {
      console.error('Failed to check settings:', error);
      message.error('检查配置失败');
    }
  };

  /**
   * 提交并保存API密钥配置
   */
  const handleApiKeySubmit = async () => {
    try {
      const values = await apiKeyForm.validateFields();
      setSavingApiKey(true);

      // 保存服务商密钥
      await settingsService.updateSettings({ zeroapiKey: values.zeroapiKey });

      // 检查是否已存在 zeroapi 配置
      const llmConfigs = await settingsService.getUserLLMConfigs();
      const hasZeroapiConfig = llmConfigs.some((config: any) => config.provider === 'zeroapi');

      if (!hasZeroapiConfig) {
        // 自动创建 zeroapi 配置
        const zeroapiConfig = {
          name: 'gemini-3-pro-preview',
          provider: 'zeroapi',
          baseUrl: 'https://zeroapi.cn/v1/chat/completions',
          modelValue: 'gemini-3-pro-preview',
          apiKey: values.zeroapiKey,
          isActive: true
        };
        
        await settingsService.createUserLLMConfig(zeroapiConfig);
      }

      message.success('配置保存成功');
      setApiKeyModalVisible(false);
      apiKeyForm.resetFields();
      
      // 打开创建项目弹窗
      setCreateModalVisible(true);
    } catch (error: any) {
      console.error('Failed to save API key:', error);
      if (error.errorFields) {
        message.error('请输入服务商密钥');
      } else {
        message.error('保存配置失败');
      }
    } finally {
      setSavingApiKey(false);
    }
  };

  /**
   * 项目创建成功后的回调
   */
  const handleCreateSuccess = (result: { projectId: number }) => {
    setCreateModalVisible(false);
    loadProjects(1, 12, false);
    navigate(`/projects/${result.projectId}`);
  };

  /**
   * 删除项目
   */
  const handleDelete = (e: React.MouseEvent, id: number) => {
    e.stopPropagation(); // Prevent card click
    Modal.confirm({
      title: '确认删除项目？',
      content: '删除后无法恢复',
      okType: 'danger',
     okText: '确定',
        cancelText: '取消',
      onOk: async () => {
        try {
          await projectService.deleteProject(id);
          message.success('项目已删除');
          setProjects(prev => prev.filter(p => p.id !== id));
          setTotal(prev => prev - 1);
        } catch (error) {
          console.error('Failed to delete project:', error);
          message.error('删除失败');
        }
      }
    });
  };

  return (
    <div className="flex flex-col gap-8 pb-8 animate-fade-in">
      {/* Quick Access Cards */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-4"> */}
        {/* Card 1: Create Video / New Project */}
        {/* <div className="glass-card p-5 rounded-2xl hover:border-primary/50 transition-all duration-300 group relative overflow-hidden flex items-center justify-between hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer" onClick={openCreateModal}>
           <div className="flex flex-col justify-center">
             <h3 className="text-text-primary text-lg font-bold mb-1 group-hover:text-primary transition-colors">创建项目</h3>
             <p className="text-text-secondary text-xs opacity-80">输入剧本，AI 自动生成角色、场景与分镜</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors !transition-all !duration-500">
             <PlusOutlined className="text-lg text-primary group-hover:text-white" />
           </div>
        </div> */}
        
        {/* Card 2: Character Library */}
        {/* <div className="glass-card p-5 rounded-2xl hover:border-primary/50 transition-all duration-300 group relative overflow-hidden flex items-center justify-between hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer" onClick={() => {
          if (!isAuthenticated) {
            setLoginModalOpen(true);
            return;
          }
          navigate('/characters');
        }}>
           <div className="flex flex-col justify-center">
             <h3 className="text-text-primary text-lg font-bold mb-1 group-hover:text-blue-500 transition-colors">角色库</h3>
             <p className="text-text-secondary text-xs opacity-80">管理和生成你的专属角色形象</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors !transition-all !duration-500">
             <UserOutlined className="text-lg text-blue-500 group-hover:text-white" />
           </div>
        </div> */}

        {/* Card 3: General Settings */}
        {/* <div className="glass-card p-5 rounded-2xl hover:border-primary/50 transition-all duration-300 group relative overflow-hidden flex items-center justify-between hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10 cursor-pointer" onClick={() => {
          if (!isAuthenticated) {
            setLoginModalOpen(true);
            return;
          }
          navigate('/settings');
        }}>
           <div className="flex flex-col justify-center">
             <h3 className="text-text-primary text-lg font-bold mb-1 group-hover:text-indigo-500 transition-colors">系统设置</h3>
             <p className="text-text-secondary text-xs opacity-80">快速设置API Key、路径等配置</p>
           </div>
           <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center group-hover:bg-indigo-500 group-hover:text-white transition-colors !transition-all !duration-500">
             <SettingOutlined className="text-lg text-indigo-500 group-hover:text-white" />
           </div>
        </div> */}
      {/* </div> */}

      {/* Project List Section */}
      <div className='px-2'>
        <div className="flex justify-between items-center mb-4">
          <div className="flex justify-between ">
            <Title level={4} className="!text-text-primary !m-0 font-bold tracking-tight">我的创作</Title>
          </div>
          {projects.length > 0? (
            <Button type="primary" className="bg-gradient-to-r from-primary border-none shadow-lg shadow-primary/30" icon={<RocketOutlined />} onClick={openCreateModal}>
                  创建项目
                </Button>):<div></div>
          }
        </div>

        {projects.length > 0 ? (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {projects.map((item) => (
                <Card
                  key={item.id}
                  hoverable
                  onClick={() => navigate(`/projects/${item.id}`)}
                  className="glass-card border-transparent hover:border-primary/50 group overflow-hidden flex flex-col h-full !transition-all !duration-300 hover:!-translate-y-2 hover:!shadow-2xl hover:!shadow-primary/10"
                  actions={[
                    <div key="edit" onClick={(e) => { e.stopPropagation(); navigate(`/projects/${item.id}`); }} className="flex items-center justify-center gap-1 text-text-secondary hover:text-primary transition-colors py-1 text-xs"><EditOutlined /> 编辑</div>,
                    <div key="delete" onClick={(e) => item.id && handleDelete(e, item.id)} className="flex items-center justify-center gap-1 text-text-secondary hover:text-red-500 transition-colors py-1 text-xs"><DeleteOutlined /> 删除</div>,
                  ]}
                  styles={{ 
                    body: { padding: '16px', minHeight: '120px', flex: 1, display: 'flex', flexDirection: 'column' },
                    actions: { borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.2)' }
                  }}
                >
                  <div className="flex flex-col h-full">
                    {/* Title & Status */}
                    <div className="flex justify-between items-start mb-3 gap-2">
                       <h3 className="text-text-primary text-base font-bold m-0 line-clamp-2 leading-snug flex-1 group-hover:text-primary transition-colors min-h-[44px]" title={item.name}>
                         {item.name}
                       </h3>
                    </div>
                    
                    {/* Tags / Meta */}
                    <div className="flex flex-wrap gap-2 mb-4 content-start flex-1">
                      {/* Aspect Ratio */}
                      <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 rounded text-xs text-text-secondary border border-white/5 h-fit">
                        {item.aspectRatio === '9:16' ? <MobileOutlined /> : <DesktopOutlined />}
                        <span>{item.aspectRatio}</span>
                      </div>
                      
                      {/* Visual Style */}
                      {item.visualStyle && (
                         <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded text-xs text-primary border border-primary/10 h-fit">
                           <PictureOutlined />
                           <span className="truncate max-w-[100px]" title={item.visualStyle}>{item.visualStyle}</span>
                         </div>
                      )}
                    </div>
                    
                    {/* Footer */}
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                      <div className="flex items-center gap-1.5 text-text-secondary/60">
                        <ClockCircleOutlined className="text-xs" />
                        <span className="text-xs">
                          {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            {/* Infinite Scroll Sentinel / Loading Indicator */}
            <div ref={observerTarget} className="h-20 flex items-center justify-center mt-4">
              {loading && <Spin tip="正在加载更多..." />}
              {!loading && !hasMore && projects.length > 0 && total > pageSize && (
                <span className="text-text-secondary text-sm">没有更多内容了</span>
              )}
            </div>
          </>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center h-64 glass-card rounded-2xl border-dashed border-2 border-border/50 hover:border-primary/50 transition-colors cursor-pointer group" onClick={openCreateModal}>
              <div className="w-16 h-16 bg-bg-element rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-inner">
                <BulbOutlined className="text-3xl text-text-secondary group-hover:text-primary transition-colors" />
              </div>
              <h3 className="text-lg font-bold text-text-primary mb-1">暂无创作</h3>
              <p className="text-text-secondary text-xs mb-4">开始你的第一个 AI 视频创作吧</p>
              <Button type="primary" icon={<RocketOutlined />} className="bg-gradient-to-r from-primary to-purple-600 border-none shadow-lg shadow-primary/30">
                一键生成项目
              </Button>
            </div>
          )
        )}
        
        {loading && projects.length === 0 && (
          <div className="flex justify-center items-center h-64">
            <Spin size="large" tip="正在加载创作列表..." />
          </div>
        )}
      </div>

      <CreateCom
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={handleCreateSuccess}
        type="project"
      />

      {/* API Key Configuration Modal */}
      <Modal
        title="一键配置接口服务"
        open={apiKeyModalVisible}
        onCancel={() => {
          setApiKeyModalVisible(false);
          apiKeyForm.resetFields();
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setApiKeyModalVisible(false);
              apiKeyForm.resetFields();
            }}
          >
            取消
          </Button>,
          <Button
            key="submit"
            type="primary"
            loading={savingApiKey}
            onClick={handleApiKeySubmit}
          >
            确认配置
          </Button>,
        ]}
        width={600}
      >
        <div className="py-4">
          <div className="mb-6">
            <p className="text-text-secondary mb-4">将自动创建以下配置：</p>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>文本服务：gemini-3-pro-preview</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>图片服务：{getImageModelsDisplay()}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2">•</span>
                <span>视频服务：{getVideoModelsDisplay()}</span>
              </li>
            </ul>
          </div>

          <Form
            form={apiKeyForm}
            layout="vertical"
          >
            <Form.Item
              name="zeroapiKey"
              label={<span className="text-text-primary">API Key</span>}
              rules={[{ required: true, message: '请输入服务商密钥' }]}
            >
              <Input.Password 
                placeholder="请输入零界 API Key" 
                size="large"
              />
            </Form.Item>
          </Form>

          <div className="text-text-secondary/60 text-xs">
            没有 API Key？{' '}
            <a
              href="#"
              className="text-primary hover:text-primary/80"
              onClick={(e) => {
                e.preventDefault();
                openExternalUrl('https://zeroapi.cn/');
              }}
            >
              点击注册
            </a>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ProjectList;
