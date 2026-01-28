/**
 * 风格表单弹窗组件
 * 用于创建和编辑风格配置
 */
import React, { useState, useEffect } from 'react';
import { Modal, Form, Input, Button, Upload, message, Spin } from 'antd';
import { PlusOutlined, LoadingOutlined } from '@ant-design/icons';
import { styleService } from '../services/styleService';
import { characterService } from '../services/characterService';
import type { Style } from '../types';
import { CachedImage } from './CachedImage';

const { TextArea } = Input;

interface StyleFormModalProps {
  visible: boolean;
  editingStyle?: Style | null;
  onCancel: () => void;
  onSuccess: (style: Style) => void;
}

export const StyleFormModal: React.FC<StyleFormModalProps> = ({
  visible,
  editingStyle,
  onCancel,
  onSuccess,
}) => {
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form] = Form.useForm();
  const [imageUrl, setImageUrl] = useState<string>('');

  useEffect(() => {
    if (visible) {
      if (editingStyle) {
        form.setFieldsValue({
          name: editingStyle.name,
          prompt: editingStyle.prompt,
          imageUrl: editingStyle.imageUrl
        });
        setImageUrl(editingStyle.imageUrl || '');
      } else {
        form.resetFields();
        setImageUrl('');
      }
    }
  }, [visible, editingStyle, form]);

  /**
   * 保存风格配置
   */
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingStyle) {
        // 更新现有风格
        await styleService.updateStyle(editingStyle.id, {
          name: values.name,
          prompt: values.prompt,
          imageUrl: imageUrl
        });
        message.success('风格更新成功');
        onSuccess({ ...editingStyle, ...values, imageUrl });
      } else {
        // 创建新风格
        const newStyle = await styleService.createStyle({
          name: values.name,
          prompt: values.prompt,
          imageUrl: imageUrl
        });
        message.success('风格添加成功');
        onSuccess(newStyle);
      }

      handleClose();
    } catch (error) {
      console.error('Failed to save style:', error);
      message.error(editingStyle ? '更新失败' : '添加失败');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 上传参考图片
   */
  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const url = await characterService.uploadFile(file);
      setImageUrl(url);
      form.setFieldValue('imageUrl', url);
      message.success('上传成功');
    } catch (error) {
      console.error('Upload failed:', error);
      message.error('上传失败');
    } finally {
      setUploading(false);
    }
    return false;
  };

  /**
   * 关闭弹窗并重置表单
   */
  const handleClose = () => {
    form.resetFields();
    setImageUrl('');
    onCancel();
  };

  return (
    <Modal
      zIndex={1050}
      title={editingStyle ? "编辑风格" : "添加风格"}
      open={visible}
      onCancel={handleClose}
      footer={null}
      width={500}
      className="custom-modal"
      centered
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSave}
      >
        <div className="flex gap-4">
          {/* Left: Image Upload */}
          <div className="w-[150px] flex-shrink-0">
            <Form.Item
              label="参考图"
              name="imageUrl"
              className="!mb-0"
            >
              <Upload
                name="file"
                listType="picture-card"
                showUploadList={false}
                customRequest={(options) => handleImageUpload(options.file as File)}
                disabled={uploading}
                className="w-full !aspect-[3/4] block [&>.ant-upload]:!w-full [&>.ant-upload]:!h-full [&>.ant-upload]:!block [&>.ant-upload]:border-dashed [&>.ant-upload]:border-white/20 [&>.ant-upload]:bg-white/5 [&>.ant-upload]:hover:border-primary/50"
                style={{ width: '100%', height: '100%' }}
              >
                {uploading ? (
                  <div className="flex flex-col items-center justify-center text-text-secondary w-full h-full">
                    <Spin indicator={<LoadingOutlined style={{ fontSize: 24 }} spin />} />
                    <div className="text-xs mt-2">上传中...</div>
                  </div>
                ) : imageUrl ? (
                  <CachedImage src={imageUrl} alt="style" className="w-full h-full object-cover rounded-lg" />
                ) : (
                  <div className="flex flex-col items-center justify-center text-text-secondary w-full h-full">
                    <PlusOutlined className="text-2xl mb-2" />
                    <div className="text-xs">点击上传</div>
                  </div>
                )}
              </Upload>
            </Form.Item>
          </div>

          {/* Right: Inputs */}
          <div className="flex-1 flex flex-col gap-2">
            <Form.Item
              label="风格名称"
              name="name"
              rules={[{ required: true, message: '请输入风格名称' }]}
              className="!mb-2"
            >
              <Input placeholder="请输入风格名称" className="bg-bg-element border-border text-text-primary" />
            </Form.Item>

            <Form.Item
              label="提示词"
              name="prompt"
              rules={[{ required: true, message: '请输入提示词' }]}
              className="!mb-0 flex-1 [&>.ant-form-item-control]:h-full [&>.ant-form-item-control-input]:h-full [&>.ant-form-item-control-input-content]:h-full"
            >
              <TextArea 
                placeholder="请输入提示词" 
                className="bg-bg-element border-border text-text-primary h-full !resize-none" 
                style={{ height: '100%', minHeight: '120px' }}
              />
            </Form.Item>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button 
            onClick={handleClose}
            className="px-6"
          >
            取消
          </Button>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            disabled={uploading}
            className="px-8 bg-gradient-to-r from-primary to-purple-600 border-none"
          >
            {editingStyle ? "保存" : "添加"}
          </Button>
        </div>
      </Form>
    </Modal>
  );
};
