/**
 * 角色表单弹窗组件
 * 用于添加和编辑角色库中的角色
 * 支持上传角色视频和图片
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Upload, message, Button } from 'antd';
import type { UploadFile } from 'antd/es/upload/interface';
import { VideoCameraOutlined, PictureOutlined, CloseCircleFilled } from '@ant-design/icons';
import { characterService } from '../services/characterService';

const { Dragger } = Upload;
const { TextArea } = Input;

interface CharacterFormModalProps {
  visible: boolean;
  editingCharacter?: any;
  onCancel: () => void;
  onSuccess: () => void;
}

export const CharacterFormModal: React.FC<CharacterFormModalProps> = ({
  visible,
  editingCharacter,
  onCancel,
  onSuccess
}) => {
  const [form] = Form.useForm();
  const [videoFileList, setVideoFileList] = useState<UploadFile[]>([]);
  const [imageFileList, setImageFileList] = useState<UploadFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (visible && editingCharacter) {
      form.setFieldsValue(editingCharacter);
      
      if (editingCharacter.video) {
        setVideoFileList([{
          uid: '-1',
          name: 'Video',
          status: 'done',
          url: editingCharacter.video,
        }]);
      } else {
        setVideoFileList([]);
      }

      if (editingCharacter.avatar) {
        setImageFileList([{
          uid: '-2',
          name: 'Image',
          status: 'done',
          url: editingCharacter.avatar,
        }]);
      } else {
        setImageFileList([]);
      }
    } else if (visible) {
      form.resetFields();
      setVideoFileList([]);
      setImageFileList([]);
    }
  }, [visible, editingCharacter, form]);

  /**
   * 自定义上传请求
   * 使用characterService上传文件
   */
  const handleCustomRequest = async (options: any) => {
    const { onSuccess, onError, file } = options;
    try {
      setUploading(true);
      const url = await characterService.uploadFile(file);
      onSuccess(url);
    } catch (err) {
      console.error('上传失败:', err);
      onError(err);
      message.error('文件上传失败');
    } finally {
      setUploading(false);
    }
  };

  /**
   * 处理文件上传状态变化
   * @param info - 上传信息
   * @param type - 文件类型（video或image）
   */
  const handleUploadChange = (info: any, type: 'video' | 'image') => {
    let newFileList = [...info.fileList];
    newFileList = newFileList.slice(-1);
    
    if (type === 'video') {
      // 立即更新文件列表以显示预览
      if (newFileList.length > 0 && newFileList[0].originFileObj) {
        const localUrl = URL.createObjectURL(newFileList[0].originFileObj);
        newFileList[0].thumbUrl = localUrl;
      }
      setVideoFileList(newFileList);
      
      if (info.file.status === 'done') {
        const url = info.file.response;
        form.setFieldValue('video', url);
        message.success('视频上传成功');
      } else if (info.file.status === 'removed') {
        form.setFieldValue('video', null);
      }
    } else {
      // 立即更新文件列表以显示预览
      if (newFileList.length > 0 && newFileList[0].originFileObj) {
        const localUrl = URL.createObjectURL(newFileList[0].originFileObj);
        newFileList[0].thumbUrl = localUrl;
      }
      setImageFileList(newFileList);
      
      if (info.file.status === 'done') {
        const url = info.file.response;
        form.setFieldValue('avatar', url);
        message.success('图片上传成功');
      } else if (info.file.status === 'removed') {
        form.setFieldValue('avatar', null);
      }
    }
  };

  /**
   * 提交表单
   * 验证并保存角色信息
   */
  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      
      const hasVideo = videoFileList.length > 0;
      const hasImage = imageFileList.length > 0;

      if (!hasVideo && !hasImage) {
        message.error('请至少上传一个角色视频或角色图片');
        return;
      }

      setLoading(true);

      const characterData = {
        ...values,
        avatar: imageFileList.length === 0 ? null : (imageFileList[0].response || imageFileList[0].url || values.avatar),
        video: videoFileList.length === 0 ? null : (videoFileList[0].response || videoFileList[0].url || values.video),
        source: 'upload',
      };

      if (editingCharacter && editingCharacter.id) {
        await characterService.updateLibraryCharacter(editingCharacter.id, characterData);
        message.success('角色更新成功');
      } else {
        await characterService.createLibraryCharacter(characterData);
        message.success('角色添加成功');
      }

      onSuccess();
    } catch (error) {
      console.error('保存角色失败:', error);
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Form validation error
        return;
      }
      message.error('保存失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title={editingCharacter ? "编辑角色" : "添加角色"}
      open={visible}
      onOk={handleOk}
      onCancel={onCancel}
      width={600}
      okText="确认"
      cancelText="取消"
      confirmLoading={loading}
      okButtonProps={{ disabled: uploading }}
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
      >
        <Form.Item
          name="name"
          label={<span className="text-text-secondary">角色名称</span>}
          rules={[{ required: true, message: '请输入角色名称' }]}
        >
          <Input placeholder="例如：陆霆" />
        </Form.Item>
        
       

        <Form.Item
          name="description"
          label={<span className="text-text-secondary">外貌/特征描述</span>}
          rules={[{ required: true, message: '请输入描述' }]}
        >
          <TextArea 
            rows={4} 
            placeholder="例如：霸道总裁气质，黑色西装，冷峻面容..." 
          />
        </Form.Item>
        
         <Form.Item
          name="externalId"
          label={<span className="text-text-secondary">Sora角色ID（可选）</span>}
          normalize={(value) => value?.replace(/@/g, '')}
        >
          <Input placeholder="请输入Sora生成的角色ID（可选）" />
        </Form.Item>

        <div className="grid grid-cols-2 gap-4">
          <Form.Item
            name="video"
            label={<span className="text-text-secondary">角色视频 (优先使用)</span>}
            className="mb-0"
          >
            <div className="relative w-full aspect-video">
              <Dragger 
                customRequest={(opts) => handleCustomRequest(opts)}
                onChange={(info) => handleUploadChange(info, 'video')}
                maxCount={1}
                accept="video/*"
                showUploadList={false}
                className={videoFileList.length > 0 ? 'hidden' : 'h-full'}
                style={{ height: '100%', padding: 0 }}
              >
                <div className="h-full flex flex-col items-center justify-center">
                  <p className="ant-upload-drag-icon">
                    <VideoCameraOutlined className="text-text-secondary " style={{ color: 'var(--color-primary)' }}  />
                  </p>
                  <p className="ant-upload-text text-sm text-text-secondary">上传视频</p>
                </div>
              </Dragger>
              
              {videoFileList.length > 0 && (
                <div className="absolute inset-0 bg-bg-element rounded-lg overflow-hidden border border-border">
                  {videoFileList[0].status === 'uploading' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      <span className="text-sm text-text-secondary">上传中...</span>
                    </div>
                  ) : (
                    <>
                      <video
                        src={videoFileList[0].response || videoFileList[0].url || videoFileList[0].thumbUrl}
                        className="w-full h-full object-cover"
                        controls
                      />
                      <Button
                        type="primary"
                        danger
                        shape="circle"
                        size="small"
                        icon={<CloseCircleFilled />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoFileList([]);
                          form.setFieldValue('video', null);
                        }}
                        className="absolute top-2 right-2 z-10"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </Form.Item>

          <Form.Item
            name="avatar"
            label={<span className="text-text-secondary">角色图片</span>}
            className="mb-0"
          >
            <div className="relative w-full aspect-video">
              <Dragger 
                customRequest={(opts) => handleCustomRequest(opts)}
                onChange={(info) => handleUploadChange(info, 'image')}
                maxCount={1}
                accept="image/*"
                showUploadList={false}
                className={imageFileList.length > 0 ? 'hidden' : 'h-full'}
                style={{ height: '100%', padding: 0 }}
              >
                <div className="h-full flex flex-col items-center justify-center">
                  <p className="ant-upload-drag-icon">
                    <PictureOutlined className="text-text-secondary" style={{ color: 'var(--color-primary)' }} />
                  </p>
                  <p className="ant-upload-text text-sm text-text-secondary">上传图片</p>
                </div>
              </Dragger>
              
              {imageFileList.length > 0 && (
                <div className="absolute inset-0 bg-bg-element rounded-lg overflow-hidden border border-border">
                  {imageFileList[0].status === 'uploading' ? (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                      <span className="text-sm text-text-secondary">上传中...</span>
                    </div>
                  ) : (
                    <>
                      <img
                        src={imageFileList[0].response || imageFileList[0].url || imageFileList[0].thumbUrl}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                      <Button
                        type="primary"
                        danger
                        shape="circle"
                        size="small"
                        icon={<CloseCircleFilled />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setImageFileList([]);
                          form.setFieldValue('avatar', null);
                        }}
                        className="absolute top-2 right-2 z-10"
                      />
                    </>
                  )}
                </div>
              )}
            </div>
          </Form.Item>
        </div>
        <div className="text-xs text-text-secondary mt-2 text-center">* 视频和图片至少上传一项</div>
      </Form>
    </Modal>
  );
};
