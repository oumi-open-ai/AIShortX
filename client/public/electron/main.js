"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const https = __importStar(require("https"));
const http = __importStar(require("http"));
const crypto = __importStar(require("crypto"));
const electron_is_dev_1 = __importDefault(require("electron-is-dev"));
const child_process_1 = require("child_process");
const dotenv_1 = __importDefault(require("dotenv"));
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const ffmpeg_helper_js_1 = require("./ffmpeg-helper.js");
// --- Backend Process Management ---
let backendProcess = null;
let backendStarting = false;
let backendStarted = false;
let backendPort = 3000;
// 查找可用的端口
function findAvailablePort(startPort = 3000) {
    return new Promise((resolve) => {
        const server = http.createServer();
        server.listen(startPort, () => {
            const port = server.address().port;
            server.close(() => resolve(port));
        });
        server.on('error', () => {
            resolve(findAvailablePort(startPort + 1));
        });
    });
}
function startBackend() {
    // Prevent multiple simultaneous starts
    if (backendStarting || backendStarted) {
        return;
    }
    backendStarting = true;
    const isDevEnv = electron_is_dev_1.default;
    // 1. Determine Backend Directory
    // In Dev: project_root/backend
    // In Prod: resources/backend
    const backendDir = isDevEnv
        ? path.join(__dirname, '../../backend')
        : path.join(process.resourcesPath, 'backend');
    console.log('[Electron] Backend Directory:', backendDir);
    console.log('[Electron] Backend Directory exists:', fs.existsSync(backendDir));
    // 2. In Dev mode, skip auto-start (user should run backend manually)
    if (isDevEnv) {
        console.log('[Electron] Dev mode detected. Skipping backend auto-start.');
        console.log('[Electron] Please run "npm run dev" in backend folder manually.');
        backendStarting = false;
        return;
    }
    // 3. In Production: Start the backend
    const backendScript = path.join(backendDir, 'dist', 'index.js');
    if (!fs.existsSync(backendScript)) {
        if (fs.existsSync(backendDir)) {
            console.error('[Electron] Backend directory contents:', fs.readdirSync(backendDir));
            const distDir = path.join(backendDir, 'dist');
            if (fs.existsSync(distDir)) {
                console.error('[Electron] Backend dist directory contents:', fs.readdirSync(distDir));
            }
        }
        else {
            console.error('[Electron] Backend directory does not exist!');
        }
        backendStarting = false;
        return;
    }
    // 4. Prepare database path
    const dbDir = path.join(electron_1.app.getPath('userData'), 'database');
    if (!fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
    }
    const dbPath = path.join(dbDir, 'prod.db');
    const databaseUrl = `file:${dbPath}`;
    // 5. Prepare uploads directory
    const uploadsDir = path.join(electron_1.app.getPath('userData'), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
    }
    // 6. 查找可用的端口
    findAvailablePort(3000).then((port) => {
        backendPort = port;
        // 在打包后的 Electron 应用中，需要使用内置的 Node.js
        // Electron 内部包含 Node.js，但我们需要用 node 模式运行而不是 electron 模式
        const nodeExecutable = process.execPath;
        const execArgs = [backendScript];
        console.log('[Electron] Starting backend with:', nodeExecutable, execArgs);
        try {
            // 使用 node 环境变量来告诉 Electron 以 Node.js 模式运行
            backendProcess = (0, child_process_1.spawn)(nodeExecutable, execArgs, {
                cwd: backendDir,
                env: {
                    ...process.env,
                    PORT: backendPort.toString(),
                    DATABASE_URL: databaseUrl,
                    UPLOADS_DIR: uploadsDir,
                    NODE_ENV: 'production',
                    ELECTRON_RUN_AS_NODE: '1' // 关键：让 Electron 以 Node.js 模式运行
                },
                stdio: ['ignore', 'pipe', 'pipe']
            });
            if (!backendProcess || !backendProcess.pid) {
                console.error('[Electron] Failed to spawn backend process');
                backendStarting = false;
                return;
            }
            backendStarted = true;
            backendStarting = false;
            backendProcess.stdout?.on('data', (data) => {
                console.log(`[Backend]: ${data.toString().trim()}`);
            });
            backendProcess.stderr?.on('data', (data) => {
                console.error(`[Backend Error]: ${data.toString().trim()}`);
            });
            backendProcess.on('exit', (code, signal) => {
                console.log(`[Backend] Process exited with code ${code} and signal ${signal}`);
                backendProcess = null;
                backendStarted = false;
                backendStarting = false;
            });
            backendProcess.on('error', (err) => {
                console.error('[Backend] Failed to start:', err);
                backendProcess = null;
                backendStarted = false;
                backendStarting = false;
            });
        }
        catch (err) {
            console.error('[Electron] Failed to start backend:', err);
            backendStarting = false;
            backendStarted = false;
        }
    });
}
// Load .env file
dotenv_1.default.config({ path: path.join(__dirname, '../../.env') });
// Initialize FFmpeg
const ffmpegPath = (0, ffmpeg_helper_js_1.getFfmpegPath)();
const ffprobePath = (0, ffmpeg_helper_js_1.getFfprobePath)();
if (ffmpegPath) {
    fluent_ffmpeg_1.default.setFfmpegPath(ffmpegPath);
}
if (ffprobePath) {
    fluent_ffmpeg_1.default.setFfprobePath(ffprobePath);
}
// Concurrency control for downloads
const downloadingRequests = new Map();
// Helper to get cache file path
function getCacheFilePath(url, type) {
    const md5 = crypto.createHash('md5').update(url).digest('hex');
    let ext = path.extname(new URL(url).pathname);
    if (!ext || ext.length > 5) {
        ext = type === 'video' ? '.mp4' : '.png';
    }
    // Use client/cache directory
    // process.cwd() is usually the project root in dev, or app root in prod
    const cacheDir = path.join(electron_1.app.getPath('documents'), 'AnimeDrama', 'Cache', type === 'video' ? 'Videos' : 'Images');
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    const filename = `${md5}${ext}`;
    const filePath = path.join(cacheDir, filename);
    return { filePath, md5 };
}
function createWindow() {
    const iconPath = electron_is_dev_1.default
        ? path.join(__dirname, '../icon.png')
        : path.join(__dirname, '../../dist/icon.png');
    // Preload script path
    const preloadPath = electron_is_dev_1.default
        ? path.join(__dirname, 'preload.js')
        : path.join(__dirname, 'preload.cjs');
    console.log('[Electron] =====================================');
    const mainWindow = new electron_1.BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 1100,
        minHeight: 720,
        icon: iconPath,
        frame: false, // Hide native border and controls
        show: false, // Don't show until ready-to-show
        backgroundColor: '#09090b', // Dark theme background color (zinc-950)
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            webSecurity: true,
            preload: preloadPath,
            // Performance optimizations
            enableWebSQL: false,
            spellcheck: false,
        },
    });
    // 生产环境不需要日志转发
    // const sendLog = (level: string, ...args: any[]) => { ... };
    // console.log = (...args) => sendLog('log', ...args);
    // Show window when ready to prevent white flash
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
    // Listen for window state changes
    mainWindow.on('maximize', () => {
        mainWindow.webContents.send('window-maximized');
    });
    mainWindow.on('unmaximize', () => {
        mainWindow.webContents.send('window-unmaximized');
    });
    // IPC handlers for window controls
    electron_1.ipcMain.on('window-min', () => mainWindow.minimize());
    electron_1.ipcMain.on('window-max', () => {
        if (mainWindow.isMaximized()) {
            mainWindow.unmaximize();
        }
        else {
            mainWindow.maximize();
        }
    });
    electron_1.ipcMain.on('window-close', () => mainWindow.close());
    // Handle opening external URLs
    electron_1.ipcMain.handle('open-external', async (_event, url) => {
        try {
            await electron_1.shell.openExternal(url);
            return { success: true };
        }
        catch (error) {
            console.error('Failed to open external URL:', error);
            return { success: false, error: error.message };
        }
    });
    // Get backend port
    electron_1.ipcMain.handle('get-backend-port', async () => {
        return backendPort;
    });
    // FFmpeg check
    electron_1.ipcMain.handle('ffmpeg:check', async () => {
        return new Promise((resolve) => {
            fluent_ffmpeg_1.default.getAvailableFormats((err, formats) => {
                if (err) {
                    resolve({
                        status: 'error',
                        error: err.message,
                        paths: { ffmpeg: ffmpegPath, ffprobe: ffprobePath }
                    });
                }
                else {
                    resolve({
                        status: 'ok',
                        formatsCount: Object.keys(formats).length,
                        paths: { ffmpeg: ffmpegPath, ffprobe: ffprobePath }
                    });
                }
            });
        });
    });
    electron_1.ipcMain.handle('select-directory', async () => {
        const result = await electron_1.dialog.showOpenDialog(mainWindow, {
            properties: ['openDirectory']
        });
        if (result.canceled) {
            return null;
        }
        else {
            return result.filePaths[0];
        }
    });
    electron_1.ipcMain.handle('save-draft', async (event, folderPath, content, meta) => {
        try {
            // Create directory
            if (!fs.existsSync(folderPath)) {
                fs.mkdirSync(folderPath, { recursive: true });
            }
            // Write draft_content.json
            fs.writeFileSync(path.join(folderPath, 'draft_content.json'), JSON.stringify(content, null, 4), 'utf-8');
            // Write draft_meta_info.json
            fs.writeFileSync(path.join(folderPath, 'draft_meta_info.json'), JSON.stringify(meta, null, 4), 'utf-8');
            return { success: true };
        }
        catch (error) {
            console.error('Save draft error:', error);
            return { success: false, error: error.message };
        }
    });
    // 视频“切白”接口：删除从0到第二个关键帧的内容
    electron_1.ipcMain.handle('video:trim-white', async (event, inputPath) => {
        try {
            if (!fs.existsSync(inputPath)) {
                throw new Error(`File not found: ${inputPath}`);
            }
            // 1. 确定输出路径
            const dir = path.dirname(inputPath);
            const ext = path.extname(inputPath);
            const name = path.basename(inputPath, ext);
            const outputPath = path.join(dir, `${name}_trimmed${ext}`);
            // 2. 使用 ffprobe 获取关键帧
            // 命令: ffprobe -v error -select_streams v:0 -skip_frame nokey -show_entries frame=pkt_pts_time -of csv=p=0 input.mp4
            const ffprobeCmd = (0, ffmpeg_helper_js_1.getFfprobePath)();
            const ffmpegCmd = (0, ffmpeg_helper_js_1.getFfmpegPath)();
            if (!ffprobeCmd || !ffmpegCmd) {
                throw new Error('FFmpeg/FFprobe not found');
            }
            const getKeyframes = () => {
                return new Promise((resolve, reject) => {
                    const args = [
                        '-v', 'error',
                        '-select_streams', 'v:0',
                        '-skip_frame', 'nokey',
                        '-show_entries', 'frame=pkt_pts_time',
                        '-of', 'csv=p=0',
                        inputPath
                    ];
                    const child = (0, child_process_1.spawn)(ffprobeCmd, args);
                    let stdout = '';
                    let stderr = '';
                    child.stdout.on('data', (data) => stdout += data);
                    child.stderr.on('data', (data) => stderr += data);
                    child.on('close', (code) => {
                        if (code !== 0) {
                            reject(new Error(`ffprobe failed: ${stderr}`));
                        }
                        else {
                            const times = stdout.trim().split(/\r?\n/).map(t => parseFloat(t)).filter(t => !isNaN(t));
                            resolve(times);
                        }
                    });
                });
            };
            const keyframes = await getKeyframes();
            console.log('Keyframes:', keyframes);
            if (keyframes.length < 2) {
                // 如果没有第二个关键帧，说明视频很短或只有一帧，直接返回原路径或报错
                // 这里选择返回原路径，不做处理
                console.log('Not enough keyframes to trim, returning original path.');
                return { success: true, path: inputPath, trimmed: false };
            }
            const secondKeyframeTime = keyframes[1];
            console.log(`Trimming from ${secondKeyframeTime}s...`);
            // 3. 使用 ffmpeg 裁剪
            // 命令: ffmpeg -y -ss <time> -i <input> -c copy <output>
            // -y: 覆盖输出
            // -ss: 开始时间 (放在 -i 前为了快速定位)
            await new Promise((resolve, reject) => {
                const args = [
                    '-y',
                    '-ss', secondKeyframeTime.toString(),
                    '-i', inputPath,
                    '-c', 'copy',
                    outputPath
                ];
                const child = (0, child_process_1.spawn)(ffmpegCmd, args);
                let stderr = '';
                child.stderr.on('data', (data) => stderr += data);
                child.on('close', (code) => {
                    if (code !== 0) {
                        reject(new Error(`ffmpeg failed: ${stderr}`));
                    }
                    else {
                        resolve();
                    }
                });
            });
            return { success: true, path: outputPath, trimmed: true };
        }
        catch (error) {
            console.error('Trim video error:', error);
            return { success: false, error: error.message };
        }
    });
    // --------------------------------------------------------------------------
    // Update Logic
    // --------------------------------------------------------------------------
    // 1. Check for updates
    electron_1.ipcMain.handle('get-version', () => {
        return electron_1.app.getVersion();
    });
    electron_1.ipcMain.handle('check-update', async (_event, apiBaseUrlFromRenderer) => {
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
                            const currentVersion = electron_1.app.getVersion();
                            // Simple version comparison (semver is better but this works for basic x.y.z)
                            if (remoteVersion !== currentVersion) {
                                // In a real app, use semver.gt(remoteVersion, currentVersion)
                                // For now, assume any difference is an update if not dev
                                // But strictly, we should compare.
                                // Let's just return the remote version info and let frontend decide or compare here.
                                // We will return it if remote != current.
                                resolve({
                                    updateAvailable: remoteVersion !== currentVersion,
                                    ...response.data
                                });
                            }
                            else {
                                resolve({ updateAvailable: false });
                            }
                        }
                        else {
                            resolve({ updateAvailable: false });
                        }
                    }
                    catch (e) {
                        console.error('Check update parse error:', e);
                        resolve({ updateAvailable: false, error: 'Parse error' });
                    }
                });
            });
            request.on('error', (err) => {
                console.error('Check update request error:', err);
                resolve({ updateAvailable: false, error: err.message });
            });
        });
    });
    // 2. Download update
    electron_1.ipcMain.on('start-download', (event, downloadUrl) => {
        // Extract extension from URL
        let ext = path.extname(new URL(downloadUrl).pathname);
        if (!ext) {
            ext = process.platform === 'win32' ? '.exe' : '.dmg';
        }
        const downloadPath = path.join(electron_1.app.getPath('temp'), `update-${Date.now()}${ext}`);
        const file = fs.createWriteStream(downloadPath);
        // Determine protocol
        const lib = downloadUrl.startsWith('https') ? https : http;
        const request = lib.get(downloadUrl, (response) => {
            const totalBytes = parseInt(response.headers['content-length'] || '0', 10);
            let receivedBytes = 0;
            response.pipe(file);
            response.on('data', (chunk) => {
                receivedBytes += chunk.length;
                if (totalBytes > 0) {
                    const progress = (receivedBytes / totalBytes) * 100;
                    mainWindow.webContents.send('download-progress', progress);
                }
            });
            file.on('finish', () => {
                file.close(() => {
                    mainWindow.webContents.send('download-complete', downloadPath);
                });
            });
        });
        request.on('error', (err) => {
            fs.unlink(downloadPath, () => { }); // Delete failed file
            mainWindow.webContents.send('download-error', err.message);
        });
        file.on('error', (err) => {
            fs.unlink(downloadPath, () => { });
            mainWindow.webContents.send('download-error', err.message);
        });
    });
    // 3. Install update
    electron_1.ipcMain.on('install-update', (event, filePath) => {
        // Run the installer
        // On Windows: just spawn it
        // On Mac: It's more complex (mount DMG, copy app). 
        // Assuming Windows for now based on user request context (usually .exe)
        if (process.platform === 'win32') {
            (0, child_process_1.spawn)(filePath, [], {
                detached: true,
                stdio: 'ignore'
            }).unref();
        }
        else {
            // Fallback: open file
            electron_1.shell.openPath(filePath);
        }
        electron_1.app.quit();
    });
    // Check if cache exists without downloading
    electron_1.ipcMain.handle('check-cache', async (event, url, type) => {
        if (!url || !url.startsWith('http'))
            return null;
        try {
            const { filePath, md5 } = getCacheFilePath(url, type);
            const tmpPath = `${filePath}.tmp`;
            // 如果正在下载中（存在 .tmp 文件或在下载队列中），返回 null
            if (downloadingRequests.has(md5) || fs.existsSync(tmpPath)) {
                return null;
            }
            // 只有完整的文件才返回路径
            if (fs.existsSync(filePath)) {
                return filePath;
            }
            return null;
        }
        catch (error) {
            console.error('Check cache error:', error);
            return null;
        }
    });
    electron_1.ipcMain.handle('cache-file', async (event, url, type) => {
        if (!url || !url.startsWith('http'))
            return url;
        try {
            const { filePath, md5 } = getCacheFilePath(url, type);
            const tmpPath = `${filePath}.tmp`;
            // Check if final file exists (complete download)
            if (fs.existsSync(filePath)) {
                return filePath;
            }
            // Check concurrency - if already downloading, wait for it
            if (downloadingRequests.has(md5)) {
                return downloadingRequests.get(md5);
            }
            // Clean up any stale .tmp file from previous failed download
            if (fs.existsSync(tmpPath)) {
                try {
                    fs.unlinkSync(tmpPath);
                }
                catch (err) {
                    console.error('Failed to clean stale tmp file:', err);
                }
            }
            // Start download
            const downloadPromise = new Promise((resolve, reject) => {
                const file = fs.createWriteStream(tmpPath);
                const request = (url.startsWith('https') ? https : http).get(url, (response) => {
                    if (response.statusCode !== 200) {
                        fs.unlink(tmpPath, () => { });
                        reject(new Error(`Failed to download: ${response.statusCode}`));
                        return;
                    }
                    response.pipe(file);
                    file.on('finish', () => {
                        file.close(() => {
                            // Atomic rename: only rename to final path when download is complete
                            try {
                                fs.renameSync(tmpPath, filePath);
                                resolve(filePath);
                            }
                            catch (err) {
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
            }
            finally {
                downloadingRequests.delete(md5);
            }
        }
        catch (error) {
            console.error('Cache file error:', error);
            // Return original URL if cache fails so the app doesn't break
            return url;
        }
    });
    // Clear corrupted cache file
    electron_1.ipcMain.handle('clear-cache', async (event, url, type) => {
        if (!url || !url.startsWith('http'))
            return { success: false, error: 'Invalid URL' };
        try {
            const { filePath } = getCacheFilePath(url, type);
            const tmpPath = `${filePath}.tmp`;
            // Delete main cache file if exists
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                console.log(`Cleared cache: ${filePath}`);
            }
            // Delete temp file if exists
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
                console.log(`Cleared temp file: ${tmpPath}`);
            }
            return { success: true };
        }
        catch (error) {
            console.error('Clear cache error:', error);
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('copy-file', async (event, sourcePath, destPath) => {
        try {
            // Ensure destination directory exists
            const destDir = path.dirname(destPath);
            if (!fs.existsSync(destDir)) {
                fs.mkdirSync(destDir, { recursive: true });
            }
            fs.copyFileSync(sourcePath, destPath);
            return { success: true };
        }
        catch (error) {
            console.error('Copy file error:', error);
            return { success: false, error: error.message };
        }
    });
    if (electron_is_dev_1.default) {
        mainWindow.loadURL('http://localhost:5174');
        mainWindow.webContents.openDevTools();
    }
    else {
        const appPath = electron_1.app.getAppPath();
        const indexPath = path.join(appPath, 'dist/index.html');
        mainWindow.loadFile(indexPath).catch(e => {
            console.error('Failed to load index.html:', e);
        });
    }
}
electron_1.app.whenReady().then(() => {
    startBackend();
    createWindow();
    electron_1.app.on('activate', () => {
        // On macOS, re-create window when dock icon is clicked and no windows are open
        if (electron_1.BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});
// Add single instance lock to prevent multiple instances
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    console.log('[Electron] Another instance is already running, quitting...');
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', (event, commandLine, workingDirectory) => {
        // Someone tried to run a second instance, focus our window instead
        const windows = electron_1.BrowserWindow.getAllWindows();
        if (windows.length > 0) {
            const mainWindow = windows[0];
            if (mainWindow.isMinimized())
                mainWindow.restore();
            mainWindow.focus();
        }
    });
}
electron_1.app.on('will-quit', () => {
    if (backendProcess) {
        console.log('[Electron] Killing backend process...');
        try {
            backendProcess.kill('SIGTERM');
            // Give it 2 seconds to gracefully shutdown
            setTimeout(() => {
                if (backendProcess && !backendProcess.killed) {
                    console.log('[Electron] Force killing backend process...');
                    backendProcess.kill('SIGKILL');
                }
            }, 2000);
        }
        catch (err) {
            console.error('[Electron] Error killing backend:', err);
        }
        backendProcess = null;
    }
});
electron_1.app.on('window-all-closed', () => {
    // On macOS, keep app running even when all windows are closed
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
