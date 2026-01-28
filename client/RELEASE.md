# 客户端打包发布指南

本文档详细说明了如何打包和发布 Anime Drama 客户端。

## 1. 环境准备

确保本地已安装 Node.js 环境，并在 `client` 目录下安装了所有依赖。

```powershell
# 进入客户端目录
cd client

# 安装依赖
npm install
```

## 2. 打包命令

使用以下命令进行一键打包。该命令会自动执行 TypeScript 编译、Vite 构建以及 Electron 打包。

```powershell
npm run dist
```

### 命令执行流程
该命令 (`npm run dist`) 实际上按顺序执行了以下步骤：

1.  **`npm run build`**:
    *   `tsc -b`: 编译 TypeScript 类型检查。
    *   `vite build`: 构建 React 前端资源（输出到 `dist` 目录）。
    *   `npm run electron:build`: 编译 Electron 主进程代码（输出到 `public/electron` 目录）。
2.  **`electron-builder`**:
    *   读取 `electron-builder.config.js` 配置。
    *   将构建好的资源打包成最终的安装程序。

## 3. 输出结果

打包完成后，安装包将生成在以下目录：

> **`client/release`**

- **Windows**: 生成 `.exe` 安装程序（NSIS 安装包）。
- **macOS**: 生成 `.dmg` 和 `.zip` 文件（需在 macOS 环境下运行）。

## 4. 关键配置说明

### 配置文件
- **构建脚本**: 定义在 [package.json](package.json) 的 `scripts` 字段中。
- **打包配置**: 定义在 [electron-builder.config.js](electron-builder.config.js) 中。
    - `appId`: `com.aishortx.client`
    - `productName`: `AIShortX`
    - `directories.output`: `release` (指定输出目录)

### 环境变量
打包过程默认加载 `.env.production` 文件。如果需要修改 API 地址或其他生产环境配置，请在打包前检查该文件。

## 5. 常见问题

- **FFmpeg 依赖**:
  配置文件中包含将 `ffmpeg.exe` 和 `ffprobe.exe` 复制到安装包的逻辑。请确保 `node_modules` 中已正确安装 `ffmpeg-static` 和 `ffprobe-static`（通常 `npm install` 会自动处理）。

- **网络问题**:
  `electron-builder` 首次运行时可能需要下载 Electron 的二进制包。如果下载缓慢或失败，请检查网络设置或配置镜像源。
