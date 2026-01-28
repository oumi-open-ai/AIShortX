import { PrismaClient } from '@prisma/client';
import prisma from '../utils/prisma';

/**
 * 任务关联实体状态更新服务
 * 专门处理任务状态变化时，对关联业务实体（如角色、分镜）的状态同步
 * 
 * 设计目的：
 * 1. 从 TaskService 中剥离具体的业务实体更新逻辑，保持 TaskService 简洁
 * 2. 支持传入事务对象 (tx)，确保任务状态更新与业务实体更新的原子性
 */
export class TaskEntityService {
  
  /**
   * 更新关联实体状态
   * @param task 任务对象
   * @param statusType 状态类型
   * @param resultUrl 结果URL (可选)
   * @param tx Prisma 事务对象 (可选，如果传入则使用该事务)
   * @param errorMsg 错误信息 (可选，仅在 failed 状态下使用)
   */
  static async updateRelatedEntityStatus(
    task: any, 
    statusType: 'generating' | 'failed' | 'completed', 
    resultUrl?: string, 
    tx?: any,
    errorMsg?: string
  ) {
    // 使用传入的事务客户端，或者默认的 prisma 实例
    const db = tx || prisma;
    const { category, relatedId } = task;
    
    try {
      if (statusType === 'completed' && !resultUrl) {
        console.warn(`[TaskEntityService] Warning: Status is completed but resultUrl is missing for ${category} (relatedId: ${relatedId}). Update skipped.`);
        return;
      }

      // 1. 角色图片 (character_image)
      if (category === 'character_image') {
        if (statusType === 'generating') {
          await db.projectCharacter.update({ where: { id: relatedId }, data: { imageStatus: 'generating' } });
        } else if (statusType === 'failed') {
          await db.projectCharacter.update({ where: { id: relatedId }, data: { imageStatus: 'failed' } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectCharacter.update({ 
            where: { id: relatedId }, 
            data: { imageStatus: 'generated', imageUrl: resultUrl } 
          });
        }
      } 
      // 2. 角色视频 (character_video)
      else if (category === 'character_video') {
        if (statusType === 'generating') {
          await db.projectCharacter.update({ where: { id: relatedId }, data: { videoStatus: 'generating' } });
        } else if (statusType === 'failed') {
          await db.projectCharacter.update({ where: { id: relatedId }, data: { videoStatus: 'failed' } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectCharacter.update({ 
            where: { id: relatedId }, 
            data: { videoStatus: 'generated', videoUrl: resultUrl } 
          });
        }
      }
      // 3. 分镜视频 (storyboard_video)
      else if (category === 'storyboard_video') {
        if (statusType === 'generating') {
          await db.projectStoryboard.update({ where: { id: relatedId }, data: { status: 'generating_video', errorMsg: null } });
        } else if (statusType === 'failed') {
          await db.projectStoryboard.update({ where: { id: relatedId }, data: { status: 'failed', errorMsg: errorMsg } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectStoryboard.update({ 
            where: { id: relatedId }, 
            data: { status: 'video_generated', videoUrl: resultUrl, errorMsg: null } 
          });
        }
      }
      // 4. 高清放大 (upscale)
      else if (category === 'upscale') {
        if (statusType === 'generating') {
          await db.projectStoryboard.update({ where: { id: relatedId }, data: { highResStatus: 'generating', highResErrorMsg: null } });
        } else if (statusType === 'failed') {
          await db.projectStoryboard.update({ where: { id: relatedId }, data: { highResStatus: 'failed', highResErrorMsg: errorMsg } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectStoryboard.update({ 
            where: { id: relatedId }, 
            data: { highResStatus: 'success', highResVideoUrl: resultUrl, highResErrorMsg: null } 
          });
        }
      }
      // 5. 分镜图片 (storyboard_image)
      else if (category === 'storyboard_image') {
        if (statusType === 'generating') {
          await db.projectStoryboard.update({ where: { id: relatedId }, data: { imageStatus: 'generating' } });
        } else if (statusType === 'failed') {
          await db.projectStoryboard.update({ where: { id: relatedId }, data: { imageStatus: 'failed' } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectStoryboard.update({ 
            where: { id: relatedId }, 
            data: { imageStatus: 'generated', imageUrl: resultUrl } 
          });
        }
      }
      // 6. 场景图片 (scene_image)
      else if (category === 'scene_image') {
        if (statusType === 'generating') {
          await db.projectScene.update({ where: { id: relatedId }, data: { status: 'generating' } });
        } else if (statusType === 'failed') {
          await db.projectScene.update({ where: { id: relatedId }, data: { status: 'failed' } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectScene.update({ 
            where: { id: relatedId }, 
            data: { status: 'generated', imageUrl: resultUrl } 
          });
        }
      }
      // 7. 物品图片 (prop_image)
      else if (category === 'prop_image') {
        if (statusType === 'generating') {
          await db.projectProp.update({ where: { id: relatedId }, data: { status: 'generating' } });
        } else if (statusType === 'failed') {
          await db.projectProp.update({ where: { id: relatedId }, data: { status: 'failed' } });
        } else if (statusType === 'completed' && resultUrl) {
          await db.projectProp.update({ 
            where: { id: relatedId }, 
            data: { status: 'generated', imageUrl: resultUrl } 
          });
        }
      } else {
        console.warn(`[TaskEntityService] Warning: Unknown category ${category} for task related update.`);
      }
    } catch (error) {
      console.error(`[TaskEntityService] Failed to update related entity for task ${task.id}:`, error);
      // 在事务中，如果这里抛出错误，会导致整个任务状态更新回滚，保证了一致性
      // 如果希望即使关联更新失败，任务状态依然更新，则需要在这里捕获错误并不重新抛出
      // 但为了数据一致性，建议抛出错误
      throw error;
    }
  }
}
