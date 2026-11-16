import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // 相对 base：产物可放进任意子目录（如 h5_tools/mindx/）或直接双击 index.html 打开
  base: './',
  server: {
    port: 5000,
    host: true,
  },
});
