const dotenv = require('dotenv');

// 加载环境变量
// 默认加载 .env.production，因为通常打包都是为了发布生产环境
// 如果需要特定环境，可以在运行命令前设置 NODE_ENV
const mode = process.env.MODE || 'production';
dotenv.config({ path: `.env.${mode}` });

/**
 * @type {import('electron-builder').Configuration}
 * @see https://www.electron.build/configuration/configuration
 */
const config = {
  appId: "com.ai-shortx.client",
  productName: "AIShortX",
  directories: {
    "output": "release"
  },
  asar: true,
  compression: "maximum",
  files: [
    "dist/**/*",
    "public/electron/**/*",
    "!**/*.map",
    "package.json",
    "!node_modules/ffmpeg-static/**/*",
    "!node_modules/ffprobe-static/**/*"
  ],
  extraMetadata: {
    main: "public/electron/main.cjs",
    type: "commonjs"
  },
  win: {
    "icon": "public/icon.png",
    "target": "nsis",
    "extraResources": [
      {
        "from": "node_modules/ffmpeg-static/ffmpeg.exe",
        "to": "ffmpeg.exe"
      },
      {
        "from": "node_modules/ffprobe-static/bin/win32/x64/ffprobe.exe",
        "to": "ffprobe.exe"
      },
      {
        "from": "../backend/dist",
        "to": "backend/dist"
      },
      {
        "from": "../backend/node_modules",
        "to": "backend/node_modules",
        "filter": ["**/*", "!**/*.md", "!**/LICENSE", "!**/.bin"]
      },
      {
        "from": "../backend/prisma",
        "to": "backend/prisma"
      },
      {
        "from": "../backend/config",
        "to": "backend/config"
      },
      {
        "from": "../backend/package.json",
        "to": "backend/package.json"
      }
    ]
  },
  mac: {
    "icon": "public/icon.png",
    "target": [
      {
        "target": "dmg",
        "arch": ["arm64"]
      }
    ],
    "category": "public.app-category.entertainment",
    "hardenedRuntime": true,
    "gatekeeperAssess": false,
    "extraResources": [
      {
        "from": "../backend/dist",
        "to": "backend/dist"
      },
      {
        "from": "../backend/node_modules",
        "to": "backend/node_modules",
        "filter": ["**/*", "!**/*.md", "!**/LICENSE", "!**/.bin"]
      },
      {
        "from": "../backend/prisma",
        "to": "backend/prisma"
      },
      {
        "from": "../backend/config",
        "to": "backend/config"
      },
      {
        "from": "../backend/package.json",
        "to": "backend/package.json"
      }
    ]
  },
  dmg: {
    "contents": [
      {
        "x": 130,
        "y": 220
      },
      {
        "x": 410,
        "y": 220,
        "type": "link",
        "path": "/Applications"
      }
    ]
  },
  nsis: {
    "oneClick": false,
    "allowToChangeInstallationDirectory": true,
    "createDesktopShortcut": true,
    "createStartMenuShortcut": true
  },
  publish: {
    "provider": "generic",
    "url": process.env.VITE_UPDATE_URL || "http://localhost:3010/updates/"
  }
};

module.exports = config;
