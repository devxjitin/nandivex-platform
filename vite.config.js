import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev the browser talks to /api on this server, which forwards to the API container (no CORS needed).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    proxy: {
      '/api': { target: 'http://localhost:4010', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
});
