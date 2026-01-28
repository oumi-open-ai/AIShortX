import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';
import { SYSTEM_PROMPT_CONFIGS } from '../constants/systemPrompts';

/**
 * 获取所有提示词配置
 * 返回系统默认提示词和用户自定义配置
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const getPromptConfigs = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return error(res, 'Unauthorized', 401, 401);

  try {
    // 获取所有系统默认提示词
    const systemPrompts = await prisma.systemPrompt.findMany({
      where: { isDefault: true }
    });

    // 获取用户配置
    const userConfigs = await prisma.userPromptConfig.findMany({
      where: { userId }
    });

    // 合并结果
    const result = systemPrompts.map(sys => {
      const userConfig = userConfigs.find(u => u.type === sys.type);
      const fileConfig = SYSTEM_PROMPT_CONFIGS.find(c => c.type === sys.type);
      
      return {
        type: sys.type,
        name: fileConfig?.name || sys.name,
        group: fileConfig?.group,
        systemContent: sys.content,
        // 仅使用文件配置中的变量定义
        variables: fileConfig?.variables || [],
        userContent: userConfig?.content || null,
        enabled: userConfig?.enabled || false,
        updatedAt: userConfig?.updatedAt || sys.updatedAt
      };
    });

    success(res, result);
  } catch (err) {
    console.error('Get prompt configs error:', err);
    error(res, 'Failed to get prompt configs');
  }
};

/**
 * 更新提示词配置
 * 用户可以自定义提示词内容并启用/禁用
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const updatePromptConfig = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return error(res, 'Unauthorized', 401, 401);

  const { type, content, enabled } = req.body;

  if (!type) return error(res, 'Type is required', 400);

  try {
    // 验证类型是否有效
    const systemPrompt = await prisma.systemPrompt.findFirst({
        where: { type, isDefault: true }
    });
    
    if (!systemPrompt) {
        return error(res, 'Invalid prompt type', 400);
    }

    const config = await prisma.userPromptConfig.upsert({
      where: {
        userId_type: { userId, type }
      },
      update: {
        content: content,
        enabled: enabled
      },
      create: {
        userId,
        type,
        content: content || systemPrompt.content, // 如果首次创建没有内容，使用系统默认作为初始值
        enabled: enabled || false
      }
    });

    success(res, config);
  } catch (err) {
    console.error('Update prompt config error:', err);
    error(res, 'Failed to update prompt config');
  }
};

/**
 * 根据类型获取系统模板列表
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const getSystemPromptsByType = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) return error(res, 'Unauthorized', 401, 401);

  const { type } = req.params;
  if (!type) return error(res, 'Type is required', 400);

  try {
    const systemPrompts = await prisma.systemPrompt.findMany({
      where: { type },
      orderBy: {
        isDefault: 'desc' // 默认模板排在前面
      }
    });

    success(res, systemPrompts);
  } catch (err) {
    console.error('Get system prompts by type error:', err);
    error(res, 'Failed to get system prompts');
  }
};
