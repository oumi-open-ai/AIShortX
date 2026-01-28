import prisma from '../utils/prisma';
import { TaskEntityService } from './taskEntityService';
import { AssetService } from './assetService';
import { AIModelManager } from './aiModelManager';

/**
 * 任务服务类
 * 负责任务的启动、状态检查、取消等核心功能
 * 支持图片和视频生成任务的异步处理
 */
export class TaskService {
  /**
   * 启动已创建且处于等待状态的任务
   * 根据任务类型调用相应的 AI 提供商生成内容
   * @param task 任务对象（包含 id, type, category, relatedId, inputParams 等）
   * @param userId 用户 ID
   */
  static async startTask(task: any, userId: number) {
    const taskId = task.id;
    try {
      const inputParams = task.inputParams ? JSON.parse(task.inputParams) : {};
      let externalTaskId: string | undefined;

      // 确定任务类别并获取对应的服务商实例
      const category = (task.type === 'video') ? 'video' : 'image';
      let result: any;

      if (category === 'video') {
        const { provider, apiKey, modelValue, providerName } = await AIModelManager.getVideoProvider(userId, task.model, task.providerId);

        // 执行视频生成任务
        const videoParams = {
          ...inputParams,
          prompt: inputParams.prompt,
          duration: inputParams.duration || '10',
          aspect_ratio: inputParams.aspect_ratio || '16:9',
          images: inputParams.images || [],
          model: modelValue || task.model
        };

        result = await provider.generateVideo(videoParams, apiKey);
        externalTaskId = result.task_id;

      } else {
        const { provider, apiKey, modelValue, providerName } = await AIModelManager.getImageProvider(userId, task.model, task.providerId);

        // 执行图片生成任务
        const imageParams = {
          ...inputParams,
          prompt: inputParams.prompt,
          ratio: inputParams.ratio,
          n: inputParams.n || 1,
          image: inputParams.image,
          model: modelValue || task.model
        };

        result = await provider.generateImage(imageParams, apiKey);

        if ('url' in result && result.url) {
          // 同步返回结果，直接完成任务
          await prisma.$transaction(async (tx) => {
            await tx.task.update({
              where: { id: taskId },
              data: {
                status: 'completed',
                progress: 100,
                externalTaskId: 'direct-response'
              }
            });

            const urls = result.urls || [result.url];
            if (urls.length > 0) {
              await AssetService.createAssets(
                urls.map((u: string) => ({
                  userId,
                  projectId: task.projectId,
                  taskId: taskId,
                  type: 'image',
                  usage: this.getAssetUsage(task.category),
                  relatedId: task.relatedId,
                  source: 'generated',
                  url: u
                })),
                tx
              );
            }

            // 更新关联实体
            await TaskEntityService.updateRelatedEntityStatus(task, 'completed', result.url, tx);
          });

          // 任务已完成，直接返回
          return;
        } else if ('task_id' in result) {
          // 异步任务
          externalTaskId = result.task_id;
        } else {
          throw new Error('Unknown response from image provider');
        }
      }

      // --- 更新任务状态 ---
      if (externalTaskId) {
        await prisma.$transaction(async (tx) => {
          await tx.task.update({
            where: { id: taskId },
            data: {
              status: 'processing',
              externalTaskId: externalTaskId,
              progress: 10
            }
          });

          // 更新相关实体状态
          await TaskEntityService.updateRelatedEntityStatus(task, 'generating', undefined, tx);
        });
      }

    } catch (error: any) {
      console.error(`Failed to start task ${taskId}:`, error);

      await prisma.$transaction(async (tx) => {
        await tx.task.update({
          where: { id: taskId },
          data: {
            status: 'failed',
            error: error.message
          }
        });

        // 失败时恢复相关实体状态
        await TaskEntityService.updateRelatedEntityStatus(task, 'failed', undefined, tx, error.message);
      });
    }
  }

  /**
   * 强制取消任务
   * 将任务标记为失败状态，并恢复相关实体状态
   * @param taskId 任务 ID
   * @returns 是否成功取消
   */
  static async cancelTask(taskId: number) {
    const task = await prisma.task.findUnique({
      where: { id: taskId }
    });

    if (!task) {
      throw new Error('Task not found');
    }

    if (task.status === 'completed' || task.status === 'failed') {
      throw new Error('Task is already finished');
    }

    // 强制标记为失败
    await prisma.$transaction(async (tx) => {
      await tx.task.update({
        where: { id: taskId },
        data: {
          status: 'failed',
          error: 'User cancelled manually'
        }
      });

      // 恢复相关实体状态
      await TaskEntityService.updateRelatedEntityStatus(task, 'failed', undefined, tx, 'User cancelled manually');
    });

    return true;
  }

