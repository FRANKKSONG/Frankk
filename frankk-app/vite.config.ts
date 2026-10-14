import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { host: '127.0.0.1', port: 5173 },
  // Inline images so the single-file preview build carries its artwork.
  build: { assetsInlineLimit: 200_000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
