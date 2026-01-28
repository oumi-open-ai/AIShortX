import { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import MainLayout from './layout/MainLayout';
import ProjectList from './pages/ProjectList';
import ProjectWorkflow from './pages/project';
import CharacterLibrary from './pages/CharacterLibrary';
import SettingsPage from './pages/Settings';
import { useAuthStore } from './store/authStore';

function App() {
  const initializeAuth = useAuthStore((state) => state.initialize);

  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          // 主色调
          colorPrimary: '#0EF283',
          colorSuccess: '#0EF283',
          colorInfo: '#0EF283',
          
          // 背景色
          colorBgContainer: '#212123',
          colorBgLayout: '#17171A',
          colorBgElevated: '#323236',
          colorBgSpotlight: '#323236',
          
          // 边框色
          colorBorder: '#323236',
          colorBorderSecondary: '#323236',
          
          // 文字色
          colorText: '#ffffff',
          colorTextSecondary: '#a1a1aa',
          colorTextTertiary: '#71717a',
          colorTextQuaternary: '#52525b',
          
          // 其他
          colorBgMask: 'rgba(0, 0, 0, 0.45)',
          borderRadius: 6,
        },
        components: {
          Button: {
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#1ffb8f',
            colorPrimaryActive: '#0dd975',
            primaryShadow: 'none',
            colorTextLightSolid: '#000000', // Primary 按钮文字颜色
            colorText: '#ffffff', // 默认按钮文字颜色
          },
          Input: {
            colorBgContainer: '#212123',
            colorBorder: '#323236',
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#1ffb8f',
            activeBorderColor: '#0EF283',
            hoverBorderColor: '#1ffb8f',
          },
          Select: {
            colorBgContainer: '#212123',
            colorBorder: '#323236',
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#1ffb8f',
            optionSelectedBg: 'rgba(14, 242, 131, 0.5)',
            optionActiveBg: 'rgba(14, 242, 131, 0.1)',
          },
          Modal: {
            contentBg: '#212123',
            headerBg: '#212123',
          },
          Table: {
            colorBgContainer: '#212123',
            headerBg: '#323236',
          },
          Card: {
            colorBgContainer: '#212123',
          },
          Menu: {
            colorItemBg: '#17171A',
            colorItemBgSelected: '#323236',
            colorItemBgHover: '#323236',
          },
          Spin: {
            colorPrimary: '#0EF283',
          },
          Checkbox: {
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#0EF283',
          },
          Switch: {
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#0EF283',
          },
          Radio: {
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#0EF283',
          },
          Upload: {
            colorPrimary: '#0EF283',
            colorPrimaryHover: '#0EF283',
          },
        },
      }}
    >
      <HashRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Navigate to="/projects" replace />} />
            <Route path="projects" element={<ProjectList />} />
            <Route path="projects/new" element={<ProjectWorkflow />} />
            <Route path="projects/:id" element={<ProjectWorkflow />} />
            <Route path="characters" element={<CharacterLibrary />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ConfigProvider>
  );
}

export default App;