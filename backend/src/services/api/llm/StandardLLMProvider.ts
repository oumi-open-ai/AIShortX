import axios from 'axios';
import { ChatParams } from '../types';
import { ILLMProvider } from '../interfaces/ILLMProvider';

/**
 * 标准LLM提供商
 * 实现了OpenAI兼容的API接口
 */
export class StandardLLMProvider implements ILLMProvider {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, ''); // 移除末尾斜杠
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
      console.error(`Standard LLM Provider Error (${this.baseUrl}):`, responseData || error.message);

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
   * 对话接口
   * @param params - 对话参数
   * @param apiKey - API密钥
   * @returns AI回复内容
   */
  async chat(params: ChatParams, apiKey: string): Promise<string> {
    const body = {
      model: params.model,
      messages: params.messages,
      temperature: params.temperature ?? 0.7,
      max_tokens: params.max_tokens || 8192 
    };

    const result = await this.makeRequest(apiKey, 'POST', '', body);

    if (result.choices && result.choices.length > 0) {
      return result.choices[0].message.content;
    }

    throw new Error('No content in AI response');
  }
}
