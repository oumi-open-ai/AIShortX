import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';
import { TaskService } from '../services/taskService';
import { SettingService } from '../services/settingService';
import { PromptService } from '../services/promptService';
import { ImageRatio } from '../constants/enums';

/**
 * 批量创建或更新道具
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const upsertProps = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const props = req.body; // 道具数组
  const episodeIdQuery = req.query.episodeId ? parseInt(req.query.episodeId as string) : undefined;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (!Array.isArray(props)) {
    return error(res, 'Invalid data format', 400, 400);
  }

  try {
    // 验证项目所有权
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { props: true }
    });

    if (!existing) {
      return error(res, 'Project not found', 404, 404);
    }

    const results = [];

    for (const prop of props) {
      const propData: any = {
        projectId,
        name: prop.name,
        description: prop.description,
        imageUrl: prop.imageUrl,
        status: prop.status || 'idle',
        episodeId: prop.episodeId ? Number(prop.episodeId) : episodeIdQuery,
      };

      if (prop.id && typeof prop.id === 'number' && prop.id > 0) {
        // 更新现有道具
        // 检查图片URL是否改变
        const oldProp = existing.props.find(p => p.id === prop.id);
        if (prop.imageUrl && oldProp && oldProp.imageUrl !== prop.imageUrl) {
          propData.referenceImageUrl = null;
        }

        const updated = await prisma.projectProp.update({
          where: { id: prop.id },
          data: propData
        });

        results.push(updated);
      } else {
        // 创建新道具
        const created = await prisma.projectProp.create({
          data: propData
        });

        results.push(created);
      }
    }

    success(res, results);
  } catch (err) {
    console.error('Failed to upsert props:', err);
    error(res, 'Failed to upsert props');
  }
};

/**
 * 删除道具
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const deleteProp = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const propId = parseInt(req.params.propId);

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

    await prisma.projectProp.delete({
      where: { id: propId }
    });

    success(res, { message: 'Prop deleted' });
  } catch (err) {
    console.error('Failed to delete prop:', err);
    error(res, 'Failed to delete prop');
  }
};

/**
 * 生成道具图片
 * 创建图片生成任务
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const generatePropImage = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const propId = parseInt(req.params.propId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId },
      include: { 
        style: true,
        props: { where: { id: propId } } 
      }
    });

    if (!project || project.props.length === 0) {
      return error(res, 'Project or Prop not found', 404, 404);
    }

    const prop = project.props[0];

    // 更新状态为生成中
    await prisma.projectProp.update({
      where: { id: propId },
      data: { status: 'generating' }
    });

    let prompt = await PromptService.getPropImageGenPrompt(userId, {
      description: prop.description || '',
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
        category: 'prop_image',
        relatedId: propId,
        status: 'pending',
        inputParams: JSON.stringify({
          prompt,
          ratio: ImageRatio.RATIO_9_16 // 道具通常使用方形或竖版
        })
      }
    });

    TaskService.startTask(task, userId).catch(err => {
      console.error(`Background task start failed for task ${task.id}:`, err);
    });

    success(res, { taskId: task.id, status: 'generating' });
  } catch (err) {
    console.error('Failed to generate prop image:', err);
    error(res, 'Failed to generate prop image');
  }
};
