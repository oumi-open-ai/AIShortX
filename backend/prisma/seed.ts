import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Ensure Default Local User (ID: 1)
  try {
    const defaultUser = await prisma.user.upsert({
      where: { id: 1 },
      update: {}, // No update needed if exists
      create: {
        id: 1,
        openid: 'local_default_user',
        nickname: '本地管理员',
        role: 'PERMANENT',
        avatar: '',
      },
    });
    console.log(`Default local user ensured: ${defaultUser.nickname} (ID: ${defaultUser.id})`);
  } catch (error) {
    console.error('Error creating default user:', error);
  }

  // 2. Initialize System Prompts
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

  try {
    for (const prompt of systemPrompts) {
      await prisma.systemPrompt.upsert({
        where: { id: prompt.id },
        update: {
          type: prompt.type,
          name: prompt.name,
          content: prompt.content,
          isDefault: prompt.isDefault,
        },
        create: prompt,
      });
    }
    console.log(`✅ Initialized ${systemPrompts.length} system prompts`);
  } catch (error) {
    console.error('Error initializing system prompts:', error);
  }

  // 3. Initialize Default Styles
  const defaultStyles = [
    {
      id: 1,
      name: '赛璐璐',
      imageUrl: 'https://lsky.zhongzhuan.chat/i/2026/01/26/697757700bcfd.webp',
      prompt: 'Cel Shading style,赛璐璐风格',
      userId: 0,
    },
    {
      id: 2,
      name: '新海城风格',
      imageUrl: 'https://lsky.zhongzhuan.chat/i/2026/01/26/697757701d05f.webp',
      prompt: '新海城风格',
      userId: 0,
    },
    {
      id: 3,
      name: '3DCG国漫',
      imageUrl: 'https://lsky.zhongzhuan.chat/i/2026/01/26/6977576fe6f36.webp',
      prompt: '3D风格,国漫风格,CG质感',
      userId: 0,
    },
  ];

  try {
    for (const style of defaultStyles) {
      await prisma.style.upsert({
        where: { id: style.id },
        update: {
          name: style.name,
          imageUrl: style.imageUrl,
          prompt: style.prompt,
          userId: style.userId,
        },
        create: style,
      });
    }
    console.log(`✅ Initialized ${defaultStyles.length} default styles`);
  } catch (error) {
    console.error('Error initializing default styles:', error);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
