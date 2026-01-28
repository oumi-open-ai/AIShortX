import { Router } from 'express';
import * as taskController from '../controllers/taskController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 任务路由

// 获取任务统计信息
router.get('/stats', taskController.getTaskStats);

// 获取任务列表（支持查询参数：category、relatedId、limit）
router.get('/', taskController.getTasks);

// 获取任务详情
router.get('/:id', taskController.getTask);

// 取消任务
router.post('/:id/cancel', taskController.cancelTask);

// 删除任务
router.delete('/:id', taskController.deleteTask);

export default router;
