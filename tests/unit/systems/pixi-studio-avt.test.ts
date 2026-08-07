// Runtime das animações do Studio Pixi (js/systems/pixi-studio-avt.js):
// saneamento de configs salvos, interpolação de keyframes, timers/races de
// animações persistentes e o dim de fundo que gerava a "sombra retangular".
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../../js/systems/pixi-studio-avt.js';

const g = globalThis as any;

// PIXI mínimo para os caminhos exercitados nos testes (sem WebGL).
function fakePixi() {
  class Node {
    children: any[] = []; filters: any = null; blendMode: any = 0;
    position = { set() {} }; scale = { set() {}, x: 1, y: 1 }; anchor = { set() {} };
    addChild(...cs: any[]) { this.children.push(...cs); return cs[0]; }
    destroy() {}
  }
  class Graphics extends Node {
    calls: any[] = [];
    beginFill(...a: any[]) { this.calls.push(['beginFill', ...a]); return this; }
    drawRect(...a: any[]) { this.calls.push(['drawRect', ...a]); return this; }
    endFill() { return this; }
  }
  return {
    Container: class extends Node {},
    Sprite: class extends Node { width = 0; height = 0; alpha = 1; constructor(public tex?: any) { super(); } },
    Graphics,
    Texture: { WHITE: {}, from: () => ({}) },
    BLEND_MODES: { ADD: 1, SCREEN: 2, MULTIPLY: 3, NORMAL: 0 },
    particles: {
      Emitter: class {
        destroyed = false; emit = false;
        constructor(public parent: any, public cfg: any) {}
        updateSpawnPos() {} update() {}
        destroy() { this.destroyed = true; }
      },
      upgradeConfig: (c: any) => c,
    },
    filters: {},
  };
}

describe('_psFixEmitterGhost (saneamento do bug B1 persistido)', () => {
  it('mescla o subtree fantasma (edições mais recentes) sobre o emitter e o remove', () => {
    const layer = {
      emitter: {
        maxParticles: 60,
        speed: { start: 180, end: 40 },
        emitter: { speed: { start: 99 }, lifetime: { min: 2 } },
      },
    };
    g._psFixEmitterGhost(layer);
    expect(layer.emitter.speed.start).toBe(99);   // fantasma vence (última edição)
    expect(layer.emitter.speed.end).toBe(40);     // resto preservado
    expect((layer.emitter as any).lifetime.min).toBe(2);
    expect(layer.emitter.maxParticles).toBe(60);
    expect((layer.emitter as any).emitter).toBeUndefined();
  });

  it('não toca em layer sem fantasma', () => {
    const layer = { emitter: { maxParticles: 30, speed: { start: 10 } } };
    const antes = JSON.parse(JSON.stringify(layer));
    g._psFixEmitterGhost(layer);
    expect(layer).toEqual(antes);
  });
});

describe('_psSanitizeCfg', () => {
  it('sanea todas as layers e ordena keyframes por t', () => {
    const cfg = {
      layers: [
        {
          emitter: { frequency: 0.01, emitter: { frequency: 0.5 } },
          keyframes: [{ t: 0.9 }, { t: 0.1 }, { t: 0.5 }],
        },
      ],
    };
    g._psSanitizeCfg(cfg);
    expect(cfg.layers[0].emitter.frequency).toBe(0.5);
    expect((cfg.layers[0].emitter as any).emitter).toBeUndefined();
    expect(cfg.layers[0].keyframes.map((k: any) => k.t)).toEqual([0.1, 0.5, 0.9]);
  });

  it('tolera cfg nulo ou sem layers', () => {
    expect(g._psSanitizeCfg(null)).toBeNull();
    expect(g._psSanitizeCfg({})).toEqual({});
  });
});

describe('_psAvtInterpKf (B8: keyframes com mesmo t)', () => {
  it('denominador zero não gera NaN', () => {
    const kfs = [{ t: 0, x: 0 }, { t: 0.5, x: 50 }, { t: 0.5, x: 100 }, { t: 1, x: 0 }];
    const r = g._psAvtInterpKf(kfs, 0.5);
    expect(Number.isFinite(r.x)).toBe(true);
  });

  it('interpola linearmente no caso normal', () => {
    const kfs = [{ t: 0, x: 0 }, { t: 1, x: 100 }];
    expect(g._psAvtInterpKf(kfs, 0.25).x).toBeCloseTo(25);
  });
});

describe('_psAvtToScreen (B17: null-safe)', () => {
  afterEach(() => { g.AVT_STATE = undefined; });

  it('entidade nula não lança e devolve o centro do canvas', () => {
    g.AVT_STATE = { canvas: { width: 800, height: 600 }, camera: { zoom: 1, x: 0, y: 0 } };
    expect(g._psAvtToScreen(null)).toEqual({ x: 400, y: 300 });
  });

  it('sem canvas devolve o centro default', () => {
    g.AVT_STATE = { canvas: null, camera: {} };
    expect(g._psAvtToScreen(null)).toEqual({ x: 400, y: 300 });
  });
});

describe('_psAvtChain (B16: delay antes de cada passo) + _psAvtDelay (B10)', () => {
  let origPlay: any;
  beforeEach(() => {
    vi.useFakeTimers();
    origPlay = g.avtPixiPlayAnimation;
  });
  afterEach(() => {
    vi.useRealTimers();
    g.avtPixiPlayAnimation = origPlay;
  });

  it('cada passo respeita o próprio delay_ms (acumulado)', () => {
    const play = vi.fn();
    g.avtPixiPlayAnimation = play;
    g._psAvtChain({ behavior_config: { sequence: [
      { animId: 'a', delay_ms: 200 }, { animId: 'b', delay_ms: 300 },
    ] } }, null, null, false);
    vi.advanceTimersByTime(199);
    expect(play).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenLastCalledWith('a', null, null, false);
    vi.advanceTimersByTime(299);
    expect(play).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1); // t = 500 = 200 + 300
    expect(play).toHaveBeenCalledTimes(2);
    expect(play).toHaveBeenLastCalledWith('b', null, null, false);
  });

  it('avtPixiCleanupAll cancela os passos futuros', () => {
    const play = vi.fn();
    g.avtPixiPlayAnimation = play;
    g._psAvtChain({ behavior_config: { sequence: [{ animId: 'a', delay_ms: 100 }] } }, null, null, false);
    g.avtPixiCleanupAll();
    vi.advanceTimersByTime(1000);
    expect(play).not.toHaveBeenCalled();
  });
});

