import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: false,
    proxy: {
      '/stooq': {
        target: 'https://stooq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/stooq/, '')
      },
      '/yahoo': {
        target: 'https://query1.finance.yahoo.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/yahoo/, '')
      },
      '/nasdaq': {
        target: 'https://api.nasdaq.com',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/nasdaq/, '')
      }
    }
  },
  test: {
    environment: 'jsdom',
    globals: true
  }
});
