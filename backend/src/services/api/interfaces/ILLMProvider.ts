import { ChatParams } from '../types';

/**
 * LLM提供商接口
 * 定义了大语言模型对话的标准方法
 */
export interface ILLMProvider {
  /**
   * 对话接口
   * @param params - 对话参数
   * @param apiKey - API密钥
   * @returns 返回AI回复内容
   */
  chat(params: ChatParams, apiKey: string): Promise<string>;
}
