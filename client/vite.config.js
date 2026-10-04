import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward API calls to the Express server so the browser sees one origin.
    // e2e overrides the target (API_PROXY_TARGET) to reach its own test server.
    proxy: {
      '/api': process.env.API_PROXY_TARGET ?? 'http://localhost:3001',
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test-setup.js',
  },
});
