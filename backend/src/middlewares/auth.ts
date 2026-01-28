import { Request, Response, NextFunction } from 'express';

/**
 * 认证请求接口
 * 扩展 Express Request，添加用户信息
 */
export interface AuthRequest extends Request {
  user?: {
    id: number;
    role: string;
  };
}

/**
 * 认证中间件
 * 本地模式：绕过 JWT 验证，始终使用默认用户（ID: 1）
 * 
 * @param req Express 请求对象
 * @param res Express 响应对象
 * @param next 下一个中间件函数
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // 始终认证为默认用户（ID: 1）
  (req as AuthRequest).user = {
    id: 1,
    role: 'PERMANENT'
  };
  next();
};
