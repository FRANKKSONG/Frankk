import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [react()],
  // The build number shown in the app comes from package.json.
  define: { __ESTHER_BUILD__: JSON.stringify(pkg.version) },
  server: { host: '127.0.0.1', port: 5173 },
  // Inline images so the single-file preview build carries its artwork.
  build: { assetsInlineLimit: 200_000 },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
