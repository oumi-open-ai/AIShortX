/**
 * 分镜底部控制栏组件
 * 显示播放控制、时间信息和分镜缩略图轮播
 */
import React, { useRef, useEffect } from 'react';
import { Button, Spin } from 'antd';
import { PauseOutlined, PlayCircleOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import type { StoryboardFrame } from '../../../types/workflow';
import { CachedImage } from '../../../components/CachedImage';

/**
 * 分镜底部控制栏属性
 */
interface StoryboardBottomBarProps {
  /** 分镜列表 */
  storyboards: StoryboardFrame[];
  /** 当前分镜索引 */
  currentIndex: number;
  /** 索引变化回调 */
  onIndexChange: (index: number) => void;
  /** 是否正在播放 */
  isPlaying: boolean;
  /** 播放/暂停回调 */
  onPlayPause: () => void;
  /** 当前播放时间（秒） */
  currentTime: number;
  /** 当前视频时长（秒） */
  videoDuration: number;
  /** 所有视频的时长记录 */
  videoDurations: Record<string, number>;
}

/**
 * 分镜底部控制栏组件
 */
export const StoryboardBottomBar: React.FC<StoryboardBottomBarProps> = ({
  storyboards,
  currentIndex,
  onIndexChange,
  isPlaying,
  onPlayPause,
  currentTime,
  videoDuration,
  videoDurations,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const totalFrames = storyboards.length;
  const currentFrame = storyboards[currentIndex];
  const hasVideo = !!currentFrame?.videoUrl;

  /**
   * 格式化时间显示
   * @param seconds - 秒数
   * @returns 格式化的时间字符串 (MM:SS)
   */
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  /**
   * 自动滚动缩略图到当前位置
   */
  useEffect(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      const thumbnailWidth = 172; // 缩略图宽度 + gap
      const scrollPosition = currentIndex * thumbnailWidth - container.clientWidth / 2 + thumbnailWidth / 2;
      container.scrollTo({ left: scrollPosition, behavior: 'smooth' });
    }
  }, [currentIndex]);

  /**
   * 缩略图滚动控制
   * @param direction - 滚动方向
   */
  const scrollThumbnails = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 300; // 每次滚动的距离
      const newScrollLeft = scrollContainerRef.current.scrollLeft + (direction === 'right' ? scrollAmount : -scrollAmount);
      scrollContainerRef.current.scrollTo({ left: newScrollLeft, behavior: 'smooth' });
    }
  };

  /**
   * 处理缩略图点击
   * @param index - 分镜索引
   */
  const handleThumbnailClick = (index: number) => {
    onIndexChange(index);
  };

  if (!currentFrame) return null;

  return (
    <div className="h-[180px] px-4 bg-bg-card mt-6 rounded-t-lg">
      {/* 播放控制和时间显示 */}
      <div className="my-[10px]">
        <div className="flex justify-between items-center">
          <div className="flex-1 text-white/60 text-sm ">
            <span className=' text-white'>全部分镜</span>（数量：{totalFrames}）
          </div>
          <div className="flex  flex-1 items-center justify-center">
            <Button
              type="text"
              icon={isPlaying ? <PauseOutlined className="!text-xl" /> : <PlayCircleOutlined className="!text-xl" />}
              onClick={onPlayPause}
              disabled={!hasVideo}
              className="text-white hover:text-primary border-none disabled:text-white/30 flex items-center justify-center"
            />
            <div className="text-white text-sm text-center">
              {hasVideo ? (
                // 有视频：显示播放时长/总时长
                <span>
                  {formatTime(currentTime)} / {formatTime(videoDuration || currentFrame.duration || 0)}
                </span>
              ) : (
                // 无视频：显示当前分镜/总分镜数
                <span>
                  {currentIndex + 1} / {totalFrames}
                </span>
              )}
            </div>
          </div>
          <div className='flex-1'></div>
        </div>
      </div>

      {/* 缩略图轮播 */}
      <div className="relative flex items-center gap-2 pb-4">
        {/* 左箭头 */}
        <div
          onClick={() => scrollThumbnails('left')}
          className="flex-none w-8 h-[110px] rounded bg-[#323236] hover:bg-[#3a3a3e] text-white cursor-pointer flex items-center justify-center transition-colors"
        >
          <LeftOutlined />
        </div>

        {/* 缩略图容器 */}
        <div className="flex-1 overflow-y-hidden">
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto preview-scrollbar pb-2"
          >
            {storyboards.map((frame, index) => (
              <div
                key={frame.id}
                onClick={() => handleThumbnailClick(index)}
                className={`flex-none w-[160px] cursor-pointer group relative transition-all duration-200 `}
              >
                <div className="relative aspect-video bg-black/40 rounded overflow-hidden">
                  {frame.imageUrl ? (
                    <CachedImage
                      src={frame.imageUrl}
                      alt={`分镜 ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/40">
                      <svg viewBox="0 0 1024 1024" className="w-8 h-8" fill="currentColor">
                        <path d="M378.902489 215.782121c14.396738-31.880686 59.721889-31.880686 74.123746 0l78.869755 174.644926a203.197774 203.197774 0 0 0 101.499052 101.575848l174.619327 78.879994c31.880686 14.396738 31.880686 59.670691 0 74.06743l-174.619327 78.885114a203.146577 203.146577 0 0 0-101.499052 101.509291l-78.874875 174.706364c-14.401858 31.865327-59.716769 31.865327-74.118626 0l-78.874875-174.706364a203.146577 203.146577 0 0 0-101.499052-101.509291L23.909234 644.950319c-31.880686-14.396738-31.880686-59.670691 0-74.06743l174.619328-78.885114a203.202894 203.202894 0 0 0 101.499052-101.575848l78.874875-174.639806z" />
                      </svg>
                    </div>
                  )}
                  
                  {/* 当前播放指示器 */}
                  {index === currentIndex && (
                    <div className="absolute inset-0 bg-primary/10 border-2 border-primary rounded" />
                  )}

                  <div className="absolute top-1 left-1 flex">
                    {/* 序号标签 */}
                  <div className=" bg-black/70 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur-sm">
                    分镜{index + 1}
                  </div>

                  {/* 时长标识 */}
                  {frame.videoUrl && (
                    <div className="ml-[5px] bg-black/70 text-white text-xs px-1.5 py-0.5 rounded backdrop-blur-sm">
                      {Math.floor(videoDurations[frame.id] || frame.duration || 10)}s
                    </div>
                  )}
                  </div>
                  
                  {/* 生成中标识 */}
                  {(frame.imageStatus === 'generating' || frame.status === 'generating_video') && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <Spin size="small" />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右箭头 */}
        <div
          onClick={() => scrollThumbnails('right')}
          className="flex-none w-8 h-[110px] rounded bg-[#323236] hover:bg-[#3a3a3e] text-white cursor-pointer flex items-center justify-center transition-colors"
        >
          <RightOutlined />
        </div>
      </div>
    </div>
  );
};
