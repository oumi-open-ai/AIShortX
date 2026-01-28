import axios from 'axios';
import { ImageRatio } from '../../constants/enums';

/**
 * 将 URL 图片转换为 Base64 编码
 * @param url 图片 URL
 * @returns Base64 编码字符串
 */
export async function urlToBase64(url: string): Promise<string> {
  try {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const buffer = Buffer.from(response.data, 'binary');
    return buffer.toString('base64');
  } catch (error) {
    console.error('Error converting URL to Base64:', error);
    throw new Error(`Failed to convert image URL to Base64: ${url}`);
  }
}

/**
 * 根据图片比例获取分辨率
 * @param ratio 图片比例
 * @returns 分辨率字符串（如 "2560x1440"）
 */
export function getResolutionFromRatio(ratio?: ImageRatio | string): string {
  switch (ratio) {
    case ImageRatio.RATIO_16_9:
      return '2560x1440';
    case ImageRatio.RATIO_9_16:
      return '1440x2560';
    case ImageRatio.RATIO_4_3:
      return '2048x1536';
    case ImageRatio.RATIO_3_4:
      return '1536x2048';
    case ImageRatio.RATIO_3_2:
      return '2160x1440';
    case ImageRatio.RATIO_2_3:
      return '1440x2160';
    case ImageRatio.RATIO_1_1:
    default:
      return '2048x2048';
  }
}
