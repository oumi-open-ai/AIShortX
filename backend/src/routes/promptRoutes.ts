import { Router } from 'express';
import { getPromptConfigs, updatePromptConfig, getSystemPromptsByType } from '../controllers/promptController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 提示词配置路由

// 获取所有提示词配置
router.get('/configs', getPromptConfigs);

// 更新提示词配置
router.post('/configs', updatePromptConfig);

// 根据类型获取系统模板列表
router.get('/system-templates/:type', getSystemPromptsByType);

export default router;
