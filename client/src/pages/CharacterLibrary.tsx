/**
 * 角色库页面
 * 管理用户的所有角色资产
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Button, Input, Empty, Modal, message, Tag, Spin } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  DeleteOutlined,
  PlayCircleOutlined,
  LeftOutlined,
  PictureOutlined
} from '@ant-design/icons';
import { characterService } from '../services/characterService';
import { useAuthStore } from '../store/authStore';
import type { UserCharacter } from '../types';
import { CachedVideo } from '../components/CachedVideo';
import { CachedAntdImage } from '../components/CachedAntdImage';
import { CharacterFormModal } from '../components/CharacterFormModal';

const CharacterLibrary = () => {
  const navigate = useNavigate();
  const { isAuthenticated, setLoginModalOpen } = useAuthStore();
  const [searchText, setSearchText] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChar, setEditingChar] = useState<UserCharacter | null>(null);
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const observerTarget = useRef<HTMLDivElement>(null);

  const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoginModalOpen(true);
      navigate('/');
    }
  }, [isAuthenticated, navigate, setLoginModalOpen]);

  /**
   * 加载角色列表，支持分页
   */
  const loadCharacters = useCallback(async (pageNum = 1, size = 12, isLoadMore = false) => {
    setLoading(true);
    try {
      const { list, total: totalCount } = await characterService.getLibraryCharacters(pageNum, size);
      
      setCharacters(prev => {
        const newCharacters = isLoadMore ? [...prev, ...list] : list;
        setHasMore(newCharacters.length < totalCount);
        return newCharacters;
      });
      
      setPage(pageNum);
    } catch (error) {
      console.error('加载角色失败:', error);
      message.error('加载角色失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadCharacters(1, pageSize);
    }
  }, [isAuthenticated, loadCharacters, pageSize]);

  /**
   * 无限滚动监听器
   */
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loading) {
          loadCharacters(page + 1, pageSize, true);
        }
      },
      { threshold: 1.0 }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) {
        observer.unobserve(observerTarget.current);
      }
    };
  }, [hasMore, loading, page, pageSize, loadCharacters]);

  const filteredCharacters = characters.filter(c => 
    c.name.includes(searchText) || c.description.includes(searchText)
  );

  /**
   * 打开添加角色弹窗
   */
  const handleAdd = () => {
    setEditingChar(null);
    setIsModalOpen(true);
  };

  /**
   * 打开编辑角色弹窗
   */
  const handleEdit = (char: UserCharacter) => {
    setEditingChar(char);
    setIsModalOpen(true);
  };

  /**
   * 删除角色
   */
  const handleDelete = (id: number) => {
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

  /**
   * 角色表单提交成功后的回调
   */
  const handleFormSuccess = () => {
    setIsModalOpen(false);
    loadCharacters(1, pageSize);
  };

  return (
    <div className="h-full flex flex-col animate-fade-in">
      {/* 头部 - 与设置和项目工作流保持一致 */}
      <div className="flex items-center justify-between mb-6 pb-4 border-b border-border shrink-0">
        <div className="flex items-center gap-4">
          <Button 
            type="text" 
            icon={<LeftOutlined />} 
            className="text-text-secondary hover:text-text-primary bg-bg-element hover:bg-bg-card w-10 h-10 rounded-lg flex items-center justify-center"
            onClick={() => navigate(-1)}
          />
          <div className="flex flex-row items-baseline gap-3">
             <h1 className="text-lg font-bold text-text-primary m-0">角色库</h1>
             <span className="text-xs text-text-secondary">管理您的所有角色资产</span>
          </div>
        </div>
        <Button 
          type="primary" 
          icon={<PlusOutlined />} 
          onClick={handleAdd}
          className="bg-primary border-none hover:opacity-90 shadow-lg shadow-primary/20"
        >
          添加角色
        </Button>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-auto pr-2">
        {/* 搜索 */}
        <div className="mb-8">
          <Input 
            prefix={<SearchOutlined className="text-text-secondary" />}
            placeholder="搜索角色名称、ID或描述..." 
            size="large"
            className="max-w-md text-base"
            onChange={e => setSearchText(e.target.value)}
          />
        </div>

        {/* 网格 */}
        {characters.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-8">
              {filteredCharacters.map(char => (
                <Card
                  key={char.id}
                  hoverable
                  className="glass-card border-border group overflow-hidden hover:border-primary/50 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 hover:-translate-y-1"
                  styles={{ body: { padding: 0 } }}
                >
                  <div className="flex h-40">
                    {/* 左侧: 图片/视频 (固定宽度, 全高) - 宽高比 9:16 相对于高度 */}
                    {/* h-40 是 160px. 160 * 9/16 = 90px */}
                    <div className="w-[90px] shrink-0 relative bg-bg-element border-r border-border overflow-hidden group/media">
                      {/* 优先级: video > avatar */}
                      {char.video ? (
                          <div 
                            className="w-full h-full cursor-pointer"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (char.video) setPreviewVideoUrl(char.video);
                            }}
                          >
                            <CachedVideo
                                src={char.video}
                                className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                                muted
                                loop
                                onMouseOver={(e: any) => e.currentTarget.play()}
                                onMouseOut={(e: any) => e.currentTarget.pause()}
                            />
                             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/media:opacity-100 transition-opacity bg-black/20 backdrop-blur-[1px] pointer-events-none">
                                <PlayCircleOutlined className="text-3xl text-white drop-shadow-lg transform scale-90 group-hover/media:scale-100 transition-transform" />
                             </div>
                          </div>
                      ) : char.avatar ? (
                          <div className="w-full h-full " onClick={e => e.stopPropagation()}>
                         
                             <CachedAntdImage 
                                 alt={char.name} 
                                 src={char.avatar} 
                                 className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500 " 
                                 
                                 preview={{
                                    mask: <div className="text-white text-xs"><PlayCircleOutlined className="mr-1"/>预览</div>
                                 }}
                             />
                          </div>
                      ) : (
                          <div className="w-full h-full flex items-center justify-center bg-bg-element text-text-secondary">
                               <PictureOutlined className="text-2xl" />
                          </div>
                      )}
                    </div>

                    {/* 右侧: 内容 */}
                    <div className="flex-1 flex flex-col min-w-0">
                       <div className="p-3 pb-2 flex justify-between items-start gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="text-base font-bold text-text-primary m-0 truncate" title={char.name}>{char.name}</h3>
                            <div className="mt-1">
                              {char.externalId && (
                                  <Tag 
                                      bordered={false}
                                      className="m-0 text-xs px-1.5 py-0.5"
                                      style={{ 
                                          backgroundColor: 'rgba(34, 197, 94, 0.1)', 
                                          color: '#22c55e',
                                          border: '1px solid rgba(34, 197, 94, 0.2)'
                                      }}
                                  >
                                      {char.externalId}
                                  </Tag>
                              )}
                            </div>
                          </div>
                       </div>

                       <div className="px-3 flex-1 overflow-hidden">
                          <p className="text-text-secondary text-xs line-clamp-2 m-0 opacity-80 leading-relaxed">{char.description}</p>
                       </div>

                       <div className="mt-auto border-t border-border bg-bg-element/30 flex divide-x divide-border">
                          <div 
                             className="flex-1 py-2.5 text-center text-text-secondary hover:text-primary cursor-pointer text-sm transition-colors flex items-center justify-center gap-1 group/action"
                             onClick={(e) => { e.stopPropagation(); handleEdit(char); }}
                          >
                             <EditOutlined className="group-hover/action:scale-110 transition-transform" /> 编辑
                          </div>
                          <div 
                             className="flex-1 py-2.5 text-center text-text-secondary hover:text-red-500 cursor-pointer text-sm transition-colors flex items-center justify-center gap-1 group/action"
                             onClick={(e) => { e.stopPropagation(); if (char.id) handleDelete(char.id); }}
                          >
                             <DeleteOutlined className="group-hover/action:scale-110 transition-transform" /> 删除
                          </div>
                       </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
            
            {/* Infinite Scroll Sentinel / Loading Indicator */}
            <div ref={observerTarget} className="h-20 flex items-center justify-center mt-4">
              {loading && <Spin tip="正在加载更多..." />}
              {!loading && !hasMore && filteredCharacters.length > 0 && filteredCharacters.length > pageSize && (
                <span className="text-text-secondary text-sm">没有更多内容了</span>
              )}
            </div>
          </>
        ) : (
          !loading && (
            <div className="flex flex-col items-center justify-center py-20">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={<span className="text-text-secondary">暂无角色，快去创建一个吧</span>}
              />
            </div>
          )
        )}
        
        {loading && characters.length === 0 && (
           <div className="flex justify-center items-center h-64">
             <Spin size="large" tip="正在加载角色库..." />
           </div>
        )}
      </div>

      <CharacterFormModal
        visible={isModalOpen}
        editingCharacter={editingChar}
        onCancel={() => setIsModalOpen(false)}
        onSuccess={handleFormSuccess}
      />

      {/* Video Preview Modal */}
    <Modal
      open={!!previewVideoUrl}
      footer={null}
      onCancel={() => setPreviewVideoUrl(null)}
      width={800}
      centered
      destroyOnClose
      className="bg-transparent shadow-none"
      styles={{ body: { padding: 0 }, mask: { backgroundColor: 'rgba(0,0,0,0.5)' } }}
    >
      {previewVideoUrl && (
        <CachedVideo 
          src={previewVideoUrl} 
          controls 
          autoPlay 
          className="w-full max-h-[80vh] object-contain bg-black rounded-lg" 
        />
      )}
    </Modal>


  </div>
  );
};

export default CharacterLibrary;
