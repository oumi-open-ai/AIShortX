import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import jwt from 'jsonwebtoken';
import { success, error } from '../utils/response';

const JWT_SECRET = process.env.JWT_SECRET || 'your_super_secret_key';
const DEV_USER_ID = parseInt(process.env.DEV_LOGIN_USER_ID || '1');

/**
 * 开发环境登录
 * 用于本地开发环境的快速登录
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const devLogin = async (req: Request, res: Response) => {
  try {
    const userId = req.body.userId || DEV_USER_ID;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return error(res, 'User not found', 404, 404);
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: '3650d' } // 本地环境使用长期有效期
    );

    success(res, {
      status: 'confirmed',
      token,
      user
    });
  } catch (err) {
    console.error(err);
    error(res, 'Internal server error');
  }
};
