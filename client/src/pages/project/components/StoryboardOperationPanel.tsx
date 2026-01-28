/**
 * 分镜操作面板组件
 * 用于管理分镜的图片和视频生成，包括历史记录、参考图生成和提示词推理
 */
import React, { useState, useEffect } from 'react';
import { Button, Empty, message, Spin, Upload, Checkbox, Tooltip, Input, Dropdown } from 'antd';
import { useParams } from 'react-router-dom';
import {
    ReloadOutlined,
    PlusOutlined,
    HistoryOutlined,
    ThunderboltOutlined,
    ZoomInOutlined,
    SyncOutlined,
    DownloadOutlined,
    LeftOutlined,
    EllipsisOutlined
} from '@ant-design/icons';
import type { StoryboardFrame, Character, Scene, Prop } from '../../../types/workflow';
import { assetService } from '../../../services/assetService';
import { characterService } from '../../../services/characterService';
import type { Asset } from '../../../types';
import { prepareAndGenerateReferenceImage } from '../hooks/useStoryboardOperations';
import { ModelSelector } from '../../../components/ModelSelector';
import { CachedImage } from '../../../components/CachedImage';
import { CachedVideo } from '../../../components/CachedVideo';
import { CachedAntdImage } from '../../../components/CachedAntdImage';

const { TextArea } = Input;

interface StoryboardOperationPanelProps {
    storyboard?: StoryboardFrame;
    index?: number;
    characters?: Character[];
    scenes?: Scene[];
    props?: Prop[];
    aspectRatio?: '16:9' | '9:16';
    onGenerateImage?: (model?: { model: string; provider: string }) => void;
    onGenerateVideo?: (model?: { model: string; provider: string }) => void;
    onUpdateStoryboard?: (field: keyof StoryboardFrame, value: any) => void;
    onInferPrompt?: (frameId: string, silent?: boolean) => Promise<void>;
    activeTab?: 'image' | 'video';
    onTabChange?: (tab: 'image' | 'video') => void;
    onBack?: () => void;
}

