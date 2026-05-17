import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        timeout: 480_000,       // 8 min — 8760h peut prendre jusqu'à 360s
        proxyTimeout: 480_000,
      },
    },
  },
});