describe('avtPixiPlayPersistent (B9: race na reaplicação da mesma key)', () => {
  let origLoad: any, origTracked: any, origScale: any;
  let adapters: any[];
  let resolvers: any[];

  beforeEach(() => {
    origLoad = g._psAvtLoadCfg;
    origTracked = g._avtVfxTrackedRoot;
    origScale = g._avtScaleEmitterCfg;
    adapters = [];
    resolvers = [];
    g.PIXI = fakePixi();
    g.AVT_STATE = { canvas: { width: 800, height: 600 }, camera: { zoom: 1, x: 0, y: 0 } };
    g.AVT_SZ = 48;
    // Host adapter fake: _psAvtAcquireApp embrulha _avtVfxAcquireApp
    g._avtVfxAcquireApp = () => {
      const ad: any = {
        ticker: { add: vi.fn(), remove: vi.fn() },
        stage: new g.PIXI.Container(),
        destroyed: false,
        destroy() { ad.destroyed = true; },
      };
      adapters.push(ad);
      return ad;
    };
    g._avtEnsurePixiParticles = () => Promise.resolve();
    g._avtVfxScale = () => 1;
    g._avtVfxTrackedRoot = () => ({ content: new g.PIXI.Container(), update: vi.fn() });
    g._avtScaleEmitterCfg = (c: any) => c;
    g._psAvtLoadCfg = () => new Promise((res) => resolvers.push(res));
  });

  afterEach(() => {
    g.avtPixiCleanupAll();
    g._psAvtLoadCfg = origLoad;
    g._avtVfxTrackedRoot = origTracked;
    g._avtScaleEmitterCfg = origScale;
    g._avtVfxAcquireApp = undefined;
    g._avtEnsurePixiParticles = undefined;
    g._avtVfxScale = undefined;
    g.AVT_STATE = undefined;
    g.AVT_SZ = undefined;
    g.PIXI = undefined;
  });

  const cfg = () => ({ layers: [{ id: 'l0', tipo: 'emitter', visivel: true, emitter: { maxParticles: 5 } }] });
  const ent = { id: 'e1', x: 0, y: 0 };

  it('duas chamadas próximas com a mesma key: só a mais nova registra e aloca', async () => {
    const p1 = g.avtPixiPlayPersistent('anim1', ent, null, 'alvo', 'k');
    const p2 = g.avtPixiPlayPersistent('anim1', ent, null, 'alvo', 'k');
    resolvers.forEach((res) => res(cfg()));
    await Promise.all([p1, p2]);
    expect(g._PS_PERSISTENT.size).toBe(1);
    // A chamada obsoleta desistiu ANTES de adquirir app — nenhum adapter órfão
    expect(adapters.length).toBe(1);
    expect(adapters[0].destroyed).toBe(false);
    g.avtPixiStopPersistent('k');
    expect(g._PS_PERSISTENT.size).toBe(0);
    expect(adapters[0].destroyed).toBe(true);
  });

  it('avtPixiCleanupAll durante o await impede o registro tardio', async () => {
    const p1 = g.avtPixiPlayPersistent('anim1', ent, null, 'alvo', 'k');
    g.avtPixiCleanupAll();
    resolvers.forEach((res) => res(cfg()));
    await p1;
    expect(g._PS_PERSISTENT.size).toBe(0);
    expect(adapters.length).toBe(0);
  });
});

describe('_psBuildBackgroundDim (sombra retangular)', () => {
  let origVig: any;
  beforeEach(() => {
    g.PIXI = fakePixi();
    origVig = g._psVignetteTexture;
    g._psVignetteTexture = () => ({});   // happy-dom não tem canvas 2D
  });
  afterEach(() => {
    g._psVignetteTexture = origVig;
    g.PIXI = undefined;
  });

  // renderer.width/height é o backing store (screen × resolution) — era a fonte do
  // retângulo parcial/deslocado no modo iso. O dim tem de usar renderer.screen.
  const app = { renderer: { width: 445, height: 334, screen: { width: 800, height: 600 } } };

  it('usa renderer.screen, não o backing store', () => {
    const dim = g._psBuildBackgroundDim(app, { darken: 0.3 });
    const rect = dim.calls.find((c: any) => c[0] === 'drawRect');
    expect(rect.slice(1)).toEqual([0, 0, 800, 600]);
    const fill = dim.calls.find((c: any) => c[0] === 'beginFill');
    expect(fill[2]).toBeCloseTo(0.3);
  });

  it('darken 0 sem vinheta → sem dim', () => {
    expect(g._psBuildBackgroundDim(app, { darken: 0 })).toBeNull();
    expect(g._psBuildBackgroundDim(app, null)).toBeNull();
  });

  it('radialDim vira sprite de vinheta do tamanho da tela', () => {
    const sp = g._psBuildBackgroundDim(app, { radialDim: true });
    expect(sp.width).toBe(800);
    expect(sp.height).toBe(600);
    expect(sp.alpha).toBeCloseTo(0.3);  // semântica legada: radialDim sem darken assume 0.3
  });
});
