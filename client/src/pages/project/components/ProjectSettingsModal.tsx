/**
 * 项目设置弹窗组件
 * 用于配置项目名称、画面比例和视觉风格
 */
import React, { useEffect, useState } from 'react';
import { Modal, Tag, message, Input } from 'antd';
import { PictureOutlined } from '@ant-design/icons';
import type { ProjectData } from '../../../types/workflow';
import { styleService } from '../../../services/styleService';
import type { Style } from '../../../types';
import { StyleManagement } from '../../../components/StyleManagement';
import { CachedImage } from '../../../components/CachedImage';

interface ProjectSettingsModalProps {
  visible: boolean;
  onCancel: () => void;
  onOk: (updatedData: Partial<ProjectData>) => void;
  projectData: ProjectData;
  setProjectData: React.Dispatch<React.SetStateAction<ProjectData>>;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  visible,
  onCancel,
  onOk,
  projectData,
  setProjectData,
}) => {
  const [styles, setStyles] = useState<Style[]>([]);
  const [localProjectName, setLocalProjectName] = useState('');

  useEffect(() => {
    if (visible) {
      loadStyles();
      setLocalProjectName(projectData.name || '');
    }
  }, [visible, projectData.name]);

  /**
   * 加载风格列表
   */
  const loadStyles = async () => {
    try {
      const data = await styleService.getStyles();
      setStyles(data || []);
    } catch (error) {
      console.error('Failed to load styles:', error);
      message.error('加载风格列表失败');
    }
  };

  /**
   * 切换选中的风格
   */
  const handleStyleChange = (styleId: number) => {
    const selectedStyle = styles.find(s => s.id === styleId);
    setProjectData(prev => ({
      ...prev,
      styleId: styleId,
      visualStyle: selectedStyle ? selectedStyle.name : ''
    }));
  };

  /**
   * 确认保存设置
   */
  const handleOk = () => {
    const updatedData = { 
      name: localProjectName,
      aspectRatio: projectData.aspectRatio,
      styleId: projectData.styleId,
      visualStyle: projectData.visualStyle
    };
    setProjectData(prev => ({ ...prev, ...updatedData }));
    onOk(updatedData);
  };

  /**
   * 取消并重置表单
   */
  const handleCancel = () => {
    setLocalProjectName(projectData.name || '');
    onCancel();
  };

  return (
    <Modal
      title="项目设置"
      open={visible}
      onCancel={handleCancel}
      onOk={handleOk}
      width={600}
      okText="确定"
      cancelText="取消"
    >
      <div className="flex flex-col gap-4 py-2">
        {/* Project Name */}
        <div>
          <div className="text-text-secondary mb-2">
            项目名称
          </div>
          <Input
            value={localProjectName}
            onChange={(e) => setLocalProjectName(e.target.value)}
            placeholder="请输入项目名称"
            className="bg-bg-element border-border text-text-primary"
            maxLength={50}
          />
        </div>

        {/* Aspect Ratio */}
        <div>
          <div className="text-text-secondary mb-2 flex items-center gap-2">
            画面比例
          </div>
          <div className="grid grid-cols-2 gap-4 w-[340px]">
            {[
              { value: '16:9', label: '横屏', width: 24, height: 13.5 },
              { value: '9:16', label: '竖屏', width: 13.5, height: 24 },
            ].map((ratio) => (
              <div
                key={ratio.value}
                onClick={() => setProjectData(prev => ({ ...prev, aspectRatio: ratio.value as any }))}
                className={`
                  cursor-pointer rounded-lg h-[50px] flex flex-row items-center justify-center gap-3 border transition-all
                  ${projectData.aspectRatio === ratio.value 
                    ? 'border-primary bg-primary/5 text-primary' 
                    : 'border-border bg-bg-element hover:border-primary/50 text-text-secondary'}
                `}
              >
                <div 
                  className="border-[1.5px] rounded-[1px]"
                  style={{
                    width: `${ratio.width}px`,
                    height: `${ratio.height}px`,
                    borderColor: 'currentColor'
                  }}
                />
                <span className="text-sm font-medium">{ratio.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Visual Style */}
        <div>
          <div className="text-text-secondary mb-2 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PictureOutlined />
              画面风格
            </div>
            <StyleManagement 
              onStyleCreated={(newStyle) => {
                loadStyles();
                handleStyleChange(newStyle.id);
              }}
              onStyleUpdated={loadStyles}
            />
          </div>
          <div className="max-h-[220px] overflow-y-auto pr-2 custom-scrollbar">
            <div className="grid grid-cols-5 gap-3">
              {styles.map(style => (
                <div 
                  key={style.id}
                  className={`relative cursor-pointer group flex flex-col gap-2 transition-all duration-300`}
                  onClick={() => handleStyleChange(style.id)}
                >
                  <div className={`aspect-[3/4] relative overflow-hidden rounded-xl transition-all duration-300 ${projectData.styleId === style.id ? 'ring-2 ring-primary ring-offset-2 ring-offset-[#1f1f1f] shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)]' : 'ring-1 ring-white/10 hover:ring-white/30'}`}>
                    {style.imageUrl ? (
                      <CachedImage src={style.imageUrl} alt={style.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-white/5 text-text-secondary">
                        <PictureOutlined className="text-2xl opacity-50" />
                      </div>
                    )}
                    
                    {/* Selected Overlay - Checkmark */}
                    {projectData.styleId === style.id && (
                      <div className="absolute inset-0 bg-primary/10 flex items-center justify-center animate-fade-in">
                        <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg scale-100 animate-bounce-short">
                          <svg viewBox="0 0 24 24" fill="none" className="w-5 h-5 text-white" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="20 6 9 17 4 12"></polyline>
                          </svg>
                        </div>
                      </div>
                    )}

                    {/* My Style Label */}
                    {style.userId !== 0 && (
                      <div className="absolute top-1 left-1 z-10">
                        <Tag color="cyan" className="mr-0 scale-75 origin-top-left shadow-md border-none font-bold">我的</Tag>
                      </div>
                    )}
                  </div>
                  
                  <div className={`text-center text-xs transition-colors px-1 truncate ${projectData.styleId === style.id ? 'text-primary font-bold' : 'text-text-secondary group-hover:text-text-primary'}`}>
                    {style.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
