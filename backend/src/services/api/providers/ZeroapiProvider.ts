import axios from 'axios';
import { getResolutionFromRatio, urlToBase64 } from '../utils';
import { ImageUploadService } from '../../imageUploadService';
import {
  VideoGenParams,
  VideoTaskResult,
  CreateCharacterParams,
  CharacterResult,
  ImageGenParams
} from '../types';
import { IVideoProvider } from '../interfaces/IVideoProvider';
import { IImageProvider } from '../interfaces/IImageProvider';

const DEFAULT_BASE_URL = 'https://zeroapi.cn';

/**
 * Zeroapi提供商
 * 实现了视频生成和图片生成接口
 * 支持Sora、Gemini等多种模型
 */
export class ZeroapiProvider implements IVideoProvider, IImageProvider {
  private baseUrl: string;

  constructor(baseUrl: string = DEFAULT_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  /**
   * 发起HTTP请求
   * @param apiKey - API密钥
   * @param method - 请求方法
   * @param endpoint - 端点路径
   * @param data - 请求体数据
   * @param params - 查询参数
   * @returns 响应数据
   */
  private async makeRequest(
    apiKey: string,
    method: 'GET' | 'POST',
    endpoint: string,
    data?: any,
    params?: any
  ) {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await axios({
        method,
        url,
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        data,
        params,
      });
      return response.data;
    } catch (error: any) {
      const responseData = error.response?.data;
      console.error(`Zeroapi Service Error (${endpoint}):`, responseData || error.message);

      let errorMessage = error.message || 'External API request failed';

      if (responseData) {
        if (typeof responseData.error === 'string') {
          errorMessage = responseData.error;
        } else if (responseData.error && typeof responseData.error.message === 'string') {
          errorMessage = responseData.error.message;
        } else if (typeof responseData.message === 'string') {
          errorMessage = responseData.message;
        }
      }

      throw new Error(errorMessage);
    }
  }

  /**
   * 生成视频
   * @param params - 视频生成参数
   * @param apiKey - API密钥
   * @returns 任务ID
   */
  async generateVideo(params: VideoGenParams, apiKey: string): Promise<{ task_id: string }> {
    const endpoint = '/v1/video/create';

    // 将宽高比映射为方向
    const orientation = params.aspect_ratio === '16:9' ? 'landscape' : 'portrait';

    const body: any = {
      model: params.model || 'sora-2',
      prompt: params.prompt,
      orientation: orientation,
      duration: Number(params.duration),
      size: 'small', // 默认使用small（720p）
      watermark: false,
    };

    if (params.images && params.images.length > 0) {
      body.images = params.images;
    }

    const result = await this.makeRequest(apiKey, 'POST', endpoint, body);

    if (result && result.id) {
      return { task_id: result.id };
    } else {
      throw new Error('Invalid response from video generation API');
    }
  }

  /**
   * 查询视频任务状态
   * @param taskId - 任务ID
   * @param apiKey - API密钥
   * @returns 视频任务结果
   */
  async queryTask(taskId: string, apiKey: string): Promise<VideoTaskResult> {
    const endpoint = '/v1/video/query';
    // Zeroapi使用查询参数传递ID
    const result = await this.makeRequest(apiKey, 'GET', endpoint, undefined, { id: taskId });

    // 结果结构: { id, status, video_url, ... }
    return {
      status: result.status,
      url: result.video_url, // 通用URL
      videoUrl: result.video_url, // 注意：Zeroapi响应使用snake_case
      failReason: result.fail_reason || (result.status === 'failed' ? 'Unknown error' : undefined),
    };
  }

