import { Response } from 'express';
import { z, ZodError, ZodTypeAny } from 'zod';

/** API 响应接口 */
export interface ApiResponse<T = any> {
  code: number;
  message: string;
  data: T | null;
}

/**
 * 返回成功响应
 * @param res Express 响应对象
 * @param data 响应数据
 * @param message 响应消息
 */
export const success = <T>(res: Response, data: T | null = null, message: string = 'success') => {
  res.status(200).json({
    code: 200,
    message,
    data,
  });
};

/**
 * 返回分页成功响应
 * @param res Express 响应对象
 * @param list 数据列表
 * @param total 总数
 * @param page 当前页码
 * @param pageSize 每页大小
 * @param message 响应消息
 */
export const successPage = <T>(res: Response, list: T[], total: number, page: number, pageSize: number, message: string = 'success') => {
  res.status(200).json({
    code: 200,
    message,
    data: {
      list,
      total,
      page,
      pageSize
    }
  });
};

/**
 * 返回错误响应
 * @param res Express 响应对象
 * @param message 错误消息
 * @param code 业务错误码
 * @param status HTTP 状态码
 */
export const error = (res: Response, message: string = 'Internal Server Error', code: number = 500, status: number = 500) => {
  res.status(status).json({
    code,
    message,
    data: null,
  });
};

/**
 * 验证请求体数据
 * 使用 Zod schema 验证请求体，验证失败时返回错误响应
 * @param res Express 响应对象
 * @param schema Zod 验证 schema
 * @param body 请求体数据
 * @returns 验证通过的数据，失败返回 null
 */
export const validateBody = <T extends ZodTypeAny>(res: Response, schema: T, body: unknown) => {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data as z.infer<T>;

  const firstMessage =
    result.error instanceof ZodError ? result.error.issues[0]?.message : 'Invalid request body';

  error(res, firstMessage || 'Invalid request body', 400, 400);
  return null;
};
