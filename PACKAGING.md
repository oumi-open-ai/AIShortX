# 打包说明

本项目将 Backend 和 Client 打包成一个 Electron 应用。

## 架构说明

- **开发环境**：Backend 和 Client 分别运行
  - Backend: `cd backend && npm run dev` (端口 3000)
  - Client: `cd client && npm run dev` (端口 5174)

- **生产环境**：Electron 应用启动时自动启动 Backend 服务
  - Backend 运行在 `resources/backend` 目录
  - 数据库存储在用户数据目录：`~/Library/Application Support/AIShortX/database/prod.db` (Mac)
  - 上传文件存储在：`~/Library/Application Support/AIShortX/uploads/`

## 打包步骤

### 1. 安装依赖

```bash
# 安装 backend 依赖
cd backend
npm install

# 安装 client 依赖
cd ../client
npm install
```

### 2. 构建并打包

```bash
cd client
npm run dist
```

这个命令会：
1. 构建 backend (`npm run build:backend`)
2. 构建 client 前端 (`tsc -b && vite build`)
3. 编译 Electron 主进程 (`npm run electron:build`)
4. 使用 electron-builder 打包应用

### 3. 输出文件

打包完成后，安装包位于：
- Windows: `client/release/AIShortX Setup x.x.x.exe`
- macOS: `client/release/AIShortX-x.x.x.dmg` 和 `AIShortX-x.x.x-mac.zip`

## 打包内容

应用会包含以下内容：

1. **Frontend (Client)**
   - 编译后的 React 应用 (`dist/`)
   - Electron 主进程代码

2. **Backend**
   - 编译后的 Node.js 代码 (`backend/dist/`)
   - Node modules (`backend/node_modules/`)
   - Prisma schema 和迁移文件 (`backend/prisma/`)
   - AI 模型配置 (`backend/config/`)

3. **FFmpeg**
   - Windows: `ffmpeg.exe` 和 `ffprobe.exe`
   - macOS: 从 npm 包中提取

## 启动流程

1. 用户启动应用
2. Electron 主进程启动
3. 主进程检测环境（开发/生产）
4. **生产环境**：自动启动 Backend 服务
   - 使用 `spawn` 启动 `backend/dist/index.js`
   - 设置环境变量：
     - `PORT=3000`
     - `DATABASE_URL=file:/path/to/userData/database/prod.db`
     - `UPLOADS_DIR=/path/to/userData/uploads`
     - `NODE_ENV=production`
5. 加载前端界面
6. 前端连接到 `http://localhost:3000/api`

## 数据库初始化

首次启动时，Prisma 会自动创建数据库文件。如果需要预填充数据：

1. 在 `backend/prisma/seed.ts` 中定义种子数据
2. 在 Backend 启动时运行迁移和种子

## 注意事项

### 开发环境
- Backend 需要手动启动：`cd backend && npm run dev`
- Electron 不会自动启动 Backend（避免端口冲突）

### 生产环境
- Backend 自动启动，无需用户干预
- 数据库和上传文件存储在用户数据目录
- 应用退出时会自动关闭 Backend 进程

### 更新机制
- 应用支持自动更新检查
- 更新服务器 URL 在 `.env.production` 中配置
- 使用 `electron-builder` 的 `publish` 配置

## 故障排查

### Backend 未启动
检查 Electron 控制台日志：
```
[Electron] Backend Directory: /path/to/resources/backend
[Electron] Starting backend process from: /path/to/backend/dist/index.js
[Backend] Server running on port 3000
```

### 数据库错误
- 检查数据库文件权限
- 确保 `DATABASE_URL` 环境变量正确
- 查看 Backend 日志输出

### 文件上传失败
- 检查 `UPLOADS_DIR` 是否存在且可写
- 确保有足够的磁盘空间

## 环境变量

### Backend (.env)
```env
PORT=3000
DATABASE_URL=file:./dev.db
NODE_ENV=development
```

### Client (.env.production)
```env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_UPDATE_URL=http://your-server.com/updates/
```

## 构建优化

### 减小包体积
1. 使用 `asar: true` 压缩应用代码
2. 排除不必要的文件（`.map`, `LICENSE`, `.md`）
3. 使用 `compression: "maximum"`

### 加快启动速度
1. 预编译 Backend 代码
2. 使用 SQLite 而非远程数据库
3. 延迟加载非关键模块

## 发布流程

1. 更新版本号：`client/package.json` 中的 `version`
2. 构建应用：`npm run dist`
3. 测试安装包
4. 上传到更新服务器
5. 更新 `latest.yml` 文件（electron-builder 自动生成）
