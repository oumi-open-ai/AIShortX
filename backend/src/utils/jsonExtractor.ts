/**
 * JSON 提取和格式转换工具
 * 用于从 LLM 响应中提取 JSON 内容，并自动转换对象格式为数组格式
 */

/**
 * 判断一个对象是否为普通对象（非数组、非null、非Date等特殊对象）
 * @param obj 要判断的对象
 * @returns 是否为普通对象
 */
function isPlainObject(obj: any): boolean {
  return obj !== null && 
         typeof obj === 'object' && 
         !Array.isArray(obj) &&
         Object.prototype.toString.call(obj) === '[object Object]';
}

/**
 * 转换对象格式为数组格式
 * 只转换值为对象的属性，将键作为 name 字段
 * 例如：{ "roles": { "小明": {...}, "小红": {...} } } 
 * 转换为：{ "roles": [{ "name": "小明", ... }, { "name": "小红", ... }] }
 * @param obj 要转换的对象
 * @returns 转换后的对象
 */
function convertObjectToArray(obj: any): any {
  if (!isPlainObject(obj)) {
    return obj;
  }
  
  const result: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    // 如果值是数组，直接保留
    if (Array.isArray(value)) {
      result[key] = value;
      continue;
    }
    
    // 如果值是对象，检查其所有子值是否都是对象
    if (isPlainObject(value)) {
      const entries = Object.entries(value as Record<string, any>);
      const allValuesAreObjects = entries.length > 0 && 
        entries.every(([_, v]) => isPlainObject(v));
      
      if (allValuesAreObjects) {
        // 转换为数组格式
        result[key] = entries.map(([name, data]: [string, any]) => ({
          name,
          ...data
        }));
      } else {
        // 递归处理
        result[key] = convertObjectToArray(value);
      }
    } else {
      // 基本类型直接保留
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * 从字符串中提取 JSON 内容
 * 处理 Markdown 代码块，自动转换对象格式为数组格式
 * @param content LLM 返回的原始字符串内容
 * @returns 清理并转换格式后的 JSON 字符串
 */
export function extractJson(content: string): string {
  if (!content) return '';
  
  // 移除 Markdown 代码块标记
  let cleaned = content.replace(/```json/g, '').replace(/```/g, '').trim();
  
  // 查找第一个 '{' 或 '['
  const firstBrace = cleaned.search(/[{[]/);
  if (firstBrace === -1) return cleaned;
  
  // 查找最后一个 '}' 或 ']'
  const lastBrace = cleaned.search(/[}\]][^}\]]*$/);
  if (lastBrace === -1) return cleaned.substring(firstBrace);
  
  const jsonStr = cleaned.substring(firstBrace, lastBrace + 1);
  
  try {
    const parsed = JSON.parse(jsonStr);
    const converted = convertObjectToArray(parsed);
    return JSON.stringify(converted);
  } catch (e) {
    // 如果解析失败，返回原始 JSON 字符串
    return jsonStr;
  }
}
