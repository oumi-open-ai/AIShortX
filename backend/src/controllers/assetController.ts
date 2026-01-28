import { Request, Response } from 'express';
import { AuthRequest } from '../middlewares/auth';
import { success, error, successPage, validateBody } from '../utils/response';
import { AssetService } from '../services/assetService';
import { z } from 'zod';

/**
 * 创建资源
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const createAsset = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  const schema = z.object({
    projectId: z.number(),
    type: z.enum(['image', 'video', 'audio']),
    usage: z.enum(['character', 'scene', 'prop', 'storyboard', 'general']),
    relatedId: z.number().optional(),
    url: z.string().url(),
    source: z.enum(['upload', 'generated']).default('upload'),
  });

  const data = validateBody(res, schema, req.body);
  if (!data) return;

  try {
    const asset = await AssetService.createAsset({
      userId,
      projectId: data.projectId,
      type: data.type,
      usage: data.usage,
      relatedId: data.relatedId || 0,
      source: data.source as 'upload' | 'generated',
      url: data.url
    });

    success(res, asset);
  } catch (err) {
    console.error('Failed to create asset:', err);
    error(res, 'Failed to create asset');
  }
};

/**
 * 获取资源列表
 * 支持按类别、类型和关联ID筛选
 * @param req - 请求对象
 * @param res - 响应对象
 */
export const getAssets = async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).user?.id;
  const { relatedId, category, type } = req.query;

  if (!userId) {
    return error(res, 'Unauthorized', 401, 401);
  }

  try {
    let usage = 'general';
    let assetType = type as string;

    // 根据 category 推断 usage 和 type
    if (category) {
      const cat = String(category);
      if (cat.includes('character')) usage = 'character';
      else if (cat.includes('scene')) usage = 'scene';
      else if (cat.includes('prop')) usage = 'prop';
      else if (cat.includes('storyboard')) usage = 'storyboard';

      if (!assetType) {
        const hasVideo = cat.includes('video');
        const hasImage = cat.includes('image');
        
        if (hasVideo && !hasImage) {
          assetType = 'video';
        } else if (hasImage && !hasVideo) {
          assetType = 'image';
        }
        // 如果两者都有或都没有，保持 assetType 为 undefined 以获取所有类型
      }
    }

    const assets = await AssetService.getHistory(
      userId,
      usage,
      relatedId ? parseInt(String(relatedId)) : 0,
      assetType
    );

    success(res, assets);
  } catch (err) {
    console.error('Failed to get assets:', err);
    error(res, 'Failed to get assets');
  }
};
