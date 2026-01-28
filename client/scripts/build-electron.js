/**
 * Electron 文件构建脚本
 * 
 * 功能：
 * 1. 将 TypeScript 编译后的 .js 文件重命名为 .cjs（CommonJS 格式）
 * 2. 替换文件中的 require 语句，将 .js 扩展名改为 .cjs
 * 3. 确保 Electron 主进程文件使用正确的模块格式
 * 
 * 背景：
 * Electron 主进程需要使用 CommonJS 格式，而 TypeScript 编译输出的是 .js 文件
 * 为了避免模块系统冲突，需要将这些文件转换为 .cjs 格式
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 获取当前文件的目录路径（ES 模块中需要手动构建 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Electron 文件输出目录：scripts/ 向上一级到 public/electron
const electronDir = path.join(__dirname, '../public/electron');

// 需要处理的 Electron 文件列表
const files = ['main.js', 'preload.js', 'ffmpeg-helper.js'];

console.log('正在处理 Electron 文件，目录:', electronDir);

// ==========================================================================
// 遍历处理每个文件
// ==========================================================================
files.forEach(f => {
    const filePath = path.join(electronDir, f);
    const newPath = filePath.replace('.js', '.cjs');

    // ========== 步骤 1: 检查 .js 文件是否存在（TypeScript 编译输出）==========
    if (fs.existsSync(filePath)) {
        console.log('正在处理:', f);
        let content = fs.readFileSync(filePath, 'utf8');

        // ========== 步骤 2: 替换 require 语句中的 .js 扩展名为 .cjs ==========
        /**
         * 正则表达式说明：
         * require\s*\(\s*  -> 匹配 require( 及可选的空格
         * (['"])           -> 匹配单引号或双引号（捕获组 1）
         * \.\/             -> 匹配 ./（相对路径）
         * ([^'"]+)         -> 匹配文件名（捕获组 2）
         * \.js             -> 匹配 .js 扩展名
         * \1               -> 匹配与捕获组 1 相同的引号
         * \s*\)            -> 匹配 ) 及可选的空格
         * 
         * 示例：
         * require("./ffmpeg-helper.js") -> require("./ffmpeg-helper.cjs")
         */
        const regex = /require\s*\(\s*(['"])\.\/([^'"]+)\.js\1\s*\)/g;

        let changed = false;
        if (regex.test(content)) {
            console.log(`  在 ${f} 中找到需要替换的导入语句`);
            content = content.replace(regex, (match, quote, filename) => {
                const replacement = `require(${quote}./${filename}.cjs${quote})`;
                console.log(`  替换: ${match} -> ${replacement}`);
                return replacement;
            });
            changed = true;
        } else {
            console.log(`  ${f} 中没有需要替换的导入语句`);
        }

        // ========== 步骤 3: 写入修改后的内容并重命名文件 ==========
        fs.writeFileSync(filePath, content);
        fs.renameSync(filePath, newPath);
        console.log(`  已重命名为 ${path.basename(newPath)}`);
    } else {
        // ========== 步骤 4: 处理文件不存在的情况 ==========
        // 如果 .js 文件不存在，检查 .cjs 文件是否已存在
        if (fs.existsSync(newPath)) {
            console.log(`  文件 ${f} 已处理完成（找到 .cjs 文件）`);
        } else {
            console.log(`  文件未找到: ${f}`);
        }
    }
});
