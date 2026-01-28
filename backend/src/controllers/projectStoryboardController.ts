import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error, validateBody } from '../utils/response';
import { TaskService } from '../services/taskService';
import { SettingService } from '../services/settingService';
import { z } from 'zod';
import { ReferenceImageService } from '../services/referenceImageService';
import { PromptService } from '../services/promptService';
import { ImageRatio } from '../constants/enums';

/**
 * 批量创建或更新分镜
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const upsertStoryboards = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const storyboards = req.body; // 分镜数组
  const episodeIdQuery = req.query.episodeId ? parseInt(req.query.episodeId as string) : undefined;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (!Array.isArray(storyboards)) {
    return error(res, 'Invalid data format', 400, 400);
  }

  try {
    // 验证项目所有权
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { storyboards: true }
    });

    if (!existing) {
      return error(res, 'Project not found', 404, 404);
    }

    // 确定默认的剧集ID
    let defaultEpisodeId = episodeIdQuery;
    if (!defaultEpisodeId) {
        // 查找第一个剧集
        const firstEpisode = await prisma.projectEpisode.findFirst({
            where: { projectId },
            orderBy: { sortOrder: 'asc' },
            select: { id: true }
        });
        defaultEpisodeId = firstEpisode?.id;
    }

    const results = [];

    for (const frame of storyboards) {
      const frameData = {
        projectId,
        episodeId: frame.episodeId ? Number(frame.episodeId) : defaultEpisodeId,
        text: frame.text,
        characterIds: JSON.stringify(frame.characterIds || []),
        propIds: frame.propIds ? JSON.stringify(frame.propIds) : null,
        sceneId: frame.sceneId ? Number(frame.sceneId) : null,
        duration: frame.duration || 0,
        prompt: frame.prompt,
        order: frame.order || 0,
        referenceImageUrl: frame.referenceImageUrl,
        imageUrl: frame.imageUrl,
        imageStatus: frame.imageStatus
      };

      if (frame.id && typeof frame.id === 'number' && frame.id > 0) {
        // 检查记录是否存在
        const existingFrame = await prisma.projectStoryboard.findUnique({
          where: { id: frame.id }
        });

        if (existingFrame) {
          // 更新现有记录
          const updated = await prisma.projectStoryboard.update({
            where: { id: frame.id },
            data: frameData
          });
          results.push(updated);
        } else {
          // 记录已被删除，创建新记录（例如撤销删除操作）
          const created = await prisma.projectStoryboard.create({
            data: {
              ...frameData,
              imageStatus: frameData.imageStatus || 'idle'
            }
          });
          results.push(created);
        }
      } else {
        // 创建新记录
        const created = await prisma.projectStoryboard.create({
          data: {
            ...frameData,
            imageStatus: 'idle'
          }
        });

        results.push(created);
      }
    }

    success(res, results);
  } catch (err) {
    console.error('Failed to upsert storyboards:', err);
    error(res, 'Failed to upsert storyboards');
  }
};

/**
 * 更新分镜媒体信息
 * 更新分镜的视频状态和高清视频信息
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const updateStoryboardMedia = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const storyboardId = parseInt(req.params.storyboardId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (isNaN(projectId) || isNaN(storyboardId)) {
    return error(res, 'Invalid project ID or storyboard ID', 400, 400);
  }

  try {
    const processingTask = await prisma.task.findFirst({
      where: {
        projectId,
        relatedId: storyboardId,
        status: 'processing',
        category: { in: ['storyboard_video', 'upscale'] }
      },
      select: { id: true }
    });

    if (processingTask) {
      return error(res, 'Storyboard is generating, operation is not allowed', 409, 409);
    }

    const bodySchema = z
      .object({
        status: z.enum(['draft', 'generating_video', 'video_generated', 'failed']).optional(),
        videoUrl: z.string().nullable().optional(),
        highResStatus: z.enum(['idle', 'generating', 'success', 'failed']).optional(),
        highResVideoUrl: z.string().nullable().optional()
      })
      .refine((val) => Object.keys(val).length > 0, { message: 'No valid fields to update' });

    const data = validateBody(res, bodySchema, req.body);
    if (!data) return;

    const updated = await prisma.projectStoryboard.update({
      where: { id: storyboardId },
      data
    });

    success(res, updated);
  } catch (err) {
    console.error('Failed to update storyboard media:', err);
    error(res, 'Failed to update storyboard media');
  }
};

/**
 * 删除分镜
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const deleteStoryboard = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const storyboardId = parseInt(req.params.storyboardId);

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

    await prisma.projectStoryboard.delete({
      where: { id: storyboardId }
    });

    success(res, { message: 'Storyboard deleted' });
  } catch (err) {
    console.error('Failed to delete storyboard:', err);
    error(res, 'Failed to delete storyboard');
  }
};

/**
 * 生成分镜图片
 * 基于角色、场景、道具的参考图生成分镜图片
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateStoryboardImage = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const storyboardId = parseInt(req.params.storyboardId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { 
        style: true,
        storyboards: { where: { id: storyboardId } } 
      }
    });

    if (!project || project.storyboards.length === 0) {
      return error(res, 'Project or Storyboard not found', 404, 404);
    }

    const storyboard = project.storyboards[0];

    // 更新状态为生成中
    await prisma.projectStoryboard.update({
      where: { id: storyboardId },
      data: { imageStatus: 'generating', errorMsg: null }
    });

    // 1. 获取相关实体
    const charIds = storyboard.characterIds ? JSON.parse(storyboard.characterIds as string) : [];
    const characters = charIds.length > 0
      ? await prisma.projectCharacter.findMany({ where: { id: { in: charIds } } })
      : [];

    const propIds = storyboard.propIds ? JSON.parse(storyboard.propIds as string) : [];
    const props = propIds.length > 0
      ? await prisma.projectProp.findMany({ where: { id: { in: propIds } } })
      : [];

    const scene = storyboard.sceneId
      ? await prisma.projectScene.findUnique({ where: { id: storyboard.sceneId } })
      : null;

    // 2. 验证主图
    const missingImages: string[] = [];

    for (const char of characters) {
      if (!char.imageUrl) missingImages.push(`角色: ${char.name}`);
    }
    if (scene && !scene.imageUrl) missingImages.push(`场景: ${scene.name}`);
    for (const prop of props) {
      if (!prop.imageUrl) missingImages.push(`物品: ${prop.name}`);
    }

    if (missingImages.length > 0) {
      // 恢复状态
      await prisma.projectStoryboard.update({
        where: { id: storyboardId },
        data: { imageStatus: 'failed', errorMsg: '资产缺失主图' }
      });
      return error(res, `以下资产缺失主图，请先生成图片: ${missingImages.join(', ')}`, 400, 400);
    }

    // 3. 检查/生成参考图并收集URL
    const referenceImages: string[] = [];

    // 角色
    for (const char of characters) {
      let refUrl = char.referenceImageUrl;
      if (!refUrl) {
        refUrl = await ReferenceImageService.generateReferenceImage(char.imageUrl!, `${char.name} 人物参考`);
        // 更新数据库
        await prisma.projectCharacter.update({
          where: { id: char.id },
          data: { referenceImageUrl: refUrl }
        });
      }
      referenceImages.push(refUrl);
    }

    // 场景
    if (scene) {
      let refUrl = scene.referenceImageUrl;
      if (!refUrl) {
        refUrl = await ReferenceImageService.generateReferenceImage(scene.imageUrl!, `${scene.name} 场景参考`);
        await prisma.projectScene.update({
          where: { id: scene.id },
          data: { referenceImageUrl: refUrl }
        });
      }
      referenceImages.push(refUrl);
    }

    // 道具
    for (const prop of props) {
      let refUrl = prop.referenceImageUrl;
      if (!refUrl) {
        refUrl = await ReferenceImageService.generateReferenceImage(prop.imageUrl!, `${prop.name} 物品参考`);
        await prisma.projectProp.update({
          where: { id: prop.id },
          data: { referenceImageUrl: refUrl }
        });
      }
      referenceImages.push(refUrl);
    }

    // 4. 构建提示词
    let finalPrompt = await PromptService.getStoryboardImagePrompt(userId, {
      description: storyboard.prompt || storyboard.text || '',
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
        category: 'storyboard_image',
        relatedId: storyboardId,
        status: 'pending',
        inputParams: JSON.stringify({
          prompt: finalPrompt,
          ratio: ImageRatio.RATIO_16_9,
          image: referenceImages
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate storyboard image:', err);
    error(res, 'Failed to generate storyboard image');
  }
};

/**
 * 生成分镜视频
 * 基于分镜图片生成视频
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateStoryboardVideo = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const storyboardId = parseInt(req.params.storyboardId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { 
        storyboards: { where: { id: storyboardId } },
        style: true
      }
    });

    if (!project || project.storyboards.length === 0) {
      return error(res, 'Project or Storyboard not found', 404, 404);
    }

    const storyboard = project.storyboards[0];

    // 更新状态为生成中
    await prisma.projectStoryboard.update({
      where: { id: storyboardId },
      data: { status: 'generating_video', errorMsg: null }
    });

    const prompt = await PromptService.getStoryboardVideoPrompt(userId, {
      description: storyboard.prompt || storyboard.text || '',
      style: project.style?.prompt || project.style?.name || ''
    });

    // 获取AI配置 - 使用提供的模型或默认模型
    const modelConfig = req.body?.model;
    let model = modelConfig?.model;
    let provider = modelConfig?.provider;
    
    if (!model) {
      const config = await SettingService.getEffectiveAIConfig(userId, 'video');
      model = config.model || 'sora2';
      provider = config.provider;
    }

    const task = await prisma.task.create({
      data: {
        projectId,
        model: model,
        providerId: provider,
        type: 'video',
        category: 'storyboard_video',
        relatedId: storyboardId,
        status: 'pending',
        inputParams: JSON.stringify({
          prompt,
          duration: storyboard.duration?.toString() || '5',
          aspect_ratio: project.aspectRatio || ImageRatio.RATIO_16_9,
          images: storyboard.referenceImageUrl ? [storyboard.referenceImageUrl] : []
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate storyboard video:', err);
    error(res, 'Failed to generate storyboard video');
  }
};

/**
 * 生成分镜高清视频（超分辨率）
 * 对已生成的视频进行超分辨率处理
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generateStoryboardHighResVideo = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const storyboardId = parseInt(req.params.storyboardId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { storyboards: { where: { id: storyboardId } } }
    });

    if (!project || project.storyboards.length === 0) {
      return error(res, 'Project or Storyboard not found', 404, 404);
    }

    const storyboard = project.storyboards[0];

    if (!storyboard.videoUrl) {
      return error(res, 'No video to upscale', 400, 400);
    }

    // 更新状态为生成中
    await prisma.projectStoryboard.update({
      where: { id: storyboardId },
      data: { highResStatus: 'generating', highResErrorMsg: null }
    });

    const task = await prisma.task.create({
      data: {
        projectId,
        model: 'flash_vsr',
        type: 'video',
        category: 'upscale',
        relatedId: storyboardId,
        status: 'pending',
        inputParams: JSON.stringify({
          video_filename: storyboard.videoUrl
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate storyboard high res video:', err);
    error(res, 'Failed to generate storyboard high res video');
  }
};
