import { Request, Response } from 'express';
import { error, success, successPage } from '../utils/response';
import prisma from '../utils/prisma';
import { AuthRequest } from '../middlewares/auth';

/**
 * 获取当前用户的角色库列表
 * 支持分页查询
 */
export const listCharacters = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 10;
    
    const skip = (page - 1) * pageSize;

    const [total, characters] = await prisma.$transaction([
      prisma.userCharacter.count({ where: { userId } }),
      prisma.userCharacter.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize
      })
    ]);
    
    return successPage(res, characters, total, page, pageSize);
  } catch (err) {
    console.error('List characters error:', err);
    return error(res, 'Failed to fetch characters');
  }
};

/**
 * 创建新角色
 * 将角色添加到用户的角色库中
 */
export const createCharacter = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const { name, description, avatar, video, source, externalId } = req.body;

    if (!name) {
      return error(res, 'Character name is required', 400, 400);
    }

    const character = await prisma.userCharacter.create({
      data: {
        userId,
        name,
        description,
        avatar,
        video,
        source: source || 'upload',
        externalId
      }
    });

    return success(res, character);
  } catch (err) {
    console.error('Create character error:', err);
    return error(res, 'Failed to create character');
  }
};

/**
 * 更新角色信息
 * 只能更新属于当前用户的角色
 */
export const updateCharacter = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const charId = parseInt(req.params.id);

    if (isNaN(charId)) {
      return error(res, 'Invalid character ID', 400, 400);
    }

    // 确保角色属于当前用户
    const existingChar = await prisma.userCharacter.findUnique({
      where: { id: charId }
    });

    if (!existingChar || existingChar.userId !== userId) {
      return error(res, 'Character not found or access denied', 404, 404);
    }

    const { name, description, avatar, video, source, externalId } = req.body;

    const updatedChar = await prisma.userCharacter.update({
      where: { id: charId },
      data: {
        name,
        description,
        avatar,
        video,
        source,
        externalId
      }
    });

    return success(res, updatedChar);
  } catch (err) {
    console.error('Update character error:', err);
    return error(res, 'Failed to update character');
  }
};

/**
 * 删除角色
 * 只能删除属于当前用户的角色
 */
export const deleteCharacter = async (req: Request, res: Response) => {
  try {
    const userId = (req as AuthRequest).user!.id;
    const charId = parseInt(req.params.id);

    if (isNaN(charId)) {
      return error(res, 'Invalid character ID', 400, 400);
    }

    // 检查角色所有权
    const existingChar = await prisma.userCharacter.findUnique({
      where: { id: charId }
    });

    if (!existingChar || existingChar.userId !== userId) {
      return error(res, 'Character not found or access denied', 404, 404);
    }

    await prisma.userCharacter.delete({
      where: { id: charId }
    });

    return success(res, null, 'Character deleted successfully');
  } catch (err) {
    console.error('Delete character error:', err);
    return error(res, 'Failed to delete character');
  }
};
