/**
 * 用户设置 Key 枚举
 * 定义所有允许的前端传入或查询的设置 Key
 */
export enum UserSettingKey {
  SYSTEM = 'system',               // 系统设置（包含 prompts 等）
  AI_MODEL_CONFIG = 'ai_model_config' // AI 模型配置
}

/**
 * 图片生成比例枚举
 */
export enum ImageRatio {
  RATIO_1_1 = '1:1',
  RATIO_16_9 = '16:9',
  RATIO_9_16 = '9:16',
  RATIO_4_3 = '4:3',
  RATIO_3_4 = '3:4',
  RATIO_3_2 = '3:2',
  RATIO_2_3 = '2:3'
}
