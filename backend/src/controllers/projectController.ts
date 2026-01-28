import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, successPage, error, validateBody } from '../utils/response';
import { SettingService } from '../services/settingService';
import { z } from 'zod';
import { AIService } from '../services/aiService';

/**
 * 创建新项目
 * 为当前用户创建一个新项目，并自动创建第一集
 */
export const createProject = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const { name, aspectRatio, styleId, script, status } = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const project = await prisma.project.create({
      data: {
        userId,
        name: name || '未命名项目',
        aspectRatio: aspectRatio || '16:9',
        styleId: styleId ? Number(styleId) : 1,
        episodes: {
          create: {
            name: '第一集',
            script: script || '',
            sortOrder: 0
          }
        }
      },
      include: {
        episodes: true
      }
    });

    success(res, project);
  } catch (err) {
    console.error('Failed to create project:', err);
    error(res, 'Failed to create project');
  }
};

/**
 * 获取当前用户的所有项目
 * 支持分页查询
 */
export const getProjects = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || 10;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const skip = (page - 1) * pageSize;
    const [total, projects] = await prisma.$transaction([
      prisma.project.count({ where: { userId } }),
      prisma.project.findMany({
        where: { userId },
        include: { style: true },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);

    const mappedProjects = projects.map(p => ({
      ...p,
      visualStyle: p.style?.name || ''
    }));

    successPage(res, mappedProjects, total, page, pageSize);
  } catch (err) {
    console.error('Failed to get projects:', err);
    error(res, 'Failed to get projects');
  }
};

/**
 * 获取单个项目的详细信息
 * 包括项目的所有关联数据：角色、场景、物品、分镜、任务等
 */
export const getProject = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (isNaN(projectId)) {
    return error(res, 'Invalid project ID', 400, 400);
  }

  // 辅助函数：解析后端的 JSON 字段
  const parseCharacter = (char: any) => ({
    ...char,
    originalData: char.originalData ? JSON.parse(char.originalData) : undefined
  });

  try {
    const project = await prisma.project.findFirst({
      where: { 
        id: projectId,
        userId // Ensure user owns the project
      },
      include: {
        style: true,
        episodes: {
          orderBy: { sortOrder: 'asc' }
        },
        characters: {
          orderBy: { id: 'desc' }
        },
        scenes: {
          orderBy: { id: 'asc' }
        },
        props: {
          orderBy: { id: 'asc' }
        },
        storyboards: {
          orderBy: { order: 'asc' }
        },
        tasks: {
          orderBy: { createdAt: 'desc' },
          take: 20 // 限制只返回最近的 20 个任务
        }
      }
    });

    if (!project) {
      return error(res, 'Project not found', 404, 404);
    }

    // 解析角色数据
    const mappedProject = {
      ...project,
      characters: project.characters.map(parseCharacter),
      visualStyle: project.style?.name || ''
    };

    success(res, mappedProject);
  } catch (err) {
    console.error('Failed to get project:', err);
    error(res, 'Failed to get project');
  }
};

/**
 * 更新项目信息
 * 只允许更新指定的字段：名称、画面比例、风格ID
 */
export const updateProject = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);
  const data = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (isNaN(projectId)) {
    return error(res, 'Invalid project ID', 400, 400);
  }

  try {
    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!existing) {
      return error(res, 'Project not found', 404, 404);
    }

    // 过滤允许更新的字段
    const allowedFields = [
      'name', 'aspectRatio', 'styleId'
    ];

    const updateData: any = {};
    Object.keys(data).forEach(key => {
      if (allowedFields.includes(key)) {
        updateData[key] = data[key];
      }
    });

    const project = await prisma.project.update({
      where: { id: projectId },
      data: updateData
    });

    success(res, project);
  } catch (err) {
    console.error('Failed to update project:', err);
    error(res, 'Failed to update project');
  }
};

/**
 * 删除项目
 * 删除项目及其所有关联数据
 */
export const deleteProject = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const projectId = parseInt(req.params.id);

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    // Verify ownership
    const existing = await prisma.project.findFirst({
      where: { id: projectId, userId }
    });

    if (!existing) {
      return error(res, 'Project not found', 404, 404);
    }

    await prisma.project.delete({
      where: { id: projectId }
    });

    success(res, { message: 'Project deleted' });
  } catch (err) {
    console.error('Failed to delete project:', err);
    error(res, 'Failed to delete project');
  }
};
