/**
 * 分镜预览模式组件
 * 提供全屏预览分镜图片和视频，支持键盘快捷键控制
 */
import React, { useState, useRef, useEffect } from 'react';
import { Spin ,Empty} from 'antd';
import type { StoryboardFrame, Character, Scene, Prop } from '../../../types/workflow';
import { CachedImage } from '../../../components/CachedImage';
import { CachedVideo } from '../../../components/CachedVideo';
import { useCachedFile } from '../../../hooks/useCachedFile';

/**
 * 分镜预览模式属性
 */
interface StoryboardPreviewModeProps {
  /** 分镜列表 */
  storyboards: StoryboardFrame[];
  /** 角色列表 */
  characters: Character[];
  /** 场景列表 */
  scenes?: Scene[];
  /** 物品列表 */
  props?: Prop[];
  /** 生成分镜图回调 */
  onGenerateImage?: (frameId: string) => void;
  /** 生成分镜视频回调 */
  onGenerateVideo?: (frameId: string) => void;
  /** 当前分镜索引（外部控制） */
  currentIndex?: number;
  /** 索引变化回调 */
  onIndexChange?: (index: number) => void;
  /** 打开图片生成面板回调 */
  onOpenImagePanel?: (frameId: string) => void;
  /** 打开视频生成面板回调 */
  onOpenVideoPanel?: (frameId: string) => void;
  /** 点击分镜时的回调 */
  onStoryboardClick?: (frameId: string) => void;
  /** 是否正在播放 */
  isPlaying?: boolean;
  /** 播放/暂停回调 */
  onPlayPause?: (playing: boolean) => void;
  /** 时间更新回调 */
  onTimeUpdate?: (time: number) => void;
  /** 时长变化回调 */
  onDurationChange?: (duration: number) => void;
  /** 播放结束回调 */
  onEnded?: () => void;
}

/**
 * 分镜预览模式组件
 */