  /**
   * 检查所有正在处理的任务的状态
   * 定期调用此方法以更新任务进度和处理超时任务
   * 包括：
   * 1. 清理卡住的排队任务（超过 5 分钟未启动）
   * 2. 检查进行中任务的状态
   * 3. 处理超时任务（超过 20 分钟）
   */
  static async checkActiveTasks() {
    // 清理卡住的排队任务（Pending Zombies）
    // 如果任务处于 pending 状态超过 5 分钟，视为启动失败
    const PENDING_TIMEOUT = 5 * 60 * 1000;
    const pendingDeadline = new Date(Date.now() - PENDING_TIMEOUT);

    const stuckPendingTasks = await prisma.task.findMany({
      where: {
        status: 'pending',
        updatedAt: { lt: pendingDeadline }
      }
    });

    if (stuckPendingTasks.length > 0) {
      console.log(`[TaskService] Found ${stuckPendingTasks.length} stuck pending tasks. Marking as failed.`);
      for (const task of stuckPendingTasks) {
        try {
          await prisma.$transaction(async (tx) => {
            await tx.task.update({
              where: { id: task.id },
              data: { status: 'failed', error: 'System error: Task failed to start (timeout)' }
            });
            await TaskEntityService.updateRelatedEntityStatus(task, 'failed', undefined, tx, 'System error: Task failed to start (timeout)');
          });
        } catch (err) {
          console.error(`Failed to cleanup stuck pending task ${task.id}:`, err);
        }
      }
    }

    // 检查进行中的任务
    const processingTasks = await prisma.task.findMany({
      where: { status: 'processing' },
      include: { project: true }
    });

    if (processingTasks.length === 0) return;

    // 分批处理任务，避免并发过高
    const BATCH_SIZE = 5;
    for (let i = 0; i < processingTasks.length; i += BATCH_SIZE) {
      const batch = processingTasks.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(task => this.checkSingleTask(task)));
    }
  }

  /**
   * 检查单个任务的状态
   * 查询外部 AI 服务商的任务状态，并更新本地数据库
   * @param task 任务对象
   */
  private static async checkSingleTask(task: any) {
    if (!task.project || !task.externalTaskId) return;

    try {
      // 超时检查：仅检查 processing 状态的任务
      if (task.status === 'processing') {
        const TIMEOUT_MS = 20 * 60 * 1000; // 20 分钟超时
        const now = new Date();
        const updatedAt = new Date(task.updatedAt);

        if (now.getTime() - updatedAt.getTime() > TIMEOUT_MS) {
          console.log(`[TaskService] Task ${task.id} timed out after 20 minutes.`);

          await prisma.$transaction(async (tx) => {
            await tx.task.update({
              where: { id: task.id },
              data: { status: 'failed', error: 'Task timed out (20 mins)' }
            });

            await TaskEntityService.updateRelatedEntityStatus(task, 'failed', undefined, tx, 'Task timed out (20 mins)');
          });
          return;
        }
      }

      let status = 'unknown';
      let resultUrl: string | undefined;
      let failReason: string | undefined;

      console.log(`[TaskService] Checking task ${task.id} (${task.model}, extId: ${task.externalTaskId})...`);

      // 统一查询任务状态
      let result;
      try {
        if (task.type === 'video') {
          const config = await AIModelManager.getVideoProvider(task.project.userId, task.model, task.providerId);
          result = await config.provider.queryTask(task.externalTaskId, config.apiKey);
        } else {
          const config = await AIModelManager.getImageProvider(task.project.userId, task.model, task.providerId);
          const provider = config.provider;

          if ('queryTask' in provider && typeof provider.queryTask === 'function') {
            result = await (provider as any).queryTask(task.externalTaskId, config.apiKey);
          } else {
            console.warn(`Provider for task ${task.id} does not support queryTask`);
            return;
          }
        }

        // 统一处理结果状态
        if (result.status === 'success' || result.status === 'SUCCESS' || result.status === 'completed') {
          status = 'success';
          resultUrl = result.url || result.videoUrl || result.imageUrl; // 使用通用 url 或回退值
        } else if (result.status === 'failed' || result.status === 'FAILURE') {
          status = 'failed';
          failReason = result.failReason || 'Task failed';
        } else {
          status = 'running';
        }

      } catch (e) {
        console.warn(`Check task ${task.id} failed:`, e);
        return;
      }

      // 处理任务结果
      console.log(`[TaskService] Task ${task.id} check result: status=${status}, url=${resultUrl || 'N/A'}`);

      if (status === 'success') {
        if (!resultUrl) {
          console.warn(`[TaskService] Task ${task.id} is marked as success but has no resultUrl. Marking as failed.`);
          status = 'failed';
          failReason = 'Task success but no result URL';
        }
      }

      if (status === 'success') {
        await prisma.$transaction(async (tx) => {
          await tx.task.update({
            where: { id: task.id },
            data: { status: 'completed', progress: 100 }
          });

          if (resultUrl) {
            await AssetService.createAsset({
              userId: task.project.userId,
              projectId: task.project.id,
              taskId: task.id,
              type: task.type === 'video' ? 'video' : 'image',
              usage: this.getAssetUsage(task.category),
              relatedId: task.relatedId,
              source: 'generated',
              url: resultUrl
            }, tx);
          }

          // 更新关联实体
          await TaskEntityService.updateRelatedEntityStatus(task, 'completed', resultUrl, tx);
        });

        console.log(`[TaskService] Task ${task.id} completed.`);

      } else if (status === 'failed') {
        await prisma.$transaction(async (tx) => {
          await tx.task.update({
            where: { id: task.id },
            data: { status: 'failed', error: failReason || 'Unknown error' }
          });
          await TaskEntityService.updateRelatedEntityStatus(task, 'failed', undefined, tx, failReason || 'Unknown error');
        });
      }

    } catch (error) {
      console.error(`Error checking task ${task.id}:`, error);
    }
  }

  /**
   * 辅助方法：将任务类别映射为资源用途
   * @param category 任务类别
   * @returns 资源用途类型
   */
  private static getAssetUsage(category: string): 'character' | 'scene' | 'prop' | 'storyboard' | 'general' {
    switch (category) {
      case 'character_image':
      case 'character_video':
        return 'character';
      case 'scene_image':
        return 'scene';
      case 'prop_image':
        return 'prop';
      case 'storyboard_image':
      case 'storyboard_video':
      case 'upscale':
        return 'storyboard';
      default:
        return 'general';
    }
  }
}
