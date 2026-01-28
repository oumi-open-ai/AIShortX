/**
 * 任务中心弹窗组件
 * 用于显示和管理AI生成任务
 */
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { Modal, Tag, Button, message, Popconfirm, Select, Space, Spin, Tooltip } from 'antd';
import { ReloadOutlined, DeleteOutlined, UserOutlined, VideoCameraOutlined, CloseOutlined, PictureOutlined, LeftOutlined, RightOutlined, StopOutlined } from '@ant-design/icons';
import { taskService } from '../services/taskService';
import type { Task } from '../types';
import { CachedVideo } from './CachedVideo';
import { CachedImage } from './CachedImage';
import { ImagePreview } from './ImagePreview';
import { VideoPreview } from './VideoPreview';

interface TaskCenterModalProps {
  visible: boolean;
  onCancel: () => void;
}

/**
 * 获取任务类别的显示文本
 */
const getCategoryText = (category: string) => {
  switch (category) {
      case 'character_image': return '角色图片';
      case 'character_video': return '角色视频';
      case 'storyboard_video': return '分镜视频';
      case 'storyboard_image': return '分镜图片';
      case 'scene_image': return '场景图片';
      case 'prop_image': return '物品图片';
      case 'upscale': return '高清放大';
      default: return '未知类型';
  }
};

