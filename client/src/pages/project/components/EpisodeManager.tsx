/**
 * 剧集管理弹窗组件
 * 用于管理项目的剧集列表，支持添加、编辑和删除
 */
import React, { useState } from 'react';
import { Modal, List, Button, Input, Popconfirm, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, CloseOutlined } from '@ant-design/icons';
import type { ProjectEpisode } from '../../../types';

interface EpisodeManagerProps {
  visible: boolean;
  onCancel: () => void;
  episodes: ProjectEpisode[];
  onAdd: (name: string) => Promise<any>;
  onUpdate: (id: number, data: { name: string }) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  currentEpisodeId: number | null;
}

export const EpisodeManager: React.FC<EpisodeManagerProps> = ({
  visible,
  onCancel,
  episodes,
  onAdd,
  onUpdate,
  onDelete,
  currentEpisodeId
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [newEpisodeName, setNewEpisodeName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);

  /**
   * 开始编辑剧集名称
   */
  const handleEdit = (episode: ProjectEpisode) => {
    setEditingId(episode.id);
    setEditName(episode.name);
  };

  /**
   * 保存编辑的剧集名称
   */
  const handleSaveEdit = async (id: number) => {
    if (!editName.trim()) {
      message.warning('分集名称不能为空');
      return;
    }
    setLoading(true);
    try {
      await onUpdate(id, { name: editName });
      setEditingId(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 取消编辑
   */
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditName('');
  };

  /**
   * 添加新剧集
   */
  const handleAdd = async () => {
    if (!newEpisodeName.trim()) {
      message.warning('请输入分集名称');
      return;
    }
    setLoading(true);
    try {
      await onAdd(newEpisodeName);
      setNewEpisodeName('');
      setIsAdding(false);
    } finally {
      setLoading(false);
    }
  };

  /**
   * 删除剧集
   */
  const handleDelete = async (id: number) => {
    if (episodes.length <= 1) {
        message.warning('至少保留一个分集');
        return;
    }
    setLoading(true);
    try {
      await onDelete(id);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="分集管理"
      open={visible}
      onCancel={onCancel}
      footer={[
        <Button key="close" onClick={onCancel}>
          关闭
        </Button>
      ]}
    >
      <div className="flex flex-col gap-4">
        <List
          dataSource={episodes}
          renderItem={(item) => (
            <List.Item
              actions={[
                editingId === item.id ? (
                  <>
                    <Button 
                      type="text" 
                      icon={<SaveOutlined />} 
                      onClick={() => handleSaveEdit(item.id)}
                      loading={loading}
                    />
                    <Button 
                      type="text" 
                      icon={<CloseOutlined />} 
                      onClick={handleCancelEdit} 
                    />
                  </>
                ) : (
                  <>
                    <Button 
                      type="text" 
                      icon={<EditOutlined />} 
                      onClick={() => handleEdit(item)} 
                    />
                    <Popconfirm
                      title="确认删除该分集？"
                      description="删除后该分集下的所有分镜都将被删除，且不可恢复。"
                      onConfirm={() => handleDelete(item.id)}
                      okText="确认删除"
                      cancelText="取消"
                      okButtonProps={{ danger: true }}
                      disabled={episodes.length <= 1}
                    >
                      <Button 
                        type="text" 
                        danger 
                        icon={<DeleteOutlined />} 
                        disabled={episodes.length <= 1}
                        loading={loading}
                      />
                    </Popconfirm>
                  </>
                )
              ]}
            >
              {editingId === item.id ? (
                <Input 
                  value={editName} 
                  onChange={(e) => setEditName(e.target.value)} 
                  onPressEnter={() => handleSaveEdit(item.id)}
                  autoFocus
                />
              ) : (
                <div className="flex items-center gap-2">
                  <span>{item.name}</span>
                  {item.id === currentEpisodeId && (
                    <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">当前</span>
                  )}
                </div>
              )}
            </List.Item>
          )}
        />

        {isAdding ? (
          <div className="flex gap-2">
            <Input
              placeholder="请输入分集名称"
              value={newEpisodeName}
              onChange={(e) => setNewEpisodeName(e.target.value)}
              onPressEnter={handleAdd}
              autoFocus
            />
            <Button type="primary" onClick={handleAdd} loading={loading}>确定</Button>
            <Button onClick={() => setIsAdding(false)}>取消</Button>
          </div>
        ) : (
          <Button 
            type="dashed" 
            block 
            icon={<PlusOutlined />} 
            onClick={() => setIsAdding(true)}
          >
            新建分集
          </Button>
        )}
      </div>
    </Modal>
  );
};
