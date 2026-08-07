// Runtime das animações do Studio Pixi (js/systems/pixi-studio-avt.js):
// saneamento de configs salvos, interpolação de keyframes e o dim de fundo
// que gerava a "sombra retangular" sobre o mapa.
import { describe, it, expect } from 'vitest';
import '../../../js/systems/pixi-studio-avt.js';

const g = globalThis as any;

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
