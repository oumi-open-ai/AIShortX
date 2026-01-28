import * as fs from 'fs';
import * as path from 'path';
import prisma from './prisma';

/**
 * 初始化数据库
 * 1. 检查数据库表是否存在
 * 2. 如果不存在，直接执行 SQL 创建表结构
 * 3. 检查并应用待处理的迁移
 * 4. 插入种子数据
 */
export async function initializeDatabase() {
  try {
    const databaseUrl = process.env.DATABASE_URL || 'file:./dev.db';
    console.log('[DB Init] Database URL:', databaseUrl);

    // 提取数据库文件路径
    const dbPath = databaseUrl.replace('file:', '');
    
    // 确保数据库目录存在
    const dbDir = path.dirname(dbPath);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
      console.log('[DB Init] Created database directory:', dbDir);
    }

    // 检查表是否存在
    let needsInitialMigration = false;
    try {
      await prisma.$connect();
      console.log('[DB Init] Database connected successfully');
      
      // 尝试查询用户表来检查表是否存在
      await prisma.user.count();
      console.log('[DB Init] Database tables exist');
    } catch (error: any) {
      if (error.code === 'P2021' || error.message?.includes('does not exist')) {
        console.log('[DB Init] Database tables do not exist, need initial migration');
        needsInitialMigration = true;
      } else {
        console.error('[DB Init] Failed to connect to database:', error);
        throw error;
      }
    }

    // 如果需要初始迁移，直接执行 SQL
    if (needsInitialMigration) {
      await applyInitialMigration();
    } else {
      // 数据库已存在，检查是否有待处理的迁移
      await checkAndApplyPendingMigrations();
    }

    // 确保有默认数据
    await ensureDefaultData();

    console.log('[DB Init] Database initialization completed!');

  } catch (error) {
    console.error('[DB Init] Database initialization failed:', error);
    throw error;
  }
}

/**
 * 应用初始迁移（首次创建数据库）
 */
async function applyInitialMigration() {
  try {
    console.log('[DB Init] Creating database schema...');
    
    // 读取迁移 SQL 文件
    const migrationDir = path.join(__dirname, '../../prisma/migrations');
    const entries = fs.readdirSync(migrationDir, { withFileTypes: true });
    
    // 只获取文件夹（排除 migration_lock.toml 等文件）
    const migrationFolders = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort()
      .reverse();
    
    if (migrationFolders.length === 0) {
      throw new Error('No migration folders found');
    }
    
    // 使用最新的迁移文件
    const latestMigration = migrationFolders[0];
    const sqlFile = path.join(migrationDir, latestMigration, 'migration.sql');
    
    console.log('[DB Init] Reading migration file:', sqlFile);
    
    if (!fs.existsSync(sqlFile)) {
      throw new Error(`Migration file not found: ${sqlFile}`);
    }
    
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    
    // 分割 SQL 语句并执行
    const statements = splitSqlStatements(sql);
    
    console.log('[DB Init] Executing', statements.length, 'SQL statements...');
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`[DB Init] Executing statement ${i + 1}/${statements.length}`);
      await prisma.$executeRawUnsafe(statement);
    }
    
    console.log('[DB Init] Database schema created successfully');
    
    // 重新连接
    await prisma.$disconnect();
    await prisma.$connect();
  } catch (error) {
    console.error('[DB Init] Failed to create database schema:', error);
    throw error;
  }
}

/**
 * 检查并应用待处理的迁移
 */
async function checkAndApplyPendingMigrations() {
  try {
    console.log('[DB Init] Checking for pending migrations...');
    
    // 1. 确保 _prisma_migrations 表存在
    await ensureMigrationTableExists();
    
    // 2. 获取所有迁移文件
    const migrationDir = path.join(__dirname, '../../prisma/migrations');
    if (!fs.existsSync(migrationDir)) {
      console.log('[DB Init] No migrations directory found');
      return;
    }
    
    const entries = fs.readdirSync(migrationDir, { withFileTypes: true });
    const allMigrations = entries
      .filter(entry => entry.isDirectory())
      .map(entry => entry.name)
      .sort(); // 按时间戳排序
    
    if (allMigrations.length === 0) {
      console.log('[DB Init] No migration folders found');
      return;
    }
    
    // 3. 获取已应用的迁移
    const appliedMigrations = await getAppliedMigrations();
    console.log('[DB Init] Applied migrations:', appliedMigrations.length);
    
    // 4. 找出待处理的迁移
    const pendingMigrations = allMigrations.filter(
      migration => !appliedMigrations.includes(migration)
    );
    
    if (pendingMigrations.length === 0) {
      console.log('[DB Init] No pending migrations');
      return;
    }
    
    console.log('[DB Init] Found', pendingMigrations.length, 'pending migrations:', pendingMigrations);
    
    // 5. 应用待处理的迁移
    for (const migration of pendingMigrations) {
      await applyMigration(migration, migrationDir);
    }
    
    console.log('[DB Init] All pending migrations applied successfully');
    
  } catch (error) {
    console.error('[DB Init] Failed to check/apply pending migrations:', error);
    // 不抛出错误，允许应用继续运行
  }
}

