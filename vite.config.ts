import { defineConfig } from 'vite';

export default defineConfig({
  // Paths relativos: funciona no GitHub Pages (subdiretório /RPG-Hub/) e em qualquer host estático
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // O bundle principal é grande por natureza (app inteiro); PIXI e extensões ficam em chunks lazy
    chunkSizeWarningLimit: 4000,
  },
});
