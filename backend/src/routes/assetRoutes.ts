import { Router } from 'express';
import * as assetController from '../controllers/assetController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 资源路由

// 创建资源
router.post('/', assetController.createAsset);

// 获取资源列表（支持查询参数：relatedId、category、type）
router.get('/', assetController.getAssets);

export default router;
