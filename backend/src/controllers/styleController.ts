import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';
import { z } from 'zod';

/**
 * 获取风格列表
 * 返回系统风格和用户自定义风格，用户风格优先显示
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const getStyles = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  
  if (!userId) {
     return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const styles = await prisma.style.findMany({
      where: {
        OR: [
          { userId: 0 },
          { userId: userId }
        ]
      }
    });

    // 排序：用户风格优先（按ID降序），然后是系统风格（按ID升序）
    const sortedStyles = styles.sort((a, b) => {
      // 如果一个是用户风格，另一个是系统风格
      if (a.userId !== 0 && b.userId === 0) return -1; // 用户风格排在前面
      if (a.userId === 0 && b.userId !== 0) return 1;  // 系统风格排在后面
      
      // 如果都是用户风格，按ID降序排列（最新的在前）
      if (a.userId !== 0 && b.userId !== 0) {
        return b.id - a.id;
      }
      
      // 如果都是系统风格，按ID升序排列（保持原始顺序）
      return a.id - b.id;
    });

    return success(res, sortedStyles);
  } catch (err) {
    console.error('Get styles error:', err);
    return error(res, 'Failed to fetch styles');
  }
};

/**
 * 创建风格
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const createStyle = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  const schema = z.object({
    name: z.string().min(1),
    prompt: z.string().min(1),
    imageUrl: z.string().optional()
  });

  const validation = schema.safeParse(req.body);
  if (!validation.success) {
    return error(res, 'Invalid input', 400, 400);
  }

  const { name, prompt, imageUrl } = validation.data;

  try {
    const style = await prisma.style.create({
      data: {
        name,
        prompt,
        imageUrl,
        userId
      }
    });
    return success(res, style);
  } catch (err) {
    console.error('Create style error:', err);
    return error(res, 'Failed to create style');
  }
};

/**
 * 更新风格
 * 只能更新用户自己创建的风格
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const updateStyle = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  const { id } = req.params;
  const styleId = parseInt(id);
  if (isNaN(styleId)) {
    return error(res, 'Invalid style ID', 400, 400);
  }

  const schema = z.object({
    name: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    imageUrl: z.string().optional()
  });

  const validation = schema.safeParse(req.body);
  if (!validation.success) {
    return error(res, 'Invalid input', 400, 400);
  }

  try {
    // Check ownership
    const existingStyle = await prisma.style.findUnique({
      where: { id: styleId }
    });

    if (!existingStyle) {
      return error(res, 'Style not found', 404, 404);
    }

    if (existingStyle.userId !== userId) {
      return error(res, 'Permission denied', 403, 403);
    }

    const updatedStyle = await prisma.style.update({
      where: { id: styleId },
      data: validation.data
    });

    return success(res, updatedStyle);
  } catch (err) {
    console.error('Update style error:', err);
    return error(res, 'Failed to update style');
  }
};

/**
 * 删除风格
 * 只能删除用户自己创建的风格，且不能删除正在被项目使用的风格
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const deleteStyle = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  const { id } = req.params;
  const styleId = parseInt(id);
  if (isNaN(styleId)) {
    return error(res, 'Invalid style ID', 400, 400);
  }

  try {
    // 检查所有权
    const existingStyle = await prisma.style.findUnique({
      where: { id: styleId }
    });

    if (!existingStyle) {
      return error(res, 'Style not found', 404, 404);
    }

    if (existingStyle.userId !== userId) {
      return error(res, 'Permission denied', 403, 403);
    }
    
    // 检查是否有项目正在使用该风格
    const projectCount = await prisma.project.count({
      where: { styleId }
    });

    if (projectCount > 0) {
      return error(res, `该风格已被 ${projectCount} 个项目使用，无法删除`, 400, 400);
    }

    await prisma.style.delete({
      where: { id: styleId }
    });

    return success(res, null);
  } catch (err) {
    console.error('Delete style error:', err);
    return error(res, 'Failed to delete style');
  }
};
