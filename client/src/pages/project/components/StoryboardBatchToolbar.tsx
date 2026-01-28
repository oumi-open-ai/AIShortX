/**
 * 分镜批量操作工具栏组件
 * 提供批量生成图片、视频、推理提示词、导出素材和删除等功能
 */
import React, { useState } from 'react';
import { Button, Tooltip, Dropdown, Modal, message } from 'antd';
import type { MenuProps } from 'antd';
import {
  PictureOutlined,
  VideoCameraOutlined,
  DeleteOutlined,
  DownloadOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import JSZip from 'jszip';
import type { StoryboardFrame, Character, Scene, Prop } from '../../../types/workflow';

/**
 * 分镜批量操作工具栏属性
 */
interface StoryboardBatchToolbarProps {
  /** 选中的分镜数量 */
  selectedCount: number;
  /** 批量生成分镜图回调 */
  onBatchGenerateImages: (mode: 'all' | 'missing') => void;
  /** 批量生成分镜视频回调 */
  onBatchGenerateVideos: (mode: 'all' | 'missing') => void;
  /** 批量删除回调 */
  onBatchDelete: () => void;
  /** 批量推理提示词回调 */
  onBatchInferPrompts?: (mode: 'all' | 'missing') => Promise<void>;
  /** 缺失图片的数量 */
  missingImagesCount: number;
  /** 缺失视频的数量 */
  missingVideosCount: number;
  /** 缺失提示词的数量 */
  missingPromptsCount: number;
  /** 选中的分镜列表 */
  selectedStoryboards: StoryboardFrame[];
  /** 角色列表 */
  characters: Character[];
  /** 场景列表 */
  scenes: Scene[];
  /** 物品列表 */
  props: Prop[];
  /** 项目名称 */
  projectName?: string;
  /** 剧集名称 */
  episodeName?: string;
}

/**
 * 分镜批量操作工具栏组件
 */
export const StoryboardBatchToolbar: React.FC<StoryboardBatchToolbarProps> = ({
  selectedCount,
  onBatchGenerateImages,
  onBatchGenerateVideos,
  onBatchDelete,
  onBatchInferPrompts,
  missingImagesCount,
  missingVideosCount,
  missingPromptsCount,
  selectedStoryboards,
  characters,
  scenes,
  props,
  projectName = '项目',
  episodeName = '剧集'
}) => {
  // 推理提示词加载状态
  const [inferringPrompts, setInferringPrompts] = useState(false);

  // 如果没有选中任何分镜，不显示工具栏
  if (selectedCount === 0) {
    return null;
  }

  /**
   * 处理删除按钮点击
   * 显示确认弹窗并执行删除操作
   */
  const handleDeleteClick = () => {
    let modalInstance: ReturnType<typeof Modal.confirm>;
    
    modalInstance = Modal.confirm({
      title: '确认删除',
      content: `确定要删除选中的 ${selectedCount} 个分镜吗？此操作无法恢复。`,
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      centered: true,
      onOk: async () => {
        // 更新弹窗内容为删除进度
        modalInstance.update({
          title: '正在删除',
          content: `正在删除 ${selectedCount} 个分镜，请稍候...`,
          okButtonProps: { loading: true, disabled: true },
          cancelButtonProps: { disabled: true }
        });

        try {
          await onBatchDelete();
          // 删除成功后关闭弹窗
          modalInstance.destroy();
        } catch (error) {
          // 删除失败，恢复弹窗状态
          modalInstance.update({
            title: '删除失败',
            content: '删除分镜时发生错误，请重试。',
            okText: '确定',
            okType: 'primary',
            okButtonProps: { loading: false, disabled: false },
            cancelButtonProps: { style: { display: 'none' } }
          });
        }
      }
    });
  };

  /**
   * 批量推理提示词
   * @param mode - 推理模式：'all' 全部推理，'missing' 只推理缺失的
   */
  const handleBatchInferPrompts = async (mode: 'all' | 'missing') => {
    if (!onBatchInferPrompts) return;
    
    setInferringPrompts(true);
    try {
      await onBatchInferPrompts(mode);
    } catch (error) {
      console.error('批量推理失败:', error);
    } finally {
      setInferringPrompts(false);
    }
  };

  /**
   * 下载文件的辅助函数
   * @param url - 文件URL
   * @returns 文件Blob对象
   */
  const downloadFile = async (url: string): Promise<Blob> => {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to fetch ${url}`);
    return await response.blob();
  };

  /**
   * 导出素材
   * 将选中分镜的相关素材打包下载
   * @param type - 导出类型：角色、场景、物品、分镜图或视频
   */
  const handleExportAssets = async (type: 'characters' | 'scenes' | 'props' | 'images' | 'videos') => {
    if (selectedStoryboards.length === 0) {
      message.warning('没有选中的分镜');
      return;
    }

    const zip = new JSZip();
    let assets: Array<{ url: string; name: string }> = [];
    let typeName = '';

    try {
      // 根据类型收集资源
      if (type === 'characters') {
        typeName = '导出角色';
        const characterIds = new Set<string>();
        selectedStoryboards.forEach(frame => {
          (frame.characterIds || []).forEach(id => characterIds.add(id));
        });
        
        characters.forEach(char => {
          if (characterIds.has(char.id) && char.imageUrl) {
            assets.push({ url: char.imageUrl, name: char.name });
          }
        });
      } else if (type === 'scenes') {
        typeName = '导出场景';
        const sceneIds = new Set<string>();
        selectedStoryboards.forEach(frame => {
          if (frame.sceneId) sceneIds.add(frame.sceneId);
        });
        
        scenes.forEach(scene => {
          if (sceneIds.has(scene.id) && scene.imageUrl) {
            assets.push({ url: scene.imageUrl, name: scene.name });
          }
        });
      } else if (type === 'props') {
        typeName = '导出物品';
        const propIds = new Set<string>();
        selectedStoryboards.forEach(frame => {
          (frame.propIds || []).forEach(id => propIds.add(id));
        });
        
        props.forEach(prop => {
          if (propIds.has(prop.id) && prop.imageUrl) {
            assets.push({ url: prop.imageUrl, name: prop.name });
          }
        });
      } else if (type === 'images') {
        typeName = '导出分镜图';
        selectedStoryboards.forEach((frame, index) => {
          if (frame.imageUrl) {
            assets.push({ url: frame.imageUrl, name: `分镜${index + 1}` });
          }
        });
      } else if (type === 'videos') {
        typeName = '导出视频';
        selectedStoryboards.forEach((frame, index) => {
          if (frame.videoUrl) {
            assets.push({ url: frame.videoUrl, name: `分镜${index + 1}` });
          }
        });
      }

      if (assets.length === 0) {
        message.warning('没有可导出的素材');
        return;
      }

      // 显示进度
      message.loading({
        content: `正在导出 0/${assets.length}...`,
        duration: 0,
        key: 'export-progress'
      });

      // 下载并添加到压缩包
      for (let i = 0; i < assets.length; i++) {
        const asset = assets[i];
        try {
          message.loading({
            content: `正在导出 ${asset.name} (${i + 1}/${assets.length})`,
            duration: 0,
            key: 'export-progress'
          });

          const blob = await downloadFile(asset.url);
          const ext = asset.url.split('.').pop()?.split('?')[0] || 'jpg';
          zip.file(`${asset.name}.${ext}`, blob);
        } catch (error) {
          console.error(`Failed to download ${asset.name}:`, error);
        }
      }

      // 生成压缩包
      message.loading({
        content: '正在生成压缩包...',
        duration: 0,
        key: 'export-progress'
      });

      const content = await zip.generateAsync({ type: 'blob' });
      
      // 下载压缩包
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${projectName}-${episodeName}-${typeName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      message.success({
        content: `导出完成！共 ${assets.length} 个素材`,
        key: 'export-progress'
      });
    } catch (error) {
      console.error('导出失败:', error);
      message.error({
        content: '导出失败',
        key: 'export-progress'
      });
    }
  };

  return (
    <div className="fixed bottom-8 left-1/2 z-50" style={{ transform: 'translateX(-50%)' }}>
      <div className="bg-[#1f1f1f] border border-white/10 rounded-full shadow-2xl px-6 py-3 flex items-center gap-6 backdrop-blur-xl animate-slide-up">
        {/* 选择信息 */}
        <div className="flex items-center gap-2 text-white/90 text-sm font-medium px-2">
          <span>已选择</span>
          <span className="text-primary text-lg font-bold">{selectedCount}</span>
          <span>项</span>
        </div>

        {/* 分隔线 */}
        <div className="w-px h-6 bg-white/10" />

        {/* 全选 */}
        {/* <Button
          type="text"
          size="small"
          onClick={onSelectAll}
          className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-3 rounded-full text-sm"
        >
          全选
        </Button> */}

        {/* 反选 */}
        {/* <Button
          type="text"
          size="small"
          onClick={onInvertSelection}
          className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-3 rounded-full text-sm"
        >
          反选
        </Button> */}

        {/* 取消选择 */}
        {/* <Button
          type="text"
          size="small"
          onClick={onClearSelection}
          className="text-white/60 hover:text-white hover:bg-white/10 h-8 px-3 rounded-full text-sm"
        >
          取消选择
        </Button> */}

        {/* 分隔线 */}
        {/* <div className="w-px h-6 bg-white/10" /> */}

        {/* 批量生成分镜图 */}
        <Dropdown
          dropdownRender={(menu) => (
            <div className="bg-bg-element border border-border rounded-lg shadow-lg overflow-hidden w-60">
              {/* Dropdown Header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <PictureOutlined className="text-base" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium text-white">批量生成分镜图</span>
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
                  <div className="py-1">
                    <div className="font-medium mb-1">全部生成</div>
                    <div className="text-xs text-text-secondary">
                      覆盖并重新生成所有素材。
                    </div>
                  </div>
                ),
                onClick: () => onBatchGenerateImages('all')
              },
              {
                key: 'missing',
                label: (
                  <div className="py-1">
                    <div className="font-medium mb-1">缺失生成</div>
                    <div className="text-xs text-text-secondary">
                      {missingImagesCount > 0 
                        ? `生成 ${missingImagesCount} 个缺失分镜图片。`
                        : '没有缺失的素材可生成。'
                      }
                    </div>
                  </div>
                ),
                onClick: () => onBatchGenerateImages('missing'),
                disabled: missingImagesCount === 0
              }
            ] as MenuProps['items']
          }}
          placement="top"
          trigger={['click']}
        >
          <Tooltip title="批量生成分镜图" placement="top">
            <Button
              type="text"
              size="small"
              icon={<PictureOutlined className="text-base" />}
              className="text-white/60 hover:text-primary hover:bg-primary/10 h-8 w-8 flex items-center justify-center rounded-full transition-all"
            />
          </Tooltip>
        </Dropdown>

        {/* 批量生成分镜视频 */}
        <Dropdown
          dropdownRender={(menu) => (
            <div className="bg-bg-element border border-border rounded-lg shadow-lg overflow-hidden w-60">
              {/* Dropdown Header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <VideoCameraOutlined className="text-base" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium text-white">批量生成分镜视频</span>
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
                  <div className="py-1">
                    <div className="font-medium mb-1">全部生成</div>
                    <div className="text-xs text-text-secondary">
                      覆盖并重新生成所有视频。
                    </div>
                  </div>
                ),
                onClick: () => onBatchGenerateVideos('all')
              },
              {
                key: 'missing',
                label: (
                  <div className="py-1">
                    <div className="font-medium mb-1">缺失生成</div>
                    <div className="text-xs text-text-secondary">
                      {missingVideosCount > 0 
                        ? `生成 ${missingVideosCount} 个缺失分镜视频。`
                        : '没有缺失的视频可生成。'
                      }
                    </div>
                  </div>
                ),
                onClick: () => onBatchGenerateVideos('missing'),
                disabled: missingVideosCount === 0
              }
            ] as MenuProps['items']
          }}
          placement="top"
          trigger={['click']}
        >
          <Tooltip title="批量生成分镜视频" placement="top">
            <Button
              type="text"
              size="small"
              icon={<VideoCameraOutlined className="text-base" />}
              className="text-white/60 hover:text-primary hover:bg-primary/10 h-8 w-8 flex items-center justify-center rounded-full transition-all"
            />
          </Tooltip>
        </Dropdown>

        {/* 批量生成视频提示词 */}
        <Dropdown
          dropdownRender={(menu) => (
            <div className="bg-bg-element border border-border rounded-lg shadow-lg overflow-hidden w-60">
              {/* Dropdown Header */}
              <div className="px-4 py-3 border-b border-border">
                <div className="flex items-center gap-2">
                  <ThunderboltOutlined className="text-base" style={{ color: 'var(--color-primary)' }} />
                  <span className="font-medium text-white">批量生成视频提示词</span>
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
                  <div className="py-1">
                    <div className="font-medium mb-1">全部生成</div>
                    <div className="text-xs text-text-secondary">
                      覆盖并重新生成所有提示词。
                    </div>
                  </div>
                ),
                onClick: () => handleBatchInferPrompts('all'),
                disabled: inferringPrompts
              },
              {
                key: 'missing',
                label: (
                  <div className="py-1">
                    <div className="font-medium mb-1">缺失生成</div>
                    <div className="text-xs text-text-secondary">
                      {missingPromptsCount > 0 
                        ? `生成 ${missingPromptsCount} 个缺失提示词。`
                        : '没有缺失的提示词可生成。'
                      }
                    </div>
                  </div>
                ),
                onClick: () => handleBatchInferPrompts('missing'),
                disabled: missingPromptsCount === 0 || inferringPrompts
              }
            ] as MenuProps['items']
          }}
          placement="top"
          trigger={['click']}
          disabled={inferringPrompts || !onBatchInferPrompts}
        >
          <Tooltip title="批量生成视频提示词" placement="top">
            <Button
              type="text"
              size="small"
              icon={<ThunderboltOutlined className="text-base" spin={inferringPrompts} />}
              loading={inferringPrompts}
              disabled={inferringPrompts || !onBatchInferPrompts}
              className="text-white/60 hover:text-primary hover:bg-primary/10 h-8 w-8 flex items-center justify-center rounded-full transition-all"
            />
          </Tooltip>
        </Dropdown>

       

        {/* 导出素材 */}
        <Dropdown
          dropdownRender={(menu) => (
            <div className="bg-bg-element border border-border rounded-lg shadow-lg overflow-hidden w-50">
              
              {/* Menu Items */}
              <div className="py-1">
                {menu}
              </div>
            </div>
          )}
          menu={{
            items: [
              
              {
                key: 'characters',
                label: (
                  <div className="py-1">
                    <div className="font-medium">导出角色</div>
                  </div>
                ),
                onClick: () => handleExportAssets('characters')
              },
              {
                key: 'scenes',
                label: (
                  <div className="py-1">
                    <div className="font-medium">导出场景</div>
                  </div>
                ),
                onClick: () => handleExportAssets('scenes')
              },
              {
                key: 'props',
                label: (
                  <div className="py-1">
                    <div className="font-medium">导出物品</div>
                  </div>
                ),
                onClick: () => handleExportAssets('props')
              },
              {
                key: 'images',
                label: (
                  <div className="py-1">
                    <div className="font-medium">导出分镜图</div>
                  </div>
                ),
                onClick: () => handleExportAssets('images')
              },
              {
                key: 'videos',
                label: (
                  <div className="py-1">
                    <div className="font-medium">导出视频</div>
                  </div>
                ),
                onClick: () => handleExportAssets('videos')
              },
            ] as MenuProps['items']
          }}
          placement="top"
          trigger={['click']}
        >
          <Tooltip title="导出素材" placement="top">
            <Button
              type="text"
              size="small"
              icon={<DownloadOutlined className="text-base" />}
              className="text-white/60 hover:text-primary hover:bg-primary/10 h-8 w-8 flex items-center justify-center rounded-full transition-all"
            />
          </Tooltip>
        </Dropdown>

      

         {/* 批量删除 */}
        <Tooltip title="批量删除分镜" placement="top">
          <Button
            type="text"
            size="small"
            icon={<DeleteOutlined className="text-base" style={{ color: '#ef4444' }} />}
            onClick={handleDeleteClick}
            className="hover:bg-red-500/10 h-8 w-8 flex items-center justify-center rounded-full transition-all"
            style={{ color: '#ef4444' }}
          />
        </Tooltip>
      </div>

      <style>{`
        @keyframes slide-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};