  /**
   * 生成图片
   * @param params - 图片生成参数
   * @param apiKey - API密钥
   * @returns 图片URL或任务ID
   */
  async generateImage(params: ImageGenParams, apiKey: string): Promise<{ url: string; urls?: string[] } | { task_id: string }> {
    // 检查是否为Gemini模型
    if (params.model === 'gemini-3-pro-image-preview' || params.model === 'gemini-2.5-flash-image') {
      return this.generateGeminiImage(params, apiKey);
    }

    const endpoint = '/v1/images/generations';

    console.log('Generating image with params:', params);
    const body: any = {
      model: params.model || 'doubao-seedream-4-0-250828',
      prompt: params.prompt,
      size: getResolutionFromRatio(params.ratio)
    };
    if (params.image && params.image.length > 0) {
      body.image = params.image;
    }
    console.log('Request body:', body);
    const result = await this.makeRequest(apiKey, 'POST', endpoint, body);
    console.log('Zeroapi Image Generation Response:', result);
    
    if (result.data && result.data.length > 0) {
      const urls = result.data.map((item: any) => item.url);
      return {
        url: urls[0],
        urls: urls
      };
    }

    throw new Error('No image URL in response');
  }

  /**
   * 使用Gemini模型生成图片
   * @param params - 图片生成参数
   * @param apiKey - API密钥
   * @returns 图片URL
   */
  private async generateGeminiImage(params: ImageGenParams, apiKey: string): Promise<{ url: string; urls?: string[] }> {
    const endpoint = `/v1beta/models/${params.model}:generateContent`;

    const contents: any[] = [
      {
        parts: [
          { text: params.prompt }
        ]
      }
    ];

    // 处理参考图片（如果提供）
    if (params.image && params.image.length > 0) {
      try {
        const imagePromises = params.image.map(async (imgUrl) => {
          const base64Data = await urlToBase64(imgUrl);
          return {
            inline_data: {
              mime_type: "image/jpeg", // 简化处理，假设为JPEG，也可以从URL/header推断
              data: base64Data
            }
          };
        });

        const imageParts = await Promise.all(imagePromises);
        contents[0].parts.push(...imageParts);
      } catch (error) {
        console.error('Failed to process reference images:', error);
      }
    }

    const body = {
      contents,
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: {
          aspectRatio: params.ratio || '1:1',
        }
      }
    };

    // Zeroapi在此端点需要在查询参数中传递'key'
    const result = await this.makeRequest(apiKey, 'POST', endpoint, body, { key: apiKey });
    if (result.candidates && result.candidates[0]?.content?.parts) {
      for (const part of result.candidates[0].content.parts) {
        // 处理驼峰命名（Gemini标准）和下划线命名（某些代理）
        const inlineData = part.inlineData || part.inline_data;
        
        if (inlineData) {
          const mimeType = inlineData.mimeType || inlineData.mime_type || 'image/jpeg';
          const data = inlineData.data;
          
          // 将Base64转换为Buffer
          const buffer = Buffer.from(data, 'base64');
          
          // 根据mime类型确定扩展名
          let ext = '.jpg';
          if (mimeType === 'image/png') ext = '.png';
          else if (mimeType === 'image/webp') ext = '.webp';
          
          // 上传到图片托管服务
          const imageUrl = await ImageUploadService.uploadBuffer(buffer, 'image', ext);
          
          return {
            url: imageUrl,
            urls: [imageUrl]
          };
        }
      }
    }

    throw new Error('No image data in Gemini response');
  }

  /**
   * 创建角色
   * @param params - 角色创建参数
   * @param apiKey - API密钥
   * @returns 角色创建结果
   */
  async createCharacter(params: CreateCharacterParams, apiKey: string): Promise<CharacterResult> {
    const endpoint = '/sora/v1/characters';

    const body: any = {
      timestamps: params.timestamps
    };

    if (params.url) {
      body.url = params.url;
    }

    if (params.from_task) {
      body.from_task = params.from_task;
    }

    // 验证：url或from_task必须提供其一
    if (!body.url && !body.from_task) {
      throw new Error('Either url or from_task is required for creating a character');
    }

    const result = await this.makeRequest(apiKey, 'POST', endpoint, body);
    return result;
  }
}
