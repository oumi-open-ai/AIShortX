/**
 * 文件缓存 Hook
 * 用于管理图片和视频的本地缓存，提升加载性能
 */

import { useState, useEffect } from 'react';

/**
 * 验证本地文件是否完整可用
 * 通过尝试加载文件来检测文件是否损坏
 * 
 * @param path 文件路径
 * @param type 文件类型（video 或 image）
 * @returns Promise<boolean> 文件是否有效
 */
const validateLocalFile = (path: string, type: 'video' | 'image'): Promise<boolean> => {
  return new Promise((resolve) => {
    // 设置 5 秒超时，超时视为验证失败
    const timeout = setTimeout(() => {
      resolve(false);
    }, 5000);

    if (type === 'image') {
      // 验证图片文件
      const img = new Image();
      
      img.onload = () => {
        clearTimeout(timeout);
        resolve(true);  // 图片加载成功
      };
      
      img.onerror = () => {
        clearTimeout(timeout);
        resolve(false);  // 图片加载失败
      };
      
      img.src = path;
    } else {
      // 验证视频文件
      const video = document.createElement('video');
      
      video.onloadedmetadata = () => {
        clearTimeout(timeout);
        resolve(true);  // 视频元数据加载成功
      };
      
      video.onerror = () => {
        clearTimeout(timeout);
        resolve(false);  // 视频加载失败
      };
      
      video.preload = 'metadata';  // 只预加载元数据
      video.src = path;
    }
  });
};

/**
 * 文件缓存 Hook
 * 自动管理远程文件的本地缓存，支持图片和视频
 * 
 * 功能特性：
 * 1. 优先使用本地缓存，提升加载速度
 * 2. 验证缓存文件完整性，自动清理损坏文件
 * 3. 后台下载缓存，不阻塞 UI
 * 4. 支持浏览器和 Electron 环境
 * 
 * @param src 文件源 URL
 * @param type 文件类型（video 或 image）
 * @returns { localSrc, loading, error } 本地路径、加载状态、错误状态
 */
export const useCachedFile = (src: string, type: 'video' | 'image') => {
  const [localSrc, setLocalSrc] = useState<string>('');  // 本地文件路径
  const [loading, setLoading] = useState(true);          // 加载状态
  const [error, setError] = useState(false);             // 错误状态

  useEffect(() => {
    let mounted = true;  // 组件挂载标志，防止内存泄漏
    
    const cache = async () => {
      // ========== 步骤 1: 验证输入 ==========
      if (!src) {
        setLoading(false);
        return;
      }
      
      // ========== 步骤 2: 处理非 HTTP 资源 ==========
      // 如果已经是本地文件或 data URL，直接使用
      if (!src.startsWith('http')) {
          if (mounted) {
            setLocalSrc(src);
            setLoading(false);
          }
          return;
      }

      // ========== 步骤 3: 重置状态 ==========
      if (mounted) {
        setLoading(true);
        setError(false);
        setLocalSrc('');  // 重置本地源，避免显示旧内容
      }
      
      try {
        // ========== 步骤 4: Electron 环境处理 ==========
        if ((window as any).electronAPI) {
            // ---------- 4.1 检查缓存是否存在 ----------
            const cachedPath = await (window as any).electronAPI.checkCache(src, type);
            
            if (cachedPath) {
                // ---------- 4.2 格式化缓存路径 ----------
                // Electron 返回绝对路径，需要转换为 file:// URL
                const formattedPath = cachedPath.startsWith('http') 
                    ? cachedPath 
                    : `file:///${cachedPath.replace(/\\/g, '/')}`;
                
                // ---------- 4.3 验证缓存文件完整性 ----------
                const isValid = await validateLocalFile(formattedPath, type);
                
                if (isValid) {
                    // 文件完整，使用缓存
                    if (mounted) {
                        setLocalSrc(formattedPath);
                    }
                } else {
                    // ---------- 4.4 处理损坏的缓存 ----------
                    console.warn(`缓存的 ${type} 文件已损坏，正在清除缓存:`, src);
                    
                    // 通知 Electron 删除损坏的缓存
                    if ((window as any).electronAPI.clearCache) {
                        try {
                            await (window as any).electronAPI.clearCache(src, type);
                        } catch (err) {
                            console.error('清除损坏缓存失败:', err);
                        }
                    }
                    
                    // 使用远程 URL 作为降级方案
                    if (mounted) {
                        setLocalSrc(src);
                    }
                    
                    // 触发重新下载
                    (window as any).electronAPI.cacheFile(src, type).catch((err: any) => {
                        console.error('重新下载失败:', err);
                    });
                }
            } else {
                // ---------- 4.5 缓存不存在，使用远程 URL ----------
                if (mounted) {
                    setLocalSrc(src);
                }
                
                // 触发后台下载（不阻塞 UI）
                (window as any).electronAPI.cacheFile(src, type).catch((err: any) => {
                    console.error('后台缓存失败:', err);
                });
            }
        } else {
            // ========== 步骤 5: 浏览器环境降级处理 ==========
            if (mounted) setLocalSrc(src);
        }
      } catch (err) {
        console.error(`${type} 缓存失败:`, err);
        // 发生错误时降级使用远程 URL
        if (mounted) {
            setLocalSrc(src);
            setError(true);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    cache();

    // 清理函数：组件卸载时标记为未挂载
    return () => {
      mounted = false;
    };
  }, [src, type]);  // 依赖项：src 或 type 变化时重新执行

  return { localSrc, loading, error };
};
