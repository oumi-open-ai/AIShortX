/**
 * 风格管理组件
 * 提供风格的创建和更新功能
 */
import React, { useState } from 'react';
import { Button } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import type { Style } from '../types';
import { StyleFormModal } from './StyleFormModal';

interface StyleManagementProps {
  onStyleCreated?: (style: Style) => void;
  onStyleUpdated?: () => void;
}

export const StyleManagement: React.FC<StyleManagementProps> = ({
  onStyleCreated,
  onStyleUpdated,
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStyle, setEditingStyle] = useState<Style | null>(null);

  /**
   * 打开风格表单弹窗
   */
  const handleOpen = (style?: Style) => {
    setEditingStyle(style || null);
    setModalVisible(true);
  };

  /**
   * 处理风格保存成功
   */
  const handleSuccess = (style: Style) => {
    if (editingStyle) {
      onStyleUpdated?.();
    } else {
      onStyleCreated?.(style);
    }
    setModalVisible(false);
    setEditingStyle(null);
  };

  /**
   * 取消编辑
   */
  const handleCancel = () => {
    setModalVisible(false);
    setEditingStyle(null);
  };

  return (
    <>
      <Button 
        type="link" 
        size="small" 
        icon={<PlusOutlined />} 
        className="text-primary hover:text-primary-light p-0 flex items-center"
        onClick={() => handleOpen()}
      >
        新增
      </Button>

      <StyleFormModal
        visible={modalVisible}
        editingStyle={editingStyle}
        onCancel={handleCancel}
        onSuccess={handleSuccess}
      />
    </>
  );
};
