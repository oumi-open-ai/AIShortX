"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFfprobePath = exports.getFfmpegPath = void 0;
const path_1 = __importDefault(require("path"));
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
const os_1 = __importDefault(require("os"));
/**
 * 获取 FFmpeg 可执行文件路径
 */
const getFfmpegPath = () => {
    if (electron_is_dev_1.default) {
        // 开发环境：从 node_modules 获取
        // ffmpeg-static 导出一个字符串路径
        try {
            // In CommonJS, we can use require directly
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            return require('ffmpeg-static');
        }
        catch (error) {
            console.error('Failed to load ffmpeg-static:', error);
            return '';
        }
    }
    // 生产环境：从 resources 目录获取
    // 假设我们通过 electron-builder 的 extraResources 将其打包到了 resources 根目录
    const platform = os_1.default.platform();
    const execName = platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
    // process.resourcesPath 在打包后指向 resources 目录
    return path_1.default.join(process.resourcesPath, execName);
};
exports.getFfmpegPath = getFfmpegPath;
/**
 * 获取 FFprobe 可执行文件路径
 */
const getFfprobePath = () => {
    if (electron_is_dev_1.default) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const ffprobe = require('ffprobe-static');
            return ffprobe.path;
        }
        catch (error) {
            console.error('Failed to load ffprobe-static:', error);
            return '';
        }
    }
    const platform = os_1.default.platform();
    const execName = platform === 'win32' ? 'ffprobe.exe' : 'ffprobe';
    return path_1.default.join(process.resourcesPath, execName);
};
exports.getFfprobePath = getFfprobePath;
