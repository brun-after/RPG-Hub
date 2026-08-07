// Mitigações de performance mobile (js/systems/avt-menu.js): resolução reduzida
// do canvas principal em iso+touch e a escada de degradação adaptativa que agora
// alcança o preset de emergência "minimo".
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import '../../../js/systems/avt-menu.js';

const g = globalThis as any;

function stubTouch(pontos: number) {
  Object.defineProperty(navigator, 'maxTouchPoints', { value: pontos, configurable: true });
}

afterEach(() => stubTouch(0));

describe('_avtMainCanvasResolution', () => {
  it('1 fora do isométrico, mesmo em touch', () => {
    g.AVT_GRAFICOS.isoAtivo = false;
    stubTouch(5);
    expect(g._avtMainCanvasResolution()).toBe(1);
  });

  it('1 em iso num desktop sem touch', () => {
    g.AVT_GRAFICOS.isoAtivo = true;
    stubTouch(0);
    expect(g._avtMainCanvasResolution()).toBe(1);
  });

  it('1/oversize (~0,556) em iso + touch', () => {
    g.AVT_GRAFICOS.isoAtivo = true;
    stubTouch(5);
    expect(g._avtMainCanvasResolution()).toBeCloseTo(1 / 1.8, 6);
  });
});

describe('_avtGraficosDegradar', () => {
  beforeEach(() => {
    g.AVT_GRAFICOS.adaptativo = true;
  });

  it('desce alto → medio → baixo → minimo e então para', () => {
    g._avtGraficosPreset('alto', { silencioso: true });
    expect(g._avtGraficosDegradar()).toBe(true);
    expect(g.AVT_GRAFICOS.preset).toBe('medio');
    expect(g._avtGraficosDegradar()).toBe(true);
    expect(g.AVT_GRAFICOS.preset).toBe('baixo');
    expect(g._avtGraficosDegradar()).toBe(true);
    expect(g.AVT_GRAFICOS.preset).toBe('minimo');
    expect(g._avtGraficosDegradar()).toBe(false);
    expect(g.AVT_GRAFICOS.preset).toBe('minimo');
  });

  it('minimo desliga fatias, billboards e VFX iso; medio restaura', () => {
    g._avtGraficosPreset('minimo', { silencioso: true });
    expect(g.AVT_GRAFICOS.fatias).toBe(false);
    expect(g.AVT_GRAFICOS.bilbordes).toBe(false);
    expect(g.AVT_GRAFICOS.vfxProjecao).toBe(false);
    g._avtGraficosPreset('medio', { silencioso: true });
    expect(g.AVT_GRAFICOS.fatias).toBe(true);
    expect(g.AVT_GRAFICOS.bilbordes).toBe(true);
  });

  it('não degrada com adaptativo desligado', () => {
    g._avtGraficosPreset('alto', { silencioso: true });
    g.AVT_GRAFICOS.adaptativo = false;
    expect(g._avtGraficosDegradar()).toBe(false);
    expect(g.AVT_GRAFICOS.preset).toBe('alto');
  });
});
