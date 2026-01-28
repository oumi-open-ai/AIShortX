/**
 * 主布局组件
 * 提供应用的整体布局结构，包括：
 * - 自定义标题栏（支持窗口控制）
 * - 主题配置
 * - 任务中心
 * - 系统设置入口
 * - 路由出口
 */

import { Layout, Button, ConfigProvider, theme as antTheme } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { 
  MinusOutlined, 
  BorderOutlined, 
  CloseOutlined,
  UnorderedListOutlined,
  SwitcherOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { useState, useEffect } from 'react';
import { useThemeStore } from '../store/themeStore';
import { useTaskStore } from '../store/taskStore';
import PersonalInfoModal from '../components/PersonalInfoModal';
import { TaskCenterModal } from '../components/TaskCenterModal';
import logo from '../assets/logo.png';

const { Header, Content } = Layout;

const MainLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // ========== 状态管理 ==========
  const isEditPage = location.pathname.startsWith('/projects/');  // 是否为项目编辑页面
  const [personalInfoModalOpen, setPersonalInfoModalOpen] = useState(false);  // 个人信息弹窗
  const [taskCenterVisible, setTaskCenterVisible] = useState(false);  // 任务中心弹窗
  const { inProgressCount, refreshStats } = useTaskStore();  // 任务统计
  const { theme } = useThemeStore();  // 主题配置
  const [appVersion, setAppVersion] = useState('');  // 应用版本号
  const [isMaximized, setIsMaximized] = useState(false);  // 窗口最大化状态

  // ==========================================================================
  // Effect: 获取应用版本号
  // ==========================================================================
  useEffect(() => {
    const getVersion = async () => {
      if ((window as any).electronAPI) {
        try {
          const ver = await (window as any).electronAPI.getVersion();
          setAppVersion(ver);
        } catch (e) {
          console.error('获取版本号失败', e);
        }
      }
    };
    getVersion();
  }, []);

  // ==========================================================================
  // Effect: 定时轮询任务统计
  // 每 10 秒刷新一次任务状态
  // ==========================================================================
  useEffect(() => {
    refreshStats();  // 立即刷新一次
    const interval = setInterval(refreshStats, 10000);  // 每 10 秒刷新
    return () => clearInterval(interval);  // 清理定时器
  }, [refreshStats]);

  // ==========================================================================
  // Effect: 同步主题到 document 类名
  // 用于全局主题切换
  // ==========================================================================
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  // ==========================================================================
  // Effect: 监听窗口状态变化
  // 同步窗口最大化/还原状态
  // ==========================================================================
  useEffect(() => {
    if ((window as any).electronAPI) {
      const handleMaximized = () => setIsMaximized(true);
      const handleUnmaximized = () => setIsMaximized(false);

      (window as any).electronAPI.onMaximize(handleMaximized);
      (window as any).electronAPI.onUnmaximize(handleUnmaximized);

      // 清理监听器
      return () => {
        if ((window as any).electronAPI.removeWindowStateListeners) {
          (window as any).electronAPI.removeWindowStateListeners();
        }
      };
    }
  }, []);

  // ==========================================================================
  // 窗口控制函数
  // ==========================================================================
  
  /** 最小化窗口 */
  const handleMinimize = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.minimize();
    }
  };

  /** 最大化/还原窗口 */
  const handleMaximize = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.maximize();
    }
  };

  /** 关闭窗口 */
  const handleClose = () => {
    if ((window as any).electronAPI) {
      (window as any).electronAPI.close();
    }
  };

  return (
    <ConfigProvider
      theme={{
        algorithm: theme === 'dark' ? antTheme.darkAlgorithm : antTheme.defaultAlgorithm,
        token: {
          colorPrimary: theme === 'dark' ? '#22d3ee' : '#0891b2', // Cyan 400 / Cyan 600
          colorBgContainer: theme === 'dark' ? '#18181b' : '#ffffff',
          colorBgLayout: theme === 'dark' ? '#09090b' : '#ffffff',
          colorText: theme === 'dark' ? '#ffffff' : '#18181b',
          colorTextSecondary: theme === 'dark' ? '#a1a1aa' : '#71717a',
          colorBorder: theme === 'dark' ? '#27272a' : '#e4e4e7',
        },
        components: {
          Button: {
             colorText: theme === 'dark' ? '#e4e4e7' : '#3f3f46',
          },
          Card: {
             colorBgContainer: theme === 'dark' ? '#18181b' : '#ffffff',
          },
          Input: {
            colorText: theme === 'dark' ? '#e4e4e7' : '#18181b',
          },
          Select: {
            colorText: theme === 'dark' ? '#e4e4e7' : '#18181b',
          }
        }
      }}
    >
      <Layout className="h-screen w-screen overflow-hidden bg-transparent transition-colors duration-300">
        <Header 
          className="!bg-bg-page backdrop-blur-xl !p-0 flex justify-between items-center !pl-6 !pr-0 h-[50px] transition-all duration-300 sticky top-0 z-50"
          style={{ WebkitAppRegion: 'drag' } as any}
        >
          <div className="flex items-center gap-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
            <div 
              className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => navigate('/')}
            >
              <img src={logo} alt="Logo" className="h-6 w-auto object-contain" />
              {appVersion && (
                <span className="text-[12px] text-text-secondary opacity-50 select-none translate-y-[5px]">
                  v{appVersion}
                </span>
              )}
            </div>
          </div>
          
          <div className="flex items-center gap-4 pr-4" style={{ WebkitAppRegion: 'no-drag' } as any}>
             <div 
               onClick={() => setTaskCenterVisible(true)}
               className="flex items-center h-8 px-3 rounded-full bg-bg-element/50 border border-border hover:border-primary/50 cursor-pointer transition-all group select-none ml-2"
               title="任务中心"
             >
               <UnorderedListOutlined className="text-text-secondary group-hover:text-primary mr-2 transition-colors text-base" />
               <span className="text-sm font-medium text-text-primary mr-3">任务中心</span>
               <div className={`w-2 h-2 rounded-full mr-2 transition-colors duration-300 ${inProgressCount > 0 ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`} />
               <span className={`text-xs transition-colors duration-300 ${inProgressCount > 0 ? 'text-blue-500' : 'text-green-500'}`}>
                 {inProgressCount > 0 ? `${inProgressCount}个任务运行中` : '服务空闲'}
               </span>
             </div>


             <div className='flex items-center h-8 px-3 rounded-full bg-bg-element/50 border border-border hover:border-primary/50 cursor-pointer transition-all group select-none'
                  onClick={() => {
                    if (location.pathname !== '/settings') {
                      navigate('/settings');
                    }
                  }}>
               <SettingOutlined className="text-lg text-indigo-500 group-hover:text-white" />
               <div className='ml-2'>系统设置</div>
             </div>

              {/* <Dropdown menu={{ items: userMenu }} placement="bottomRight">
                <div className="flex items-center gap-2 cursor-pointer hover:bg-bg-element px-2 py-1 rounded-full transition-colors">
                  <Avatar icon={<UserOutlined />} size="small" className="bg-blue-600" />
                  <span className="text-xs text-text-primary font-medium leading-none">{user?.nickname || 'Local User'}</span>
                </div>
              </Dropdown> */}
            
            {/* Window Controls */}
            {window.electronAPI?
            <div className="flex items-center gap-2 ml-2 pl-4 border-l border-border">
              <Button 
                type="text" 
                icon={<MinusOutlined className="text-xs" />} 
                onClick={handleMinimize}
                className="text-text-secondary hover:text-text-primary flex items-center justify-center w-8 h-8 min-w-0" 
              />
              <Button 
                type="text" 
                icon={isMaximized ? <SwitcherOutlined className="text-xs" /> : <BorderOutlined className="text-xs" />} 
                onClick={handleMaximize}
                className="text-text-secondary hover:text-text-primary flex items-center justify-center w-8 h-8 min-w-0" 
              />
              <Button 
                type="text" 
                icon={<CloseOutlined className="text-xs" />} 
                onClick={handleClose}
                className="text-text-secondary hover:text-red-500 hover:bg-red-500/10 flex items-center justify-center w-8 h-8 min-w-0" 
              />
            </div>:<div></div>}
          </div>
        </Header>
        <Content className={`m-0 bg-bg-page overflow-auto transition-colors duration-300 ${isEditPage ? '' : 'p-4'}`}>
           <div className="w-full mx-auto h-full">
              <Outlet />
           </div>
        </Content>
        
        <PersonalInfoModal
          open={personalInfoModalOpen}
          onCancel={() => setPersonalInfoModalOpen(false)}
        />
        <TaskCenterModal 
          visible={taskCenterVisible}
          onCancel={() => setTaskCenterVisible(false)}
        />

      </Layout>
    </ConfigProvider>
  );
};

export default MainLayout;
