# 🎬 AIShortX
<div align="center">
[![License: Custom](https://img.shields.io/badge/License-Commercial_Required-red.svg)](#-许可证-license)
![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Electron](https://img.shields.io/badge/Electron-191970?style=flat-square&logo=Electron&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-43853D?style=flat-square&logo=node.js&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-3982CE?style=flat-square&logo=Prisma&logoColor=white)

</div>

**AIShortX** 是一个基于 AI 的短剧生成工具，旨在帮助创作者通过 AI 技术快速生成高质量的短剧视频。项目采用现代化的技术栈，结合了 Electron 桌面端和 Node.js 后端服务，提供了一站式的创作体验。

## ✨ 核心特性

- **📚 项目管理**: 完整的项目生命周期管理，支持多剧集 (Episodes) 规划。
- **🎭 角色系统**: 强大的角色管理，支持从角色库导入、自定义角色形象及声音配置。
- **🎬 分镜创作**: 可视化的分镜 (Storyboard) 编辑器，支持场景 (Scenes) 和道具 (Props) 的绑定。
- **🤖 AI 集成**:
  - **LLM**: 支持多种大语言模型（如 DeepSeek, Moonshot 等）辅助剧本生成。
  - **Image Gen**: 集成 Nano 系列、即梦 (Jimeng) 系列绘图能力，自动生成角色立绘和场景图。
  - **Video Gen**: 支持 Sora2 视频生成，将静态分镜转化为动态视频。
- **🎞️ 导出剪映**: 内置 FFmpeg 进行视频切白（自动删除参考图）处理，支持导出剪映草稿 (Jianying Draft) 以便二次剪辑。
- **🔄 任务调度**: 强大的后台任务调度系统，稳定处理耗时的 AI 生成任务。
- **📝 提示词管理**: 支持自定义和优化 AI 提示词 (Prompts)，精准控制画面与剧情生成。
- **🎨 风格管理**: 支持自定义艺术风格配置，保持作品视觉统一性。

## 🛠 技术栈

### 🖥️ 客户端 (Client)
- **Runtime**: Electron
- **Framework**: React 19, Vite
- **Language**: TypeScript
- **UI Library**: Ant Design 6.x, TailwindCSS
- **State Management**: Zustand
- **Media**: Fluent-ffmpeg, FFmpeg-static

### ⚙️ 后端 (Backend)
- **Runtime**: Node.js
- **Framework**: Express
- **Language**: TypeScript
- **Database**: SQLite (via Prisma ORM)
- **Storage**: 免费图床 (Free Image Hosting)
- **Tools**: Zod (验证), Multer (上传), Sharp (图像处理)

## 🚀 快速开始

### 环境要求
- Node.js >= 18.0.0
- npm 或 yarn
- FFmpeg (开发环境下通常由 `ffmpeg-static` 处理，但建议本地安装以便调试)

### 1. 克隆项目
```bash
git clone https://github.com/yourusername/ai-shortx.git
cd ai-shortx
```

### 2. 后端设置 (Backend)
后端服务负责数据持久化、AI 接口转发和任务调度。

```bash
cd backend

# 安装依赖
npm install

# 初始化数据库
npx prisma generate
npx prisma db push

# 启动开发服务器 (默认端口 3000)
npm run dev
```

### 3. 客户端设置 (Client)
客户端提供用户交互界面，基于 Electron 和 React。

```bash
cd client

# 安装依赖
npm install

# 启动开发环境 (同时启动 React 和 Electron)
npm run dev
```

## 📂 项目结构

```
ai_shortx/
├── backend/                 # 后端服务源码
│   ├── config/              # 配置文件
│   ├── prisma/              # 数据库 Schema 和迁移
│   ├── src/
│   │   ├── controllers/     # 业务逻辑控制器
│   │   ├── routes/          # API 路由定义
│   │   ├── services/        # 核心服务 (AI, Task, etc.)
│   │   └── index.ts         # 入口文件
│   └── uploads/             # 本地文件上传目录 (开发环境)
│
└── client/                  # 客户端源码
    ├── electron/            # Electron 主进程代码
    ├── src/
    │   ├── components/      # React 组件
    │   ├── pages/           # 页面路由
    │   ├── services/        # 前端 API 服务
    │   ├── store/           # Zustand 状态管理
    │   └── utils/           # 工具函数
    └── public/              # 静态资源
```

## ⚙️ 配置说明

### 环境变量 (.env)
在 `backend` 目录下创建 `.env` 文件（参考 `.env.example`）：
```env
PORT=3000
DATABASE_URL="file:./dev.db"
```

### Prisma Studio
如果你需要可视化管理数据库，可以使用 Prisma Studio：
```bash
cd backend
npx prisma studio
```

## 💬 交流群

<img src="./qrcode.png" alt="AIShortX开源短剧交流群" width="300" />


## 📄 许可证 (License)

本项目采用 [CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/) 协议。

详细条款请见 [LICENSE](./LICENSE) 文件。简而言之：
- **个人非商业使用**: 免费。
- **商业使用**: 必须获得授权。

如需商业授权，请联系项目维护者。
