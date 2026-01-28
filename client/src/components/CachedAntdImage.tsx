/**
 * 缓存图片组件（Antd Image版本）
 * 使用本地缓存优化图片加载性能
 * 支持Antd Image的所有属性
 */
import React from 'react';
import { Image } from 'antd';
import type { ImageProps } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import { useCachedFile } from '../hooks/useCachedFile';

interface CachedAntdImageProps extends ImageProps {
  src: string;
}

export const CachedAntdImage: React.FC<CachedAntdImageProps> = ({ src, className, style, ...props }) => {
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
    <Image 
      key={displaySrc}
      src={displaySrc} 
      rootClassName={className}
      style={{ 
        width: '100%', 
        height: '100%', 
        objectFit: 'cover',
        display: 'block',
        ...style 
      }}
      {...props} 
    />
  );
};
