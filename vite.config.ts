import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    host: '127.0.0.1',
    port: 5179,
    proxy: { '/api': 'http://127.0.0.1:8787' },
    // The API rewrites its JSON store on refresh; that must not reload the page.
    watch: { ignored: ['**/data/*.json', '**/output/**'] },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/three/')) return 'three';
        },
      },
    },
    // Three's WebGL renderer is a standalone, cacheable bundle.
    chunkSizeWarningLimit: 750,
  },
});
