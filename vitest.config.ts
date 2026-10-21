import { defineConfig } from 'vitest/config';

// Cache próprio dos testes: não divide o diretório do servidor de desenvolvimento (npm run dev),
// que pode estar aberto ao mesmo tempo e interferir na execução dos testes.
export default defineConfig({
  cacheDir: 'node_modules/.vitest-cache',
  test: { include: ['tests/**/*.test.ts'] },
});
