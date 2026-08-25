import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  // 用相对路径打包资源，使 dist 可在 file:// 下双击 index.html 直接打开
  base: './',
  server: {
    port: 5173,
    open: true
  }
})
