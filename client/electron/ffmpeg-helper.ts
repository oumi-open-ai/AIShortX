import path from 'path';
import isDev from 'electron-is-dev';
import { app } from 'electron';
import os from 'os';

/**
 * 获取 FFmpeg 可执行文件路径
 */
export const getFfmpegPath = (): string => {
  if (isDev) {
    // 开发环境：从 node_modules 获取
    // ffmpeg-static 导出一个字符串路径
    try {
      // In CommonJS, we can use require directly
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      return require('ffmpeg-static') as string;
    } catch (error) {
      console.error('Failed to load ffmpeg-static:', error);
      return '';
    }
  }

  // 生产环境：从 resources 目录获取
  // 假设我们通过 electron-builder 的 extraResources 将其打包到了 resources 根目录
  const platform = os.platform();
  const execName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  
  // process.resourcesPath 在打包后指向 resources 目录
  return path.join(process.resourcesPath, execName);
};

/**
 * 获取 FFprobe 可执行文件路径
 */
export const getFfprobePath = (): string => {
  if (isDev) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const ffprobe = require('ffprobe-static');
      return ffprobe.path;
    } catch (error) {
      console.error('Failed to load ffprobe-static:', error);
      return '';
    }
  }

  const platform = os.platform();
  const execName = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
  
  return path.join(process.resourcesPath, execName);
};
