// Guarda de boot: importa o bundle inteiro na ordem real do js/main.ts.
// A ordem desses imports é load-bearing (documentado em vite.config.ts — os
// módulos dependem de globals publicados pelos anteriores). Uma reordenação
// que quebre o boot ("HUB_EVENTS undefined" etc.) falha aqui em milissegundos,
// sem precisar de browser.
import { describe, it, expect } from 'vitest';

describe('boot do bundle', () => {
  it('importar js/main.ts na ordem real não lança', async () => {
    await expect(import('../../js/main')).resolves.toBeTruthy();
  });

  it('após o boot, a API global essencial está publicada', async () => {
    await import('../../js/main');
    const g = globalThis as any;
    for (const nome of [
      'HUB_EVENTS', 'sb', 'iniciarRealtime', 'realtimeBroadcast',
      'parsearFormulaDano', 'calcularDanoFinal', 'temPermissao',
      'parseCSV', 'EFFECT_REGISTRY', 'RTNet',
    ]) {
      expect(g[nome], `global ${nome}`).toBeTruthy();
    }
  });
});
