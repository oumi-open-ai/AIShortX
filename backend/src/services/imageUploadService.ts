import axios from 'axios';
import FormData from 'form-data';

/**
 * 图片上传服务类
 * 提供图片上传到图床的功能，支持多个图床备用方案
 */
export class ImageUploadService {
  /** FreeImage 图床的 API 密钥 */
  private static FREEIMAGE_KEY = '6d207e02198a847aa98d0a2a901485a5';

  /**
   * 上传 Buffer 到图床
   * 优先使用 freeimage.host，失败后使用中转图床
   * @param buffer 图片 Buffer
   * @param fileType 文件类型标识
   * @param ext 文件扩展名
   * @returns 上传后的图片 URL
   */
  static async uploadBuffer(buffer: Buffer, fileType: string, ext: string = '.png'): Promise<string> {
    try {
      // 尝试使用 freeimage.host 上传
      return await this.uploadToFreeImage(buffer, ext);
    } catch (error) {
      console.error('FreeImage 上传失败，尝试备用方案:', error);
      try {
        // 备用方案：使用中转图床
        return await this.uploadToTransfer(buffer, ext);
      } catch (fallbackError) {
        console.error('所有上传方案均失败:', fallbackError);
        throw new Error('图片上传失败');
      }
    }
  }

  /**
   * 上传到 freeimage.host
   * 主要上传方案
   * @param buffer 图片 Buffer
   * @param ext 文件扩展名
   * @returns 上传后的图片 URL
   */
  private static async uploadToFreeImage(buffer: Buffer, ext: string): Promise<string> {
    const base64Data = buffer.toString('base64');
    
    const formData = new FormData();
    formData.append('key', this.FREEIMAGE_KEY);
    formData.append('action', 'upload');
    formData.append('source', base64Data);
    formData.append('format', 'json');

    const response = await axios.post('https://freeimage.host/api/1/upload', formData, {
      headers: formData.getHeaders(),
    });

    if (response.status === 200 && response.data.status_code === 200 && response.data.image?.url) {
      return response.data.image.url;
    }
    
    throw new Error(response.data.error?.message || 'FreeImage 上传失败');
  }

  /**
   * 上传到中转图床
   * 备用上传方案
   * @param buffer 图片 Buffer
   * @param ext 文件扩展名
   * @returns 上传后的图片 URL
   */
  private static async uploadToTransfer(buffer: Buffer, ext: string): Promise<string> {
    const formData = new FormData();
    formData.append('file', buffer, {
      filename: `upload${ext}`,
      contentType: this.getMimeType(ext),
    });

    const response = await axios.post('https://imageproxy.zhongzhuan.chat/api/upload', formData, {
      headers: formData.getHeaders(),
    });

    if (response.status === 200) {
      const result = response.data;
      if (result.code === 200 && result.data?.url) {
        return result.data.url;
      } else if (result.url) {
        return result.url;
      }
    }
    
    throw new Error('中转图床上传失败');
  }

  /**
   * 根据文件扩展名获取 MIME 类型
   * @param ext 文件扩展名
   * @returns MIME 类型字符串
   */
  private static getMimeType(ext: string): string {
    const mimeTypes: { [key: string]: string } = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
    };
    return mimeTypes[ext.toLowerCase()] || 'application/octet-stream';
  }
}
