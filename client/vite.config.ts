import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react()], // 暂时移除混淆插件以排查问题
  base: './',
  server: {
    port: 5174,
  },
  build: {
    sourcemap: false,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor'
          }
        },
      },
    },
  },
  esbuild: {
    drop: ['console', 'debugger'],
  },
})
