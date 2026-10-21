import { defineConfig, type Plugin } from 'vite';
import { readFileSync, writeFileSync } from 'node:fs';
import react from '@vitejs/plugin-react';

/** Carimba o service worker com o id do build para que cada deploy invalide o cache antigo. */
const stampServiceWorker = (): Plugin => ({
  name: 'stamp-service-worker',
  apply: 'build',
  // depois de tudo (inclusive da cópia de public/ para dist/)
  closeBundle: {
    order: 'post',
    handler() {
      const file = 'dist/sw.js';
      writeFileSync(file, readFileSync(file, 'utf8').replaceAll('__BUILD__', Date.now().toString(36)));
    },
  },
});

export default defineConfig({
  base: './',
  plugins: [react(), stampServiceWorker()],
});
