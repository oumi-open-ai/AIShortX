/**
 * 资源浏览器弹窗组件
 * 用于浏览和选择历史生成的图片或视频资源
 * 支持资源预览、下载和恢复功能
 */
import React, { useEffect, useState } from 'react';
import { Modal, Empty, Spin, Button, message, Dropdown } from 'antd';
import { 
  VideoCameraOutlined, 
  CheckCircleOutlined,
  CloudUploadOutlined,
  RobotOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import { assetService } from '../services/assetService';
import type { Asset, Task } from '../types';
import { CachedVideo } from './CachedVideo';
import { CachedImage } from './CachedImage';

interface AssetBrowserModalProps {
  visible: boolean;
  onCancel: () => void;
  category: string;
  relatedId: number;
  onSelect: (task: Partial<Task>, asset: Asset) => void | Promise<void>;
  title?: string;
}

export const AssetBrowserModal: React.FC<AssetBrowserModalProps> = ({
  visible,
  onCancel,
  category,
  relatedId,
  onSelect,
  title
}) => {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | null>(null);

  useEffect(() => {
    if (visible && relatedId) {
      loadAssets();
      setSelectedAssetId(null);
    }
  }, [visible, relatedId, category]);

  /**
   * 加载资源列表
   * 根据类别和关联ID获取历史资源
   */
  const loadAssets = async () => {
    setLoading(true);
    try {
      const list = await assetService.getAssets(relatedId, category);
      setAssets(list);
    } catch (error) {
      console.error('Failed to load assets:', error);
      message.error('加载资源失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 确认选择资源
   * 将选中的资源传递给父组件
   */
  const handleConfirm = () => {
    if (!selectedAssetId) return;
    const asset = assets.find(a => a.id === selectedAssetId);
    if (!asset || !asset.url) return;
    
    // 根据资源用途和类型推断任务分类
    let inferredCategory = category;
    if (asset.usage === 'character') {
      inferredCategory = asset.type === 'video' ? 'character_video' : 'character_image';
    } else if (asset.usage === 'scene') {
      inferredCategory = 'scene_image';
    } else if (asset.usage === 'prop') {
      inferredCategory = 'prop_image';
    } else if (asset.usage === 'storyboard') {
      if (asset.type === 'video') {
         inferredCategory = 'storyboard_video';
      } else {
         inferredCategory = 'storyboard_image';
      }
    }

    // 构造一个模拟的任务对象传给父组件
    // 父组件通常需要 task 和 asset，但实际上主要使用 asset.url
    const mockTask: Partial<Task> = {
      id: asset.taskId || 0,
      category: inferredCategory as any,
      status: 'completed'
    };
    
    onSelect(mockTask, asset);
  };

  return (
    <Modal
      title={title || "资源库"}
      open={visible}
      onCancel={onCancel}
      width={800}
      destroyOnClose
      footer={[
        <Button key="cancel" onClick={onCancel}>取消</Button>,
        <Button 
          key="submit" 
          type="primary" 
          disabled={!selectedAssetId}
          onClick={handleConfirm}
        >
          恢复此版本
        </Button>
      ]}
    >
      <div className="min-h-[400px]">
        {loading ? (
          <div className="flex justify-center items-center h-[400px]">
            <Spin size="large" tip="加载资源中..." />
          </div>
        ) : assets.length === 0 ? (
          <div className="flex justify-center items-center h-[400px]">
            <Empty description="暂无可用资源" />
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-4 p-4 max-h-[60vh] overflow-y-auto custom-scrollbar">
            {assets.map(asset => {
              const isSelected = selectedAssetId === asset.id;
              const isVideo = asset.type === 'video';
              
              return (
                <div 
                  key={asset.id}
                  className={`
                    group relative aspect-[3/4] rounded-lg overflow-hidden cursor-pointer border-2 transition-all
                    ${isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-transparent hover:border-primary/50'}
                    bg-bg-element
                  `}
                  onClick={() => setSelectedAssetId(asset.id || null)}
                >
                  {/* Content */}
                  <div className="w-full h-full bg-black/20">
                    {isVideo ? (
                      <div className="w-full h-full flex items-center justify-center relative">
                         <CachedVideo 
                            src={asset.url || ''}
                            className="w-full h-full object-cover pointer-events-none"
                         />
                         <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-transparent transition-all">
                            <VideoCameraOutlined className="text-2xl text-white/80 drop-shadow-md" />
                         </div>
                      </div>
                    ) : (
                      <CachedImage 
                        src={asset.url || ''}
                        className="w-full h-full object-cover"
                      />
                    )}
                  </div>

                  {/* Fixed Dropdown Button in Bottom Right */}
                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'download',
                          label: '下载',
                          onClick: async (e) => {
                            e.domEvent.stopPropagation();
                            if (!asset.url) return;
                            try {
                              const response = await fetch(asset.url);
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement('a');
                              link.href = url;
                              const ext = isVideo ? 'mp4' : 'png';
                              link.download = `asset-${asset.id}.${ext}`;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              window.URL.revokeObjectURL(url);
                              message.success('下载成功');
                            } catch (error) {
                              console.error('Download failed:', error);
                              message.error('下载失败');
                            }
                          }
                        }
                      ]
                    }}
                    trigger={['hover']}
                  >
                    <div
                      className="absolute bottom-2 right-2 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all z-10"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <EllipsisOutlined style={{ fontSize: '12px' }} />
                    </div>
                  </Dropdown>

                  {/* Overlay Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center justify-between text-xs text-white/90">
                       <span className="flex items-center gap-1">
                         {asset.source === 'upload' ? <CloudUploadOutlined /> : <RobotOutlined />}
                         {asset.source === 'upload' ? '上传' : '生成'}
                       </span>
                    </div>
                    <div className="text-[10px] text-white/60 mt-0.5">
                      {new Date(asset.createdAt).toLocaleDateString()}
                    </div>
                  </div>

                  {/* Selection Indicator */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-primary bg-white rounded-full p-0.5 shadow-lg">
                      <CheckCircleOutlined className="text-xl block" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
};
