/**
 * 图片预览组件
 * 显示图片并在hover时显示预览图标
 */
import React from 'react';
import { EyeOutlined } from '@ant-design/icons';
import { CachedImage } from './CachedImage';

interface ImagePreviewProps {
  src: string;
  alt?: string;
  onClick?: () => void;
  className?: string;
}

export const ImagePreview: React.FC<ImagePreviewProps> = ({ src, alt, onClick, className }) => {
  return (
    <div 
      className={`relative w-full h-full group cursor-pointer ${className || ''}`}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <CachedImage 
        src={src}
        className="w-full h-full object-cover"
        alt={alt}
      />
      <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/30 transition-colors">
          <EyeOutlined className="text-3xl text-white opacity-0 group-hover:opacity-100 transition-opacity drop-shadow-md" />
      </div>
    </div>
  );
};
