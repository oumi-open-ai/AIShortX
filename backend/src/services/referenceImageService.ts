import sharp from 'sharp';
import axios from 'axios';
import { ImageUploadService } from './imageUploadService';

/**
 * 参考图服务类
 * 负责生成带有文字标注的参考图
 */
export class ReferenceImageService {
  /**
   * 生成参考图
   * 在原图底部添加文字标注，用于视频生成时的参考
   * @param imageUrl 原始图片 URL
   * @param text 要添加的文字
   * @returns 新的图片 URL
   */
  static async generateReferenceImage(imageUrl: string, text: string): Promise<string> {
    try {
      // 下载原始图片
      const response = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const inputBuffer = Buffer.from(response.data);

      // 获取图片元数据
      const image = sharp(inputBuffer);
      const metadata = await image.metadata();
      const width = metadata.width || 1024;

      // 准备底部文字区域的高度
      const footerHeight = 100; // 底部高度
      const fontSize = Math.floor(width / 20); // 根据宽度动态调整字体大小

      // 创建 SVG 文字图片
      const svgImage = `
        <svg width="${width}" height="${footerHeight}">
          <style>
            .title { fill: #000; font-size: ${fontSize}px; font-weight: bold; font-family: sans-serif; }
          </style>
          <rect width="100%" height="100%" fill="white" />
          <text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" class="title">${text}</text>
        </svg>
      `;
      const svgBuffer = Buffer.from(svgImage);

      // 合成图片：在底部添加文字区域
      const outputBuffer = await image
        .extend({
          bottom: footerHeight,
          background: { r: 255, g: 255, b: 255, alpha: 1 }
        })
        .composite([
          {
            input: svgBuffer,
            gravity: 'south',
          }
        ])
        .png() // 统一转为 PNG 格式
        .toBuffer();

      // 上传图片到图床
      const url = await ImageUploadService.uploadBuffer(outputBuffer, 'reference_image', '.png');

      return url;
    } catch (err) {
      console.error('Reference image generation failed:', err);
      // 如果生成失败，降级返回原图，避免流程中断
      return imageUrl;
    }
  }
}
