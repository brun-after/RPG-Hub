import { defineConfig } from 'vite';

export default defineConfig({
  // Paths relativos: funciona no GitHub Pages (subdiretório /RPG-Hub/) e em qualquer host estático
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // O bundle principal é grande por natureza (app inteiro); PIXI e extensões ficam em chunks lazy.
    // NOTA: manualChunks foi testado e REVERTIDO — os módulos comunicam-se por globals
    // definidos em ordem (main.ts importa por side-effect); extrair um módulo do meio
    // da sequência para um chunk próprio hoisteia sua execução para antes de config/
    // state/rtnet (imports são hasteados), quebrando o boot (ex.: HUB_EVENTS undefined).
    chunkSizeWarningLimit: 4000,
  },
});
