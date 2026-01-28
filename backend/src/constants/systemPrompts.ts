export interface SystemPromptVariable {
    label: string;
    value: string;
}

export interface SystemPromptConfig {
    type: string;
    name: string;
    group: 'llm' | 'image' | 'video';
    variables: SystemPromptVariable[];
}

export const SYSTEM_PROMPT_CONFIGS: SystemPromptConfig[] = [
    {
        type: 'analyze_elements',
        name: '元素分析 (角色/场景/物品)',
        group: 'llm',
        variables: [
            { label: '剧本内容', value: '{{script}}' }
        ]
    },
    {
        type: 'storyboard_analysis',
        name: '分镜分析推理',
        group: 'llm',
        variables: [
            { label: '剧本内容', value: '{{script}}' }
        ]
    },
    {
        type: 'storyboard_video_gen',
        name: '分镜视频提示词推理',
        group: 'llm',
        variables: [
            { label: '分镜描述', value: '{{script}}' }
        ]
    },
    {
        type: 'storyboard_image_gen',
        name: '分镜生图',
        group: 'image',
        variables: [
            { label: '分镜描述', value: '{{description}}' },
            { label: '视觉风格', value: '{{style}}' }
        ]
    },
    {
        type: 'role_image_gen',
        name: '角色生图',
        group: 'image',
        variables: [
            { label: '角色描述', value: '{{description}}' },
            { label: '视觉风格', value: '{{style}}' }
        ]
    },
    {
        type: 'scene_image_gen',
        name: '场景生图',
        group: 'image',
        variables: [
            { label: '场景描述', value: '{{description}}' },
            { label: '视觉风格', value: '{{style}}' }
        ]
    },
    {
        type: 'prop_image_gen',
        name: '物品生图',
        group: 'image',
        variables: [
            { label: '物品描述', value: '{{description}}' },
            { label: '视觉风格', value: '{{style}}' }
        ]
    },
    {
        type: 'role_video_gen',
        name: '角色视频生成',
        group: 'video',
        variables: [
            { label: '角色描述', value: '{{description}}' },
            { label: '视觉风格', value: '{{style}}' }
        ]
    },
    {
        type: 'storyboard_video_gen_direct',
        name: '分镜视频生成',
        group: 'video',
        variables: [
            { label: '分镜描述（视频提示词）', value: '{{description}}' },
            { label: '视觉风格', value: '{{style}}' }
        ]
    }
];