export const TaskCenterModal: React.FC<TaskCenterModalProps> = ({ visible, onCancel }) => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState<string | undefined>(undefined);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<'video' | 'image'>('video');
  const [previewTitle, setPreviewTitle] = useState<string>('');
  const [previewAssets, setPreviewAssets] = useState<string[]>([]);
  const [previewIndex, setPreviewIndex] = useState(0);
  const observerTarget = useRef<HTMLDivElement>(null);

  /**
   * 打开预览弹窗
   */
  const handlePreview = (assets: string[], type: 'video' | 'image', title: string, index: number = 0) => {
    setPreviewAssets(assets);
    setPreviewIndex(index);
    setPreviewUrl(assets[index]);
    setPreviewType(type);
    setPreviewTitle(title);
  };

  /**
   * 切换到上一个资源
   */
  const handlePrevAsset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newIndex = (previewIndex - 1 + previewAssets.length) % previewAssets.length;
    setPreviewIndex(newIndex);
    setPreviewUrl(previewAssets[newIndex]);
  };

  /**
   * 切换到下一个资源
   */
  const handleNextAsset = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newIndex = (previewIndex + 1) % previewAssets.length;
    setPreviewIndex(newIndex);
    setPreviewUrl(previewAssets[newIndex]);
  };

  /**
   * 加载任务列表
   */
  const loadTasks = useCallback(async (pageNum = 1, size = 10, silent = false, isLoadMore = false) => {
    if (!silent) setLoading(true);
    try {
      const { list, total: totalCount } = await taskService.getAllTasks(
        pageNum, 
        size, 
        statusFilter === 'all' ? undefined : statusFilter,
        categoryFilter === 'all' ? undefined : categoryFilter
      );
      
      setTasks(prev => {
        const newTasks = isLoadMore ? [...prev, ...list] : list;
        setHasMore(newTasks.length < totalCount);
        return newTasks;
      });
      
      setTotal(totalCount);
      setPage(pageNum);
    } catch (error) {
      console.error('Failed to load tasks:', error);
      message.error('加载任务列表失败');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [categoryFilter, statusFilter]);

  useEffect(() => {
    if (visible) {
      loadTasks(1, pageSize);
    }
  }, [visible, categoryFilter, statusFilter, pageSize, loadTasks]);

  /**
   * 无限滚动监听器
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadTasks(page + 1, pageSize, false, true);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, page, pageSize, loadTasks]);

  /**
   * 刷新任务列表
   */
  const handleRefresh = () => {
      loadTasks(1, pageSize, false);
  };

  /**
   * 删除任务记录
   */
  const handleDelete = async (id: number) => {
    try {
      await taskService.deleteTask(id);
      message.success('任务记录已删除');
      // Optimistic update
      setTasks(prev => prev.filter(t => t.id !== id));
      setTotal(prev => prev - 1);
    } catch (error) {
      message.error('删除失败');
    }
  };

  /**
   * 取消正在执行的任务
   */
  const handleCancelTask = async (id: number) => {
    try {
      await taskService.cancelTask(id);
      message.success('任务已停止');
      setTasks(prev => prev.map(t => 
        t.id === id ? { ...t, status: 'failed', error: 'User cancelled manually' } : t
      ));
    } catch (error) {
      message.error('停止失败');
    }
  };

  /**
   * 获取任务的提示词描述
   */
  const getTaskPrompt = (task: Task) => {
      if (task.inputParams && task.inputParams.prompt) {
          return task.inputParams.prompt;
      }
      if (task.model === 'flash_vsr') {
          return '视频高清放大';
      }
      
      const text = getCategoryText(task.category);
      if (text === '未知类型') return '未知任务';
      // '高清放大' 不需要加 '生成' 后缀
      if (task.category === 'upscale') return text;
      
      return `${text}生成`;
  };

  /**
   * 获取模型的显示标签
   */
  const getTaskModelLabel = (model: string) => {
    switch (model) {
      case 'sora2': return '视频生成';
      case 'flash_vsr': return '高清放大';
      case 'qwen_image': return '图片生成';
      default: return model;
    }
  };

  /**
   * 获取任务类别对应的图标
   */
  const getCategoryIcon = (category: string) => {
    switch (category) {
        case 'character_image': return <PictureOutlined className="text-xs" />;
        case 'character_video': return <UserOutlined className="text-xs" />;
        case 'storyboard_video': return <VideoCameraOutlined className="text-xs" />;
        case 'storyboard_image': return <PictureOutlined className="text-xs" />;
        case 'scene_image': return <PictureOutlined className="text-xs" />;
        case 'prop_image': return <PictureOutlined className="text-xs" />;
        case 'upscale': return <ReloadOutlined className="text-xs" />;
        default: return <VideoCameraOutlined className="text-xs" />;
    }
  };

  /**
   * 获取任务类别对应的颜色样式
   */
  const getCategoryColorClass = (category: string, type: 'icon-bg' | 'tag-bg') => {
    switch (category) {
        case 'character_image':
            return type === 'icon-bg' ? 'bg-green-600/10 text-green-600' : 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400';
        case 'character_video':
            return type === 'icon-bg' ? 'bg-blue-600/10 text-blue-600' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400';
        case 'storyboard_video':
            return type === 'icon-bg' ? 'bg-purple-600/10 text-purple-600' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400';
        case 'storyboard_image':
            return type === 'icon-bg' ? 'bg-purple-600/10 text-purple-600' : 'bg-purple-50 text-purple-600 dark:bg-purple-900/20 dark:text-purple-400';
        case 'scene_image':
            return type === 'icon-bg' ? 'bg-cyan-600/10 text-cyan-600' : 'bg-cyan-50 text-cyan-600 dark:bg-cyan-900/20 dark:text-cyan-400';
        case 'prop_image':
            return type === 'icon-bg' ? 'bg-yellow-600/10 text-yellow-600' : 'bg-yellow-50 text-yellow-600 dark:bg-yellow-900/20 dark:text-yellow-400';
        case 'upscale':
            return type === 'icon-bg' ? 'bg-orange-600/10 text-orange-600' : 'bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400';
        default:
            return type === 'icon-bg' ? 'bg-gray-600/10 text-gray-600' : 'bg-gray-50 text-gray-600 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  return (
    <Modal
      title={null} // Remove default title to customize header
      open={visible}
      onCancel={onCancel}
      width={900}
      centered
      footer={null}
      styles={{ 
        body: { 
          padding: 0, // Remove padding as requested
          height: '600px', // Slightly taller for better view
          overflow: 'hidden', 
          backgroundColor: 'var(--color-bg-page)' // Use theme var
        }
      }}
      closeIcon={null} // We'll add a custom close button
      className="task-center-modal"
    >
      {/* Custom Header */}
      <div className="flex justify-between items-center px-6 py-4 bg-bg-card border-b border-border">
        <div className="text-lg font-bold text-text-primary">任务中心</div>
        <Space>
            <Select 
              placeholder="状态" 
              style={{ width: 120 }}
              onChange={setStatusFilter}
              value={statusFilter}
              options={[
                  { value: 'all', label: '全部状态' },
                  { value: 'pending', label: '等待中' },
                  { value: 'processing', label: '生成中' },
                  { value: 'completed', label: '已完成' },
                  { value: 'failed', label: '失败' },
              ]}
              variant="borderless"
              className="!bg-bg-element rounded-lg"
            />
            <Select 
              placeholder="全部类型" 
              allowClear={false}
              style={{ width: 120 }}
              onChange={setCategoryFilter}
              value={categoryFilter || 'all'}
              options={[
                  { value: 'all', label: '全部类型' },
                  { value: 'character_image', label: '角色图片' },
                  { value: 'character_video', label: '角色视频' },
                  { value: 'storyboard_video', label: '分镜视频' },
                  { value: 'storyboard_image', label: '分镜图片' },
                  { value: 'scene_image', label: '场景图片' },
                  { value: 'prop_image', label: '物品图片' },
                  { value: 'upscale', label: '高清放大' },
              ]}
              variant="borderless"
              className="!bg-bg-element rounded-lg"
            />
            <Button type="text" icon={<ReloadOutlined />} onClick={handleRefresh} loading={loading}>
              刷新
            </Button>
            <Button 
              type="text" 
              icon={<CloseOutlined />} 
              onClick={onCancel} 
              className="ml-2 flex items-center justify-center w-8 h-8"
            />
        </Space>
      </div>

      {/* Task List */}
      <div className="flex flex-col gap-3 overflow-y-auto h-[calc(100%-60px)] px-6 py-4 custom-scrollbar bg-bg-page">
          {tasks.length > 0 ? (
            <>
              {tasks.map((task) => {
                  const prompt = getTaskPrompt(task);
                  const validAssetUrls = task.assets?.filter(a => a.url).map(a => a.url!) || [];
                  const firstAssetUrl = validAssetUrls[0];
                  const isCompleted = task.status === 'completed';
                  const isProcessing = task.status === 'processing';
                  const isPending = task.status === 'pending';
                  const isFailed = task.status === 'failed';

                  return (
                      <div key={task.id} className="bg-bg-card rounded-xl overflow-hidden border border-border hover:border-primary/50 transition-colors duration-200 flex items-center group h-[120px] p-3 gap-4 shrink-0 shadow-sm">
                          
                          {/* Left: Info */}
                          <div className="flex-1 min-w-0 flex flex-col justify-center h-full py-1 pl-2">
                              <div className="flex items-center gap-2 mb-2">
                                  <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${getCategoryColorClass(task.category, 'icon-bg')}`}>
                                      {getCategoryIcon(task.category)}
                                  </div>
                                  <span className={`text-xs px-2 py-0.5 rounded ${getCategoryColorClass(task.category, 'tag-bg')}`}>
                                      {getCategoryText(task.category)}
                                  </span>
                                  <span className="text-xs px-2 py-0.5 rounded bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                                      {getTaskModelLabel(task.model)}
                                  </span>
                                  <div className="ml-auto flex items-center gap-2 mr-4">
                                      {isProcessing && <Spin size="small" />}
                                      {isPending && <Tag color="warning" className="m-0 text-xs border-0">排队中</Tag>}
                                      {isFailed && <Tag color="error" className="m-0 text-xs border-0">失败</Tag>}
                                      {isCompleted && <Tag color="success" className="m-0 text-xs border-0">完成</Tag>}
                                  </div>
                              </div>
                              
                              <Tooltip title={prompt}>
                                  <div className="text-text-primary text-sm font-medium line-clamp-2 mb-2 hover:text-primary transition-colors cursor-default">
                                      {prompt}
                                  </div>
                              </Tooltip>
                              
                              <div className="flex flex-wrap items-center text-xs text-text-secondary mt-2 select-none">
                                  <span>{new Date(task.createdAt).toLocaleString()}</span>
                                  {task.inputParams?.duration && (
                                    <>
                                      <span className="mx-2 opacity-30">|</span>
                                      <span>{task.inputParams.duration}s</span>
                                    </>
                                  )}
                                  {task.inputParams?.aspect_ratio && (
                                    <>
                                      <span className="mx-2 opacity-30">|</span>
                                      <span>
                                        {task.inputParams.aspect_ratio === '16:9' ? '横屏 16:9' : 
                                         task.inputParams.aspect_ratio === '9:16' ? '竖屏 9:16' : 
                                         task.inputParams.aspect_ratio === '1:1' ? '方形 1:1' :
                                         task.inputParams.aspect_ratio}
                                      </span>
                                    </>
                                  )}
                                  {task.inputParams?.images?.length > 0 && (
                                    <>
                                      <span className="mx-2 opacity-30">|</span>
                                      <span>{task.inputParams.images.length} 参考图</span>
                                    </>
                                  )}
                              </div>
                          </div>

                          {/* Right: Video/Image Preview (Fixed) */}
                          <div className="w-[140px] h-full bg-black rounded-lg overflow-hidden shrink-0 relative group/video border border-border">
                              {isCompleted && validAssetUrls.length > 1 && (
                                  <div className="absolute top-1 right-1 bg-black/60 text-white text-[10px] px-1.5 py-0.5 rounded backdrop-blur-sm z-20 pointer-events-none select-none">
                                      {validAssetUrls.length}
                                  </div>
                              )}
                              {isCompleted && firstAssetUrl ? (
                                  task.type === 'image' ? (
                                    <ImagePreview 
                                      src={firstAssetUrl} 
                                      onClick={() => handlePreview(validAssetUrls, 'image', '预览图片')}
                                      className="opacity-90 hover:opacity-100 transition-opacity"
                                    />
                                  ) : (
                                    <VideoPreview 
                                      src={firstAssetUrl} 
                                      onClick={() => handlePreview(validAssetUrls, 'video', '预览视频')}
                                    />
                                  )
                              ) : isProcessing ? (
                                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400">
                                      <Spin size="small" className="mb-2" />
                                      <span className="text-[10px] animate-pulse">生成中...</span>
                                  </div>
                              ) : isFailed ? (
                                  <Tooltip title={task.error || '任务失败'}>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-red-400/80 bg-red-900/10 cursor-help">
                                        <div className="text-xl mb-1">⚠️</div>
                                        <span className="text-[10px] px-2 text-center truncate w-full">{task.error || '失败'}</span>
                                    </div>
                                  </Tooltip>
                              ) : (
                                 <div className="absolute inset-0 flex items-center justify-center text-gray-600 text-xs bg-gray-50/50">
                                     <div className="flex flex-col items-center">
                                         <span className="text-[10px] text-gray-400 mb-1">等待处理</span>
                                         <span className="text-[9px] text-gray-300">排队中</span>
                                     </div>
                                 </div>
                              )}
                          </div>

                          {/* Far Right: Actions */}
                          <div className="w-[40px] flex flex-col items-center justify-center gap-2 h-full">
                              {(isProcessing || isPending) && (
                                <Tooltip title="强制停止">
                                  <Popconfirm
                                    title="确定停止该任务？"
                                    onConfirm={() => task.id && handleCancelTask(task.id)}
                                    okText="停止"
                                    cancelText="取消"
                                  >
                                    <Button 
                                      type="text" 
                                      size="small" 
                                      danger 
                                      icon={<StopOutlined />} 
                                      className="flex items-center justify-center w-8 h-8 hover:bg-red-500/10 rounded-lg"
                                    />
                                  </Popconfirm>
                                </Tooltip>
                              )}
                              
                              {(isFailed || isCompleted) && (
                                 <Tooltip title="删除任务">
                                   <Popconfirm
                                     title="确定删除该任务？"
                                     onConfirm={() => task.id && handleDelete(task.id)}
                                     okText="删除"
                                     cancelText="取消"
                                   >
                                     <Button 
                                       type="text" 
                                       size="small" 
                                       danger 
                                       icon={<DeleteOutlined />} 
                                       className="flex items-center justify-center w-8 h-8 hover:bg-red-500/10 rounded-lg"
                                     />
                                   </Popconfirm>
                                 </Tooltip>
                              )}
                          </div>
                      </div>
                  );
              })}
              
              {/* Infinite Scroll Sentinel / Loading Indicator */}
              <div ref={observerTarget} className="h-10 flex items-center justify-center shrink-0 py-4">
                {loading && <Spin size="small" tip="正在加载更多..." />}
                {!loading && !hasMore && tasks.length > 0 && total > pageSize && (
                  <span className="text-text-secondary text-xs">没有更多任务了</span>
                )}
              </div>
            </>
          ) : (
             !loading && (
              <div className="flex justify-center py-20 h-full items-center text-text-secondary">
                  暂无任务记录
              </div>
             )
          )}
          
          {loading && tasks.length === 0 && (
              <div className="flex justify-center py-20 h-full items-center">
                  <Spin size="large" tip="加载任务中..." />
              </div>
          )}
      </div>

      {/* Video/Image Preview Modal */}
      <Modal
        title={
          <div className="flex items-center gap-4">
            <span>{previewTitle}</span>
            {previewAssets.length > 1 && (
              <span className="text-sm font-normal text-gray-400">
                {previewIndex + 1} / {previewAssets.length}
              </span>
            )}
          </div>
        }
        open={!!previewUrl}
        footer={null}
        onCancel={() => setPreviewUrl(null)}
        width={1000}
        centered
        destroyOnClose
        className="video-preview-modal"
        styles={{ 
          body: { 
            padding: 0, 
            backgroundColor: '#1a1a1a', 
            height: '600px', 
            display: 'flex', 
            overflow: 'hidden'
          } 
        }}
        zIndex={1001}
      >
        {/* Main Preview Area */}
        <div className="flex-1 h-full relative flex items-center justify-center bg-black overflow-hidden">
            {/* Previous Button */}
            {previewAssets.length > 1 && (
            <div 
                className="absolute left-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 cursor-pointer transition-all hover:scale-110 select-none"
                onClick={handlePrevAsset}
            >
                <LeftOutlined className="text-xl" />
            </div>
            )}

            {previewUrl && (
            previewType === 'image' ? (
                <CachedImage 
                key={previewUrl}
                src={previewUrl} 
                className="max-w-full max-h-full object-contain select-none" 
                />
            ) : (
                <CachedVideo 
                key={previewUrl}
                src={previewUrl} 
                controls 
                autoPlay 
                className="max-w-full max-h-full object-contain" 
                />
            )
            )}

            {/* Next Button */}
            {previewAssets.length > 1 && (
            <div 
                className="absolute right-4 top-1/2 -translate-y-1/2 z-50 p-3 rounded-full bg-black/40 text-white/70 hover:text-white hover:bg-black/60 cursor-pointer transition-all hover:scale-110 select-none"
                onClick={handleNextAsset}
            >
                <RightOutlined className="text-xl" />
            </div>
            )}
        </div>

        {/* Sidebar: Thumbnail List */}
        {previewAssets.length > 1 && (
            <div className="w-[140px] h-full bg-[#1f1f1f] border-l border-[#333] flex flex-col shrink-0">
                <div className="p-3 text-xs text-gray-400 font-medium border-b border-[#333] flex justify-between items-center bg-[#252525]">
                    <span>资源列表</span>
                    <span>{previewAssets.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-2 custom-scrollbar">
                    {previewAssets.map((assetUrl, index) => {
                        const isSelected = index === previewIndex;
                        return (
                            <div 
                                key={index}
                                className={`
                                    relative aspect-square rounded-md overflow-hidden cursor-pointer transition-all duration-200 border-2
                                    ${isSelected ? 'border-primary opacity-100 shadow-md' : 'border-transparent opacity-60 hover:opacity-100 hover:border-white/20'}
                                `}
                                onClick={() => {
                                    setPreviewIndex(index);
                                    setPreviewUrl(assetUrl);
                                }}
                            >
                                {previewType === 'image' ? (
                                    <CachedImage 
                                        src={assetUrl}
                                        className="w-full h-full object-cover"
                                    />
                                ) : (
                                    <video 
                                        src={assetUrl}
                                        className="w-full h-full object-cover"
                                        muted
                                        preload="metadata"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        )}
      </Modal>
      </Modal>
  );
};
