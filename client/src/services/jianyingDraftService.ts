/**
 * 剪映草稿服务
 * 用于创建和导出剪映草稿文件
 */
import type { StoryboardFrame } from '../types/workflow';

/**
 * 生成UUID
 * @returns UUID字符串
 */
function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 获取视频元数据
 * @param path - 视频文件路径
 * @returns 包含时长、宽度和高度的对象
 */
async function getVideoMetadata(path: string): Promise<{ duration: number; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      resolve({
        duration: video.duration, // 秒
        width: video.videoWidth,
        height: video.videoHeight
      });
      video.remove();
    };
    video.onerror = () => {
      reject(new Error(`Failed to load video: ${path}`));
      video.remove();
    };
    // 在 Electron 中处理本地文件，需要使用 file:// 协议
    // Electron renderer 中设置了 webSecurity: false，可以通过 file:// 协议访问本地文件
    let src = path;
    if (!path.startsWith('http') && !path.startsWith('file:')) {
      // 将 Windows 路径的反斜杠转换为正斜杠
      const normalizedPath = path.replace(/\\/g, '/');
      // 确保以 file:/// 开头
      src = `file:///${normalizedPath}`;
    }
    video.src = src;
  });
}

/**
 * 剪映草稿元信息接口
 */
interface DraftMetaInfo {
  /** 草稿云端最后修改时间 */
  draft_cloud_last_modify_time: number;
  /** 草稿云端购买信息 */
  draft_cloud_purchase_info: string;
  /** 草稿封面 */
  draft_cover: string;
  /** 草稿文件夹路径 */
  draft_fold_path: string;
  /** 草稿ID */
  draft_id: string;
  /** 是否为AI短视频 */
  draft_is_ai_shorts: boolean;
  /** 是否不可见 */
  draft_is_invisible: boolean;
  /** 草稿JSON文件名 */
  draft_json_file: string;
  /** 草稿名称 */
  draft_name: string;
  /** 草稿新版本 */
  draft_new_version: string;
  /** 草稿根路径 */
  draft_root_path: string;
  /** 草稿时间线素材大小 */
  draft_timeline_materials_size: number;
  /** 草稿类型 */
  draft_type: string;
  /** 草稿云端完成时间 */
  tm_draft_cloud_completed: string;
  /** 草稿云端修改时间 */
  tm_draft_cloud_modified: number;
  /** 草稿创建时间 */
  tm_draft_create: number;
  /** 草稿修改时间 */
  tm_draft_modified: number;
  /** 草稿时长 */
  tm_duration: number;
}

/**
 * 确保视频已缓存到本地
 * @param url - 视频URL
 * @returns 本地文件路径
 */
async function ensureCachedPath(url: string): Promise<string> {
  if (!url) return '';
  if (!url.startsWith('http')) return url;

  if ((window as any).electronAPI) {
    try {
      // 使用 cacheFile 确保视频已下载并返回本地路径
      // 如果文件不存在会等待下载完成
      const path = await (window as any).electronAPI.cacheFile(url, 'video');
      return path;
    } catch (e) {
      console.error('Failed to cache video for draft:', e);
      return url;
    }
  }
  return url;
}

/**
 * 复制文件
 * @param sourcePath - 源文件路径
 * @param destPath - 目标文件路径
 * @returns 是否复制成功
 */
async function copyFile(sourcePath: string, destPath: string): Promise<boolean> {
    if ((window as any).electronAPI) {
        try {
            const result = await (window as any).electronAPI.copyFile(sourcePath, destPath);
            return result.success;
        } catch (e) {
            console.error('Failed to copy file:', e);
            return false;
        }
    }
    return false;
}

/**
 * 剪映草稿服务
 */
