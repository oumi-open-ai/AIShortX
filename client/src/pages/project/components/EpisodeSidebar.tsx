/**
 * 剧集侧边栏组件
 * 显示剧集列表，支持切换、重命名和删除剧集
 */
import React, { useState } from 'react';
import { Button, Tooltip, Input, Modal, Dropdown } from 'antd';
import type { MenuProps } from 'antd';
import { 
  PlusOutlined, 
  MoreOutlined, 
  EditOutlined, 
  DeleteOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import type { ProjectEpisode } from '../../../types';
import { CreateCom } from '../../../components/CreateCom';

interface EpisodeSidebarProps {
  episodes: ProjectEpisode[];
  currentEpisodeId: number | null;
  projectId: number;
  loading?: boolean;
  onSelect: (id: number) => void;
  onAdd: (name: string) => Promise<any>;
  onUpdate: (id: number, data: { name: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export const EpisodeSidebar: React.FC<EpisodeSidebarProps> = ({
  episodes,
  currentEpisodeId,
  projectId,
  loading = false,
  onSelect,
  onUpdate,
  onDelete
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [createModalVisible, setCreateModalVisible] = useState(false);

  /**
   * 打开创建剧集弹窗
   */
  const handleAdd = () => {
    setCreateModalVisible(true);
  };

  /**
   * 开始编辑剧集名称
   */
  const handleEditStart = (episode: ProjectEpisode) => {
    setEditingId(episode.id);
    setEditName(episode.name);
  };

  /**
   * 保存编辑的剧集名称
   */
  const handleEditSave = async () => {
    if (editingId && editName.trim()) {
      try {
        await onUpdate(editingId, { name: editName });
      } catch (error) {
        console.error('Failed to update episode:', error);
      }
    }
    setEditingId(null);
    setEditName('');
  };

  /**
   * 取消编辑
   */
  const handleEditCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  /**
   * 确认删除剧集
   */
  const handleDeleteConfirm = (id: number) => {
    Modal.confirm({
      title: '确认删除分集',
      icon: <ExclamationCircleOutlined />,
      content: '删除后无法恢复，且该分集下的所有分镜都将被删除。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await onDelete(id);
        } catch (error) {
          console.error('Failed to delete episode:', error);
        }
      },
    });
  };

  /**
   * 获取剧集操作菜单项
   */
  const getMenuItems = (episode: ProjectEpisode): MenuProps['items'] => [
    {
      key: 'rename',
      label: '重命名',
      icon: <EditOutlined />,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        handleEditStart(episode);
      },
    },
    {
      key: 'delete',
      label: '删除',
      icon: <DeleteOutlined />,
      danger: true,
      disabled: episodes.length <= 1,
      onClick: (e) => {
        e.domEvent.stopPropagation();
        handleDeleteConfirm(episode.id);
      },
    },
  ];

  return (
    <div className="flex flex-col bg-bg-card w-40 shrink-0 rounded-lg overflow-hidden ml-4 my-4 h-[calc(100%-32px)]">
      <div className="p-4 pl-5 flex items-center justify-between shrink-0">
        <span className="text-lg font-bold text-white/90">剧集</span>
        <Tooltip title="新建分集">
          <Button
            type="text"
            size="small"
            icon={<PlusOutlined />}
            onClick={handleAdd}
            className="text-white/60 hover:text-white hover:bg-white/10"
          />
        </Tooltip>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar px-2 pb-4 space-y-2">
        {episodes.map((episode) => (
          <div key={episode.id} className="relative group">
            {editingId === episode.id ? (
              <Input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleEditSave}
                onPressEnter={handleEditSave}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') handleEditCancel();
                }}
                className="bg-[#1f1f1f] border-primary text-white text-sm py-1.5 px-3 rounded-lg h-[38px]"
              />
            ) : (
              <div
                onClick={() => !loading && onSelect(episode.id)}
                className={`
                  flex items-center justify-between px-3 py-2 rounded-lg transition-all duration-200 h-[38px]
                  ${loading ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
                  ${currentEpisodeId === episode.id 
                    ? 'bg-[#1f1f1f] text-primary border border-primary/30 shadow-[0_0_10px_rgba(var(--primary-rgb),0.1)]' 
                    : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                  }
                `}
              >
                <span className="truncate text-base font-medium flex-1 mr-2">
                  {episode.name}
                </span>
                
                <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <Dropdown 
                    menu={{ items: getMenuItems(episode) }} 
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined className="text-xs" />}
                      className={`
                        w-6 h-6 flex items-center justify-center p-0
                        ${currentEpisodeId === episode.id ? 'text-primary hover:bg-primary/10' : 'text-white/60 hover:text-white hover:bg-white/10'}
                      `}
                      onClick={(e) => e.stopPropagation()}
                      disabled={loading}
                    />
                  </Dropdown>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <CreateCom
        visible={createModalVisible}
        onCancel={() => setCreateModalVisible(false)}
        onSuccess={async (result) => {
          setCreateModalVisible(false);
          // Reload episodes or handle success
          if (result.episodeId) {
            onSelect(result.episodeId);
          }
        }}
        type="episode"
        projectId={projectId}
      />
    </div>
  );
};
