/**
 * 视频预览组件
 * 显示视频缩略图和播放按钮
 */
import React from 'react';
import { PlayCircleOutlined } from '@ant-design/icons';
import { CachedVideo } from './CachedVideo';

interface VideoPreviewProps {
  src: string;
  onClick: () => void;
}

export const VideoPreview: React.FC<VideoPreviewProps> = ({ src, onClick }) => {
  return (
    <div className="relative w-full h-full group cursor-pointer" onClick={(e) => {
      e.stopPropagation();
      onClick();
    }}>
      <CachedVideo 
        src={src}
        className="w-full h-full object-cover"
        playsInline
        muted
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <PlayCircleOutlined className="text-3xl text-white opacity-90 group-hover:opacity-100 drop-shadow-md" />
      </div>
    </div>
  );
};
