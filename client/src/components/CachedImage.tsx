/**
 * 缓存图片组件
 * 使用本地缓存优化图片加载性能
 * 优先使用本地缓存，失败时回退到远程URL
 */
import React from 'react';
import { PictureOutlined } from '@ant-design/icons';
import { useCachedFile } from '../hooks/useCachedFile';

interface CachedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
}

export const CachedImage: React.FC<CachedImageProps> = ({ src, className, alt, ...props }) => {
  const { localSrc } = useCachedFile(src, 'image');

  // 优先使用本地缓存，如果没有（正在加载或缓存失败）则使用远程链接
  const displaySrc = localSrc || src;

  if (!displaySrc) {
      return (
        <div className={`flex items-center justify-center bg-gray-100 text-gray-400 ${className}`}>
            <PictureOutlined />
        </div>
      );
  }

  return (
    <img 
      key={displaySrc}
      src={displaySrc} 
      className={className}
      alt={alt} 
      {...props} 
    />
  );
};