/**
 * 确保迁移记录表存在
 */
async function ensureMigrationTableExists() {
  try {
    // 检查表是否存在
    const result = await prisma.$queryRawUnsafe<any[]>(`
      SELECT name FROM sqlite_master 
      WHERE type='table' AND name='_prisma_migrations'
    `);
    
    if (!result || result.length === 0) {
      console.log('[DB Init] Creating _prisma_migrations table...');
      
      // 创建迁移记录表
      await prisma.$executeRawUnsafe(`
        CREATE TABLE "_prisma_migrations" (
          "id" TEXT PRIMARY KEY NOT NULL,
          "checksum" TEXT NOT NULL,
          "finished_at" DATETIME,
          "migration_name" TEXT NOT NULL,
          "logs" TEXT,
          "rolled_back_at" DATETIME,
          "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          "applied_steps_count" INTEGER NOT NULL DEFAULT 0
        )
      `);
      
      console.log('[DB Init] _prisma_migrations table created');
    }
  } catch (error) {
    console.error('[DB Init] Failed to ensure migration table exists:', error);
    throw error;
  }
}

/**
 * 获取已应用的迁移列表
 */
async function getAppliedMigrations(): Promise<string[]> {
  try {
    const migrations = await prisma.$queryRawUnsafe<any[]>(`
      SELECT migration_name FROM _prisma_migrations 
      WHERE finished_at IS NOT NULL
      ORDER BY started_at ASC
    `);
    
    return migrations.map(m => m.migration_name);
  } catch (error) {
    console.error('[DB Init] Failed to get applied migrations:', error);
    return [];
  }
}

/**
 * 应用单个迁移
 */
async function applyMigration(migrationName: string, migrationDir: string) {
  try {
    console.log(`[DB Init] Applying migration: ${migrationName}`);
    
    const sqlFile = path.join(migrationDir, migrationName, 'migration.sql');
    
    if (!fs.existsSync(sqlFile)) {
      console.warn(`[DB Init] Migration file not found: ${sqlFile}`);
      return;
    }
    
    const sql = fs.readFileSync(sqlFile, 'utf-8');
    const statements = splitSqlStatements(sql);
    
    // 生成迁移 ID 和 checksum
    const migrationId = generateMigrationId();
    const checksum = generateChecksum(sql);
    
    // 记录迁移开始
    await prisma.$executeRawUnsafe(`
      INSERT INTO _prisma_migrations (id, checksum, migration_name, started_at, applied_steps_count)
      VALUES ('${migrationId}', '${checksum}', '${migrationName}', datetime('now'), 0)
    `);
    
    // 执行迁移语句
    let appliedSteps = 0;
    for (const statement of statements) {
      if (statement.trim()) {
        await prisma.$executeRawUnsafe(statement);
        appliedSteps++;
      }
    }
    
    // 更新迁移记录为完成
    await prisma.$executeRawUnsafe(`
      UPDATE _prisma_migrations 
      SET finished_at = datetime('now'), applied_steps_count = ${appliedSteps}
      WHERE id = '${migrationId}'
    `);
    
    console.log(`[DB Init] Migration ${migrationName} applied successfully (${appliedSteps} steps)`);
    
  } catch (error) {
    console.error(`[DB Init] Failed to apply migration ${migrationName}:`, error);
    throw error;
  }
}

/**
 * 分割 SQL 语句
 */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split('\n')
    .filter(line => !line.trim().startsWith('--')) // 移除注释
    .join('\n')
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

/**
 * 生成迁移 ID
 */
function generateMigrationId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

/**
 * 生成 checksum
 */
