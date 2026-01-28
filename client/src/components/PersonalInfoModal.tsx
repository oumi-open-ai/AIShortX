/**
 * 个人信息弹窗组件
 * 用于显示和编辑用户个人信息
 */
import { Modal, Form, Input, Button, Avatar, Tag, message } from 'antd';
import { UserOutlined } from '@ant-design/icons';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { authService } from '../services/authService';
import dayjs from 'dayjs';

interface PersonalInfoModalProps {
  open: boolean;
  onCancel: () => void;
}

const PersonalInfoModal = ({ open, onCancel }: PersonalInfoModalProps) => {
  const { user, refreshProfile } = useAuthStore();
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && user) {
      form.setFieldsValue({ nickname: user.nickname });
    }
  }, [open, user, form]);

  /**
   * 保存个人信息
   */
  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      await authService.updateProfile({ nickname: values.nickname });
      await refreshProfile();
      message.success('个人信息已保存');
      onCancel();
    } catch (error) {
      console.error('Failed to update profile:', error);
      // message.error('保存失败'); // authService might throw or return error
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  /**
   * 获取用户角色显示名称
   */
  const getRoleName = (role: string) => {
    switch (role) {
      case 'REGULAR': return '普通用户';
      case 'TRIAL': return '体验会员';
      case 'VIP': return 'VIP会员';
      case 'PERMANENT': return '永久会员';
      default: return '未知身份';
    }
  };

  /**
   * 获取用户角色对应的标签颜色
   */
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'REGULAR': return 'default';
      case 'TRIAL': return 'blue';
      case 'VIP': return 'gold';
      case 'PERMANENT': return 'purple';
      default: return 'default';
    }
  };

  return (
    <Modal
      title="个人信息"
      open={open}
      onCancel={onCancel}
      footer={[
        <Button key="cancel" onClick={onCancel}>
          取消
        </Button>,
        <Button key="submit" type="primary" loading={loading} onClick={handleSave}>
          保存
        </Button>,
      ]}
    >
      <div className="flex flex-col gap-6 py-4">
        <div className="flex items-center gap-6">
          <Avatar 
            size={80} 
            src={user.avatar || undefined}
            icon={<UserOutlined style={{ fontSize: '48px' }} className="text-text-secondary" />} 
            className="flex items-center justify-center bg-bg-element border border-border"
          />
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xl font-medium text-text-primary">{user.nickname || '未设置昵称'}</span>
              <Tag color={getRoleColor(user.role)}>{getRoleName(user.role)}</Tag>
            </div>
            {user.vipExpireAt && (
              <div className="text-text-secondary text-sm">
                会员到期时间: {dayjs(user.vipExpireAt).format('YYYY-MM-DD HH:mm:ss')}
              </div>
            )}
          </div>
        </div>

        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            label="昵称"
            name="nickname"
            rules={[{ required: true, message: '请输入昵称' }]}
          >
            <Input maxLength={20} showCount placeholder="请输入昵称" />
          </Form.Item>
        </Form>
      </div>
    </Modal>
  );
};

export default PersonalInfoModal;
