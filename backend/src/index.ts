import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import xmlparser from 'express-xml-bodyparser';
import authRoutes from './routes/authRoutes';
import userRoutes from './routes/userRoutes';
import aiRoutes from './routes/aiRoutes';
import settingRoutes from './routes/settingRoutes';
import uploadRoutes from './routes/uploadRoutes';
import characterRoutes from './routes/characterRoutes';
import projectRoutes from './routes/projectRoutes';
import taskRoutes from './routes/taskRoutes';
import promptRoutes from './routes/promptRoutes';
import assetRoutes from './routes/assetRoutes';
import styleRoutes from './routes/styleRoutes';
import path from 'path';
import { TaskService } from './services/taskService';
import { initializeDatabase } from './utils/dbInit';

// 加载环境变量配置
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 确定上传文件目录
// 生产环境（Electron）使用环境变量 UPLOADS_DIR
// 开发环境使用默认的 uploads 文件夹
const uploadsDir = process.env.UPLOADS_DIR || path.join(process.cwd(), 'uploads');
console.log('[Backend] Uploads directory:', uploadsDir);

// 启动任务调度器（每 10 秒检查一次）
setInterval(() => {
  TaskService.checkActiveTasks().catch(err => console.error('Scheduler error:', err));
}, 10000);

// 配置中间件
app.use(cors());
app.use(express.json());
app.use(xmlparser());

// 提供静态文件服务 - public 目录
app.use(express.static(path.join(__dirname, '../public')));
// 提供上传文件的静态访问
app.use('/uploads', express.static(uploadsDir));

// 配置路由
app.use('/api/auth', authRoutes);

app.use('/api/user', userRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/settings', settingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/characters', characterRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/prompts', promptRoutes);
app.use('/api/assets', assetRoutes);
app.use('/api/styles', styleRoutes);

app.get('/', (req: Request, res: Response) => {
  res.send('Anime Drama Backend is running!');
});

// 启动服务器前初始化数据库
async function startServer() {
  try {
    console.log('[Server] Initializing database...');
    await initializeDatabase();
    console.log('[Server] Database initialization completed');

    app.listen(port, () => {
      console.log(`Server is running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('[Server] Failed to start server:', error);
    process.exit(1);
  }
}

// 启动服务器
startServer();
