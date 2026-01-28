import { Request, Response } from 'express';
import { SettingService } from '../services/settingService';
import { success, error } from '../utils/response';
import { AuthRequest } from '../middlewares/auth';
// @ts-ignore
import { AIService } from '../services/aiService';

/**
 * AI 控制器
 * 处理 AI 相关的 HTTP 请求
 */
export class AIController {

  /**
   * 分析项目元素（角色、场景、物品）
   */
  static async analyzeElements(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { projectId, scriptContent, episodeId, saveToDb = true, isAppend = false } = req.body;
      
      if (!projectId || !scriptContent) {
        return error(res, 'Missing required parameters: projectId, scriptContent', 400, 400);
      }

      const { provider, apiKey, model, modelValue } = await SettingService.getEffectiveAIConfig(userId, 'llm');
      
      const result = await AIService.analyzeProjectElements(
        userId, 
        projectId, 
        scriptContent, 
        provider, 
        apiKey, 
        modelValue || model,
        saveToDb,
        episodeId,
        isAppend
      );
      
      success(res, result);
    } catch (err: any) {
      console.error('Analyze elements error:', err);
      error(res, err.message);
    }
  }

  /**
   * 分析项目分镜
   */
  static async analyzeStoryboards(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { projectId, scriptContent, episodeId } = req.body;
      
      if (!projectId || !scriptContent) {
        return error(res, 'Missing required parameters: projectId, scriptContent', 400, 400);
      }

      const { provider, apiKey, model, modelValue } = await SettingService.getEffectiveAIConfig(userId, 'llm');
      
      const result = await AIService.analyzeProjectStoryboards(
        userId, 
        projectId, 
        scriptContent, 
        provider, 
        apiKey, 
        modelValue || model,
        episodeId
      );
      
      success(res, result);
    } catch (err: any) {
      console.error('Analyze storyboards error:', err);
      error(res, err.message);
    }
  }

  /**
   * 推理分镜视频提示词
   */
  static async inferStoryboard(req: Request, res: Response) {
    try {
      const userId = (req as AuthRequest).user!.id;
      const { scriptContent } = req.body;
      if (!scriptContent) {
        return error(res, 'Missing required parameters: scriptContent', 400, 400);
      }

      const { provider, apiKey, model, modelValue } = await SettingService.getEffectiveAIConfig(userId, 'llm');
      const result = await AIService.inferStoryboard(userId, scriptContent, provider, apiKey, modelValue || model);
      success(res, result);
    } catch (err: any) {
      error(res, err.message);
    }
  }
}
