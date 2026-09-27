import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The SPA talks to the Node backend at VITE_API_BASE_URL (default http://localhost:4000)
// directly — CORS is enabled server-side for the dev origin. In production nginx serves
// this build and proxies /api + /ws to the backend (see docker/nginx/frontend.conf).
export default defineConfig({
  plugins: [react()],
  // Sub-path deploys (e.g. served at http://host/blog-app/) need a matching base so
  // built asset URLs resolve. Set VITE_BASE_PATH=/blog-app/ at build time; defaults to '/'.
  base: process.env.VITE_BASE_PATH || '/',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
});
