import { Router } from 'express';
import * as userController from '../controllers/userController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 用户路由

// 获取用户资料
router.get('/profile', userController.getProfile);

// 更新用户资料
router.put('/profile', userController.updateProfile);

export default router;
