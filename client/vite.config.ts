import react from '@vitejs/plugin-react'
// import JavaScriptObfuscator from 'javascript-obfuscator'
import { defineConfig } from 'vite'

// function obfuscateBuildAssets(): Plugin {
//   return {
//     name: 'obfuscate-build-assets',
//     apply: 'build',
//     enforce: 'post',
//     generateBundle(_options, bundle) {
//       for (const file of Object.values(bundle)) {
//         if (file.type !== 'chunk') continue
//         if (!file.fileName.endsWith('.js')) continue
//         if (!file.fileName.startsWith('assets/')) continue
//         // 排除第三方库 (vendor chunks)
//         if (file.fileName.includes('vendor')) continue
//
//         const result = JavaScriptObfuscator.obfuscate(file.code, {
//           compact: true,
//           simplify: true,
//           stringArray: true,
//           rotateStringArray: true,
//           stringArrayThreshold: 0.3, // 降低混淆比例以减小体积
//           deadCodeInjection: false,
//           controlFlowFlattening: false,
//           debugProtection: false,
//           renameGlobals: false,
//           sourceMap: false,
//           identifierNamesGenerator: 'mangled', // 使用短变量名
//         })
//
//         file.code = result.getObfuscatedCode()
//       }
//     },
//   }
// }

export default defineConfig({
  // plugins: [react(), obfuscateBuildAssets()],
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
