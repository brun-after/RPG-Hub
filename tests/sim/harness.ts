// Harness da simulação de jogabilidade do Modo Aventura.
//
// Boota a aventura em happy-dom SEM rede (fetch mockado) e SEM RAF: o teste
// chama o tick real da simulação (_avtRenderFrame) manualmente com dt fixo,
// com RNG (Math.random), Date e performance.now determinísticos. Cada tick
// valida invariantes — uma violação lança com contexto e é um bug encontrado.
//
// Módulos importados na ordem do main.ts (os que a simulação usa como bare
// globals): effect-registry (normalização de skills), combat (parser/rolagem
// de fórmulas), fase-tileset (_avtTilePassavel), avt-perf (AVT_PERF real como
// sonda de vida do loop) e aventura.
import { vi } from 'vitest';
import '../../js/systems/effect-registry.js';
import '../../js/combat/combat.js';
import '../../js/maps/fase-tileset.js';
import '../../js/systems/aventura.js';
import '../../js/systems/avt-menu.js';   // AVT_GRAFICOS + _hexToRgb (usados pelo frame)
import '../../js/systems/avt-perf.js';
import { stubFetchRotas } from '../helpers/mock-fetch';
import { rotasAventura, RPG_ID } from './fixtures-aventura';

const g = globalThis as any;

// PRNG determinístico para substituir Math.random (79 call sites bare em
// aventura.js — um stub global cobre todos).
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// happy-dom retorna null em getContext('2d'); o caminho de desenho legado usa
// dezenas de métodos e o check `'filter' in ctx`. Um Proxy no-op cobre tudo.
function makeCtx(canvas: any) {
  const noop = () => undefined;
  const base: any = { canvas };
  return new Proxy(base, {
    get: (t, p) => {
      if (p in t) return t[p];
      if (p === 'measureText') return () => ({ width: 0 });
      if (p === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
      if (p === 'createRadialGradient' || p === 'createLinearGradient') {
        return () => ({ addColorStop: noop });
      }
      return noop;
    },
    set: (t, p, v) => { t[p as any] = v; return true; },
    has: () => true, // `'filter' in ctx` → true
  });
}

export function stubCanvas2D() {
  (g.HTMLCanvasElement as any).prototype.getContext = function () { return makeCtx(this); };
}

// Campos que não sobrevivem a JSON (funções, canvas) ou que são por-cliente.
const CLONE_SKIP = new Set(['canvas', 'ctx', 'animFrame', '_tilesetTextures']);

// Clona o AVT_STATE atual para servir de "segundo cliente" no teste de
// state-tick (o módulo é singleton — o clone recebe canvas/ctx próprios).
export function cloneEstado(): any {
  const src = g.AVT_STATE;
  const json = JSON.stringify(src, (k, v) => {
    if (typeof v === 'function') return undefined;
    if (CLONE_SKIP.has(k)) return undefined;
    return v;
  });
  const clone = JSON.parse(json);
  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  clone.canvas = canvas;
  clone.ctx = makeCtx(canvas);
  return clone;
}

export function assertInvariants(S: any) {
  const d = S.dungeon;
  for (const e of S.entidades || []) {
    for (const k of ['x', 'y', 'renderX', 'renderY', 'hp', 'hpMax']) {
      if (e[k] != null && !Number.isFinite(e[k])) {
        throw new Error(`invariante: ${e.nome}.${k} não-finito (${e[k]})`);
      }
    }
    if (d && (e.x < -1 || e.x > d.w || e.y < -1 || e.y > d.h)) {
      throw new Error(`invariante: ${e.nome} fora do mapa (${e.x},${e.y}) em ${d.w}×${d.h}`);
    }
    if (Number.isFinite(e.hp) && Number.isFinite(e.hpMax) && e.hp > e.hpMax) {
      throw new Error(`invariante: ${e.nome} hp ${e.hp} > hpMax ${e.hpMax}`);
    }
    if (Array.isArray(e._waypoints) && e._waypoints.length > 64) {
      throw new Error(`invariante: fila de waypoints de ${e.nome} explodiu (${e._waypoints.length})`);
    }
    JSON.stringify(e, (k, v) => {
      if (typeof v === 'number' && Number.isNaN(v)) {
        throw new Error(`invariante: NaN em ${e.nome}.${k}`);
      }
      return typeof v === 'function' ? undefined : v;
    });
  }
}

// Digest canônico para comparação entre clientes: exatamente os campos que o
// state tick autoritativo serializa; renderX/renderY (interpolação) ficam fora.
export function digest(entidades: any[]): string {
  return (entidades || [])
    .filter(e => !e.escondido)
    .map(e => [e.id, Math.round(e.x), Math.round(e.y), e.hp, e.hpMax, e.tipo].join(':'))
    .sort()
    .join('|');
}

export interface SimHandle {
  tick: (dt?: number) => void;
  run: (n: number, dt?: number) => void;
  readonly state: any;
  jogador: () => any;
  npc: (id: string) => any;
}

export async function bootAventuraSim(opts: {
  charNome: string; uid?: string; seed?: number; ia?: boolean;
}): Promise<SimHandle> {
  stubFetchRotas(rotasAventura());
  stubCanvas2D();

  document.body.innerHTML =
    '<div id="aventura-screen"></div><div id="avt-dados-overlay"></div>';

  // Relógio determinístico: performance.now anda por simNow; Date/timers via
  // fake timers (avançados junto no tick).
  let simNow = 0;
  vi.useFakeTimers();
  vi.setSystemTime(1_700_000_000_000);
  vi.spyOn(performance, 'now').mockImplementation(() => simNow);
  vi.spyOn(Math, 'random').mockImplementation(mulberry32(opts.seed ?? 42));

  g.SESSION = { user: { id: opts.uid ?? 'uid-host' }, nickname: opts.charNome };
  g.CURRENT_RPG = RPG_ID;

  await g._avtCarregarDados(RPG_ID);

  g.AVT_STATE.myCharNome = opts.charNome;
  g.AVT_STATE.npcIaAtiva = opts.ia ?? false;      // patrulha só quando o cenário pede
  g.AVT_STATE.npcSyncEnabled = false;             // state tick = autoridade única
  if (g.AVT_GRAFICOS) g.AVT_GRAFICOS.adaptativo = false;
  if (typeof g.AVT_PERF?.pararAdaptativo === 'function') g.AVT_PERF.pararAdaptativo();

  const canvas = document.createElement('canvas');
  canvas.width = 1280; canvas.height = 720;
  g.AVT_STATE.canvas = canvas;
  g.AVT_STATE.ctx = makeCtx(canvas);
  if (!g.AVT_STATE.camera) g.AVT_STATE.camera = { x: 0, y: 0 };
  g.AVT_STATE._lastFrameTs = 0;

  const tick = (dt = 16.67) => {
    simNow += dt;
    vi.advanceTimersByTime(dt);
    g._avtRenderFrame();
    assertInvariants(g.AVT_STATE);
  };
  const run = (n: number, dt = 16.67) => { for (let i = 0; i < n; i++) tick(dt); };

  return {
    tick,
    run,
    get state() { return g.AVT_STATE; },
    jogador: () => g.AVT_STATE.entidades.find((e: any) => e.nome === opts.charNome),
    npc: (id: string) => g.AVT_STATE.entidades.find((e: any) => e.id === id),
  };
}
