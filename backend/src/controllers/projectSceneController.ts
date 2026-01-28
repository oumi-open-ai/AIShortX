import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';
import { TaskService } from '../services/taskService';
import { SettingService } from '../services/settingService';
import { PromptService } from '../services/promptService';
import { ImageRatio } from '../constants/enums';

/**
 * 批量创建或更新场景
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const upsertScenes = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const scenes = req.body; // 场景数组
  const episodeIdQuery = req.query.episodeId ? parseInt(req.query.episodeId as string) : undefined;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (!Array.isArray(scenes)) {
    return error(res, 'Invalid data format', 400, 400);
  }

  try {
    // 验证项目所有权
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { scenes: true }
    });

    if (!existing) {
      return error(res, 'Project not found', 404, 404);
    }

    const results = [];

    for (const scene of scenes) {
      const sceneData: any = {
        projectId,
        name: scene.name,
        description: scene.description,
        imageUrl: scene.imageUrl,
        status: scene.status || 'idle',
        episodeId: scene.episodeId ? Number(scene.episodeId) : episodeIdQuery,
      };

      if (scene.id && typeof scene.id === 'number' && scene.id > 0) {
        // 更新现有场景
        // 检查图片URL是否改变
        const existingScene = existing.scenes.find(s => s.id === scene.id);
        if (scene.imageUrl && existingScene && existingScene.imageUrl !== scene.imageUrl) {
          sceneData.referenceImageUrl = null;
        }

        const updated = await prisma.projectScene.update({
          where: { id: scene.id },
          data: sceneData
        });

        results.push(updated);
      } else {
        // 创建新场景
        const created = await prisma.projectScene.create({
          data: sceneData
        });

        results.push(created);
      }
    }

    success(res, results);
  } catch (err) {
    console.error('Failed to upsert scenes:', err);
    error(res, 'Failed to upsert scenes');
  }
};

/**
 * 删除场景
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const deleteScene = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const sceneId = parseInt(req.params.sceneId);

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

    await prisma.projectScene.delete({
      where: { id: sceneId }
    });

    success(res, { message: 'Scene deleted' });
  } catch (err) {
    console.error('Failed to delete scene:', err);
    error(res, 'Failed to delete scene');
  }
};

/**
 * 生成场景图片
 * 创建图片生成任务
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateSceneImage = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const sceneId = parseInt(req.params.sceneId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { 
        style: true,
        scenes: { where: { id: sceneId } } 
      }
    });

    if (!project || project.scenes.length === 0) {
      return error(res, 'Project or Scene not found', 404, 404);
    }

    const scene = project.scenes[0];

    // 更新状态为生成中
    await prisma.projectScene.update({
      where: { id: sceneId },
      data: { status: 'generating' }
    });

    let prompt = await PromptService.getSceneImageGenPrompt(userId, {
      description: scene.description || '',
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
        category: 'scene_image',
        relatedId: sceneId,
        status: 'pending',
        inputParams: JSON.stringify({
          prompt,
          ratio: ImageRatio.RATIO_16_9 // 场景通常使用16:9
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate scene image:', err);
    error(res, 'Failed to generate scene image');
  }
};
