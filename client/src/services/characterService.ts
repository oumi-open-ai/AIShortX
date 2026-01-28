import { type UserCharacter } from '../types';
import api from './api';

/**
 * 角色服务
 * 提供角色库管理、文件上传等功能
 */
export const characterService = {
  /**
   * 获取全局角色库列表
   * @param page 页码
   * @param pageSize 每页大小
   * @returns 角色列表和总数
   */
  async getLibraryCharacters(page: number = 1, pageSize: number = 10): Promise<{ list: UserCharacter[], total: number }> {
    try {
      const response = await api.get('/characters', { params: { page, pageSize } });
      const data = response.data;
      
      const parseCharacter = (char: any) => ({
        ...char,
        createdAt: new Date(char.createdAt),
        updatedAt: new Date(char.updatedAt)
      });

      if (data.list && Array.isArray(data.list)) {
        return {
          list: data.list.map(parseCharacter),
          total: data.total || 0
        };
      } else if (Array.isArray(data)) {
        return {
          list: data.map(parseCharacter),
          total: data.length
        };
      }
      return { list: [], total: 0 };
    } catch (error) {
      console.error('获取角色库失败:', error);
      return { list: [], total: 0 };
    }
  },

  /**
   * 上传文件（主方法）
   * 优先使用 freeimage.host，失败后使用中转图床
   * @param file 要上传的文件
   * @param onProgress 上传进度回调
   * @returns 上传后的图片 URL
   */
  async uploadFile(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      // 使用 freeimage.host 上传
      return await this.uploadToFreeImage(file, onProgress);
    } catch (error) {
      // 备用方案：使用中转图床
      try {
        return await this.uploadToTransfer(file, onProgress);
      } catch (error) {
        throw new Error('上传失败');
      }
    }
  },

  /**
   * 上传到中转图床
   * 备用上传方案
   * @param file 要上传的文件
   * @param onProgress 上传进度回调
   * @returns 上传后的图片 URL
   */
  async uploadToTransfer(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              // 根据中转图床的响应格式调整
              if (result.code === 200 && result.data?.url) {
                resolve(result.data.url);
              } else if (result.url) {
                resolve(result.url);
              } else {
                reject(new Error(result.message || '上传失败'));
              }
            } catch (error) {
              reject(new Error('解析响应失败: ' + xhr.responseText));
            }
          } else {
            reject(new Error(`上传失败: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });

        xhr.open('POST', 'https://imageproxy.zhongzhuan.chat/api/upload');
        xhr.send(formData);
      });
    } catch (error) {
      console.error('中转图床上传失败:', error);
      throw error;
    }
  },

  /**
   * 上传到 freeimage.host
   * 主要上传方案
   * @param file 要上传的文件
   * @param onProgress 上传进度回调
   * @returns 上传后的图片 URL
   */
  async uploadToFreeImage(file: File, onProgress?: (percent: number) => void): Promise<string> {
    try {
      // 将文件转换为 base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // 移除 data:image/xxx;base64, 前缀
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const formData = new FormData();
      formData.append('key', '6d207e02198a847aa98d0a2a901485a5');
      formData.append('action', 'upload');
      formData.append('source', base64);
      formData.append('format', 'json');

      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable && onProgress) {
            const percent = Math.round((e.loaded / e.total) * 100);
            onProgress(percent);
          }
        });

        xhr.addEventListener('load', () => {
          if (xhr.status === 200) {
            try {
              const result = JSON.parse(xhr.responseText);
              if (result.status_code === 200 && result.image?.url) {
                resolve(result.image.url);
              } else {
                reject(new Error(result.error?.message || '上传失败'));
              }
            } catch (error) {
              reject(new Error('解析响应失败: ' + xhr.responseText));
            }
          } else {
            reject(new Error(`上传失败: ${xhr.status}`));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('网络错误'));
        });

        xhr.open('POST', 'https://freeimage.host/api/1/upload');
        xhr.send(formData);
      });
    } catch (error) {
      console.error('FreeImage 上传失败:', error);
      throw error;
    }
  },

  /**
   * 创建角色库角色
   * @param character 角色数据（不包含 id、创建时间、更新时间）
   * @returns 创建的角色 ID
   */
  async createLibraryCharacter(character: Omit<UserCharacter, 'id' | 'createdAt' | 'updatedAt'>): Promise<number> {
    try {
      // 创建角色
      const response = await api.post('/characters', {
        name: character.name,
        description: character.description,
        avatar: character.avatar,
        video: character.video,
        source: character.source,
        externalId: character.externalId
      });

      return response.data.id;
    } catch (error) {
      console.error('创建角色失败:', error);
      throw error;
    }
  },

  /**
   * 更新角色库角色
   * @param id 角色 ID
   * @param updates 要更新的字段
   * @returns 角色 ID
   */
  async updateLibraryCharacter(id: number, updates: Partial<UserCharacter>): Promise<number> {
    try {
      const payload: any = { ...updates };
      
      await api.put(`/characters/${id}`, payload);
      return id;
    } catch (error) {
      console.error('更新角色失败:', error);
      throw error;
    }
  },

  /**
   * 删除角色库角色
   * @param id 角色 ID
   */
  async deleteLibraryCharacter(id: number): Promise<void> {
    try {
      await api.delete(`/characters/${id}`);
    } catch (error) {
      console.error('删除角色失败:', error);
      throw error;
    }
  }
};
