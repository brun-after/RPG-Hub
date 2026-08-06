// Projeção isométrica do Modo Aventura (js/systems/avt-menu.js): a projeção direta
// de deltas (_avtIsoDeltaToScreen) deve ser a inversa exata da inversa de pan
// (_avtIsoDeltaToCanvas) e consistente com a projeção de pontos (_avtIsoCanvasToScreen),
// nos dois ângulos (52° base e 60° com "profundidade"). É ela que leva os endpoints do
// trajeto caster→alvo para dentro dos containers billboardados de VFX.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/systems/avt-menu.js';

const g = globalThis as any;

const VECS = [
  { x: 240, y: 0 }, { x: 0, y: 240 }, { x: 100, y: 100 },
  { x: -37, y: 82 }, { x: 55.5, y: -13.25 },
];

function configurarIso(profundidade: boolean) {
  g.AVT_GRAFICOS.isoAtivo = true;
  g.AVT_GRAFICOS.profundidade = profundidade;
  g._avtIsoParamsAtualizar();
}

describe.each([false, true])('_avtIsoDeltaToScreen (profundidade=%s)', (prof) => {
  beforeEach(() => configurarIso(prof));

  it('é a inversa exata de _avtIsoDeltaToCanvas (ida e volta)', () => {
    for (const v of VECS) {
      const s = g._avtIsoDeltaToScreen(v.x, v.y);
      const volta = g._avtIsoDeltaToCanvas(s.x, s.y);
      expect(volta.x).toBeCloseTo(v.x, 9);
      expect(volta.y).toBeCloseTo(v.y, 9);
    }
  });

  it('coincide com a parte linear de _avtIsoCanvasToScreen', () => {
    // No happy-dom o wrap tem offset/tamanho 0, então _avtIsoCanvasToScreen reduz-se
    // à parte linear M da projeção — deltas de pontos devem bater com o helper.
    const wrap = document.createElement('div');
    wrap.id = 'avt-mapa-wrap';
    document.body.appendChild(wrap);
    try {
      const A = { x: 120, y: 300 };
      for (const v of VECS) {
        const P = { x: A.x + v.x, y: A.y + v.y };
        const sA = g._avtIsoCanvasToScreen(A.x, A.y);
        const sP = g._avtIsoCanvasToScreen(P.x, P.y);
        const d = g._avtIsoDeltaToScreen(v.x, v.y);
        expect(sP.x - sA.x).toBeCloseTo(d.x, 9);
        expect(sP.y - sA.y).toBeCloseTo(d.y, 9);
      }
    } finally {
      wrap.remove();
    }
  });

  it('projeta um delta cardinal da grade na diagonal de tela esperada', () => {
    // Leste puro na grade (dx>0, dy=0) deve descer-e-ir-à-direita na tela
    // (screen.x = k·dx > 0, screen.y = k·dx·cosX > 0) — exatamente o desvio que o
    // billboard de VFX precisa compensar.
    const s = g._avtIsoDeltaToScreen(240, 0);
    expect(s.x).toBeGreaterThan(0);
    expect(s.y).toBeGreaterThan(0);
    expect(s.y / s.x).toBeCloseTo(Math.cos((prof ? 60 : 52) * Math.PI / 180), 9);
  });
});
