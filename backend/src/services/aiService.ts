import { PromptService } from './promptService';
import { Role, AIProvider } from './api/types';
import { AIModelManager } from './aiModelManager';
import prisma from '../utils/prisma';
import { extractJson } from '../utils/jsonExtractor';

/**
 * AI 服务类
 * 提供项目元素分析、分镜分析等 AI 相关功能
 */
export class AIService {

  /**
   * 分析项目元素并入库（角色、场景、物品）
   * @param userId 用户 ID
   * @param projectId 项目 ID
   * @param scriptContent 剧本内容
   * @param _provider AI 提供商（已废弃，从配置获取）
   * @param _apiKey API 密钥（已废弃，从配置获取）
   * @param model 模型名称
   * @param saveToDb 是否保存到数据库
   * @param episodeId 剧集 ID（可选）
   * @param isAppend 是否为追加剧本模式
   * @returns 分析结果：角色、场景、物品列表
   */
  static async analyzeProjectElements(
    userId: number,
    projectId: number,
    scriptContent: string,
    _provider: AIProvider,
    _apiKey: string,
    model?: string,
    saveToDb: boolean = true,
    episodeId?: number,
    isAppend: boolean = false // 新增参数：是否为追加剧本模式
  ): Promise<{ roles: any[], scenes: any[], props: any[] }> {
    const prompt = await PromptService.getAnalyzeElementsPrompt(userId, { script: scriptContent });

    try {
      const { provider: llmProvider, apiKey: llmApiKey, modelValue } = await AIModelManager.getLLMProvider(userId);

      const content = await llmProvider.chat({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请开始分析' }
        ],
        temperature: 0.7,
        model: model || modelValue
      }, llmApiKey);

      const result = JSON.parse(extractJson(content));
      // extractJson 已自动将对象格式转换为数组格式
      const roles = result.roles || [];
      const scenes = result.scenes || [];
      const props = result.props || [];
      
      // 入库操作 - 使用事务确保数据一致性
      if (saveToDb) {
        await prisma.$transaction(async (tx) => {
          let newRoles = roles;
          let newScenes = scenes;
          let newProps = props;

          // 只有在追加剧本模式下才检查重复，避免重复创建
          if (isAppend) {
            // 查询项目中已存在的角色、场景、物品名称
            const [existingCharacters, existingScenes, existingProps] = await Promise.all([
              tx.projectCharacter.findMany({
                where: { projectId },
                select: { name: true }
              }),
              tx.projectScene.findMany({
                where: { projectId },
                select: { name: true }
              }),
              tx.projectProp.findMany({
                where: { projectId },
                select: { name: true }
              })
            ]);

            // 创建已存在名称的 Set，用于快速查找
            const existingCharacterNames = new Set(existingCharacters.map(c => c.name));
            const existingSceneNames = new Set(existingScenes.map(s => s.name));
            const existingPropNames = new Set(existingProps.map(p => p.name));

            // 过滤掉已存在的元素，只保留新元素
            newRoles = roles.filter((r: any) => !existingCharacterNames.has(r.name));
            newScenes = scenes.filter((s: any) => !existingSceneNames.has(s.name));
            newProps = props.filter((p: any) => !existingPropNames.has(p.name));

            // 记录跳过的重复元素数量
            const skippedCount = {
              characters: roles.length - newRoles.length,
              scenes: scenes.length - newScenes.length,
              props: props.length - newProps.length
            };

            if (skippedCount.characters > 0 || skippedCount.scenes > 0 || skippedCount.props > 0) {
              console.log('跳过已存在的元素:', skippedCount);
            }
          }

          // 批量插入新角色
          if (newRoles.length > 0) {
             await tx.projectCharacter.createMany({
               data: newRoles.map((r: any) => ({
                 projectId,
                 episodeId: episodeId || null,
                 name: r.name,
                 description: r.description || '',
                 voice: r.voice || '',
                 source: 'ai'
               }))
             });
          }
  
          // 批量插入新场景
          if (newScenes.length > 0) {
            await tx.projectScene.createMany({
              data: newScenes.map((s: any) => ({
                projectId,
                episodeId: episodeId || null,
                name: s.name,
                description: s.description || '',
                status: 'idle'
              }))
            });
          }
  
          // 批量插入新物品
          if (newProps.length > 0) {
            await tx.projectProp.createMany({
              data: newProps.map((p: any) => ({
                projectId,
                episodeId: episodeId || null,
                name: p.name,
                description: p.description || '',
                status: 'idle'
              }))
            });
          }
        });
      }

      // 返回数组格式的分析结果
      return { roles, scenes, props };
    } catch (e: any) {
      console.error('Failed to analyze project elements:', e);
      console.error('Error details:', {
        message: e.message,
        stack: e.stack,
        userId,
        projectId,
        episodeId,
        scriptLength: scriptContent?.length
      });
      throw new Error(`Failed to analyze project elements: ${e.message}`);
    }
  }

  /**
   * 分析项目分镜并入库
   * @param userId 用户 ID
   * @param projectId 项目 ID
   * @param scriptContent 剧本内容
   * @param _provider AI 提供商（已废弃）
   * @param _apiKey API 密钥（已废弃）
   * @param model 模型名称
   * @param episodeId 剧集 ID（可选）
   * @returns 分镜列表
   */
  static async analyzeProjectStoryboards(
    userId: number,
    projectId: number,
    scriptContent: string,
    _provider: AIProvider,
    _apiKey: string,
    model?: string,
    episodeId?: number
  ): Promise<any[]> {
    // 获取分镜分析提示词
    const prompt = await PromptService.getStoryboardAnalysisPrompt(userId, { 
      script: scriptContent
    });

    try {
      const { provider: llmProvider, apiKey: llmApiKey, modelValue } = await AIModelManager.getLLMProvider(userId);

      const content = await llmProvider.chat({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请开始分析' }
        ],
        temperature: 0.7,
        model: model || modelValue
      }, llmApiKey);

      const storyboards = JSON.parse(extractJson(content));

      if (!Array.isArray(storyboards)) {
        throw new Error('AI response is not an array');
      }

      // 提取所有涉及的元素名称，用于后续数据库查询匹配（使用 Set 去重）
      const roleNames = [...new Set(storyboards.flatMap(s => s['role-use'] || []))];
      const propNames = [...new Set(storyboards.flatMap(s => s['prop-use'] || []))];
      // 场景是单个字符串，需要特殊处理
      const sceneNames = [...new Set(storyboards.map(s => s['scene-use']).filter(Boolean))] as string[];

      const [roles, scenes, props] = await Promise.all([
        prisma.projectCharacter.findMany({ 
          where: { projectId, name: { in: roleNames } },
          select: { id: true, name: true }
        }),
        prisma.projectScene.findMany({ 
          where: { projectId, name: { in: sceneNames } },
          select: { id: true, name: true }
        }),
        prisma.projectProp.findMany({ 
          where: { projectId, name: { in: propNames } },
          select: { id: true, name: true }
        })
      ]);

      console.log('数据库查询结果:');
      console.log('- 找到的角色:', roles);
      console.log('- 找到的场景:', scenes);
      console.log('- 找到的物品:', props);

      // 建立名称到 ID 的映射表，方便快速查找
      const roleMap = new Map(roles.map(r => [r.name, r.id]));
      const sceneMap = new Map(scenes.map(s => [s.name, s.id]));
      const propMap = new Map(props.map(p => [p.name, p.id]));

      // 辅助函数：根据名称列表获取对应的 ID 列表
      const getIds = (names: string[] | undefined, map: Map<string, number>) => 
        (names || []).map(n => map.get(n)).filter((id): id is number => id !== undefined);

      // 查询当前项目和剧集中已有分镜的最大排序值
      const maxOrderResult = await prisma.projectStoryboard.findFirst({
        where: {
          projectId,
          episodeId: episodeId || null
        },
        orderBy: {
          order: 'desc'
        },
        select: {
          order: true
        }
      });

      // 如果已有分镜，从最大排序值 + 1 开始；否则从 0 开始
      const startOrder = maxOrderResult ? maxOrderResult.order + 1 : 0;

      const storyboardData = storyboards.map((frame, index) => ({
        projectId,
        episodeId: episodeId || null,
        text: frame.text,
        characterIds: JSON.stringify(getIds(frame['role-use'], roleMap)),
        propIds: JSON.stringify(getIds(frame['prop-use'], propMap)),
        sceneId: frame['scene-use'] ? sceneMap.get(frame['scene-use']) || null : null,
        duration: 15, // 默认时长 15 秒
        order: startOrder + index // 从最大排序值 + 1 开始递增
      }));

      // 批量插入分镜数据
      if (storyboardData.length > 0) {
        await prisma.projectStoryboard.createMany({
          data: storyboardData
        });
      }

      return storyboards;
    } catch (e) {
      console.error('Failed to analyze project storyboards:', e);
      throw new Error('Failed to analyze project storyboards');
    }
  }

  /**
   * 分镜视频提示词推理
   * 根据剧本内容推理生成视频提示词
   * @param userId 用户 ID
   * @param scriptContent 剧本内容
   * @param _provider AI 提供商（已废弃）
   * @param _apiKey API 密钥（已废弃）
   * @param model 模型名称
   * @returns 推理结果
   */
  static async inferStoryboard(
    userId: number,
    scriptContent: string,
    _provider: AIProvider,
    _apiKey: string,
    model?: string
  ): Promise<any> {
    const prompt = await PromptService.getInferencePrompt(userId, {
      script: scriptContent
    });

    try {
      const { provider: llmProvider, apiKey: llmApiKey, modelValue } = await AIModelManager.getLLMProvider(userId);

      const content = await llmProvider.chat({
        messages: [
          { role: 'system', content: prompt },
          { role: 'user', content: '请开始分析' }
        ],
        temperature: 0.7,
        model: model || modelValue
      }, llmApiKey);

      return content;
    } catch (e) {
      console.error('Failed to parse storyboard inference result:', e);
      throw new Error('Failed to parse AI response');
    }
  }
}