export const jianyingDraftService = {
  /**
   * 裁剪视频白边
   * 暴露给外部调用，方便控制进度条
   * @param inputPath - 输入视频路径
   * @returns 处理后的视频路径
   */
  async trimVideo(inputPath: string): Promise<string> {
    if ((window as any).electronAPI) {
      try {
        const result = await (window as any).electronAPI.trimVideoWhite(inputPath);
        if (result.success && result.path) {
          return result.path;
        } else {
          console.warn('Trim failed or no trim needed:', result.error);
          return inputPath;
        }
      } catch (e) {
        console.error('Failed to trim video:', e);
        return inputPath;
      }
    }
    return inputPath;
  },

  /**
   * 创建剪映草稿
   * @param storyboards - 分镜列表
   * @param projectName - 项目名称
   * @param outputDir - 输出目录
   * @param processedVideosMap - 已处理视频映射表（可选）
   * @returns 创建结果，包含成功状态和草稿路径
   */
  async createDraft(storyboards: StoryboardFrame[], projectName: string, outputDir: string, processedVideosMap?: Record<string, string>) {
    try {
      // 过滤有效的分镜（存在普通视频或高清视频）
      const validStoryboards = storyboards.filter(
        sb => (sb.status === 'video_generated' && sb.videoUrl) || 
              (sb.highResStatus === 'success' && sb.highResVideoUrl)
      );


      if (validStoryboards.length === 0) {
        throw new Error('没有可用的视频分镜');
      }

      const draftId = generateUUID().toUpperCase();
      // 清理文件夹名称中的非法字符
      const safeProjectName = projectName.replace(/[\\/:*?"<>|]/g, '_');
      const draftFolderName = `${safeProjectName}_${draftId.slice(0, 8)}`;
      const draftPath = `${outputDir}\\${draftFolderName}`; // 假设是 Windows 环境

      // 在草稿目录中创建素材文件夹
      // 剪映不强制要求素材在特定子文件夹中
      // 但将它们放在 'materials' 文件夹中更整洁
      const materialsPath = `${draftPath}\\materials`;

      // 1. 准备素材和片段
      const materials: any[] = [];
      const tracks: any[] = [];
      const videoTrackSegments: any[] = [];

      let currentTime = 0; // 微秒

      for (const sb of validStoryboards) {
        // 优先使用高清视频
        const targetVideoUrl = (sb.highResStatus === 'success' && sb.highResVideoUrl) 
          ? sb.highResVideoUrl 
          : sb.videoUrl;

        if (!targetVideoUrl) continue;

        try {
          // 确保有本地路径供剪映使用
          let localPath = await ensureCachedPath(targetVideoUrl);

          // 如果提供了已处理（裁剪）的路径，使用它
          if (processedVideosMap && processedVideosMap[sb.id]) {
            localPath = processedVideosMap[sb.id];
            console.log(`Using processed video for storyboard ${sb.id}: ${localPath}`);
          }
          
          // 复制到草稿素材文件夹
          // 获取扩展名
          const ext = localPath.split('.').pop() || 'mp4';
          const newFileName = `${sb.id}_${generateUUID().slice(0, 8)}.${ext}`;
          const newFilePath = `${materialsPath}\\${newFileName}`;
          
          // 复制文件
          await copyFile(localPath, newFilePath);
          
          // 在草稿中使用新路径
          // 从本地路径获取元数据（如果缓存失败则从远程获取，但本地对剪映更好）
          // 注意：getVideoMetadata 可能需要调整以正确处理本地路径
          // Electron 的 cacheFile 返回绝对路径
          // 需要确保 getVideoMetadata 可以读取它
          // 在 Electron renderer 中，<video> 标签需要 file:// 协议
          const metadataUrl = localPath.startsWith('http') ? localPath : `file:///${localPath.replace(/\\/g, '/')}`;
          const metadata = await getVideoMetadata(metadataUrl);
          
          const durationUs = Math.round(metadata.duration * 1000000);

          const materialId = generateUUID();

          // 视频素材
          const videoMaterial = {
            "audio_fade": null,
            "category_id": "",
            "category_name": "local",
            "check_flag": 63487,
            "crop": {
              "lower_left_x": 0.0,
              "lower_left_y": 1.0,
              "lower_right_x": 1.0,
              "lower_right_y": 1.0,
              "upper_left_x": 0.0,
              "upper_left_y": 0.0,
              "upper_right_x": 1.0,
              "upper_right_y": 0.0
            },
            "crop_ratio": "free",
            "crop_scale": 1.0,
            "duration": durationUs,
            "height": metadata.height,
            "id": materialId,
            "local_material_id": materialId, // 通常与 ID 相同或派生
            "material_id": materialId,
            "material_name": sb.id, // 使用分镜 ID 或索引作为名称
            "media_path": "",
            "path": newFilePath, // 使用草稿文件夹中的复制路径
            "type": "video",
            "width": metadata.width
          };
          materials.push(videoMaterial);

          // 视频片段
          const segmentId = generateUUID();
          const segment = {
            "cartoon": false,
            "clip": {
              "alpha": 1.0,
              "flip": {
                "horizontal": false,
                "vertical": false
              },
              "rotation": 0.0,
              "scale": {
                "x": 1.0,
                "y": 1.0
              },
              "transform": {
                "x": 0.0,
                "y": 0.0
              }
            },
            "common_keyframes": [],
            "enable_adjust": true,
            "enable_color_curves": true,
            "enable_color_wheels": true,
            "enable_lut": true,
            "enable_smart_color_adjust": false,
            "extra_material_refs": [
              materialId
            ],
            "group_id": "",
            "hdr_settings": {
              "intensity": 1.0,
              "mode": 1,
              "nits": 1000
            },
            "id": segmentId,
            "intensifies_audio": false,
            "is_tone_modify": false,
            "keyframe_refs": [],
            "last_modified_platform": {
              "app_id": 3704,
              "app_source": "lv",
              "app_version": "5.9.0",
              "os": "windows"
            },
            "material_id": materialId,
            "render_index": 0,
            "reverse": false,
            "source_timerange": {
              "duration": durationUs,
              "start": 0
            },
            "speed": 1.0,
            "target_timerange": {
              "duration": durationUs,
              "start": currentTime
            },
            "template_id": "",
            "template_scene": "default",
            "track_attribute": 0,
            "track_render_index": 0,
            "visible": true,
            "volume": 1.0
          };

          videoTrackSegments.push(segment);
          currentTime += durationUs;

        } catch (err) {
          console.error(`Failed to process video ${sb.videoUrl}`, err);
        }
      }

      // 视频轨道
      const videoTrackId = generateUUID();
      tracks.push({
        "attribute": 0,
        "flag": 0,
        "id": videoTrackId,
        "segments": videoTrackSegments,
        "type": "video"
      });

      // 2. 构建 draft_content.json
      const draftContent = {
        "canvas_config": {
          "height": 1080,
          "ratio": "original",
          "width": 1920
        },
        "color_space": 0,
        "config": {
          "adjust_max_index": 1,
          "attachment_info": [],
          "combination_max_index": 1,
          "export_range": null,
          "extract_audio_last_index": 1,
          "lyrics_recognition_id": "",
          "lyrics_sync": true,
          "lyrics_taskinfo": [],
          "maintrack_adsorb": true,
          "material_save_mode": 0,
          "multi_language_current": "none",
          "multi_language_list": [],
          "multi_language_main": "none",
          "multi_language_mode": "none",
          "original_sound_last_index": 1,
          "record_audio_last_index": 1,
          "sticker_max_index": 1,
          "subtitle_keywords_config": null,
          "subtitle_recognition_id": "",
          "subtitle_sync": true,
          "subtitle_taskinfo": [],
          "system_font_list": [],
          "video_mute": false,
          "zoom_info_params": null
        },
        "cover": null,
        "create_time": Date.now(), // Unix 时间戳（毫秒）
        "duration": currentTime,
        "extra_info": null,
        "fps": 30.0,
        "free_render_index_mode_on": false,
        "group_container": null,
        "id": draftId,
        "keyframe_graph_list": [],
        "keyframes": {
          "adjusts": [],
          "audios": [],
          "effects": [],
          "filters": [],
          "handwrites": [],
          "stickers": [],
          "texts": [],
          "videos": []
        },
        "last_modified_platform": {
          "app_id": 3704,
          "app_source": "lv",
          "app_version": "5.9.0",
          "os": "windows"
        },
        "materials": {
          "ai_translates": [],
          "audio_balances": [],
          "audio_effects": [],
          "audio_fades": [],
          "audio_track_indexes": [],
          "audios": [],
          "beats": [],
          "canvases": [],
          "chromas": [],
          "color_curves": [],
          "digital_humans": [],
          "drafts": [],
          "effects": [],
          "flowers": [],
          "green_screens": [],
          "handwrites": [],
          "hsl": [],
          "images": [],
          "log_color_wheels": [],
          "loudnesses": [],
          "manual_deformations": [],
          "masks": [],
          "material_animations": [],
          "material_colors": [],
          "multi_language_refs": [],
          "placeholders": [],
          "plugin_effects": [],
          "primary_color_wheels": [],
          "realtime_denoises": [],
          "shapes": [],
          "smart_crops": [],
          "smart_relights": [],
          "sound_channel_mappings": [],
          "speeds": [],
          "stickers": [],
          "tail_leaders": [],
          "text_templates": [],
          "texts": [],
          "time_marks": [],
          "transitions": [],
          "video_effects": [],
          "video_trackings": [],
          "videos": materials, // 我们的视频素材
          "vocal_beautifys": [],
          "vocal_separations": []
        },
        "mutable_config": null,
        "name": "",
        "new_version": "110.0.0",
        "relationships": [],
        "render_index_track_mode_on": false,
        "retouch_cover": null,
        "source": "default",
        "static_cover_image_path": "",
        "time_marks": null,
        "tracks": tracks,
        "update_time": 0,
        "version": 360000
      };

      // 3. 构建 draft_meta_info.json
      const timestamp = Date.now() * 1000; // 微秒
      // Date.now() 返回毫秒，乘以 1000 得到微秒

      const draftMeta: DraftMetaInfo = {
        "draft_cloud_last_modify_time": 0,
        "draft_cloud_purchase_info": "",
        "draft_cover": "",
        "draft_fold_path": draftPath, // 注意：这可能需要是文件夹名称或完整路径，通常是本地的完整路径
        "draft_id": draftId,
        "draft_is_ai_shorts": false,
        "draft_is_invisible": false,
        "draft_json_file": "draft_content.json",
        "draft_name": projectName,
        "draft_new_version": "",
        "draft_root_path": outputDir, // 父目录
        "draft_timeline_materials_size": 0, // 可以为 0
        "draft_type": "",
        "tm_draft_cloud_completed": "",
        "tm_draft_cloud_modified": 0,
        "tm_draft_create": timestamp,
        "tm_draft_modified": timestamp,
        "tm_duration": currentTime
      };

      // 4. 通过 Electron IPC 保存
      const result = await (window as any).electronAPI.saveDraft(draftPath, draftContent, draftMeta);

      if (result.success) {
        return { success: true, path: draftPath };
      } else {
        throw new Error(result.error);
      }

    } catch (error: any) {
      console.error('Create draft error:', error);
      throw error;
    }
  }
};