export const StoryboardOperationPanel: React.FC<StoryboardOperationPanelProps> = ({
    storyboard,
    index = 0,
    characters = [],
    scenes = [],
    props = [],
    aspectRatio = '16:9',
    onGenerateImage,
    onGenerateVideo,
    onUpdateStoryboard,
    onInferPrompt,
    activeTab: propsActiveTab,
    onTabChange,
    onBack
}) => {
    const { id: projectId } = useParams();
    const [localActiveTab, setLocalActiveTab] = useState<'image' | 'video'>('image');
    const activeTab = propsActiveTab || localActiveTab;
    const setActiveTab = (tab: 'image' | 'video') => {
        if (onTabChange) {
            onTabChange(tab);
        }
        setLocalActiveTab(tab);
    };

    const [historyAssets, setHistoryAssets] = useState<Asset[]>([]);
    const [videoHistoryAssets, setVideoHistoryAssets] = useState<Asset[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [loadingVideoHistory, setLoadingVideoHistory] = useState(false);
    const [generatingRefImage, setGeneratingRefImage] = useState(false);
    const [inferringPrompt, setInferringPrompt] = useState(false);
    const [previewVisible, setPreviewVisible] = useState(false);
    const [storyboardImagePreviewVisible, setStoryboardImagePreviewVisible] = useState(false);
    const [selectedImageModel, setSelectedImageModel] = useState<{ model: string; provider: string }>();
    const [selectedVideoModel, setSelectedVideoModel] = useState<{ model: string; provider: string }>();
    const [uploading, setUploading] = useState(false);

    /**
     * 根据当前标签页加载对应的历史资源
     */
    useEffect(() => {
        if (storyboard?.id) {
            if (activeTab === 'image') {
                loadHistoryAssets();
            } else {
                loadVideoHistoryAssets();
            }
        } else {
            setHistoryAssets([]);
            setVideoHistoryAssets([]);
        }
    }, [storyboard?.id, activeTab, storyboard?.imageUrl, storyboard?.videoUrl]);

    /**
     * 加载分镜图历史资源
     */
    const loadHistoryAssets = async () => {
        if (!storyboard?.id) return;
        setLoadingHistory(true);
        try {
            const assets = await assetService.getAssets(parseInt(storyboard.id), 'storyboard_image', 'image');
            setHistoryAssets(assets);
        } catch (error) {
            console.error('Failed to load history assets:', error);
            message.error('加载历史素材失败');
        } finally {
            setLoadingHistory(false);
        }
    };

    /**
     * 加载分镜视频历史资源
     */
    const loadVideoHistoryAssets = async () => {
        if (!storyboard?.id) return;
        setLoadingVideoHistory(true);
        try {
            const assets = await assetService.getAssets(parseInt(storyboard.id), 'storyboard_video', 'video');
            setVideoHistoryAssets(assets);
        } catch (error) {
            console.error('Failed to load video history assets:', error);
            message.error('加载视频历史素材失败');
        } finally {
            setLoadingVideoHistory(false);
        }
    };

    /**
     * 上传分镜图片
     */
    const handleUpload = async (file: File) => {
        if (!projectId || !storyboard?.id) return;

        try {
            setUploading(true);
            const url = await characterService.uploadFile(file);

            await assetService.createAsset({
                projectId: parseInt(projectId),
                type: 'image',
                usage: 'storyboard',
                relatedId: parseInt(storyboard.id),
                url: url,
                source: 'upload'
            });

            message.success('上传成功');

            // 自动选中上传的图片
            if (onUpdateStoryboard) {
                onUpdateStoryboard('imageUrl', url);
            }

            loadHistoryAssets();
        } catch (error) {
            console.error('Upload failed:', error);
            message.error('上传失败');
        } finally {
            setUploading(false);
        }
    };

    /**
     * 下载分镜图片
     */
    const handleDownloadImage = async () => {
        if (!storyboard?.imageUrl) return;

        try {
            const response = await fetch(storyboard.imageUrl);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `storyboard-${index + 1}.png`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download failed:', error);
            message.error('下载失败');
        }
    };

    /**
     * 生成视频参考图
     */
    const handleGenerateRefImage = async () => {
        if (!storyboard) return;
        try {
            setGeneratingRefImage(true);
            const url = await prepareAndGenerateReferenceImage(
                storyboard,
                characters,
                scenes,
                props,
                aspectRatio
            );

            if (url) {
                if (onUpdateStoryboard) {
                    onUpdateStoryboard('referenceImageUrl', url);
                }
                message.success('参考图生成成功');
            } else {
                message.warning('所选范围内没有可用的参考图片，请检查是否已生成分镜图或关联角色/场景/物品图片');
            }
        } catch (error) {
            console.error('Failed to generate reference image:', error);
            message.error('生成参考图失败');
        } finally {
            setGeneratingRefImage(false);
        }
    };

    /**
     * 推理视频提示词
     */
    const handleInferPrompt = async () => {
        if (!storyboard?.text) {
            message.warning('请先输入分镜描述');
            return;
        }

        if (!storyboard?.id) {
            message.warning('请先保存分镜');
            return;
        }

        if (onInferPrompt) {
            setInferringPrompt(true);
            try {
                await onInferPrompt(storyboard.id, false);
            } catch (error) {
                console.error('Failed to infer prompt:', error);
            } finally {
                setInferringPrompt(false);
            }
        }
    };

    /**
     * 检查是否正在推理（本地状态或分镜状态）
     */
    const isInferring = inferringPrompt || storyboard?.status === 'generating_prompt';

    if (!storyboard) {
        return (
            <div className="w-full h-full bg-bg-card p-6 flex items-center justify-center text-text-secondary">
                <Empty description="请选择分镜" image={Empty.PRESENTED_IMAGE_SIMPLE} />
            </div>
        );
    }

    return (
        <div className="w-full h-full bg-bg-card flex flex-col overflow-hidden">
            {/* 固定头部 */}
            <div className="flex-none px-2 py-1.5 bg-bg-card z-10">
                <div className="grid grid-cols-[1fr_auto_1fr] items-center">
                    <div className="flex justify-start">
                        <Button
                            type="text"
                            icon={<LeftOutlined />}
                            onClick={onBack}
                            className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                        />
                    </div>

                    {/* 标签切换器 */}
                    <div className="flex justify-center">
                        <div className="grid grid-cols-2 bg-bg-element p-1 rounded-full w-[160px]">
                            <div
                                className={`flex items-center justify-center py-1.5 text-xs rounded-full cursor-pointer transition-all ${activeTab === 'image'
                                    ? 'bg-bg-card text-text-primary shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                onClick={() => setActiveTab('image')}
                            >
                                分镜图
                            </div>
                            <div
                                className={`flex items-center justify-center py-1.5 text-xs rounded-full cursor-pointer transition-all ${activeTab === 'video'
                                    ? 'bg-bg-card text-text-primary shadow-sm'
                                    : 'text-text-secondary hover:text-text-primary'
                                    }`}
                                onClick={() => setActiveTab('video')}
                            >
                                分镜视频
                            </div>
                        </div>
                    </div>

                    <div /> {/* 占位符 */}
                </div>
            </div>

            {/* 可滚动内容区域 */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-4 space-y-6">
                    {activeTab === 'image' ? (
                        <>
                            {/* 图片预览 */}
                            <div>
                                <div className="text-text-secondary text-xs mb-2">分镜图预览</div>
                                <div className="bg-bg-element rounded-lg overflow-hidden border border-border aspect-video relative group">
                                    {storyboard.imageStatus === 'generating' ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2 bg-bg-element">
                                            <Spin />
                                            <span className="text-xs text-text-secondary">生成中...</span>
                                        </div>
                                    ) : storyboard.imageUrl ? (
                                        <>
                                            <CachedAntdImage
                                                src={storyboard.imageUrl}
                                                alt={`分镜${index + 1}`}
                                                className="w-full h-full object-cover"
                                                preview={{
                                                    visible: storyboardImagePreviewVisible,
                                                    onVisibleChange: (val) => setStoryboardImagePreviewVisible(val)
                                                }}
                                            />
                                            {/* Uploading Overlay */}
                                            {uploading && (
                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-2 z-20">
                                                    <Spin />
                                                    <span className="text-xs text-white">上传中...</span>
                                                </div>
                                            )}
                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-10">
                                                <Tooltip title="放大查看">
                                                    <div
                                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setStoryboardImagePreviewVisible(true);
                                                        }}
                                                    >
                                                        <ZoomInOutlined style={{ fontSize: '18px' }} />
                                                    </div>
                                                </Tooltip>
                                                <Tooltip title="下载">
                                                    <div
                                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDownloadImage();
                                                        }}
                                                    >
                                                        <DownloadOutlined style={{ fontSize: '18px' }} />
                                                    </div>
                                                </Tooltip>
                                                <Tooltip title="上传素材">
                                                    <Upload
                                                        accept="image/*"
                                                        showUploadList={false}
                                                        disabled={uploading}
                                                        customRequest={async (options) => {
                                                            await handleUpload(options.file as File);
                                                        }}
                                                    >
                                                        <div
                                                            className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                                                        >
                                                            <PlusOutlined style={{ fontSize: '18px' }} />
                                                        </div>
                                                    </Upload>
                                                </Tooltip>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary bg-bg-element gap-3">
                                            {uploading ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Spin />
                                                    <span className="text-xs text-text-secondary">上传中...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="mb-2 text-2xl">🖼️</div>
                                                    <div className="text-xs">暂无分镜图</div>
                                                </>
                                            )}
                                            {!uploading && (
                                                <Upload
                                                    accept="image/*"
                                                    showUploadList={false}
                                                    disabled={uploading}
                                                    customRequest={async (options) => {
                                                        await handleUpload(options.file as File);
                                                    }}
                                                >
                                                    <Button icon={<PlusOutlined />}>
                                                        上传素材
                                                    </Button>
                                                </Upload>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>


                            {/* 模型选择器和生成按钮 */}
                            <div className="flex items-center gap-2">
                                <ModelSelector
                                    type="image"
                                    value={selectedImageModel}
                                    onChange={setSelectedImageModel}
                                    size="small"
                                    placeholder="选择模型"
                                    className="flex-1"
                                    capability="image2image"
                                />
                                <Button
                                    type="primary"
                                    className="flex-1 h-10 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 border-none shadow-lg shadow-orange-900/20 font-medium"
                                    icon={<ReloadOutlined spin={storyboard.imageStatus === 'generating'} />}
                                    onClick={() => onGenerateImage?.(selectedImageModel)}
                                    loading={storyboard.imageStatus === 'generating'}
                                    disabled={storyboard.imageStatus === 'generating' || uploading}
                                >
                                    {storyboard.imageStatus === 'generating' ? '生成中...' : (storyboard.imageUrl ? '重新生成' : '生成分镜图')}
                                </Button>
                            </div>
                            {/* 历史记录 */}
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-text-secondary text-xs">
                                    <HistoryOutlined />
                                    <span>分镜图历史素材</span>
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
                                        {historyAssets.map(asset => (
                                            <div
                                                key={asset.id}
                                                className={`aspect-video bg-bg-element rounded-lg border overflow-hidden relative group/history cursor-pointer ${asset.url === storyboard.imageUrl
                                                    ? 'border-primary ring-1 ring-primary'
                                                    : 'border-border hover:border-primary'
                                                    }`}
                                                onClick={() => {
                                                    if (onUpdateStoryboard && asset.url) {
                                                        onUpdateStoryboard('imageUrl', asset.url);
                                                    }
                                                }}
                                            >
                                                {asset.url ? (
                                                    <>
                                                        <CachedImage src={asset.url} alt="History" className="w-full h-full object-contain" />
                                                        {/* 右下角固定的下拉按钮 */}
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
                                                                                link.download = `storyboard-${index + 1}-${asset.id}.png`;
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
                                                            >
                                                                <EllipsisOutlined style={{ fontSize: '12px' }} />
                                                            </div>
                                                        </Dropdown>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-text-secondary">
                                                        图片
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="space-y-6">
                            {/* 参考图预览 */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-text-secondary text-xs">视频参考图</div>
                                </div>
                                <div className="bg-bg-element rounded-lg overflow-hidden border border-border relative group aspect-video">
                                    {storyboard.referenceImageUrl ? (
                                        <>
                                            <CachedAntdImage
                                                src={storyboard.referenceImageUrl}
                                                alt="视频参考图"
                                                className="w-full h-full object-contain bg-black/5"
                                                preview={{
                                                    visible: previewVisible,
                                                    onVisibleChange: (val) => setPreviewVisible(val)
                                                }}
                                            />

                                            {/* 生成中遮罩 */}
                                            {storyboard.status === 'generating_video' && (
                                                <div className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center z-20">
                                                    <Spin />
                                                    <span className="text-white text-xs mt-2">视频生成中...</span>
                                                </div>
                                            )}

                                            {/* Hover Overlay */}
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 z-10">
                                                <Tooltip title="放大查看">
                                                    <div
                                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            setPreviewVisible(true);
                                                        }}
                                                    >
                                                        <ZoomInOutlined style={{ fontSize: '18px' }} />
                                                    </div>
                                                </Tooltip>
                                                <Tooltip title="下载">
                                                    <div
                                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                                                        onClick={async (e) => {
                                                            e.stopPropagation();
                                                            if (!storyboard.referenceImageUrl) return;
                                                            try {
                                                                const response = await fetch(storyboard.referenceImageUrl);
                                                                const blob = await response.blob();
                                                                const url = window.URL.createObjectURL(blob);
                                                                const link = document.createElement('a');
                                                                link.href = url;
                                                                link.download = `reference-${index + 1}.png`;
                                                                document.body.appendChild(link);
                                                                link.click();
                                                                document.body.removeChild(link);
                                                                window.URL.revokeObjectURL(url);
                                                                message.success('下载成功');
                                                            } catch (error) {
                                                                console.error('Download failed:', error);
                                                                message.error('下载失败');
                                                            }
                                                        }}
                                                    >
                                                        <DownloadOutlined style={{ fontSize: '18px' }} />
                                                    </div>
                                                </Tooltip>
                                                <Tooltip title="重新生成">
                                                    <div
                                                        className="w-10 h-10 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center cursor-pointer backdrop-blur-sm transition-all transform hover:scale-110"
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleGenerateRefImage();
                                                        }}
                                                    >
                                                        <SyncOutlined spin={generatingRefImage} style={{ fontSize: '18px' }} />
                                                    </div>
                                                </Tooltip>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center text-text-secondary bg-bg-element cursor-pointer hover:bg-bg-element/80 transition-colors" onClick={handleGenerateRefImage}>
                                            {generatingRefImage || storyboard.status === 'generating_video' ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <Spin size="small" />
                                                    <span className="text-xs">{generatingRefImage ? '生成参考图中...' : '视频生成中...'}</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="mb-2 text-2xl">🧩</div>
                                                    <div className="text-xs">点击生成参考图</div>
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                                
                                {/* 参考范围选择 */}
                                <div className="mt-2">
                                    <Checkbox.Group
                                        className="w-full grid grid-cols-2 gap-2"
                                        value={storyboard.videoRefScope || (storyboard.imageUrl ? ['storyboard'] : ['character', 'scene', 'prop'])}
                                        onChange={(checkedValues) => {
                                            if (onUpdateStoryboard) {
                                                onUpdateStoryboard('videoRefScope', checkedValues);
                                            }
                                        }}
                                    >
                                        <Checkbox value="storyboard" className="text-sm">分镜图</Checkbox>
                                        <Checkbox value="character" className="text-sm">角色</Checkbox>
                                        <Checkbox value="scene" className="text-sm">场景</Checkbox>
                                        <Checkbox value="prop" className="text-sm">物品</Checkbox>
                                    </Checkbox.Group>
                                </div>
                            </div>

                            {/* 视频提示词 */}
                            <div>
                                <div className="flex justify-between items-center mb-2">
                                    <div className="text-text-secondary text-xs">视频提示词</div>
                                    <Button
                                        type="text"
                                        size="small"
                                        icon={<ThunderboltOutlined spin={isInferring} />}
                                        onClick={handleInferPrompt}
                                        loading={isInferring}
                                        disabled={isInferring || !storyboard.text}
                                        className="text-primary hover:text-primary/80 h-6 px-2"
                                    >
                                        自动推理
                                    </Button>
                                </div>
                                <div className="relative">
                                    <TextArea
                                        value={storyboard.prompt}
                                        onChange={(e) => {
                                            if (onUpdateStoryboard) {
                                                onUpdateStoryboard('prompt', e.target.value);
                                            }
                                        }}
                                        placeholder="输入视频生成的提示词..."
                                        autoSize={{ minRows: 3, maxRows: 6 }}
                                        className="text-sm"
                                        disabled={isInferring}
                                    />
                                    {/* 推理中蒙层 */}
                                    {isInferring && (
                                        <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px] rounded-lg flex items-center justify-center z-10">
                                            <div className="flex flex-col items-center gap-2">
                                                <Spin size="small" />
                                                <span className="text-white text-xs">推理中...</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* 模型选择器和生成按钮 */}
                            <div className="flex items-center gap-2">
                                <ModelSelector
                                    type="video"
                                    value={selectedVideoModel}
                                    onChange={setSelectedVideoModel}
                                    size="small"
                                    placeholder="选择模型"
                                    className="flex-1"
                                />
                                <Button
                                    type="primary"
                                    className="flex-1 h-10 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 border-none shadow-lg shadow-purple-900/20 font-medium"
                                    icon={<ThunderboltOutlined spin={storyboard.status === 'generating_video'} />}
                                    onClick={async () => {
                                        if (!onGenerateVideo) return;
                                        onGenerateVideo(selectedVideoModel);
                                    }}
                                    loading={storyboard.status === 'generating_video'}
                                    disabled={storyboard.status === 'generating_video' || isInferring}
                                >
                                    {storyboard.status === 'generating_video' ? '视频生成中...' : (storyboard.videoUrl ? '重新生成视频' : '生成视频')}
                                </Button>
                            </div>



                            {/* 历史记录 */}
                            <div>
                                <div className="flex items-center gap-2 mb-2 text-text-secondary text-xs">
                                    <HistoryOutlined />
                                    <span>分镜视频历史素材</span>
                                </div>
                                {loadingVideoHistory ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Spin size="small" />
                                    </div>
                                ) : videoHistoryAssets.length === 0 ? (
                                    <div className="text-center py-8 text-text-secondary text-sm">
                                        暂无历史记录
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-2">
                                        {videoHistoryAssets.map(asset => (
                                            <div
                                                key={asset.id}
                                                className={`aspect-video bg-bg-element rounded-lg border overflow-hidden relative group/history cursor-pointer ${asset.url === storyboard.videoUrl
                                                    ? 'border-primary ring-1 ring-primary'
                                                    : 'border-border hover:border-primary'
                                                    }`}
                                                onClick={() => {
                                                    if (onUpdateStoryboard && asset.url) {
                                                        onUpdateStoryboard('videoUrl', asset.url);
                                                    }
                                                }}
                                            >
                                                {asset.url ? (
                                                    <>
                                                        <CachedVideo src={asset.url} className="w-full h-full object-contain" />
                                                        {/* 右下角固定的下拉按钮 */}
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
                                                                                link.download = `storyboard-video-${index + 1}-${asset.id}.mp4`;
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
                                                            >
                                                                <EllipsisOutlined style={{ fontSize: '12px' }} />
                                                            </div>
                                                        </Dropdown>
                                                    </>
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-gray-800 text-xs text-text-secondary">
                                                        视频
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                    )}
                </div>
            </div>
        </div>
    );
};
