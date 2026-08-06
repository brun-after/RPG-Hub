// Config isolada do vite.config.ts de propósito: o plugin swBuildId (git SHA no
// sw.js) e o manualChunks de build não devem rodar durante os testes.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    setupFiles: ['tests/setup/globals.ts'],
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/e2e/**', '**/node_modules/**'],
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['js/**'],
      reporter: ['text', 'html'],
    },
  },
});
