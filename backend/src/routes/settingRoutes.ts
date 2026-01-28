import { Router } from 'express';
import * as settingController from '../controllers/settingController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 设置路由

// 通用保存设置接口
router.post('/', settingController.saveSetting);

// 获取AI模型列表（必须在 /:key 之前定义）
router.get('/ai-models', settingController.getAIModelConfigs);

// 用户LLM配置路由

// 测试LLM配置
router.post('/llm/test', settingController.testLLMConfig);

// 获取用户LLM配置列表
router.get('/llm', settingController.getUserLLMConfigs);

// 创建用户LLM配置
router.post('/llm', settingController.createUserLLMConfig);

// 更新用户LLM配置
router.put('/llm/:id', settingController.updateUserLLMConfig);

// 删除用户LLM配置
router.delete('/llm/:id', settingController.deleteUserLLMConfig);

// 通用读取设置接口
router.get('/:key', settingController.getSetting);

export default router;
