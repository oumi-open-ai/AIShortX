import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';
import { SettingService } from '../services/settingService';
import { TaskService } from '../services/taskService';
import { PromptService } from '../services/promptService';
import { ReferenceImageService } from '../services/referenceImageService';
import { ImageRatio } from '../constants/enums';
import { AIModelManager } from '../services/aiModelManager';

/**
 * 批量创建或更新角色
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const upsertCharacters = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const characters = req.body; // 角色数组
  const episodeIdQuery = req.query.episodeId ? parseInt(req.query.episodeId as string) : undefined;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (!Array.isArray(characters)) {
    return error(res, 'Invalid data format', 400, 400);
  }

  try {
    // 验证项目所有权
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { characters: true }
    });

    if (!existing) {
      return error(res, 'Project not found', 404, 404);
    }

    const results = [];

    for (const char of characters) {
      const charData: any = {
        projectId,
        libraryId: char.libraryId ? Number(char.libraryId) : null,
        name: char.name,
        description: char.description,
        imageUrl: char.imageUrl,
        imageStatus: char.imageStatus || 'idle',
        videoUrl: char.videoUrl,
        videoStatus: char.videoStatus || 'draft',
        createStatus: char.createStatus || 'idle',
        source: char.source || 'custom',
        externalId: char.externalId,
        originalData: char.originalData ? JSON.stringify(char.originalData) : undefined,
        voice: char.voice,
        episodeId: char.episodeId ? Number(char.episodeId) : episodeIdQuery,
      };

      if (char.id && typeof char.id === 'number' && char.id > 0) {
        // 更新现有角色
        // 检查图片URL是否改变
        const existingChar = existing.characters.find(c => c.id === char.id);
        if (char.imageUrl && existingChar && existingChar.imageUrl !== char.imageUrl) {
          charData.referenceImageUrl = null;
        }

        const updated = await prisma.projectCharacter.update({
          where: { id: char.id },
          data: charData
        });

        results.push(updated);
      } else {
        // 创建新角色
        const created = await prisma.projectCharacter.create({
          data: charData
        });

        results.push(created);
      }
    }

    success(res, results);
  } catch (err) {
    console.error('Failed to upsert characters:', err);
    error(res, 'Failed to upsert characters');
  }
};

/**
 * 更新单个角色
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const updateCharacter = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const charId = parseInt(req.params.charId);
  const updates = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    // 验证项目所有权
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return error(res, 'Project not found', 404, 404);
    }

    // 验证角色是否属于该项目
    const character = await prisma.projectCharacter.findFirst({
      where: { id: charId, projectId }
    });

    if (!character) {
      return error(res, 'Character not found', 404, 404);
    }

    const data: any = {};
    const allowedFields = [
      'name', 'description', 'imageUrl', 'imageStatus',
      'videoUrl', 'videoStatus', 'createStatus', 'source',
      'externalId', 'originalData', 'voice'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        if (field === 'originalData' && typeof updates[field] === 'object') {
          data[field] = JSON.stringify(updates[field]);
        } else {
          data[field] = updates[field];
        }
      }
    }

    // 如果图片URL改变，清除参考图URL
    if (updates.imageUrl && updates.imageUrl !== character.imageUrl) {
      data.referenceImageUrl = null;
    }

    const updated = await prisma.projectCharacter.update({
      where: { id: charId },
      data
    });

    success(res, updated);
  } catch (err) {
    console.error('Failed to update character:', err);
    error(res, 'Failed to update character');
  }
};

/**
 * 删除角色
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const deleteCharacter = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const charId = parseInt(req.params.charId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    // 通过项目验证所有权
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return error(res, 'Project not found', 404, 404);
    }

    await prisma.projectCharacter.delete({
      where: { id: charId }
    });

    success(res, { message: 'Character deleted' });
  } catch (err) {
    console.error('Failed to delete character:', err);
    error(res, 'Failed to delete character');
  }
};

/**
 * 创建Sora角色
 * 将角色视频上传到Sora平台创建角色
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const createSoraCharacter = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const charId = parseInt(req.params.charId);
  const { timestamps } = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    // 验证所有权并获取角色
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: {
        characters: {
          where: { id: charId }
        }
      }
    });

    if (!project || project.characters.length === 0) {
      return error(res, 'Character not found', 404, 404);
    }

    const character = project.characters[0];

    if (!character.videoUrl) {
      return error(res, 'Character video URL is missing', 400, 400);
    }

    // 获取AI提供商实例
    const { provider, apiKey } = await AIModelManager.getVideoProvider(userId);

    // 调用提供商API
    const result = await provider.createCharacter(
      { url: character.videoUrl, timestamps },
      apiKey
    );

    // 更新角色的Sora ID
    const updatedCharacter = await prisma.projectCharacter.update({
      where: { id: charId },
      data: {
        externalId: result.username,
        createStatus: 'created'
      }
    });

    success(res, updatedCharacter);
  } catch (err: any) {
    console.error('Failed to create Sora character:', err);
    error(res, err.message || 'Failed to create Sora character');
  }
};

/**
 * 生成角色参考图
 * 基于角色主图生成用于图生图的参考图
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateCharacterReferenceImage = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const charId = parseInt(req.params.charId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return error(res, 'Project not found', 404, 404);
    }

    const character = await prisma.projectCharacter.findFirst({
      where: { id: charId, projectId }
    });

    if (!character) {
      return error(res, 'Character not found', 404, 404);
    }

    if (!character.imageUrl) {
      return error(res, 'Character has no image', 400, 400);
    }

    const refUrl = await ReferenceImageService.generateReferenceImage(character.imageUrl, `${character.name} 人物参考`);

    const updated = await prisma.projectCharacter.update({
      where: { id: charId },
      data: { referenceImageUrl: refUrl }
    });

    success(res, updated);
  } catch (err) {
    console.error('Failed to generate character reference image:', err);
    error(res, 'Failed to generate character reference image');
  }
};

/**
 * 生成角色图片（任务）
 * 创建图片生成任务
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateCharacterImage = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const charId = parseInt(req.params.charId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { 
        style: true,
        characters: { where: { id: charId } } 
      }
    });

    if (!project || project.characters.length === 0) {
      return error(res, 'Project or Character not found', 404, 404);
    }

    const char = project.characters[0];

    // 更新状态为生成中
    await prisma.projectCharacter.update({
      where: { id: charId },
      data: { imageStatus: 'generating' }
    });

    let prompt = await PromptService.getRoleImageGenPrompt(userId, {
      description: char.description || '',
      style: project.style?.prompt || project.style?.name || ''
    });

    // 获取AI配置 - 使用提供的模型或默认模型
    const modelConfig = req.body?.model;
    let model = modelConfig?.model;
    let provider = modelConfig?.provider;
    
    if (!model) {
      const config = await SettingService.getEffectiveAIConfig(userId, 'image');
      model = config.model || 'jimeng-4.0';
      provider = config.provider;
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        model: model,
        providerId: provider,
        type: 'image',
        category: 'character_image',
        relatedId: charId,
        status: 'pending',
        inputParams: JSON.stringify({
          prompt,
          ratio: ImageRatio.RATIO_16_9
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate character image:', err);
    error(res, 'Failed to generate character image');
  }
};

/**
 * 生成角色视频
 * 创建视频生成任务
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateCharacterVideo = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const charId = parseInt(req.params.charId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { 
        style: true,
        characters: { where: { id: charId } } 
      }
    });

    if (!project || project.characters.length === 0) {
      return error(res, 'Project or Character not found', 404, 404);
    }

    const char = project.characters[0];

    // 更新状态为生成中
    await prisma.projectCharacter.update({
      where: { id: charId },
      data: {
        videoStatus: 'generating',
        // 重新生成时重置创建状态
        createStatus: 'idle',
        externalId: null,
        videoUrl: null
      }
    });

    const prompt = await PromptService.getRoleVideoPrompt(userId, {
      style: project.style?.prompt || project.style?.name || '',
      description: char.description || '',
      voice: char.voice || ''
    });

    // 获取AI配置
    const { model, provider } = await SettingService.getEffectiveAIConfig(userId, 'video');

    const task = await prisma.task.create({
      data: {
        projectId,
        model: model || 'sora2', // Default or configurable?
        providerId: provider,
        type: 'video',
        category: 'character_video',
        relatedId: charId,
        status: 'pending',
        inputParams: JSON.stringify({
          prompt,
          duration: '10',
          aspect_ratio: '9:16',
          images: char.imageUrl ? [char.imageUrl] : []
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate character video:', err);
    error(res, 'Failed to generate character video');
  }
};
