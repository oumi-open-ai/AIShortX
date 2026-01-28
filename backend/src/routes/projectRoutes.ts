import { Router } from 'express';
import * as projectController from '../controllers/projectController';
import * as projectCharacterController from '../controllers/projectCharacterController';
import * as projectSceneController from '../controllers/projectSceneController';
import * as projectPropController from '../controllers/projectPropController';
import * as projectStoryboardController from '../controllers/projectStoryboardController';
import * as episodeController from '../controllers/episodeController';
import { authenticate } from '../middlewares/auth';

const router = Router();

// 对所有路由应用认证中间件
router.use(authenticate);

// ==================== 项目基础路由 ====================

// 获取项目列表
router.get('/', projectController.getProjects);

// 创建项目
router.post('/', projectController.createProject);

// 获取项目详情
router.get('/:id', projectController.getProject);

// 更新项目
router.put('/:id', projectController.updateProject);

// 删除项目
router.delete('/:id', projectController.deleteProject);

// ==================== 剧集路由 ====================

// 创建剧集
router.post('/:projectId/episodes', episodeController.createEpisode);

// 获取剧集列表
router.get('/:projectId/episodes', episodeController.getEpisodes);

// 获取剧集详情
router.get('/episodes/:id', episodeController.getEpisode);

// 更新剧集
router.put('/episodes/:id', episodeController.updateEpisode);

// 删除剧集
router.delete('/episodes/:id', episodeController.deleteEpisode);

// ==================== 角色路由 ====================

// 批量创建或更新角色
router.post('/:id/characters', projectCharacterController.upsertCharacters);

// 更新单个角色
router.put('/:id/characters/:charId', projectCharacterController.updateCharacter);

// 删除角色
router.delete('/:id/characters/:charId', projectCharacterController.deleteCharacter);

// 生成角色图片
router.post('/:id/characters/:charId/generate_image', projectCharacterController.generateCharacterImage);

// 生成角色视频
router.post('/:id/characters/:charId/generate_video', projectCharacterController.generateCharacterVideo);

// ==================== 场景路由 ====================

// 批量创建或更新场景
router.post('/:id/scenes', projectSceneController.upsertScenes);

// 删除场景
router.delete('/:id/scenes/:sceneId', projectSceneController.deleteScene);

// 生成场景图片
router.post('/:id/scenes/:sceneId/generate_image', projectSceneController.generateSceneImage);

// ==================== 道具路由 ====================

// 批量创建或更新道具
router.post('/:id/props', projectPropController.upsertProps);

// 删除道具
router.delete('/:id/props/:propId', projectPropController.deleteProp);

// 生成道具图片
router.post('/:id/props/:propId/generate_image', projectPropController.generatePropImage);

// ==================== 分镜路由 ====================

// 批量创建或更新分镜
router.post('/:id/storyboards', projectStoryboardController.upsertStoryboards);

// 更新分镜媒体信息
router.patch('/:id/storyboards/:storyboardId/media', projectStoryboardController.updateStoryboardMedia);

// 删除分镜
router.delete('/:id/storyboards/:storyboardId', projectStoryboardController.deleteStoryboard);

// 生成分镜图片
router.post('/:id/storyboards/:storyboardId/generate_image', projectStoryboardController.generateStoryboardImage);

// 生成分镜视频
router.post('/:id/storyboards/:storyboardId/generate_video', projectStoryboardController.generateStoryboardVideo);

// 生成分镜高清视频（超分辨率）
router.post('/:id/storyboards/:storyboardId/generate_high_res_video', projectStoryboardController.generateStoryboardHighResVideo);

export default router;
