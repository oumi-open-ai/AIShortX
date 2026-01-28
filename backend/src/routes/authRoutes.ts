import { Router } from 'express';
import * as authController from '../controllers/authController';

const router = Router();

// 认证路由

// 开发环境登录（用于本地开发自动登录）
router.post('/dev-login', authController.devLogin);

export default router;
