/**
 * Electron 主进程入口文件
 * 负责管理应用窗口、后端进程、文件缓存、更新检查等核心功能
 */

import { app, BrowserWindow, screen, ipcMain, dialog, shell, protocol } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as https from 'https';
import * as http from 'http';
import * as crypto from 'crypto';
import isDev from 'electron-is-dev';
import { spawn, ChildProcess } from 'child_process';
import dotenv from 'dotenv';
import ffmpeg from 'fluent-ffmpeg';
import { getFfmpegPath, getFfprobePath } from './ffmpeg-helper.js';

// ========== 后端进程管理 ==========
let backendProcess: ChildProcess | null = null;  // 后端进程实例
let backendStarting = false;  // 后端是否正在启动中
let backendStarted = false;   // 后端是否已启动
let backendPort = 3000;       // 后端服务端口

// ========== 主窗口引用 ==========
let mainWindow: BrowserWindow | null = null;  // 主窗口实例

/**
 * 查找可用的端口
 * 从指定端口开始递归查找，直到找到可用端口
 * 
 * @param startPort 起始端口号，默认 3000
 * @returns 可用的端口号
 */
function findAvailablePort(startPort: number = 3000): Promise<number> {
  return new Promise((resolve) => {
    const server = http.createServer();
    // 尝试监听指定端口
    server.listen(startPort, () => {
      const port = (server.address() as any).port;
      // 成功监听后立即关闭，返回该端口
      server.close(() => resolve(port));
    });
    // 如果端口被占用，尝试下一个端口
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
}

/**
 * 启动后端服务进程
 * 开发环境：跳过自动启动，需要手动运行
 * 生产环境：自动启动打包后的后端服务
 */
function startBackend() {
  // 防止重复启动
  if (backendStarting || backendStarted) {
    return;
  }

  backendStarting = true;
  const isDevEnv = isDev;

  // ========== 步骤 1: 确定后端目录 ==========
  // 开发环境: project_root/backend
  // 生产环境: resources/backend
  const backendDir = isDevEnv
    ? path.join(__dirname, '../../backend')
    : path.join(process.resourcesPath, 'backend');

  console.log('[Electron] 后端目录:', backendDir);
  console.log('[Electron] 后端目录是否存在:', fs.existsSync(backendDir));

  // ========== 步骤 2: 开发环境跳过自动启动 ==========
  if (isDevEnv) {
    console.log('[Electron] 检测到开发模式，跳过后端自动启动');
    console.log('[Electron] 请在 backend 文件夹中手动运行 "npm run dev"');
    backendStarting = false;
    return;
  }

  // ========== 步骤 3: 生产环境启动后端 ==========
  const backendScript = path.join(backendDir, 'dist', 'index.js');

  // 验证后端脚本是否存在
  if (!fs.existsSync(backendScript)) {
    if (fs.existsSync(backendDir)) {
      console.error('[Electron] 后端目录内容:', fs.readdirSync(backendDir));
      const distDir = path.join(backendDir, 'dist');
      if (fs.existsSync(distDir)) {
        console.error('[Electron] 后端 dist 目录内容:', fs.readdirSync(distDir));
      }
    } else {
      console.error('[Electron] 后端目录不存在！');
    }
    backendStarting = false;
    return;
  }

  // ========== 步骤 4: 准备数据库路径 ==========
  const dbDir = path.join(app.getPath('userData'), 'database');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  const dbPath = path.join(dbDir, 'prod.db');
  const databaseUrl = `file:${dbPath}`;

  // ========== 步骤 5: 准备上传文件目录 ==========
  const uploadsDir = path.join(app.getPath('userData'), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  // ========== 步骤 6: 查找可用端口并启动后端 ==========
  findAvailablePort(3000).then((port) => {
    backendPort = port;

    // 使用 Electron 内置的 Node.js 运行后端
    // 注意：需要以 Node.js 模式运行，而不是 Electron 模式
    const nodeExecutable = process.execPath;
    const execArgs = [backendScript];

    console.log('[Electron] 启动后端，使用:', nodeExecutable, execArgs);

    try {
      // 创建后端子进程
      backendProcess = spawn(nodeExecutable, execArgs, {
        cwd: backendDir,
        env: {
          ...process.env,
          PORT: backendPort.toString(),      // 后端服务端口
          DATABASE_URL: databaseUrl,         // 数据库连接字符串
          UPLOADS_DIR: uploadsDir,           // 上传文件目录
          NODE_ENV: 'production',            // 生产环境
          ELECTRON_RUN_AS_NODE: '1'          // 关键：让 Electron 以 Node.js 模式运行
        },
        stdio: ['ignore', 'pipe', 'pipe']   // 忽略 stdin，捕获 stdout 和 stderr
      });

      // 验证进程是否成功创建
      if (!backendProcess || !backendProcess.pid) {
        console.error('[Electron] 后端进程创建失败');
        backendStarting = false;
        return;
      }
      backendStarted = true;
      backendStarting = false;

      // 监听后端标准输出
      backendProcess.stdout?.on('data', (data) => {
        console.log(`[后端]: ${data.toString().trim()}`);
      });

      // 监听后端错误输出
      backendProcess.stderr?.on('data', (data) => {
        console.error(`[后端错误]: ${data.toString().trim()}`);
      });

      // 监听进程退出事件
      backendProcess.on('exit', (code, signal) => {
        console.log(`[后端] 进程退出，代码: ${code}，信号: ${signal}`);
        backendProcess = null;
        backendStarted = false;
        backendStarting = false;
      });

      // 监听进程错误事件
      backendProcess.on('error', (err) => {
        console.error('[后端] 启动失败:', err);
        backendProcess = null;
        backendStarted = false;
        backendStarting = false;
      });
    } catch (err) {
      console.error('[Electron] 后端启动异常:', err);
      backendStarting = false;
      backendStarted = false;
    }
  });
}

// ========== 加载环境变量 ==========
dotenv.config({ path: path.join(__dirname, '../../.env') });

// ========== 初始化 FFmpeg ==========
const ffmpegPath = getFfmpegPath();
const ffprobePath = getFfprobePath();

if (ffmpegPath) {
  ffmpeg.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
  ffmpeg.setFfprobePath(ffprobePath);
}

// ========== 文件下载并发控制 ==========
// 使用 Map 存储正在下载的请求，避免重复下载同一文件
const downloadingRequests = new Map<string, Promise<string>>();

/**
 * 获取缓存文件路径
 * 使用 URL 的 MD5 作为文件名，避免文件名冲突
 * 
 * @param url 文件 URL
 * @param type 文件类型（video 或 image）
 * @returns 缓存文件路径和 MD5 值
 */
function getCacheFilePath(url: string, type: 'video' | 'image') {
  // 使用 MD5 生成唯一文件名
  const md5 = crypto.createHash('md5').update(url).digest('hex');

  // 提取文件扩展名
  let ext = path.extname(new URL(url).pathname);
  if (!ext || ext.length > 5) {
    // 如果没有扩展名或扩展名异常，使用默认扩展名
    ext = type === 'video' ? '.mp4' : '.png';
  }

  // 缓存目录：文档目录/AIShortX/Cache/Videos 或 Images
  const cacheDir = path.join(app.getPath('documents'), 'AIShortX', 'Cache', type === 'video' ? 'Videos' : 'Images');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const filename = `${md5}${ext}`;
  const filePath = path.join(cacheDir, filename);
  return { filePath, md5 };
}

/**
 * 注册所有 IPC 处理器
 * 只在应用启动时调用一次，避免重复注册
 */
function registerIPCHandlers() {
  // ========== 窗口控制 IPC 处理器 ==========
  ipcMain.on('window-min', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.on('window-max', () => {
    if (mainWindow) {
      if (mainWindow.isMaximized()) {
        mainWindow.unmaximize();
      } else {
        mainWindow.maximize();
      }
    }
  });

  ipcMain.on('window-close', () => {
    if (mainWindow) mainWindow.close();
  });

  // ========== 打开外部链接 ==========
  ipcMain.handle('open-external', async (_event, url: string) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error: any) {
      console.error('打开外部链接失败:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== 获取后端端口 ==========
  ipcMain.handle('get-backend-port', async () => {
    return backendPort;
  });

  // ========== FFmpeg 可用性检查 ==========
  ipcMain.handle('ffmpeg:check', async () => {
    return new Promise((resolve) => {
      ffmpeg.getAvailableFormats((err, formats) => {
        if (err) {
          resolve({
            status: 'error',
            error: err.message,
            paths: { ffmpeg: ffmpegPath, ffprobe: ffprobePath }
          });
        } else {
          resolve({
            status: 'ok',
            formatsCount: Object.keys(formats).length,
            paths: { ffmpeg: ffmpegPath, ffprobe: ffprobePath }
          });
        }
      });
    });
  });

  // ========== 选择目录对话框 ==========
  ipcMain.handle('select-directory', async () => {
    if (!mainWindow) return null;
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory']
    });
    if (result.canceled) {
      return null;
    } else {
      return result.filePaths[0];
    }
  });

  // ========== 保存剪映草稿 ==========
  ipcMain.handle('save-draft', async (event, folderPath: string, content: any, meta: any) => {
    try {
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      fs.writeFileSync(
        path.join(folderPath, 'draft_content.json'),
        JSON.stringify(content, null, 4),
        'utf-8'
      );

      fs.writeFileSync(
        path.join(folderPath, 'draft_meta_info.json'),
        JSON.stringify(meta, null, 4),
        'utf-8'
      );

      return { success: true };
    } catch (error: any) {
      console.error('保存草稿错误:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== 视频切白 ==========
  ipcMain.handle('video:trim-white', async (event, inputPath: string) => {
    try {
      if (!fs.existsSync(inputPath)) {
        throw new Error(`File not found: ${inputPath}`);
      }

      const dir = path.dirname(inputPath);
      const ext = path.extname(inputPath);
      const name = path.basename(inputPath, ext);
      const outputPath = path.join(dir, `${name}_trimmed${ext}`);

      const ffprobeCmd = getFfprobePath();
      const ffmpegCmd = getFfmpegPath();

      if (!ffprobeCmd || !ffmpegCmd) {
        throw new Error('FFmpeg/FFprobe not found');
      }

      const getKeyframes = (): Promise<number[]> => {
        return new Promise((resolve, reject) => {
          const args = [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-skip_frame', 'nokey',
            '-show_entries', 'frame=pkt_pts_time',
            '-of', 'csv=p=0',
            inputPath
          ];

          const child = spawn(ffprobeCmd, args);
          let stdout = '';
          let stderr = '';

          child.stdout.on('data', (data) => stdout += data);
          child.stderr.on('data', (data) => stderr += data);

          child.on('close', (code) => {
            if (code !== 0) {
              reject(new Error(`ffprobe failed: ${stderr}`));
            } else {
              const times = stdout.trim().split(/\r?\n/).map(t => parseFloat(t)).filter(t => !isNaN(t));
              resolve(times);
            }
          });
        });
      };

      const keyframes = await getKeyframes();
      console.log('Keyframes:', keyframes);

      if (keyframes.length < 2) {
        console.log('Not enough keyframes to trim, returning original path.');
        return { success: true, path: inputPath, trimmed: false };
      }

      const secondKeyframeTime = keyframes[1];
      console.log(`Trimming from ${secondKeyframeTime}s...`);

      await new Promise<void>((resolve, reject) => {
        const args = [
          '-y',
          '-ss', secondKeyframeTime.toString(),
          '-i', inputPath,
          '-c', 'copy',
          outputPath
        ];

        const child = spawn(ffmpegCmd, args);
        let stderr = '';

        child.stderr.on('data', (data) => stderr += data);

        child.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`ffmpeg failed: ${stderr}`));
          } else {
            resolve();
          }
        });
      });

      return { success: true, path: outputPath, trimmed: true };

    } catch (error: any) {
      console.error('Trim video error:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== 获取应用版本号 ==========
  ipcMain.handle('get-version', () => {
    return app.getVersion();
  });

  // ========== 检查更新 ==========
  ipcMain.handle('check-update', async (_event, apiBaseUrlFromRenderer?: string) => {
    return new Promise((resolve) => {
      const apiBaseUrl = typeof apiBaseUrlFromRenderer === 'string' && apiBaseUrlFromRenderer.startsWith('http')
        ? apiBaseUrlFromRenderer
        : (process.env.VITE_API_BASE_URL || 'http://localhost:3010/api');
      const updateUrl = `${apiBaseUrl}/updates/latest`;

      const request = (updateUrl.startsWith('https') ? https : http).get(updateUrl, (res) => {
        let data = '';
        res.on('data', (chunk) => data += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            if (response.code === 200 && response.data) {
              const remoteVersion = response.data.version;
              const currentVersion = app.getVersion();

              if (remoteVersion !== currentVersion) {
                resolve({
                  updateAvailable: remoteVersion !== currentVersion,
                  ...response.data
                });
              } else {
                resolve({ updateAvailable: false });
              }
            } else {
              resolve({ updateAvailable: false });
            }
          } catch (e) {
            console.error('检查更新解析错误:', e);
            resolve({ updateAvailable: false, error: '解析错误' });
          }
        });
      });

      request.on('error', (err) => {
        console.error('检查更新请求错误:', err);
        resolve({ updateAvailable: false, error: err.message });
      });
    });
  });

  // ========== 下载更新 ==========
  ipcMain.on('start-download', (event, downloadUrl: string) => {
    if (!mainWindow) return;

    let ext = path.extname(new URL(downloadUrl).pathname);
    if (!ext) {
      ext = process.platform === 'win32' ? '.exe' : '.dmg';
    }

    const downloadPath = path.join(app.getPath('temp'), `update-${Date.now()}${ext}`);
    const file = fs.createWriteStream(downloadPath);

    const lib = downloadUrl.startsWith('https') ? https : http;

    const request = lib.get(downloadUrl, (response) => {
      const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
      let receivedBytes = 0;

      response.pipe(file);

      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
        if (totalBytes > 0) {
          const progress = (receivedBytes / totalBytes) * 100;
          mainWindow?.webContents.send('download-progress', progress);
        }
      });

      file.on('finish', () => {
        file.close(() => {
          mainWindow?.webContents.send('download-complete', downloadPath);
        });
      });
    });

    request.on('error', (err) => {
      fs.unlink(downloadPath, () => { });
      mainWindow?.webContents.send('download-error', err.message);
    });

    file.on('error', (err) => {
      fs.unlink(downloadPath, () => { });
      mainWindow?.webContents.send('download-error', err.message);
    });
  });

  // ========== 安装更新 ==========
  ipcMain.on('install-update', (event, filePath: string) => {
    if (process.platform === 'win32') {
      spawn(filePath, [], {
        detached: true,
        stdio: 'ignore'
      }).unref();
    } else {
      shell.openPath(filePath);
    }

    app.quit();
  });

  // ========== 检查缓存是否存在 ==========
  ipcMain.handle('check-cache', async (event, url: string, type: 'video' | 'image') => {
    if (!url || !url.startsWith('http')) return null;
    try {
      const { filePath, md5 } = getCacheFilePath(url, type);
      const tmpPath = `${filePath}.tmp`;

      if (downloadingRequests.has(md5) || fs.existsSync(tmpPath)) {
        return null;
      }

      if (fs.existsSync(filePath)) {
        return filePath;
      }

      return null;
    } catch (error) {
      console.error('检查缓存错误:', error);
      return null;
    }
  });

  // ========== 下载并缓存文件 ==========
  ipcMain.handle('cache-file', async (event, url: string, type: 'video' | 'image') => {
    if (!url || !url.startsWith('http')) return url;

    try {
      const { filePath, md5 } = getCacheFilePath(url, type);
      const tmpPath = `${filePath}.tmp`;

      if (fs.existsSync(filePath)) {
        return filePath;
      }

      if (downloadingRequests.has(md5)) {
        return downloadingRequests.get(md5);
      }

      if (fs.existsSync(tmpPath)) {
        try {
          fs.unlinkSync(tmpPath);
        } catch (err) {
          console.error('清理临时文件失败:', err);
        }
      }

      const downloadPromise = new Promise<string>((resolve, reject) => {
        const file = fs.createWriteStream(tmpPath);
        const request = (url.startsWith('https') ? https : http).get(url, (response) => {
          if (response.statusCode !== 200) {
            fs.unlink(tmpPath, () => { });
            reject(new Error(`下载失败: ${response.statusCode}`));
            return;
          }

          response.pipe(file);

          file.on('finish', () => {
            file.close(() => {
              try {
                fs.renameSync(tmpPath, filePath);
                resolve(filePath);
              } catch (err) {
                fs.unlink(tmpPath, () => { });
                reject(err);
              }
            });
          });

          file.on('error', (err) => {
            fs.unlink(tmpPath, () => { });
            reject(err);
          });
        }).on('error', (err) => {
          fs.unlink(tmpPath, () => { });
          reject(err);
        });
      });

      downloadingRequests.set(md5, downloadPromise);

      try {
        return await downloadPromise;
      } finally {
        downloadingRequests.delete(md5);
      }
    } catch (error) {
      console.error('缓存文件错误:', error);
      return url;
    }
  });

  // ========== 清除损坏的缓存文件 ==========
  ipcMain.handle('clear-cache', async (event, url: string, type: 'video' | 'image') => {
    if (!url || !url.startsWith('http')) return { success: false, error: '无效的 URL' };

    try {
      const { filePath } = getCacheFilePath(url, type);
      const tmpPath = `${filePath}.tmp`;

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`已清除缓存: ${filePath}`);
      }

      if (fs.existsSync(tmpPath)) {
        fs.unlinkSync(tmpPath);
        console.log(`已清除临时文件: ${tmpPath}`);
      }

      return { success: true };
    } catch (error: any) {
      console.error('清除缓存错误:', error);
      return { success: false, error: error.message };
    }
  });

  // ========== 复制文件 ==========
  ipcMain.handle('copy-file', async (event, sourcePath: string, destPath: string) => {
    try {
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      fs.copyFileSync(sourcePath, destPath);
      return { success: true };
    } catch (error: any) {
      console.error('复制文件错误:', error);
      return { success: false, error: error.message };
    }
  });
}

/**
 * 创建主窗口
 * 配置窗口属性、安全设置、IPC 通信等
 */
function createWindow() {
  // 确定应用图标路径
  const iconPath = isDev
    ? path.join(__dirname, '../icon.png')
    : path.join(__dirname, '../../dist/icon.png');

  // 确定 preload 脚本路径
  const preloadPath = path.join(__dirname, 'preload.cjs');
  console.log('[Electron] =====================================');

  // 创建浏览器窗口（使用全局变量）
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 1100,
    minHeight: 720,
    icon: iconPath,
    frame: false,  // 隐藏原生窗口边框和控制按钮（使用自定义标题栏）
    show: false,   // 初始不显示，等待 ready-to-show 事件（避免白屏闪烁）
    backgroundColor: '#09090b',  // 深色主题背景色 (zinc-950)
    webPreferences: {
      nodeIntegration: false,    // 禁用 Node.js 集成（安全考虑）
      contextIsolation: true,    // 启用上下文隔离（安全考虑）
      webSecurity: true,         // 启用 Web 安全
      preload: preloadPath,      // 预加载脚本
      // 性能优化
      enableWebSQL: false,       // 禁用 WebSQL
      spellcheck: false,         // 禁用拼写检查
    },
  });

  // ========== 窗口显示控制 ==========
  // 等待页面准备就绪后再显示窗口，防止白屏闪烁
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) mainWindow.show();
  });

  // ========== 监听窗口状态变化 ==========
  mainWindow.on('maximize', () => {
    if (mainWindow) mainWindow.webContents.send('window-maximized');
  });

  mainWindow.on('unmaximize', () => {
    if (mainWindow) mainWindow.webContents.send('window-unmaximized');
  });

  // ==========================================================================
  // 加载应用页面
  // ==========================================================================
  if (isDev) {
    // 开发环境：加载开发服务器
    mainWindow.loadURL('http://localhost:5174');
    mainWindow.webContents.openDevTools();  // 打开开发者工具
  } else {
    // 生产环境：加载打包后的 HTML 文件
    const appPath = app.getAppPath();
    const indexPath = path.join(appPath, 'dist/index.html');
    mainWindow.loadFile(indexPath).catch(e => {
      console.error('加载 index.html 失败:', e);
    });
  }
}

