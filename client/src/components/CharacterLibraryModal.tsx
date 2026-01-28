/**
 * 角色库弹窗组件
 * 显示用户的角色素材库
 * 支持搜索、编辑、删除和选择角色
 */
import React, { useState, useEffect } from 'react';
import { Modal, Input, Card, Empty, Spin, message, Image, Button } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, PlusOutlined, PlayCircleOutlined, PictureOutlined } from '@ant-design/icons';
import { characterService } from '../services/characterService';
import type { UserCharacter } from '../types';
import { CachedVideo } from './CachedVideo';
import { CharacterFormModal } from './CharacterFormModal';
import { CachedImage } from './CachedImage';

interface CharacterLibraryModalProps {
  visible: boolean;
  onCancel: () => void;
  onSelect: (character: UserCharacter) => void;
}

export const CharacterLibraryModal: React.FC<CharacterLibraryModalProps> = ({
  visible,
  onCancel,
  onSelect
}) => {
  const [searchText, setSearchText] = useState('');
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [loading, setLoading] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<UserCharacter | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewVideo, setPreviewVideo] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      loadCharacters();
    }
  }, [visible]);

  /**
   * 加载角色列表
   */
  const loadCharacters = async () => {
    setLoading(true);
    try {
      const { list } = await characterService.getLibraryCharacters(1, 100);
      setCharacters(list);
    } catch (error) {
      console.error('加载角色失败:', error);
      message.error('加载角色失败');
    } finally {
      setLoading(false);
    }
  };

  // 过滤角色列表
  const filteredCharacters = characters.filter(c => 
    c.name.includes(searchText) || c.description.includes(searchText)
  );

  /**
   * 编辑角色
   */
  const handleEdit = (e: React.MouseEvent, char: UserCharacter) => {
    e.stopPropagation();
    setEditingCharacter(char);
    setEditModalVisible(true);
  };

  /**
   * 删除角色
   */
  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    Modal.confirm({
      title: '确认删除角色？',
      content: '删除后将无法恢复。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await characterService.deleteLibraryCharacter(id);
          message.success('角色已删除');
          setCharacters(prev => prev.filter(c => c.id !== id));
        } catch (error) {
          console.error('删除角色失败:', error);
          message.error('删除失败');
        }
      }
    });
  };

  const handleAdd = () => {
    setEditingCharacter(null);
    setEditModalVisible(true);
  };

  const handleFormSuccess = () => {
    setEditModalVisible(false);
    loadCharacters();
  };

  const handleImageClick = (e: React.MouseEvent, imageUrl: string) => {
    e.stopPropagation();
    setPreviewImage(imageUrl);
  };

  const handleVideoClick = (e: React.MouseEvent, videoUrl: string) => {
    e.stopPropagation();
    setPreviewVideo(videoUrl);
  };

  return (
    <>
      <Modal
        title="角色素材库"
        open={visible}
        onCancel={onCancel}
        width={1000}
        footer={null}
        className="character-library-modal"
        styles={{
          body: { 
            height: '700px',
            overflow: 'hidden',
            padding: '16px'
          }
        }}
      >
        <div className="flex flex-col gap-4 h-full">
          {/* Header */}
          <div className="flex items-center justify-between gap-4 shrink-0">
            <div  className="w-[350px]">
                <Input 
                prefix={<SearchOutlined className="text-text-secondary" />}
                placeholder="搜索角色名称、描述、ID..." 
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className='h-10'
                />
            </div>
            <Button
              type="primary"
              onClick={handleAdd}
              icon={<PlusOutlined />}
              className="shrink-0"
            >
              添加角色
            </Button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="flex justify-center items-center h-full">
                <Spin size="large" tip="正在加载角色库..." />
              </div>
            ) : filteredCharacters.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full">
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<span className="text-text-secondary">暂无角色</span>}
                />
              </div>
            ) : (
              <div className="grid grid-cols-6 gap-3">
                {filteredCharacters.map(char => (
                  <Card
                    key={char.id}
                    className="glass-card border-border group overflow-hidden hover:border-primary/50 transition-all duration-300 relative"
                    styles={{ body: { padding: 0 } }}
                  >
                    {/* Hover Actions - Top Right */}
                    <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        type="text"
                        size="small"
                        onClick={(e) => handleEdit(e, char)}
                        icon={<EditOutlined />}
                        className="w-7 h-7 flex items-center justify-center bg-black/70 hover:bg-black/90 text-white border-0"
                      />
                      <Button
                        type="text"
                        size="small"
                        onClick={(e) => char.id && handleDelete(e, char.id)}
                        icon={<DeleteOutlined />}
                        className="w-7 h-7 flex items-center justify-center bg-black/70 hover:bg-red-500 text-white border-0"
                      />
                    </div>

                    {/* Image/Video */}
                    <div className="aspect-square bg-bg-element relative overflow-hidden">
                      {char.video ? (
                        <div 
                          className="w-full h-full cursor-zoom-in"
                          onClick={(e) => handleVideoClick(e, char.video!)}
                        >
                          <CachedVideo
                            src={char.video}
                            className="w-full h-full object-cover"
                            muted
                            loop
                            onMouseOver={(e: any) => e.currentTarget.play()}
                            onMouseOut={(e: any) => e.currentTarget.pause()}
                          />
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px] pointer-events-none">
                            <PlayCircleOutlined className="text-4xl text-white drop-shadow-lg" />
                          </div>
                        </div>
                      ) : char.avatar ? (
                        <div 
                          className="w-full h-full cursor-zoom-in"
                          onClick={(e) => handleImageClick(e, char.avatar!)}
                        >
                          <CachedImage
                            src={char.avatar}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-bg-element text-text-secondary">
                          <PictureOutlined className="text-4xl" />
                        </div>
                      )}
                      
                      {/* Hover Overlay with Name and Select Button */}
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/60 to-transparent px-2 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="text-[10px] font-bold text-white mb-1 truncate" title={char.name}>
                          {char.name}
                        </div>
                        <Button
                          type="primary"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelect(char);
                          }}
                          className="w-full h-[30px] text-[12px] font-medium" 
                        >
                          选择
                        </Button>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </Modal>

      <CharacterFormModal
        visible={editModalVisible}
        editingCharacter={editingCharacter}
        onCancel={() => setEditModalVisible(false)}
        onSuccess={handleFormSuccess}
      />

      {/* Image Preview */}
      <Image
        width={200}
        style={{ display: 'none' }}
        src={previewImage || ''}
        preview={{
          visible: !!previewImage,
          onVisibleChange: (visible) => {
            if (!visible) setPreviewImage(null);
          },
          src: previewImage || ''
        }}
      />

      {/* Video Preview Modal */}
      <Modal
        open={!!previewVideo}
        footer={null}
        onCancel={() => setPreviewVideo(null)}
        width={800}
        centered
        destroyOnClose
        className="bg-transparent shadow-none"
        styles={{ body: { padding: 0 }, mask: { backgroundColor: 'rgba(0,0,0,0.5)' } }}
      >
        {previewVideo && (
          <CachedVideo 
            src={previewVideo} 
            controls 
            autoPlay 
            className="w-full max-h-[80vh] object-contain bg-black rounded-lg" 
          />
        )}
      </Modal>
    </>
  );
};