function generateChecksum(content: string): string {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * 确保默认数据存在
 */
async function ensureDefaultData() {
  try {
    // 1. 检查并创建默认用户
    const userCount = await prisma.user.count();
    if (userCount === 0) {
      console.log('[DB Init] Creating default user...');
      await prisma.user.create({
        data: {
          id: 1,
          openid: 'local_default_user',
          nickname: '本地管理员',
          role: 'PERMANENT',
          avatar: '',
        },
      });
      console.log('[DB Init] Default user created');
    }

    // 2. 检查并创建默认系统提示词
    // const promptCount = await prisma.systemPrompt.count();
    // if (promptCount === 0) {
      console.log('[DB Init] Creating default system prompts...');
      const systemPrompts = [
        {
          id: 1,
          type: 'storyboard_analysis',
          name: '分镜分析推理',
          content: `# 核心任务
梳理小说的故事主线，将小说改编为具有画面冲击、故事带入感、剧情紧凑的短剧剧本。

# 输出要求
输出内容：
分镜描述 text，含运镜方式+主体动作/语音（微观参数）+环境/物体反馈+光影节奏。（） 内代表情绪或者动作，："" 代表说话的台词，(OS) ：代表内心对白。示例：镜头缓慢推近至嫌疑人面部特写。男子点烟时手部轻微颤抖（OS）："我决不能在这里出意外！"，（火苗晃动幅度极大，连续两次未点燃），烟雾呈丝缕状缓慢升腾（遮挡半边脸）；审讯室顶灯发出滋滋声并伴随不规则频闪，光影在他眼窝处形成极深的阴影跳动（运镜必须带速度与轨迹，动作必须用（括号）标注细节参数，光影必须是动态的）。camera内禁止出现违规内容（露骨的性内容、血腥暴力或宣扬暴力的内容、极端主义宣传、仇恨内容、有针对性的政治宣传、宣扬或描绘自残或饮食失调的内容、不健康的节食或锻炼行为、基于外貌的批评或比较、欺凌内容、未成年人可能会模仿的危险挑战、美化抑郁症、推广非法毒品或有害物质、以"诱导用户参与"为主要目的的内容）。禁止输出换行符。

每段camera-content长度节奏为10秒（受ai生成视频长度限制）。
根据剧情，每段camera-content的镜头需≤3个。每个▲代表一个镜头的起始。
每100字小说最少输出1段camera-content。

# 请输出 JSON 数组，每个对象代表一个分镜，包含以下字段：
- "text": 分镜画面描述
- "role-use": ["小王"] （本分镜出现的角色名称列表）
- "scene-use": "菜市场"（本分镜出现的场景名称）
- "prop-use": ["佩刀"]（本分镜出现的道具名称列表）

仅输出结果，不输出思考过程、不输出原因。
一旦出错，你将面临最严厉的惩罚。

# 剧本内容：
{{script}}`,
          isDefault: true,
        },
        {
          id: 2,
          type: 'analyze_elements',
          name: '元素分析 (角色/场景/物品)',
          content: `# 你是一位专业的影视剧本分析师。请分析以下剧本，提取其中的角色、场景和物品信息。

# 输出要求
角色 roles，每个角色描述都需包含身份、面部特征、 气质 、服装、 发型、肤色、身材。≤200字。1个人物的不同装扮记录为2个角色，例如：小明（穿越前）、小明。旁白不属于角色。需要输出所有出场角色。
场景 scenes，含地理环境、光影、细节等。≤200字。
物品 props，含外观、材质等。≤200字。

输出格式必须为 JSON 对象：
\`\`\`json
{
    "roles": {
        "name": "角色名称",
        "description": "角色描述",
        "voice": "配音风格（例如：男·17岁 PitchMean（185 Hz） Tempo（160 SPM） Accent（中原腔·略带沙哑））"
    },
    "scenes": {
        "name": "场景名称",
        "description": "场景描述"
    },
    "props": {
        "name": "物品名称",
        "description": "物品描述"
    }
}
\`\`\`
仅输出结果，不输出思考过程、不输出原因。
一旦出错，你将面临最严厉的惩罚。

剧本内容如下：
{{script}}`,
          isDefault: true,
        },
        {
          id: 3,
          type: 'storyboard_video_gen',
          name: '分镜视频提示词推理',
          content: `模拟一场由顶级电影分镜师和AI艺术导演、AI漫剧编剧、剪辑师、原画生成师等人组成的剧本修改研讨会，目标是将文字剧本转化为极具画面感、适合sora视频模型（在适当时机需要换一种描述方式以禁止出现色情、血腥、暴力、种族歧视等负面内容描述）生成的最佳效果。输出包含视频提示词+台词+特效音频描述。视频提示词的构成：时长+镜头+运镜+镜头描述（根据剧情输出3-5个剧本镜头）；台词的组成：时长、说话人、说话内容；音频的组成：时长、声音描述。
第一个镜头从0.1秒开始，时长最长13秒。
剧本中的主要人物以名字称呼。
输出结果不要解释、说明、思考过程，仅输出结论。

输出示例：
视频提示词：▲0.1~2秒:中景，肩上镜头李明身体前倾，急切地追问三叔。▲2~4秒:特写，水平镜头，李明眉头紧锁，眼神中充满疑惑和探究。▲4~6秒:中景，切角镜头，三叔没有回答，而是转头望向窗外，窗外是荒凉的野外，他的侧脸线条紧绷。▲6~8秒:特写，透视镜头，三叔的倒影映在车窗上，他的表情凝重，眼神中流露出深深的忧虑。▲8~10秒:广角镜头，低角度镜头，车厢内光线昏暗，三叔沉默不语，李明的脸上的疑惑更深了，两人之间郜的气氛变得更加凝重
台词：0.1～4秒:李明:"三叔，那到底是什么东西?咋用手机还不行呢?"
音频：0.1～10秒:火车行驶的单调轰鸣声，车厢内一片寂静。

接下来是正式的文案：
{{script}}`,
          isDefault: true,
        },
        {
          id: 4,
          type: 'storyboard_image_gen',
          name: '生成分镜图',
          content: `根据剧本和美术设定生成分镜图，要求输出1张2*3的6宫格彩色分镜。
剧本：{{description}}
风格：{{style}}
其他要求：不要显示镜头号，不要显示文字备注，不要气泡框。
输出结果为1张图片，禁止分析、解释，仅输出结果。`,
          isDefault: true,
        },
        {
          id: 5,
          type: 'role_image_gen',
          name: '生成角色图',
          content: `中心区域生成全身三视图以及一张面部特写(最左边占满三分之一的位置是超大的面部特写，右边三分之二放正视图、侧视图、后视图)，人物比例适中，清晰可见。严格按照比例设定，包括身高对比和头身比，保持整体风格统一，角色为自然站立状态。纯白色背景，禁止纹理，全局光照，禁止投影。
美术风格：{{style}}
角色描述：{{description}}`,
          isDefault: true,
        },
        {
          id: 6,
          type: 'scene_image_gen',
          name: '场景生图',
          content: `根据以下设定，生成1张场景图。
美术风格：{{style}}。
场景描述：{{description}}
其他要求：画面中不要出现人物。
输出结果为1张图片，禁止分析、解释，仅输出结果。`,
          isDefault: true,
        },
        {
          id: 7,
          type: 'prop_image_gen',
          name: '物品生图',
          content: `根据以下设定，生成1张物品图。
美术风格：{{style}}。
场景描述：{{description}}
其他要求：画面中不要出现人物。
输出结果为1张图片，禁止分析、解释，仅输出结果。`,
          isDefault: true,
        },
        {
          id: 8,
          type: 'role_video_gen',
          name: '角色视频生成',
          content: `画面风格：{{style}}
视频描述：{{description}}`,
          isDefault: true,
        },
        {
          id: 9,
          type: 'storyboard_video_gen_direct',
          name: '分镜',
          content: `画面风格：{{style}}
视频描述：{{description}}`,
          isDefault: true,
        },
      ];

      for (const prompt of systemPrompts) {
        await prisma.systemPrompt.upsert({
          where: { id: prompt.id },
          update: prompt,
          create: prompt,
        });
      }
      console.log('[DB Init] System prompts created');
    // }

    // 3. 检查并创建默认风格
    console.log('[DB Init] Creating default styles...');
    const defaultStyles = [
      {
        name: '赛璐璐',
        imageUrl: 'https://lsky.zhongzhuan.chat/i/2026/01/26/697757700bcfd.webp',
        prompt: 'Cel Shading style,赛璐璐风格',
        userId: 0,
      },
      {
        name: '新海城风格',
        imageUrl: 'https://lsky.zhongzhuan.chat/i/2026/01/26/697757701d05f.webp',
        prompt: '新海城风格',
        userId: 0,
      },
      {
        name: '3DCG国漫',
        imageUrl: 'https://lsky.zhongzhuan.chat/i/2026/01/26/6977576fe6f36.webp',
        prompt: '3D风格,国漫风格,CG质感',
        userId: 0,
      }
    ];

    for (const style of defaultStyles) {
      // 查找是否已存在相同的风格
      const existingStyle = await prisma.style.findFirst({
        where: {
          name: style.name,
          imageUrl: style.imageUrl,
          userId: style.userId,
        },
      });

      if (existingStyle) {
        // 如果存在，更新 prompt
        await prisma.style.update({
          where: { id: existingStyle.id },
          data: { prompt: style.prompt },
        });
      } else {
        // 如果不存在，创建新记录
        await prisma.style.create({
          data: style,
        });
      }
    }
    console.log('[DB Init] Default styles created');

    console.log('[DB Init] Default data check completed');
  } catch (error) {
    console.error('[DB Init] Failed to ensure default data:', error);
    // 不抛出错误，允许应用继续运行
  }
}
