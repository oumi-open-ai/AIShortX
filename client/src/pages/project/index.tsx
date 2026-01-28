import { Undo2, Redo2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button, message, Modal, Spin, Progress, Dropdown, Tooltip } from 'antd';
import { 
  LeftOutlined,
  ExportOutlined,
  SettingOutlined,
  EditOutlined,
  ScanOutlined,
} from '@ant-design/icons';
import { useNavigate, useParams } from 'react-router-dom';
import type { Character } from '../../types/workflow';
import { useProjectWorkflow } from './hooks/useProjectWorkflow';
import { settingsService } from '../../services/settingsService';
import { jianyingDraftService } from '../../services/jianyingDraftService';
import { StepStoryboard } from './components/StepStoryboard';
import { ProjectSettingsModal } from './components/ProjectSettingsModal';
import { EpisodeSidebar } from './components/EpisodeSidebar';
import { useAuthStore } from '../../store/authStore';
import { CachedVideo } from '../../components/CachedVideo';
import { AIModelConfig } from '../../components/AIModelConfig';
import { AppendScriptModal } from '../../components/AppendScriptModal';
import { AnalyzeElementsModal, type AnalyzeElementsModalRef } from '../../components/AnalyzeElementsModal';

const ProjectWorkflow = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const projectId = id ? parseInt(id) : 0;
  const { isAuthenticated, setLoginModalOpen } = useAuthStore();
  const [exporting, setExporting] = useState(false);
  const [showProjectSettings, setShowProjectSettings] = useState(false);
  const [showAppendScript, setShowAppendScript] = useState(false);
  const analyzeElementsRef = useRef<AnalyzeElementsModalRef>(null);
  
  const [exportConfirmVisible, setExportConfirmVisible] = useState(false);
  const [exportSettings, setExportSettings] = useState<{jianyingPath: string} | null>(null);

  // Trimming State
  const [trimmingState, setTrimmingState] = useState({
    visible: false,
    current: 0,
    total: 0,
    processing: false
  });

  const isExistingProject = !!id;

  useEffect(() => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      navigate('/');
    }
  }, [isAuthenticated, navigate, setLoginModalOpen]);

  const {
    loadingProject,
    projectData,
    characters,
    scenes,
    props,
    storyboards,
    previewVideoUrl,
    
    setProjectData,
    setPreviewVideoUrl,
    setStoryboards,
    switchEpisode,
    addEpisode,
    deleteEpisode,
    updateEpisode,
    episodes,
    currentEpisodeId,

    saveProject,
    retryGenerateStoryboard,
    
    // 撤回/重做
    handleUndo,
    handleRedo,
    canUndo,
    canRedo,
    getLastOperation,
    getNextOperation,
    saveCurrentState,
    
    // Characters
    addCharacter,
    deleteCharacter,
    updateCharacter,
    generateCharacterImage,
    
    // Scenes
    addScene,
    updateScene,
    deleteScene,
    generateSceneImage,

    // Props
    addProp,
    updateProp,
    deleteProp,
    generatePropImage,

    // Storyboards
    addStoryboard,
    updateStoryboard,
    updateStoryboardAndSave,
    updateStoryboardMediaAndSave,
    deleteStoryboard,
    moveStoryboard,
    inferStoryboardPrompt,
    generateStoryboardVideo,
    generateStoryboardImage,
  } = useProjectWorkflow();

  const handleUpdateCharacter = (id: string, field: keyof Character, value: any) => {
    updateCharacter(id, field, value);
  };

  const handleExportDraft = async () => {
    try {
      const settings = await settingsService.getSettings();
      
      if (!settings.jianyingPath) {
        message.error('请先在设置页面配置剪映草稿目录');
        return;
      }

      // 统计已生成视频的分镜数量
      const generatedCount = storyboards.filter(sb => sb.status === 'video_generated' && sb.videoUrl).length;
      const totalCount = storyboards.length;

      if (generatedCount === 0) {
        message.warning('还没有分镜生成视频，无法导出');
        return;
      }

      // 如果不是全部生成，弹窗确认
      if (generatedCount < totalCount) {
        Modal.confirm({
          title: '部分分镜未生成视频',
          content: `当前仅 ${generatedCount} 个分镜生成了分镜视频（共 ${totalCount} 个），是否确认导出 ${generatedCount} 个分镜？`,
          okText: '确认导出',
          cancelText: '取消',
          onOk: () => {
            // 继续导出流程
            setExportSettings({ jianyingPath: settings.jianyingPath! });
            setExportConfirmVisible(true);
          }
        });
        return;
      }

      // 全部生成完毕，直接进入导出流程
      setExportSettings({ jianyingPath: settings.jianyingPath! });
      setExportConfirmVisible(true);
    } catch (error: any) {
      console.error('Pre-export check failed:', error);
      message.error(`导出检查失败: ${error.message}`);
    }
  };

  const startExportProcess = async (trim: boolean, jianyingPath: string) => {
    // If coming from modal, close it
    setExportConfirmVisible(false);
    setExporting(true);
    try {
      let processedVideosMap: Record<string, string> | undefined;

      if (trim) {
        // 1. Prepare list
        const validStoryboards = storyboards.filter(
          sb => (sb.status === 'video_generated' && sb.videoUrl) || 
                (sb.highResStatus === 'success' && sb.highResVideoUrl)
        );

        setTrimmingState({
          visible: true,
          current: 0,
          total: validStoryboards.length,
          processing: true
        });

        processedVideosMap = {};
        
        // 2. Process each video
        for (let i = 0; i < validStoryboards.length; i++) {
          const sb = validStoryboards[i];
          setTrimmingState(prev => ({ ...prev, current: i + 1 }));

          const targetVideoUrl = (sb.highResStatus === 'success' && sb.highResVideoUrl) 
            ? sb.highResVideoUrl 
            : sb.videoUrl;
          
          if (targetVideoUrl) {
            let localPath = targetVideoUrl;
            if (targetVideoUrl.startsWith('http') && (window as any).electronAPI) {
               localPath = await (window as any).electronAPI.cacheFile(targetVideoUrl, 'video');
            }
            
            // Trim
            const trimmedPath = await jianyingDraftService.trimVideo(localPath);
            if (trimmedPath) {
              processedVideosMap[sb.id] = trimmedPath;
            }
          }
        }
        
        setTrimmingState(prev => ({ ...prev, processing: false, visible: false }));
      }

      // 3. Create Draft
      const result = await jianyingDraftService.createDraft(
        storyboards,
        projectData.name || '未命名项目',
        jianyingPath,
        processedVideosMap
      );

      if (result.success) {
        message.success(`已导出剪映草稿到: ${result.path}`);
      }
    } catch (error: any) {
      console.error('Export draft failed:', error);
      message.error(`导出失败: ${error.message}`);
    } finally {
      setExporting(false);
      setTrimmingState(prev => ({ ...prev, visible: false, processing: false }));
    }
  };

  const menuItems = [
    ...(isExistingProject ? [{
      key: 'settings',
      label: '项目设置',
      icon: <SettingOutlined />,
      onClick: () => setShowProjectSettings(true),
      disabled: loadingProject
    }] : []),
    ...(isExistingProject ? [{
      key: 'append',
      label: '追加剧本',
      icon: <EditOutlined />,
      onClick: () => setShowAppendScript(true),
      disabled: loadingProject
    }] : []),
    ...(isExistingProject ? [{
      key: 'analyze',
      label: '解析角色、场景、物品',
      icon: <ScanOutlined />,
      onClick: () => analyzeElementsRef.current?.show(),
      disabled: loadingProject || storyboards.length === 0
    }] : []),
    // {
    //   key: 'save',
    //   label: saving ? '保存中...' : '保存草稿',
    //   icon: <SaveOutlined />,
    //   onClick: () => saveProject(),
    //   disabled: loadingProject || saving
    // },
    {
      key: 'export',
      label: exporting ? '正在导出...' : '导出剪映',
      icon: <ExportOutlined />,
      onClick: handleExportDraft,
      disabled: storyboards.length === 0 || !storyboards.some(sb => sb.status === 'video_generated' && sb.videoUrl) || exporting
    }
  ];

  return (
    <div className="h-full flex flex-col bg-bg-base">
      <style>{`
        .project-drawer .ant-drawer-header {
          position: relative !important;
          z-index: 1051 !important;
          -webkit-app-region: no-drag !important;
        }
        .project-drawer .ant-drawer-close {
          position: relative !important;
          z-index: 1052 !important;
          -webkit-app-region: no-drag !important;
          pointer-events: auto !important;
        }
        .project-drawer .ant-drawer-wrapper {
          -webkit-app-region: no-drag !important;
        }
      `}</style>
      
      <div className="flex-1 flex flex-col h-full min-w-0">
        {/* Export Confirmation Modal */}
        <Modal
          title="是否需要自动裁剪？"
          open={exportConfirmVisible}
          onCancel={() => setExportConfirmVisible(false)}
          footer={[
            <Button key="direct" onClick={() => exportSettings && startExportProcess(false, exportSettings.jianyingPath)}>
              直接导出
            </Button>,
            <Button 
              key="trim" 
              type="primary" 
              onClick={() => exportSettings && startExportProcess(true, exportSettings.jianyingPath)}
            >
              裁剪并导出 (推荐)
            </Button>
          ]}
        >
          <div className="flex flex-col gap-4">
            <div className="bg-bg-tertiary p-4 rounded-lg">
               {/* <p className="font-bold mb-2">是否需要自动裁剪？</p> */}
               <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                 <li><span className="text-text-primary font-medium">裁剪并导出</span>：自动删除片头的参考图，只保留正片内容（推荐）。</li>
                 <li><span className="text-text-primary font-medium">直接导出</span>：保留所有内容，包括片头的参考图。</li>
               </ul>
            </div>
          </div>
        </Modal>

        {/* Trimming Progress Modal */}
        <Modal
          title="正在智能裁剪参考图..."
          open={trimmingState.visible}
          footer={null}
          closable={false}
          centered
          maskClosable={false}
        >
          <div className="flex flex-col items-center py-6">
             <Progress 
               type="circle" 
               percent={Math.round((trimmingState.current / trimmingState.total) * 100)} 
               format={() => `${trimmingState.current} / ${trimmingState.total}`}
             />
             <div className="mt-4 text-text-secondary">
               正在处理第 {trimmingState.current} 个视频，共 {trimmingState.total} 个
             </div>
             <div className="mt-2 text-xs text-text-tertiary">
               根据视频长度，这可能需要一些时间，请耐心等待...
             </div>
          </div>
        </Modal>

        {/* Header */}
        <div className="relative flex items-center justify-between mb-0 px-4 pt-3 pb-0 shrink-0">
          {/* Left: Back & Title */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <Button 
              type="text" 
              icon={<LeftOutlined />} 
              className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              onClick={() => navigate('/projects')}
            />
            <div className="flex items-center gap-2 min-w-0 group">
              <span className="text-base text-white/70 truncate" title={projectData.name}>
                {projectData.name || '新建项目'}
              </span>
              {isExistingProject && (
                <Button
                  type="text"
                  size="small"
                  icon={<EditOutlined />}
                  className="text-primary transition-opacity w-6 h-6 flex items-center justify-center shrink-0"
                  onClick={() => setShowProjectSettings(true)}
                  title="编辑项目设置"
                />
              )}
            </div>
            
            {/* Model Config moved here */}
            {!loadingProject && (
               <AIModelConfig className="ml-4 !rounded-full !bg-[#262626] !border-white/10 !text-white/90 hover:!text-white hover:!border-white/20 hover:!bg-[#333] shadow-sm transition-all h-[32px]" />
            )}
          </div>
          
          {/* Center: Tabs - Removed/Empty now */}
          
          {/* Right: Actions */}
          <div className="flex gap-3">
            {/* 撤回/重做按钮 */}
            <div className="flex gap-2">
              <Tooltip title={canUndo ? `撤回: ${getLastOperation()}` : '无可撤回操作'}>
                <Button
                  type="text"
                  icon={<Undo2 size={18} />}
                  className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={handleUndo}
                  disabled={!canUndo || loadingProject}
                />
              </Tooltip>
              <Tooltip title={canRedo ? `重做: ${getNextOperation()}` : '无可重做操作'}>
                <Button
                  type="text"
                  icon={<Redo2 size={18} />}
                  className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                  onClick={handleRedo}
                  disabled={!canRedo || loadingProject}
                />
              </Tooltip>
            </div>
            
            <Dropdown menu={{ items: menuItems }} placement="bottomRight" trigger={['click']}>
              <Button
                type="text"
                icon={<SettingOutlined style={{ fontSize: '20px' }} />}
                className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              />
            </Dropdown>
          </div>
        </div>

        <ProjectSettingsModal
          visible={showProjectSettings}
          onCancel={() => setShowProjectSettings(false)}
          onOk={async (updatedData) => {
            setShowProjectSettings(false);
            
            // 检查哪些字段发生了变化，并保存相应的历史记录
            const oldData = projectData;
            if (updatedData.name !== oldData.name) {
              saveCurrentState('update_project_name', '修改项目名称');
            } else if (updatedData.aspectRatio !== oldData.aspectRatio) {
              saveCurrentState('update_project_ratio', '切换画面比例');
            } else if (updatedData.styleId !== oldData.styleId) {
              saveCurrentState('update_project_style', '切换画面风格');
            }
            
            // 先更新本地状态
            setProjectData(prev => ({ ...prev, ...updatedData }));
            // 使用 projectDataOverride 参数保存更新后的数据，跳过剧本验证
            await saveProject(false, undefined, undefined, updatedData, true);
          }}
          projectData={projectData}
          setProjectData={setProjectData}
        />

        <AppendScriptModal
          visible={showAppendScript}
          onCancel={() => setShowAppendScript(false)}
          onSuccess={async () => {
            // 静默刷新数据（不显示loading状态）
            if (currentEpisodeId) {
              await switchEpisode(currentEpisodeId, true);
            }
            // 数据刷新成功后再关闭弹窗并提示
            setShowAppendScript(false);
            message.success('剧本追加成功');
          }}
          projectId={projectId}
          episodeId={currentEpisodeId || 0}
        />

        <AnalyzeElementsModal
          ref={analyzeElementsRef}
          projectId={projectId}
          episodeId={currentEpisodeId || 0}
          existingCharacters={characters}
          existingScenes={scenes}
          existingProps={props}
          storyboards={storyboards}
          onSuccess={async () => {
            // 刷新数据
            if (currentEpisodeId) {
              await switchEpisode(currentEpisodeId, true);
            }
          }}
        />

        {/* Content Body */}
        <div className="flex-1 flex flex-row min-h-0 overflow-hidden">
          {/* Sidebar */}
          <EpisodeSidebar
            episodes={episodes}
            currentEpisodeId={currentEpisodeId}
            projectId={projectId}
            loading={loadingProject}
            onSelect={switchEpisode}
            onAdd={addEpisode}
            onUpdate={updateEpisode}
            onDelete={deleteEpisode}
          />

          {/* Main Content */}
          <div className="flex-1 min-h-0 overflow-auto custom-scrollbar bg-bg-base">
            {loadingProject ? (
              <div className="h-full flex flex-col items-center justify-center">
                <Spin size="large" tip="正在加载项目..." />
              </div>
            ) : (
              <div className="h-full pb-4">
                <StepStoryboard 
                  projectId={id ? parseInt(id) : undefined}
                  projectName={projectData.name}
                  episodeName={episodes.find(ep => ep.id === currentEpisodeId)?.name}
                  storyboards={storyboards}
                  setStoryboards={setStoryboards}
                  onRetry={retryGenerateStoryboard}
                  characters={characters}
                  scenes={scenes}
                  props={props}
                  updateStoryboard={updateStoryboard}
                  updateStoryboardAndSave={updateStoryboardAndSave}
                  updateStoryboardMediaAndSave={updateStoryboardMediaAndSave}
                  deleteStoryboard={deleteStoryboard}
                  moveStoryboard={moveStoryboard}
                  addStoryboard={addStoryboard}
                  generateStoryboardVideo={generateStoryboardVideo}
                  generateStoryboardImage={generateStoryboardImage}
                  inferStoryboardPrompt={inferStoryboardPrompt}
                  setPreviewVideoUrl={setPreviewVideoUrl}
                  onSave={() => saveProject(true)}
                  aspectRatio={projectData.aspectRatio}
                  updateCharacter={handleUpdateCharacter}
                  generateCharacterImage={generateCharacterImage}
                  deleteCharacter={deleteCharacter}
                  addCharacter={addCharacter}
                  updateScene={updateScene}
                  generateSceneImage={generateSceneImage}
                  deleteScene={deleteScene}
                  addScene={addScene}
                  updateProp={updateProp}
                  generatePropImage={generatePropImage}
                  deleteProp={deleteProp}
                  addProp={addProp}
                  projectScript={episodes.find(ep => ep.id === currentEpisodeId)?.script || ''}
                  episodeId={currentEpisodeId ?? undefined}
                  saveCurrentState={saveCurrentState}
                  onRefreshProject={async () => {
                    if (currentEpisodeId) {
                     await switchEpisode(currentEpisodeId, true);
                    }
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Video Preview Modal */}
      <Modal
        title="预览视频"
        open={!!previewVideoUrl}
        footer={null}
        onCancel={() => setPreviewVideoUrl(null)}
        width={800}
        centered
        destroyOnClose
        className="video-preview-modal"
        bodyStyle={{ padding: 0, backgroundColor: 'black', height: '600px' }}
      >
        {previewVideoUrl && (
          <CachedVideo 
            src={previewVideoUrl} 
            controls 
            autoPlay 
            className="w-full h-full object-contain"
          />
        )}
      </Modal>
    </div>
  );
};

export default ProjectWorkflow;
