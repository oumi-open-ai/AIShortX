import { Request, Response } from 'express';
import { error, success } from '../utils/response';
import path from 'path';

/**
 * 本地文件上传
 * POST /api/upload/file
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const uploadFile = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return error(res, 'No file uploaded');
    }

    // 将绝对路径转换为相对URL
    // req.file.path 类似 d:\Projects\anime_drama\backend\uploads\image\2024\01\01\abc.png
    // 我们需要 /uploads/image/2024/01/01/abc.png
    
    const relativePath = path.relative(process.cwd(), req.file.path);
    const urlPath = '/' + relativePath.split(path.sep).join('/');
    
    const port = process.env.PORT || 3000;
    const fullUrl = `http://localhost:${port}${urlPath}`;
    
    return success(res, { url: fullUrl });
  } catch (err: any) {
    console.error('Upload error:', err);
    return error(res, 'Upload failed: ' + err.message);
  }
};

/**
 * 已废弃：获取凭证（保留存根以防万一）
 */
export const getCredential = async (_req: Request, res: Response) => {
   return error(res, 'Local mode: Please use /api/upload/file');
};
