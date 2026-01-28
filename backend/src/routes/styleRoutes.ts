import { Router } from 'express';
import { authenticate } from '../middlewares/auth';
import * as styleController from '../controllers/styleController';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 风格路由

// 获取风格列表
router.get('/', styleController.getStyles);

// 创建风格
router.post('/', styleController.createStyle);

// 更新风格
router.put('/:id', styleController.updateStyle);

// 删除风格
router.delete('/:id', styleController.deleteStyle);

export default router;
