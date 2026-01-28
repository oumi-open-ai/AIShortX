import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { UserSettingKey } from '../constants/enums';
import { AIModelManager } from '../services/aiModelManager';
import { StandardLLMProvider } from '../services/api/llm/StandardLLMProvider';

/**
 * 验证 Key 是否有效
 */
const isValidKey = (key: string): boolean => {
  return Object.values(UserSettingKey).includes(key as UserSettingKey);
};

/**
 * 通用获取设置接口
 * GET /api/settings/:key
 */
export const getSetting = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { key } = req.params;

    if (!key) {
      return error(res, 'Key is required');
    }

    if (!isValidKey(key)) {
      return error(res, 'Invalid setting key', 400);
    }

    const setting = await prisma.userSetting.findUnique({
      where: { userId_key: { userId, key } }
    });

    let result;
    if (!setting) {
      result = {};
    } else {
      try {
        result = JSON.parse(setting.value);
      } catch {
        result = setting.value;
      }
    }

    return success(res, result);
  } catch (err) {
    console.error(`Get setting ${req.params.key} error:`, err);
    return error(res, 'Failed to get setting');
  }
};

/**
 * 通用保存设置接口
 * POST /api/settings
 * Body: { key: string, value: any }
 */
export const saveSetting = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { key, value } = req.body;

    if (!key) {
      return error(res, 'Key is required');
    }

    if (!isValidKey(key)) {
      return error(res, 'Invalid setting key', 400);
    }

    const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

    const setting = await prisma.userSetting.upsert({
      where: { userId_key: { userId, key } },
      update: { value: valueStr },
      create: { userId, key, value: valueStr }
    });

    // 尝试解析返回
    try {
      const parsed = JSON.parse(setting.value);
      return success(res, parsed);
    } catch {
      return success(res, setting.value);
    }

  } catch (err) {
    console.error(`Save setting ${req.body.key} error:`, err);
    return error(res, 'Failed to save setting');
  }
};

/**
 * 获取所有可用 AI 模型配置列表
 * GET /api/settings/ai-models
 */
export const getAIModelConfigs = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const configs = await AIModelManager.getAllConfigs(userId);
    return success(res, configs);
  } catch (err) {
    console.error('Get AI model configs error:', err);
    return error(res, 'Failed to get AI model configs');
  }
};

/**
 * Get User LLM Configs
 * GET /api/settings/llm
 */
export const getUserLLMConfigs = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const configs = await prisma.userLLMConfig.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });
    return success(res, configs);
  } catch (err) {
    console.error('Get User LLM Configs error:', err);
    return error(res, 'Failed to get User LLM Configs');
  }
};

/**
 * Create User LLM Config
 * POST /api/settings/llm
 */
export const createUserLLMConfig = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { name, provider, modelValue, baseUrl, apiKey } = req.body;
    
    if (!name || !provider || !modelValue || !baseUrl || !apiKey) {
        return error(res, 'Missing required fields', 400);
    }

    const config = await prisma.userLLMConfig.create({
      data: {
        userId,
        name,
        provider,
        modelValue,
        baseUrl,
        apiKey
      }
    });
    return success(res, config);
  } catch (err) {
    console.error('Create User LLM Config error:', err);
    return error(res, 'Failed to create User LLM Config');
  }
};

/**
 * Update User LLM Config
 * PUT /api/settings/llm/:id
 */
export const updateUserLLMConfig = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { id } = req.params;
    const { name, provider, modelValue, baseUrl, apiKey, isActive } = req.body;

    const config = await prisma.userLLMConfig.findUnique({ where: { id: Number(id) } });
    if (!config || config.userId !== userId) {
        return error(res, 'Config not found or permission denied', 404);
    }

    const updated = await prisma.userLLMConfig.update({
      where: { id: Number(id) },
      data: {
        name,
        provider,
        modelValue,
        baseUrl,
        apiKey,
        isActive
      }
    });
    return success(res, updated);
  } catch (err) {
    console.error('Update User LLM Config error:', err);
    return error(res, 'Failed to update User LLM Config');
  }
};

/**
 * Delete User LLM Config
 * DELETE /api/settings/llm/:id
 */
export const deleteUserLLMConfig = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { id } = req.params;

    const config = await prisma.userLLMConfig.findUnique({ where: { id: Number(id) } });
    if (!config || config.userId !== userId) {
        return error(res, 'Config not found or permission denied', 404);
    }

    await prisma.userLLMConfig.delete({ where: { id: Number(id) } });
    return success(res, { success: true });
  } catch (err) {
    console.error('Delete User LLM Config error:', err);
    return error(res, 'Failed to delete User LLM Config');
  }
};

/**
 * Test User LLM Config
 * POST /api/settings/llm/test
 */
export const testLLMConfig = async (req: Request, res: Response) => {
  try {
    const { baseUrl, apiKey, modelValue } = req.body;

    if (!baseUrl || !apiKey || !modelValue) {
        return error(res, 'Missing required fields: baseUrl, apiKey, modelValue', 400);
    }

    // Initialize provider
    const provider = new StandardLLMProvider(baseUrl);
    
    // Test chat
    const response = await provider.chat({
        messages: [{ role: 'user', content: 'Hello' }],
        model: modelValue,
        max_tokens: 10
    }, apiKey);

    return success(res, { success: true, message: 'Connection successful', response });
  } catch (err: any) {
    console.error('Test User LLM Config error:', err);
    return error(res, err.message || 'Failed to test User LLM Config', 400);
  }
};

