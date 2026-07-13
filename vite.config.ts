import { defineConfig, type Plugin } from 'vite';
import { execSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Substitui o token __BUILD_ID__ do public/sw.js por um id único por deploy,
// para que o nome do cache do service worker mude a cada build (antes era
// 'rpghub-v1' fixo, bumpado manualmente).
function swBuildId(): Plugin {
  return {
    name: 'sw-build-id',
    apply: 'build',
    closeBundle() {
      const swPath = resolve('dist/sw.js');
      if (!existsSync(swPath)) return;
      let id: string;
      try {
        id = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch {
        id = Date.now().toString(36);
      }
      writeFileSync(swPath, readFileSync(swPath, 'utf8').replaceAll('__BUILD_ID__', id));
    },
  };
}

export default defineConfig({
  plugins: [swBuildId()],
  // Paths relativos: funciona no GitHub Pages (subdiretório /RPG-Hub/) e em qualquer host estático
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    // O bundle principal é grande por natureza (app inteiro); PIXI e extensões ficam em chunks lazy.
    // NOTA: manualChunks de módulos do APP foi testado e REVERTIDO — os módulos
    // comunicam-se por globals definidos em ordem (main.ts importa por side-effect);
    // extrair um módulo do meio da sequência para um chunk próprio hoisteia sua
    // execução para antes de config/state/rtnet (imports são hasteados), quebrando
    // o boot (ex.: HUB_EVENTS undefined). A exceção segura abaixo é restrita a
    // bibliotecas de terceiros SEM dependência de ordem (gsap/howler, consumidas
    // só por core/vendor.ts, o primeiro import): ganham cache de longo prazo entre
    // deploys sem tocar na sequência de boot. Não incluir pixi aqui — ele já é
    // lazy via core/pixi-lazy.ts e o match indevido quebraria esses chunks.
    chunkSizeWarningLimit: 4000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules[\\/](gsap|howler)[\\/]/.test(id)) return 'vendor';
        },
      },
    },
  },
});
