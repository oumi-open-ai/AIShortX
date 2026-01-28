import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';

/**
 * 创建新剧集
 * 为指定项目创建一个新的剧集
 */
export const createEpisode = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.projectId);
  const { name, sortOrder, script } = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (isNaN(projectId)) {
    return error(res, 'Invalid project ID', 400, 400);
  }

  try {
    // Check project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return error(res, 'Project not found', 404, 404);
    }

    // 如果未提供排序值，自动计算
    let finalSortOrder = sortOrder;
    if (finalSortOrder === undefined) {
      const lastEpisode = await prisma.projectEpisode.findFirst({
        where: { projectId },
        orderBy: { sortOrder: 'desc' }
      });
      finalSortOrder = (lastEpisode?.sortOrder ?? -1) + 1;
    }

    const episode = await prisma.projectEpisode.create({
      data: {
        projectId,
        name: name || `第 ${finalSortOrder + 1} 集`,
        sortOrder: finalSortOrder,
        script: script || '',
      }
    });

    success(res, episode);
  } catch (err) {
    console.error('Failed to create episode:', err);
    error(res, 'Failed to create episode');
  }
};

/**
 * 获取项目的所有剧集
 * 按排序值升序返回
 */
export const getEpisodes = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.projectId);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    // Check project ownership
    const project = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!project) {
      return error(res, 'Project not found', 404, 404);
    }

    const episodes = await prisma.projectEpisode.findMany({
      where: { projectId },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: { storyboards: true }
        }
      }
    });

    success(res, episodes);
  } catch (err) {
    console.error('Failed to get episodes:', err);
    error(res, 'Failed to get episodes');
  }
};

/**
 * 更新剧集信息
 * 可以更新剧集名称、剧本内容和排序值
 */
export const updateEpisode = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const episodeId = parseInt(req.params.id);
  const { name, script, sortOrder } = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    // 通过项目验证所有权
    const episode = await prisma.projectEpisode.findFirst({
      where: { id: episodeId },
      include: { project: true }
    });

    if (!episode || episode.project.userId !== userId) {
      return error(res, 'Episode not found or unauthorized', 404, 404);
    }

    const updated = await prisma.projectEpisode.update({
      where: { id: episodeId },
      data: {
        name,
        script,
        sortOrder
      }
    });

    success(res, updated);
  } catch (err) {
    console.error('Failed to update episode:', err);
    error(res, 'Failed to update episode');
  }
};

/**
 * 删除剧集
 * 同时删除该剧集下的所有分镜
 */
export const deleteEpisode = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const episodeId = parseInt(req.params.id);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const episode = await prisma.projectEpisode.findFirst({
      where: { id: episodeId },
      include: { project: true }
    });

    if (!episode || episode.project.userId !== userId) {
      return error(res, 'Episode not found or unauthorized', 404, 404);
    }

    // 先删除关联的分镜
    await prisma.projectStoryboard.deleteMany({
      where: { episodeId }
    });

    // 最后删除剧集
    await prisma.projectEpisode.delete({
      where: { id: episodeId }
    });

    success(res, { message: 'Episode deleted' });
  } catch (err) {
    console.error('Failed to delete episode:', err);
    error(res, 'Failed to delete episode');
  }
};

/**
 * 获取单个剧集的详细信息
 * 包括剧集的所有分镜
 */
export const getEpisode = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const episodeId = parseInt(req.params.id);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const episode = await prisma.projectEpisode.findFirst({
      where: { id: episodeId },
      include: { 
        project: true,
        storyboards: {
          orderBy: { order: 'asc' }
        }
      }
    });

    if (!episode || episode.project.userId !== userId) {
      return error(res, 'Episode not found or unauthorized', 404, 404);
    }

    success(res, episode);
  } catch (err) {
    console.error('Failed to get episode:', err);
    error(res, 'Failed to get episode');
  }
};
