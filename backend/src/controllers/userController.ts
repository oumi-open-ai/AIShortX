import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';
import { success, error } from '../utils/response';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';

/**
 * 获取用户资料
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const getProfile = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        role: true,
        vipExpireAt: true,
        createdAt: true
      }
    });

    if (!user) {
      return error(res, 'User not found', 404, 404);
    }

    success(res, user);
  } catch (err) {
    console.error(err);
    error(res, 'Internal server error');
  }
};

/**
 * 更新用户资料
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const updateProfile = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const { nickname } = req.body;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  if (!nickname || nickname.trim().length === 0) {
    return error(res, 'Nickname is required', 400, 400);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { nickname },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        role: true
      }
    });

    success(res, user);
  } catch (err) {
    console.error(err);
    error(res, 'Failed to update profile');
  }
};
