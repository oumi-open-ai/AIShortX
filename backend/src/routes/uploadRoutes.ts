import { Router } from 'express';
import * as uploadController from '../controllers/uploadController';
import { authenticate } from '../middlewares/auth';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// 配置Multer存储
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    
    // 根据文件类型确定文件夹
    let folder = 'common';
    if (file.mimetype.startsWith('image/')) folder = 'image';
    else if (file.mimetype.startsWith('video/')) folder = 'video';
    
    const uploadPath = path.join(process.cwd(), 'uploads', folder, `${year}`, `${month}`, `${day}`);
    
    if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname) || '';
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({ 
    storage,
    limits: { fileSize: 100 * 1024 * 1024 } // 100MB限制
});

// 对所有路由应用认证中间件
router.use(authenticate);

// 上传路由

// 本地文件上传
router.post('/file', upload.single('file'), uploadController.uploadFile);

// 已废弃的路由（保留存根）
router.get('/credential', uploadController.getCredential);

export default router;
