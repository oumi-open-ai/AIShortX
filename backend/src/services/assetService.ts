import prisma from '../utils/prisma';
import { Prisma } from '@prisma/client';

/** 创建资源参数接口 */
export interface CreateAssetParams {
  userId: number;
  projectId?: number;
  taskId?: number;
  type: 'image' | 'video' | 'audio';
  usage?: 'character' | 'scene' | 'prop' | 'storyboard' | 'general';
  relatedId?: number;
  source?: 'upload' | 'generated';
  url: string;
}

/**
 * 资源服务类
 * 管理项目资源（图片、视频、音频）的创建和查询
 */
export class AssetService {
  /**
   * 创建资源记录
   * 如果存在完全相同的记录（根据所有字段），则跳过创建并返回现有记录
   * @param params 资源参数
   * @param tx Prisma 事务对象（可选）
   * @returns 创建或已存在的资源记录
   */
  static async createAsset(params: CreateAssetParams, tx?: Prisma.TransactionClient) {
    const db = tx || prisma;

    // 查重逻辑：检查是否存在所有字段都匹配的记录
    const existing = await db.asset.findFirst({
      where: {
        userId: params.userId,
        projectId: params.projectId ?? null,
        taskId: params.taskId ?? null,
        type: params.type,
        usage: params.usage ?? null,
        relatedId: params.relatedId ?? null,
        source: params.source || 'generated',
        url: params.url,
      }
    });

    if (existing) {
      return existing;
    }

    return db.asset.create({
      data: {
        userId: params.userId,
        projectId: params.projectId,
        taskId: params.taskId,
        type: params.type,
        usage: params.usage,
        relatedId: params.relatedId,
        source: params.source || 'generated',
        url: params.url,
      }
    });
  }

  /**
   * 批量创建资源记录
   * 逐条调用 createAsset，复用其查重逻辑
   * @param paramsList 资源参数列表
   * @param tx Prisma 事务对象（可选）
   * @returns 创建的资源记录列表
   */
  static async createAssets(paramsList: CreateAssetParams[], tx?: Prisma.TransactionClient) {
    const results = [];
    for (const params of paramsList) {
      results.push(await this.createAsset(params, tx));
    }
    return results;
  }

  /**
   * 根据关联 ID 和用途查询资源历史
   * @param userId 用户 ID
   * @param usage 资源用途
   * @param relatedId 关联实体 ID
   * @param type 资源类型（可选）
   * @returns 资源列表，按创建时间降序
   */
  static async getHistory(
    userId: number, 
    usage: string, 
    relatedId: number, 
    type?: string
  ) {
    return prisma.asset.findMany({
      where: {
        userId,
        usage,
        relatedId,
        ...(type ? { type } : {})
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
  }
}
