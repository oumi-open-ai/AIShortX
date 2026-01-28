/**
 * COS（对象存储）服务
 * 用于文件上传到本地后端（替代云端 COS）
 */
import api from './api';

export const cosService = {
  /**
   * 上传文件到本地后端
   * @param file - 要上传的文件
   * @param onProgress - 上传进度回调函数
   * @returns 文件URL
   */
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      // 可以添加 'type' 参数以便后端使用特定的文件夹逻辑
      // 但后端目前从 mimetype 推断类型
      
      const response = await api.post('/upload/file', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
           if (onProgress && progressEvent.total) {
             const percent = Math.floor((progressEvent.loaded * 100) / progressEvent.total);
             onProgress(percent);
           }
        }
      });
      
      // 后端返回 { url: '/uploads/...' }
      // 如果前端与后端分离运行（例如开发模式），
      // 可能需要在返回的相对 URL 前添加基础 URL
      // 通常 'api' axios 实例已配置 baseURL
      // 但返回的 URL 用于显示
      // 如果后端是 localhost:3000，图片 url 是 /uploads/x.png
      // 如果使用 <img src="/uploads/x.png" />，会尝试从前端开发服务器（localhost:5173）获取
      // 所以需要确保 URL 是绝对路径或配置 Vite 代理
      // 由于我们迁移到 Electron 本地应用，通常从同源提供静态文件或需要完整 URL
      
      // 现在假设后端返回相对路径如 /uploads/...
      // 如果在 Electron 中，可能需要完整路径？
      // 或者配置 `api.ts` 的 base URL 也用于图片？
      
      // 修改返回值以在需要时包含基础 URL
      // response.data.url 是我们获取的内容
      
      let fileUrl = response.data.url;
      if (fileUrl.startsWith('/') && !fileUrl.startsWith('http')) {
         // 如果在开发模式，可能需要添加 API 基础 URL
         // import.meta.env.VITE_API_BASE_URL 可能是 /api 或 http://localhost:3000/api
         // 我们需要 API 服务器的源
         
         const apiBase = import.meta.env.VITE_API_BASE_URL;
         if (apiBase && apiBase.startsWith('http')) {
             const urlObj = new URL(apiBase);
             fileUrl = `${urlObj.origin}${fileUrl}`;
         }
      }
      
      return fileUrl;
    } catch (error) {
      console.error('Failed to upload file locally:', error);
      throw error;
    }
  }
};
