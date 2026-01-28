import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error, successPage } from '../utils/response';
import { TaskService } from '../services/taskService';

/**
 * 根据 ID 获取任务详情
 * 包括任务关联的项目和资源信息
 */
export const getTask = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const taskId = parseInt(req.params.id);

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        project: true,
        assets: true
      }
    });

    if (!task) {
      return error(res, 'Task not found', 404, 404);
    }

    if (task.project && task.project.userId !== userId) {
      return error(res, 'Unauthorized', 403, 403);
    }

    // 解析 inputParams
    const result = {
      ...task,
      inputParams: task.inputParams ? JSON.parse(task.inputParams) : null
    };

    success(res, result);
  } catch (err) {
    console.error('Failed to get task:', err);
    error(res, 'Failed to get task');
  }
};

/**
 * 获取任务统计信息
 * 按状态分组统计任务数量
 */
export const getTaskStats = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;

  try {
    const stats = await prisma.task.groupBy({
      by: ['status'],
      where: {
        project: { userId }
      },
      _count: {
        id: true
      }
    });

    const result = {
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0
    };

    stats.forEach(stat => {
      if (stat.status in result) {
        result[stat.status as keyof typeof result] = stat._count.id;
      }
    });

    success(res, result);
  } catch (err) {
    console.error('Failed to get task stats:', err);
    error(res, 'Failed to get task stats');
  }
};

/**
 * 获取任务列表
 * 支持按类别、关联ID、状态、项目ID等条件过滤
 * 支持分页查询
 */
export const getTasks = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const { category, relatedId, limit, projectId, status, type } = req.query;
  const page = parseInt(req.query.page as string) || 1;
  const pageSize = parseInt(req.query.pageSize as string) || (limit ? parseInt(limit as string) : 10);

  try {
    const whereClause: any = {
      project: { userId } // 通过项目过滤，确保用户只能访问自己的任务
    };

    if (projectId) {
      whereClause.projectId = parseInt(String(projectId));
    }

    if (type) {
      whereClause.type = String(type);
    }

    if (category) {
      const catStr = String(category);
      if (catStr.includes(',')) {
        whereClause.category = { in: catStr.split(',') };
      } else {
        whereClause.category = catStr;
      }
    }

    if (relatedId) {
      whereClause.relatedId = parseInt(String(relatedId));
    }

    if (status) {
      // 支持逗号分隔的多个状态
      const statuses = String(status).split(',');
      whereClause.status = { in: statuses };
    }

    const [total, tasks] = await prisma.$transaction([
      prisma.task.count({ where: whereClause }),
      prisma.task.findMany({
        where: whereClause,
        include: {
          project: true,
          assets: true
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize
      })
    ]);

    const results = tasks.map(task => ({
      ...task,
      inputParams: task.inputParams ? JSON.parse(task.inputParams) : null
    }));

    successPage(res, results, total, page, pageSize);
  } catch (err) {
    console.error('Failed to get tasks:', err);
    error(res, 'Failed to get tasks');
  }
};

/**
 * 强制取消任务
 * 将正在进行的任务标记为失败状态
 */
export const cancelTask = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const taskId = parseInt(req.params.id);

  try {
    if (!userId) {
      return error(res, 'Unauthorized', 401, 401);
    }

    await TaskService.cancelTask(taskId);
    success(res, { message: 'Task cancelled' });
  } catch (err: any) {
    console.error('Failed to cancel task:', err);
    if (err.message === 'Task not found') {
      return error(res, 'Task not found', 404, 404);
    } else if (err.message === 'Unauthorized') {
      return error(res, 'Unauthorized', 403, 403);
    } else if (err.message === 'Task is already finished') {
      return error(res, 'Task is already finished', 400, 400);
    }
    error(res, 'Failed to cancel task');
  }
};

/**
 * 删除任务
 * 删除任务及其关联的资源（通过级联删除）
 */
export const deleteTask = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const taskId = parseInt(req.params.id);

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true }
    });

    if (!task) {
      return error(res, 'Task not found', 404, 404);
    }

    if (task.project && task.project.userId !== userId) {
      return error(res, 'Unauthorized', 403, 403);
    }

    // 删除任务（关联的资源会通过 Prisma 的 onDelete: Cascade 自动删除）
    await prisma.task.delete({
      where: { id: taskId }
    });

    success(res, { message: 'Task deleted' });
  } catch (err) {
    console.error('Failed to delete task:', err);
    error(res, 'Failed to delete task');
  }
};
