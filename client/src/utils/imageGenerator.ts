/**
 * 参考图项接口
 */
export interface ReferenceItem {
  url: string;  // 图片 URL
  name: string; // 名称
  type: '角色' | '场景' | '物品' | '分镜'; // 类型
}

/**
 * 通过网格布局拼接多张图片生成参考图
 * 
 * @param items 要包含的参考项列表
 * @param aspectRatio 目标宽高比 '16:9' 或 '9:16'
 * @returns 包含生成图片的 File 对象
 */
export const generateReferenceImage = async (
  items: ReferenceItem[], 
  aspectRatio: '16:9' | '9:16' = '16:9'
): Promise<File> => {
  // 验证输入参数
  if (!items || items.length === 0) {
    throw new Error('未提供参考图项');
  }

  // ========== 步骤 1: 加载所有有效图片 ==========
  const loadedItems: { img: HTMLImageElement; item: ReferenceItem }[] = [];
  
  await Promise.all(
    items.map(async (item) => {
      if (!item.url) return;

      try {
        // 创建图片对象并异步加载
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const image = new Image();
          image.crossOrigin = 'Anonymous'; // 允许跨域加载
          image.onload = () => resolve(image);
          image.onerror = (e) => reject(e);
          image.src = item.url;
        });
        loadedItems.push({ img, item });
      } catch (e) {
        console.warn(`加载图片失败 ${item.name}:`, e);
      }
    })
  );

  // 验证至少有一张图片加载成功
  if (loadedItems.length === 0) {
    throw new Error('没有成功加载的图片');
  }

  // ========== 步骤 2: 定义画布常量 ==========
  const CANVAS_WIDTH = 1920;   // 画布宽度
  const CANVAS_HEIGHT = 1080;  // 画布高度
  const PADDING = 10;          // 网格间距（已优化减小）
  const TEXT_HEIGHT = 50;      // 为文本预留的高度
  const FONT_SIZE = 30;        // 字体大小

  // 根据宽高比确定目标尺寸
  const targetWidth = aspectRatio === '16:9' ? CANVAS_WIDTH : CANVAS_HEIGHT;
  const targetHeight = aspectRatio === '16:9' ? CANVAS_HEIGHT : CANVAS_WIDTH;

  // ========== 步骤 3: 计算最佳网格布局 ==========
  const count = loadedItems.length;
  let bestLayout = { cols: 1, rows: 1, score: -1 };

  // 遍历所有可能的列数，找出图片总面积最大的布局
  for (let c = 1; c <= count; c++) {
    const r = Math.ceil(count / c); // 计算需要的行数
    
    // 计算单元格尺寸
    const cellW = (targetWidth - (c + 1) * PADDING) / c;   // 单元格宽度
    const cellH = (targetHeight - (r + 1) * PADDING) / r;  // 单元格高度
    const availH = cellH - TEXT_HEIGHT; // 图片可用高度（扣除文本区域）

    // 跳过无效布局
    if (cellW <= 0 || availH <= 0) continue;

    // 计算此布局下所有图片的总面积
    let totalArea = 0;
    for (const loaded of loadedItems) {
      const img = loaded.img;
      const imgRatio = img.width / img.height;    // 图片宽高比
      const targetRatio = cellW / availH;         // 单元格宽高比
      
      let drawW, drawH;
      // 使用 contain 模式：保持图片比例，完整显示在单元格内
      if (imgRatio > targetRatio) {
        // 图片更宽，以宽度为准
        drawW = cellW;
        drawH = cellW / imgRatio;
      } else {
        // 图片更高，以高度为准
        drawH = availH;
        drawW = availH * imgRatio;
      }
      totalArea += drawW * drawH;
    }

    // 选择图片总面积最大的布局（最大化图片显示）
    if (totalArea > bestLayout.score) {
      bestLayout = { cols: c, rows: r, score: totalArea };
    }
  }

  const { cols, rows } = bestLayout;

  // ========== 步骤 4: 创建和配置画布 ==========
  const canvas = document.createElement('canvas');
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext('2d');

  if (!ctx) throw new Error('无法创建画布上下文');

  // 绘制白色背景
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetWidth, targetHeight);

  // 配置文本样式
  ctx.font = `bold ${FONT_SIZE}px Arial`;
  ctx.textAlign = 'center';     // 文本水平居中
  ctx.textBaseline = 'top';     // 文本从顶部开始绘制
  ctx.fillStyle = '#000000';    // 黑色文本

  // ========== 步骤 5: 绘制所有图片和文本 ==========
  const cellWidth = (targetWidth - (cols + 1) * PADDING) / cols;
  const cellHeight = (targetHeight - (rows + 1) * PADDING) / rows;
  const imageAreaHeight = cellHeight - TEXT_HEIGHT; // 图片区域高度

  loadedItems.forEach((loaded, index) => {
    // 计算当前项在网格中的位置
    const col = index % cols;                // 列索引
    const row = Math.floor(index / cols);    // 行索引

    // 计算单元格左上角坐标
    const x = PADDING + col * (cellWidth + PADDING);
    const y = PADDING + row * (cellHeight + PADDING);

    // ---------- 绘制图片（contain 模式）----------
    const img = loaded.img;
    const imgRatio = img.width / img.height;      // 图片宽高比
    const targetRatio = cellWidth / imageAreaHeight; // 单元格宽高比

    let drawWidth, drawHeight;
    
    // 根据宽高比决定缩放方式，保持图片完整显示
    if (imgRatio > targetRatio) {
      // 图片更宽，以宽度为准
      drawWidth = cellWidth;
      drawHeight = cellWidth / imgRatio;
    } else {
      // 图片更高，以高度为准
      drawHeight = imageAreaHeight;
      drawWidth = imageAreaHeight * imgRatio;
    }

    // 在图片区域内居中显示
    const drawX = x + (cellWidth - drawWidth) / 2;
    const drawY = y + (imageAreaHeight - drawHeight) / 2;

    ctx.drawImage(img, drawX, drawY, drawWidth, drawHeight);

    // ---------- 绘制文本标签 ----------
    const textY = drawY + drawHeight + 5; // 图片下方 5px 处
    
    // 根据类型生成文本
    let text = '';
    if (loaded.item.type === '分镜') {
      text = '分镜参考';
    } else {
      text = `${loaded.item.name} ${loaded.item.type}参考`;
    }
    
    // 在单元格水平中心位置绘制文本
    ctx.fillText(text, x + cellWidth / 2, textY);
  });

  // ========== 步骤 6: 将画布转换为 File 对象 ==========
  return new Promise<File>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('生成图片 Blob 失败'));
        return;
      }
      // 创建文件对象，使用时间戳作为文件名
      const file = new File([blob], `ref_${Date.now()}.png`, { type: 'image/png' });
      resolve(file);
    }, 'image/png');
  });
};