// ==========================================================================
// 应用生命周期管理
// ==========================================================================

// 应用准备就绪后执行
app.whenReady().then(() => {
  // ========== 注册自定义协议 local:// ==========
  // 用于安全地加载本地缓存文件，避免 file:// 协议的安全限制
  protocol.registerFileProtocol('local', (request, callback) => {
    // 从 local://path 中提取实际文件路径
    const url = request.url.replace('local://', '');
    // 解码 URL 编码的路径
    const decodedPath = decodeURIComponent(url);

    try {
      // 返回文件路径
      callback({ path: decodedPath });
    } catch (error) {
      console.error('加载本地文件失败:', error);
      callback({ error: -2 }); // 文件未找到错误
    }
  });

  // ========== 注册 IPC 处理器（只注册一次）==========
  registerIPCHandlers();

  startBackend();   // 启动后端服务
  createWindow();   // 创建主窗口

  // macOS 特性：点击 Dock 图标时重新创建窗口
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// ==========================================================================
// 单实例锁定：防止多个应用实例同时运行
// ==========================================================================
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // 如果已有实例在运行，退出当前实例
  console.log('[Electron] 已有实例正在运行，退出...');
  app.quit();
} else {
  // 当尝试启动第二个实例时，聚焦到第一个实例的窗口
  app.on('second-instance', (event, commandLine, workingDirectory) => {
    const windows = BrowserWindow.getAllWindows();
    if (windows.length > 0) {
      const mainWindow = windows[0];
      if (mainWindow.isMinimized()) mainWindow.restore();  // 还原最小化的窗口
      mainWindow.focus();  // 聚焦窗口
    }
  });
}

// ==========================================================================
// 应用退出前的清理工作
// ==========================================================================
app.on('will-quit', () => {
  if (backendProcess) {
    console.log('[Electron] 正在终止后端进程...');
    try {
      backendProcess.kill('SIGTERM');  // 发送终止信号
      // 给予 2 秒时间优雅关闭
      setTimeout(() => {
        if (backendProcess && !backendProcess.killed) {
          console.log('[Electron] 强制终止后端进程...');
          backendProcess.kill('SIGKILL');  // 强制终止
        }
      }, 2000);
    } catch (err) {
      console.error('[Electron] 终止后端进程错误:', err);
    }
    backendProcess = null;
  }
});

// ==========================================================================
// 所有窗口关闭时的处理
// ==========================================================================
app.on('window-all-closed', () => {
  // macOS 特性：即使所有窗口关闭，应用仍保持运行
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
