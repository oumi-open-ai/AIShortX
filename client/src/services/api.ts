import axios from 'axios';
import { getAppVersion } from '../utils/appVersion';

let API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// 如果在 Electron 环境中，动态获取后端端口
async function initializeAPI() {
  if ((window as any).electronAPI) {
    try {
      const port = await (window as any).electronAPI.getBackendPort();
      console.log(port,'portportportport')
      API_BASE_URL = `http://localhost:${port}/api`;
    } catch (error) {
      // 降级到默认值
      API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
    }
  }
}

// 初始化 API
initializeAPI();

const AUTH_REQUIRED_EVENT = 'auth:required';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 180000, // 3 minutes timeout
  headers: {
    'Content-Type': 'application/json',
  },
});

// 动态更新 baseURL
api.interceptors.request.use(
  async (config) => {
    // 确保使用最新的 API_BASE_URL
    config.baseURL = API_BASE_URL;
    
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const appVersion = await getAppVersion();
    if (appVersion) {
      config.headers['x-app-version'] = appVersion;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle unified response format
api.interceptors.response.use(
  (response) => {
    // If the response has a 'code' property and it's 200, unwrap the data
    if (response.data && typeof response.data === 'object' && 'code' in response.data) {
      if (response.data.code === 200) {
        response.data = response.data.data;
      } else {
        // Handle business error (if status is 200 but code is not)
        return Promise.reject(new Error(response.data.message || 'Unknown Error'));
      }
    }
    return response;
  },
  (error) => {
    if (error.response) {
      if (error.response.status === 401) {
        localStorage.removeItem('token');
        window.dispatchEvent(new CustomEvent(AUTH_REQUIRED_EVENT));
      }

      if (error.response.data) {
        const { message } = error.response.data;
        if (message) {
          error.message = message;
        }
      }
    }
    return Promise.reject(error);
  }
);

export default api;
