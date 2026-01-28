import { Router } from 'express';
import * as characterController from '../controllers/characterController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// 角色库路由

// 获取角色列表
router.get('/', characterController.listCharacters);

// 创建角色
router.post('/', characterController.createCharacter);

// 更新角色
router.put('/:id', characterController.updateCharacter);

// 删除角色
router.delete('/:id', characterController.deleteCharacter);

export default router;
