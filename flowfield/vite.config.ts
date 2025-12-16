import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@flowfield': path.resolve(__dirname, './src'),
      '@mixdraw': path.resolve(__dirname, '../src'),
    },
  },
  server: {
    port: 3001,
  },
  optimizeDeps: {
    include: ['paper', 'mathjs'],
  },
});
