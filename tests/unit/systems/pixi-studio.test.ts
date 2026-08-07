// Editor do Studio Pixi (js/systems/pixi-studio.js): escrita de propriedades do
// emissor, parse numérico dos sliders e interpolação de keyframes — as funções
// puras (ou quase) por trás dos bugs de UI que não deixavam rastro no console.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../../../js/systems/pixi-studio.js';

const g = globalThis as any;

function layerEmitterBase() {
  return {
    id: 'l_test', tipo: 'emitter', nome: 'Partículas', visivel: true, z: 1,
    emitter: {
      maxParticles: 60, frequency: 0.01,
      lifetime: { min: 0.3, max: 0.6 },
      speed: { start: 180, end: 40 },
    },
  };
}

beforeEach(() => {
  // psUpdateEmitterProp encerra com _psSetDirty + psPreviewSyncEmitter (mexem em
  // DOM/preview) — o setter global rebinda a function declaration do módulo.
  g.psPreviewSyncEmitter = vi.fn();
  g.PIXI_STUDIO_STATE.atual = { id: 'a1', nome: 'T', config_json: { layers: [layerEmitterBase()] } };
  g.PIXI_STUDIO_STATE.layerSel = 'l_test';
});

describe('psUpdateEmitterProp (B1: chave prefixada emitter.*)', () => {
  it('grava no destino real, não em layer.emitter.emitter.*', () => {
    g.psUpdateEmitterProp('l_test', 'emitter.speed.start', 250);
    const layer = g.PIXI_STUDIO_STATE.atual.config_json.layers[0];
    expect(layer.emitter.speed.start).toBe(250);
    expect(layer.emitter.emitter).toBeUndefined();
  });

  it('chave simples prefixada também aterrissa na raiz do emitter', () => {
    g.psUpdateEmitterProp('l_test', 'emitter.maxParticles', 120);
    const layer = g.PIXI_STUDIO_STATE.atual.config_json.layers[0];
    expect(layer.emitter.maxParticles).toBe(120);
    expect(layer.emitter.emitter).toBeUndefined();
  });

  it('chave sem prefixo continua funcionando', () => {
    g.psUpdateEmitterProp('l_test', 'frequency', 0.2);
    expect(g.PIXI_STUDIO_STATE.atual.config_json.layers[0].emitter.frequency).toBe(0.2);
  });
});

describe('_psInterpKf (interpolação de keyframes do preview)', () => {
  it('keyframes com o mesmo t não geram NaN', () => {
    const kfs = [{ t: 0.5, x: 10, y: 0 }, { t: 0.5, x: 90, y: 4 }];
    const r = g._psInterpKf(kfs, 0.5);
    expect(Number.isFinite(r.x)).toBe(true);
    expect(Number.isFinite(r.y)).toBe(true);
  });

  it('interpola linearmente entre dois keyframes', () => {
    const kfs = [{ t: 0, x: 0 }, { t: 1, x: 100 }];
    expect(g._psInterpKf(kfs, 0.5).x).toBeCloseTo(50);
  });

  it('clampa fora do range nos extremos', () => {
    const kfs = [{ t: 0.2, x: 5 }, { t: 0.8, x: 15 }];
    expect(g._psInterpKf(kfs, 0).x).toBe(5);
    expect(g._psInterpKf(kfs, 1).x).toBe(15);
  });
});

describe('psMoveLayer (B13: setas ↑/↓ devem mudar a ordem de render por z)', () => {
  it('troca a ordenação efetiva quando os z empatam', () => {
    const cfg = g.PIXI_STUDIO_STATE.atual.config_json;
    cfg.layers = [
      { id: 'a', z: 3, tipo: 'emitter', emitter: {} },
      { id: 'b', z: 3, tipo: 'emitter', emitter: {} },
    ];
    g.psPreviewRebuildAll = vi.fn();
    g.psMoveLayer('b', -1);
    const ordem = [...cfg.layers].sort((x: any, y: any) => x.z - y.z).map((l: any) => l.id);
    expect(ordem).toEqual(['b', 'a']);
  });

  it('troca os z quando são distintos', () => {
    const cfg = g.PIXI_STUDIO_STATE.atual.config_json;
    cfg.layers = [
      { id: 'a', z: 1, tipo: 'emitter', emitter: {} },
      { id: 'b', z: 5, tipo: 'emitter', emitter: {} },
    ];
    g.psPreviewRebuildAll = vi.fn();
    g.psMoveLayer('b', -1);
    const byId: any = Object.fromEntries(cfg.layers.map((l: any) => [l.id, l.z]));
    expect(byId.b).toBe(1);
    expect(byId.a).toBe(5);
  });
});

describe('psNum (B5: sliders não chegavam a zero)', () => {
  it('aceita 0 em vez de devolver o default', () => {
    expect(g.psNum('0', 5)).toBe(0);
  });
  it('devolve o default para entrada não numérica', () => {
    expect(g.psNum('', 5)).toBe(5);
    expect(g.psNum('abc', 5)).toBe(5);
  });
  it('parseia números normais', () => {
    expect(g.psNum('2.5', 5)).toBe(2.5);
    expect(g.psNum('-40', 5)).toBe(-40);
  });
});
