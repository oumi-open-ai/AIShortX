/**
 * 物品详情面板组件
 * 用于显示和编辑物品的详细信息，包括图片生成、上传和历史记录
 */
import React, { useEffect, useState } from 'react';
import { Button, Input, Spin, Upload, message, Popover, Dropdown, Tooltip } from 'antd';
import { ArrowLeftOutlined, PictureOutlined, HistoryOutlined, UploadOutlined, EllipsisOutlined, EyeOutlined, DownloadOutlined, PlusOutlined } from '@ant-design/icons';
import type { Prop } from '../../../types/workflow';
import type { Asset } from '../../../types';
import { characterService } from '../../../services/characterService';
import { assetService } from '../../../services/assetService';
import { ModelSelector } from '../../../components/ModelSelector';
import { CachedAntdImage } from '../../../components/CachedAntdImage';
import { CachedImage } from '../../../components/CachedImage';

const { TextArea } = Input;

interface PropDetailPanelProps {
  prop: Prop;
  onBack: () => void;
  onUpdateProp: (field: keyof Prop, value: any) => void;
  onGenerateImage: (model?: { model: string; provider: string }) => void;
  projectId?: number;
}

export const PropDetailPanel: React.FC<PropDetailPanelProps> = ({
  prop,
  onBack,
  onUpdateProp,
  onGenerateImage,
  projectId
}) => {
  const [historyAssets, setHistoryAssets] = useState<Asset[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [selectedModel, setSelectedModel] = useState<{ model: string; provider: string }>();
  const [uploading, setUploading] = useState(false);
  const prevStatusRef = React.useRef<string | undefined>(undefined);

  useEffect(() => {
    loadHistoryAssets();
    prevStatusRef.current = prop.status;
  }, [prop.id]);

  /**
   * 监听物品状态变化，生成完成后刷新历史记录
   */
  useEffect(() => {
    // 只在状态真正从非 generated 变为 generated 时刷新
    if (prop.status === 'generated' && 
        prop.imageUrl && 
        prevStatusRef.current !== 'generated' &&
        prevStatusRef.current !== undefined) {
      loadHistoryAssets(false); // 静默刷新，不显示加载状态
    }
    prevStatusRef.current = prop.status;
  }, [prop.status, prop.imageUrl]);

  /**
   * 加载历史资源记录
   */
  const loadHistoryAssets = async (showLoading = true) => {
    const numericId = parseInt(prop.id);
    if (isNaN(numericId)) return;

    if (showLoading) {
      setLoadingHistory(true);
    }
    try {
      const assets = await assetService.getAssets(numericId, 'prop_image', 'image');
      setHistoryAssets(assets);
    } catch (error) {
      console.error('Failed to load history assets:', error);
    } finally {
      if (showLoading) {
        setLoadingHistory(false);
      }
    }
  };

  /**
   * 下载物品图片
   */
  const handleDownload = async () => {
    if (!prop.imageUrl) return;
    
    try {
      const response = await fetch(prop.imageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${prop.name || 'prop'}.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      message.success('下载成功');
    } catch (error) {
      console.error('Download failed:', error);
      message.error('下载失败');
    }
  };



  return (
    <div className="w-full h-full bg-bg-card flex flex-col overflow-hidden">
      {/* Fixed Header */}
      <div className="flex-none px-0 py-2 border-b border-border bg-bg-card z-10">
        <div className="flex items-center gap-3">
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={onBack}
            className="text-text-secondary hover:text-text-primary"
          >
            返回物品列表
          </Button>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <div className="p-4 space-y-4">
          {/* Image Preview */}
          <div>
            <div className="text-text-secondary text-xs mb-2">物品图</div>
            <div className="bg-bg-element rounded-lg overflow-hidden border border-border aspect-video relative group">
              {(prop.status as string) === 'generating' ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                  <Spin />
                  <span className="text-xs text-text-secondary">生成中...</span>
                </div>
              ) : prop.imageUrl ? (
                <>
                  <CachedAntdImage
                    src={prop.imageUrl}
                    alt={prop.name}
                    className="w-full h-full object-cover"
                    preview={{
                      visible: previewVisible,
                      onVisibleChange: (visible) => setPreviewVisible(visible),
                    }}
                    style={{ display: 'block' }}
                  />
                  {/* Uploading Overlay */}
                  {uploading && (
                    <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-20">
                      <Spin />
                      <span className="text-xs text-white">上传中...</span>
                    </div>
                  )}
                  {/* Hover Overlay with Preview, Download and Upload Buttons */}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 pointer-events-none z-10">
                    <Tooltip title="预览">
                      <div className="pointer-events-auto">
                        <div
                          className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                          onClick={() => setPreviewVisible(true)}
                        >
                          <EyeOutlined style={{ fontSize: '18px' }} />
                        </div>
                      </div>
                    </Tooltip>
                    <Tooltip title="下载">
                      <div className="pointer-events-auto">
                        <div
                          className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                          onClick={handleDownload}
                        >
                          <DownloadOutlined style={{ fontSize: '18px' }} />
                        </div>
                      </div>
                    </Tooltip>
                    <Tooltip title="上传素材">
                      <div className="pointer-events-auto">
                        <Upload
                          accept="image/*"
                          showUploadList={false}
                          disabled={(prop.status as string) === 'generating' || uploading}
                          customRequest={async (options) => {
                            try {
                              setUploading(true);
                              const url = await characterService.uploadFile(options.file as File);
                              onUpdateProp('imageUrl', url);
                              onUpdateProp('status', 'generated');

                              if (projectId) {
                                await assetService.createAsset({
                                  projectId,
                                  type: 'image',
                                  usage: 'prop',
                                  relatedId: parseInt(prop.id) || undefined,
                                  url: url,
                                  source: 'upload'
                                });
                                
                                // 重新加载历史记录
                                await loadHistoryAssets(false); // 静默刷新
                              }

                              message.success('上传成功');
                            } catch (err) {
                              message.error('上传失败');
                            } finally {
                              setUploading(false);
                            }
                          }}
                        >
                          <div
                            className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                          >
                            <PlusOutlined style={{ fontSize: '18px' }} />
                          </div>
                        </Upload>
                      </div>
                    </Tooltip>
                  </div>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary gap-3">
                  {prop.status === 'failed' ? (
                    <div className="text-red-500 flex flex-col items-center gap-2">
                      <PictureOutlined className="text-4xl" />
                      <span className="text-sm font-medium">生成失败</span>
                    </div>
                  ) : uploading ? (
                    <div className="flex flex-col items-center gap-2">
                      <Spin />
                      <span className="text-xs text-text-secondary">上传中...</span>
                    </div>
                  ) : (
                    <>
                      <PictureOutlined className="text-4xl opacity-50" />
                      <span className="text-sm opacity-70">暂无物品图</span>
                    </>
                  )}
                  {!uploading && (
                    <Upload
                      accept="image/*"
                      showUploadList={false}
                      disabled={(prop.status as string) === 'generating' || uploading}
                      customRequest={async (options) => {
                        try {
                          setUploading(true);
                          const url = await characterService.uploadFile(options.file as File);
                          onUpdateProp('imageUrl', url);
                          onUpdateProp('status', 'generated');

                          if (projectId) {
                            await assetService.createAsset({
                              projectId,
                              type: 'image',
                              usage: 'prop',
                              relatedId: parseInt(prop.id) || undefined,
                              url: url,
                              source: 'upload'
                            });
                            
                            // 重新加载历史记录
                            await loadHistoryAssets(false); // 静默刷新
                          }

                          message.success('上传成功');
                        } catch (err) {
                          message.error('上传失败');
                        } finally {
                          setUploading(false);
                        }
                      }}
                    >
                      <Button 
                        icon={<UploadOutlined />}
                        disabled={(prop.status as string) === 'generating' || uploading}
                      >
                        本地图片
                      </Button>
                    </Upload>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Prop Name */}
          <div>
            <div className="text-text-secondary text-xs mb-2">物品名称</div>
            <Input
              value={prop.name}
              onChange={(e) => onUpdateProp('name', e.target.value)}
              placeholder="输入物品名称..."
              className="text-lg font-medium"
            />
          </div>

          {/* Prop Description */}
          <div>
            <div className="text-text-secondary text-xs mb-2">物品描述</div>
            <TextArea
              value={prop.description}
              onChange={(e) => onUpdateProp('description', e.target.value)}
              placeholder="描述物品的特征..."
              autoSize={{ minRows: 6, maxRows: 12 }}
              className="text-sm"
            />
          </div>

          {/* Model Selector and Generate Button */}
          <div className="flex items-center gap-2">
            <ModelSelector
              type="image"
              value={selectedModel}
              onChange={setSelectedModel}
              size="small"
              placeholder="选择模型"
              className="flex-1"
            />
            <Button
              type="primary"
              icon={<PictureOutlined />}
              onClick={() => onGenerateImage(selectedModel)}
              loading={(prop.status as string) === 'generating'}
              disabled={(prop.status as string) === 'generating' || uploading}
              className="flex-1 h-10 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-none shadow-lg shadow-green-900/20 font-medium"
            >
              {(prop.status as string) === 'generating' ? '生成中...' : (prop.imageUrl ? '重新生成' : '生成物品图')}
            </Button>
          </div>

          {/* History Section */}
          <div>
            <div className="flex items-center gap-2 mb-2 text-text-secondary text-xs">
              <HistoryOutlined />
              <span>历史记录</span>
            </div>
            
            {loadingHistory ? (
              <div className="flex items-center justify-center py-8">
                <Spin size="small" />
              </div>
            ) : historyAssets.length === 0 ? (
              <div className="text-center py-8 text-text-secondary text-sm">
                暂无历史记录
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {historyAssets.map((asset) => (
                  <Popover
                    key={asset.id}
                    placement="top"
                    content={
                      asset.url ? (
                        <div className="p-2 bg-bg-card border border-border rounded-lg shadow-lg">
                          <CachedImage 
                            src={asset.url} 
                            alt="历史记录预览" 
                            className="max-w-[300px] max-h-[300px] object-contain rounded-md shadow-sm" 
                          />
                        </div>
                      ) : null
                    }
                    trigger="hover"
                    mouseEnterDelay={0.5}
                    overlayStyle={{ pointerEvents: 'none' }}
                  >
                    <div
                      className={`aspect-video bg-bg-element rounded-lg border overflow-hidden cursor-pointer transition-all relative group/history ${
                        asset.url === prop.imageUrl
                          ? 'border-primary ring-2 ring-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => {
                        if (asset.url) {
                          onUpdateProp('imageUrl', asset.url);
                          onUpdateProp('status', 'generated');
                          message.success('已应用历史生成结果');
                        }
                      }}
                    >
                      {asset.url ? (
                        <>
                          <CachedImage
                            src={asset.url}
                            alt="历史记录"
                            className="w-full h-full object-contain"
                          />
                          {/* Fixed Dropdown Button in Bottom Right */}
                          <Dropdown
                            menu={{
                              items: [
                                {
                                  key: 'download',
                                  label: '下载',
                                  onClick: async (e) => {
                                    e.domEvent.stopPropagation();
                                    try {
                                      const response = await fetch(asset.url!);
                                      const blob = await response.blob();
                                      const url = window.URL.createObjectURL(blob);
                                      const link = document.createElement('a');
                                      link.href = url;
                                      link.download = `prop-${prop.name}-${asset.id}.png`;
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
                              className="absolute bottom-1 right-1 w-6 h-6 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all z-10"
                              onClick={(e) => e.stopPropagation()}
                              onMouseEnter={(e) => e.stopPropagation()}
                            >
                              <EllipsisOutlined style={{ fontSize: '12px' }} />
                            </div>
                          </Dropdown>
                        </>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-bg-element text-text-secondary text-xs">
                          图片
                        </div>
                      )}
                    </div>
                  </Popover>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
