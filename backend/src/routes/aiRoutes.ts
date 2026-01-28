import { Router } from 'express';
import { AIController } from '../controllers/aiController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有AI路由应用认证中间件
router.use(authenticate);

// AI分析路由

// 项目元素分析接口（角色、场景、物品）
router.post('/elements/analyze', AIController.analyzeElements);

// 项目分镜分析接口
router.post('/storyboards/analyze', AIController.analyzeStoryboards);

// 分镜视频提示词推理接口
router.post('/storyboards/inference', AIController.inferStoryboard);

export default router;
