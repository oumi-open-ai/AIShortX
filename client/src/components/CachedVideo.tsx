/**
 * 缓存视频组件
 * 使用本地缓存优化视频加载性能
 * 支持动态更新视频源并保持播放状态
 */
import React, { useState, forwardRef, useEffect, useRef } from 'react';
import { VideoCameraOutlined } from '@ant-design/icons';
import { useCachedFile } from '../hooks/useCachedFile';

interface CachedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  src: string;
}

export const CachedVideo = forwardRef<HTMLVideoElement, CachedVideoProps>(({ src, className, ...props }, ref) => {
  const { localSrc } = useCachedFile(src, 'video');
  const [videoError, setVideoError] = useState(false);
  const internalRef = useRef<HTMLVideoElement>(null);

  // 优先使用本地缓存，如果没有（正在加载或缓存失败）则使用远程链接
  const displaySrc = localSrc || src;

  // 当 displaySrc 变化时，更新 video 的 src（不重新创建元素）
  useEffect(() => {
    const videoElement = (ref && typeof ref !== 'function' ? ref.current : null) || internalRef.current;
    if (videoElement && displaySrc && videoElement.src !== displaySrc) {
      const wasPlaying = !videoElement.paused;
      const currentTime = videoElement.currentTime;
      
      videoElement.src = displaySrc;
      
      // 如果之前在播放，恢复播放状态
      if (wasPlaying) {
        videoElement.currentTime = currentTime;
        videoElement.play().catch(err => {
          console.error('恢复播放失败:', err);
        });
      }
    }
  }, [displaySrc, ref]);

  if (videoError || !displaySrc) {
      return (
        <div className={`flex items-center justify-center bg-black/5 text-gray-400 ${className}`}>
           <VideoCameraOutlined className="text-2xl" />
        </div>
      );
  }

  return (
    <video 
      ref={(node) => {
        // 同时设置内部 ref 和外部 ref
        internalRef.current = node;
        if (typeof ref === 'function') {
          ref(node);
        } else if (ref) {
          ref.current = node;
        }
      }}
      src={displaySrc} 
      className={className}
      onError={() => setVideoError(true)}
      preload="metadata"
      {...props}
    >
      <source src={displaySrc} type="video/mp4" />
    </video>
  );
});