export const StoryboardPreviewMode: React.FC<StoryboardPreviewModeProps> = ({
  storyboards,
  characters,
  onGenerateImage,
  onGenerateVideo,
  currentIndex: externalIndex,
  onIndexChange,
  onOpenImagePanel,
  onOpenVideoPanel,
  isPlaying = false,
  onPlayPause,
  onTimeUpdate,
  onDurationChange,
  onEnded
}) => {
  // 内部索引状态
  const [internalIndex, setInternalIndex] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // 使用外部传入的 index 或内部 state
  const currentIndex = externalIndex !== undefined ? externalIndex : internalIndex;
  const setCurrentIndex = onIndexChange || setInternalIndex;

  const currentFrame = storyboards[currentIndex];
  
  // 缓存当前分镜的图片（用于背景）
  const { localSrc: cachedBgImage } = useCachedFile(currentFrame?.imageUrl || '', 'image');
  
  /**
   * 视频播放控制
   * 根据 isPlaying 状态控制视频播放/暂停
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.play().catch(err => {
        console.error('播放失败:', err);
        onPlayPause?.(false);
      });
    } else {
      video.pause();
    }
  }, [isPlaying, currentFrame]);

  /**
   * 视频事件监听
   * 监听时间更新、元数据加载和播放结束事件
   */
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleTimeUpdate = () => {
      onTimeUpdate?.(video.currentTime);
    };

    const handleLoadedMetadata = () => {
      onDurationChange?.(video.duration);
    };

    const handleEndedEvent = () => {
      onEnded?.();
    };

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('ended', handleEndedEvent);

    // 如果视频已经加载，立即获取时长
    if (video.duration) {
      onDurationChange?.(video.duration);
    }

    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('ended', handleEndedEvent);
    };
  }, [currentFrame, onTimeUpdate, onDurationChange, onEnded]);

  /**
   * 键盘快捷键支持
   * 左右箭头切换分镜，空格键播放/暂停
   */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentIndex > 0) {
        setCurrentIndex(currentIndex - 1);
        onPlayPause?.(false);
      } else if (e.key === 'ArrowRight' && storyboards.length > 0 && currentIndex < storyboards.length - 1) {
        setCurrentIndex(currentIndex + 1);
        onPlayPause?.(false);
      } else if (e.key === ' ' && currentFrame?.videoUrl) {
        e.preventDefault();
        onPlayPause?.(!isPlaying);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, isPlaying, storyboards.length, currentFrame, setCurrentIndex, onPlayPause]);

  if (!currentFrame) {
    return (
      <div className="w-full h-full flex items-center justify-center">
          <Empty
                            image={Empty.PRESENTED_IMAGE_SIMPLE}
                            description={
                              <div className="text-center ">
                                <div className="text-text-secondary text-base mb-1">暂无分镜</div>
                              </div>
                            }
                          ></Empty>
      </div>
     
    );
  }

  return (
    <div className="w-full h-full flex flex-col">
      {/* 主预览区域 - flex-1 占据剩余空间 */}
      <div className="flex-1 min-h-0 flex flex-col">
        {/* 图片/视频预览容器 */}
        <div className="flex-1 min-h-0 flex items-center justify-center relative bg-black overflow-hidden">
          {/* 背景层 - 放大的分镜图作为背景 */}
          {currentFrame.imageUrl && (cachedBgImage || currentFrame.imageUrl) && (
            <div 
              className="absolute inset-0 bg-cover bg-center rounded-tl-[10px]"
              style={{ 
                backgroundImage: `url(${cachedBgImage || currentFrame.imageUrl})`,
                filter: 'blur(40px)',
                transform: 'scale(1.1)'
              }}
            />
          )}
          
          {/* 毛玻璃遮罩层 */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          
          {/* 内容层 */}
          <div className="relative z-10 flex items-center justify-center w-full h-full">
            {currentFrame.videoUrl ? (
              <CachedVideo
                key={currentFrame.id}
                ref={videoRef}
                src={currentFrame.highResVideoUrl || currentFrame.videoUrl}
                className="max-w-full max-h-full object-contain"
                loop={false}
                preload="metadata"
              />
            ) : currentFrame.imageUrl ? (
              <CachedImage
                key={currentFrame.id}
                src={currentFrame.imageUrl}
                alt={`分镜 ${currentIndex + 1}`}
                className="max-w-full max-h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 text-white/60">
                <svg viewBox="0 0 1024 1024" className="w-20 h-20" fill="currentColor">
                  <path d="M378.902489 215.782121c14.396738-31.880686 59.721889-31.880686 74.123746 0l78.869755 174.644926a203.197774 203.197774 0 0 0 101.499052 101.575848l174.619327 78.879994c31.880686 14.396738 31.880686 59.670691 0 74.06743l-174.619327 78.885114a203.146577 203.146577 0 0 0-101.499052 101.509291l-78.874875 174.706364c-14.401858 31.865327-59.716769 31.865327-74.118626 0l-78.874875-174.706364a203.146577 203.146577 0 0 0-101.499052-101.509291L23.909234 644.950319c-31.880686-14.396738-31.880686-59.670691 0-74.06743l174.619328-78.885114a203.202894 203.202894 0 0 0 101.499052-101.575848l78.874875-174.639806z" />
                </svg>
                <div className="text-sm">暂无预览内容</div>
              </div>
            )}
          </div>

          {/* 加载状态 */}
          {(currentFrame.imageStatus === 'generating' || currentFrame.status === 'generating_video') && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-20">
              <div className="flex flex-col items-center gap-3">
                <Spin size="large" />
                <div className="text-white text-sm">
                  {currentFrame.status === 'generating_video' ? '视频生成中...' : '图片生成中...'}
                </div>
              </div>
            </div>
          )}

        </div>

        {/* 剧本文字和操作按钮区域 - flex-none 固定高度 */}
        <div className="flex-none rounded-bl-lg rounded-br-lg">
          <div className="px-6 py-4 flex items-center justify-between gap-4">
            {/* 左侧：剧本文字 */}
            <div className="flex-1 flex items-center gap-3 min-w-0">
              <div className="text-white/85 text-sm flex-none flex items-center gap-1.5">
                <svg viewBox="0 0 1024 1024" className="w-5 h-5" fill="currentColor">
                  <path d="M854.6 288.7c6 6 9.4 14.1 9.4 22.6V928c0 17.7-14.3 32-32 32H192c-17.7 0-32-14.3-32-32V96c0-17.7 14.3-32 32-32h424.7c8.5 0 16.7 3.4 22.7 9.4l215.2 215.3zM790.2 326L602 137.8V326h188.2zM633.6 521.4c-3.1-3.1-8.2-3.1-11.3 0L506.6 637.1c-3.1 3.1-3.1 8.2 0 11.3l115.7 115.7c3.1 3.1 8.2 3.1 11.3 0l115.7-115.7c3.1-3.1 3.1-8.2 0-11.3L633.6 521.4z"/>
                </svg>
              </div>
              <div className="flex-1 min-w-0 group/text relative">
                <div className="text-white/85 text-base leading-relaxed truncate">
                  {currentFrame.text ? (
                    (() => {
                      const characterNames = (currentFrame.characterIds || [])
                        .map(charId => characters.find(c => c.id === charId)?.name)
                        .filter(Boolean) as string[];
                      
                      if (characterNames.length === 0) {
                        return currentFrame.text;
                      }
                      
                      const regex = new RegExp(`(${characterNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
                      const parts = currentFrame.text.split(regex);
                      
                      return parts.map((part, i) => {
                        if (characterNames.includes(part)) {
                          return (
                            <span key={i} className="text-primary font-semibold">
                              {part}
                            </span>
                          );
                        }
                        return <span key={i}>{part}</span>;
                      });
                    })()
                  ) : (
                    <span className="text-white/40">暂无剧本描述</span>
                  )}
                </div>
                
                {/* Hover 显示完整文本 */}
                {currentFrame.text && (
                  <div className="fixed left-1/2 -translate-x-1/2 bottom-[200px] w-full max-w-2xl bg-black/95 border border-white/20 rounded-lg px-4 py-3 opacity-0 invisible group-hover/text:opacity-100 group-hover/text:visible transition-all duration-200 z-50 shadow-xl backdrop-blur-sm pointer-events-none">
                    <div className="text-white text-sm leading-relaxed whitespace-pre-wrap">
                      {(() => {
                        const characterNames = (currentFrame.characterIds || [])
                          .map(charId => characters.find(c => c.id === charId)?.name)
                          .filter(Boolean) as string[];
                        
                        if (characterNames.length === 0) {
                          return currentFrame.text;
                        }
                        
                        const regex = new RegExp(`(${characterNames.map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g');
                        const parts = currentFrame.text.split(regex);
                        
                        return parts.map((part, i) => {
                          if (characterNames.includes(part)) {
                            return (
                              <span key={i} className="text-primary font-semibold">
                                {part}
                              </span>
                            );
                          }
                          return <span key={i}>{part}</span>;
                        });
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 右侧：操作按钮 */}
            <div className="flex-none flex gap-3">
              <div
                onClick={() => {
                  if (currentFrame.imageStatus === 'generating') return;
                  // 如果有打开面板的回调，使用它；否则直接生成
                  if (onOpenImagePanel) {
                    onOpenImagePanel(currentFrame.id);
                  } else {
                    onGenerateImage?.(currentFrame.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm transition-all ${
                  currentFrame.imageStatus === 'generating'
                    ? 'bg-[#3a3a3e] cursor-not-allowed opacity-50'
                    : 'bg-[#3a3a3e] hover:bg-[#424246] cursor-pointer'
                }`}
              >
                <svg viewBox="0 0 1024 1024" className="w-5 h-5 text-primary" fill="currentColor">
                  <path d="M378.902489 215.782121c14.396738-31.880686 59.721889-31.880686 74.123746 0l78.869755 174.644926a203.197774 203.197774 0 0 0 101.499052 101.575848l174.619327 78.879994c31.880686 14.396738 31.880686 59.670691 0 74.06743l-174.619327 78.885114a203.146577 203.146577 0 0 0-101.499052 101.509291l-78.874875 174.706364c-14.401858 31.865327-59.716769 31.865327-74.118626 0l-78.874875-174.706364a203.146577 203.146577 0 0 0-101.499052-101.509291L23.909234 644.950319c-31.880686-14.396738-31.880686-59.670691 0-74.06743l174.619328-78.885114a203.202894 203.202894 0 0 0 101.499052-101.575848l78.874875-174.639806z" />
                </svg>
                <span>生成分镜图</span>
              </div>
              <div
                onClick={() => {
                  if (currentFrame.status === 'generating_video') return;
                  // 如果有打开面板的回调，使用它；否则直接生成
                  if (onOpenVideoPanel) {
                    onOpenVideoPanel(currentFrame.id);
                  } else {
                    onGenerateVideo?.(currentFrame.id);
                  }
                }}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-white text-sm transition-all ${
                  currentFrame.status === 'generating_video'
                    ? 'bg-[#3a3a3e] cursor-not-allowed opacity-50'
                    : 'bg-[#3a3a3e] hover:bg-[#424246] cursor-pointer'
                }`}
              >
                <svg viewBox="0 0 1024 1024" className="w-5 h-5 text-primary" fill="currentColor">
                  <path d="M512 64C264.6 64 64 264.6 64 512s200.6 448 448 448 448-200.6 448-448S759.4 64 512 64zm144.1 454.9L437.7 677.8c-3.5 2.4-8.1-.1-8.1-4.4V350.6c0-4.3 4.6-6.8 8.1-4.4l218.4 158.9c3.8 2.7 3.8 8.1 0 10.8z" />
                </svg>
                <span>生成分镜视频</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 底部控制栏已移除，移至 StepStoryboard.tsx */}
    </div>
  );
};
