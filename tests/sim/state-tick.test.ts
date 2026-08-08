// Serialização e reconciliação do tick autoritativo entre "dois clientes".
//
// LIMITAÇÃO CONHECIDA (aceita e documentada): aventura.js é singleton no
// processo — closures do patch HOST-RTC (_tickBase etc.) são compartilhadas.
// Por isso só o lado "host" constrói ticks aqui; o lado "cliente" é um clone
// do AVT_STATE trocado via setter global antes de aplicar avtReceberStateTick.
// Não transforme este teste em dois hosts simultâneos — os deltas se misturam.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { bootAventuraSim, cloneEstado, digest } from './harness';

const g = globalThis as any;

const CAMPOS_TICK = [
  'id', 'nome', 'x', 'y', 'hp', 'hpMax', 'tipo', 'morto', 'anim', 'escondido',
  'pausado', 'status_effects', 'atravessar', 'fantasma', 'ackSeq', 'dominado',
  'donoNome', 'cor', 'pat',
].sort();

let souHost = true;

beforeEach(() => {
  souHost = true;
});

afterEach(() => {
  vi.useRealTimers();
});

async function bootHost() {
  const sim = await bootAventuraSim({ charNome: 'Alice', uid: 'uid-host' });
  // Autoridade de fase controlada pelo teste (setter global reassina o binding
  // do módulo — _souHostDaFase() interno passa a consultar este stub).
  g._avtSouHostDaFaseAtual = () => souHost;
  // O gate reseta _tickBase quando NÃO se é host: garante base limpa por teste
  souHost = false; g._avtBuildStateTick();
  souHost = true;
  return sim;
}

describe('_avtBuildStateTick (lado host)', () => {
  it('primeiro tick é keyframe completo com o conjunto exato de campos', async () => {
    const sim = await bootHost();
    const kf = g._avtBuildStateTick();

    expect(kf).toBeTruthy();
    expect(kf.full).toBe(true);
    expect(kf.v).toBe(2);
    expect(kf.faseId).toBe('principal');
    expect(kf.hostId).toBe('uid-host');
    expect(kf.entidades).toHaveLength(sim.state.entidades.length); // 2 jogadores + 2 NPCs

    for (const r of kf.entidades) {
      expect(Object.keys(r).sort()).toEqual(CAMPOS_TICK);
      for (const k of ['x', 'y', 'hp', 'hpMax']) {
        expect(Number.isFinite(r[k]), `${r.nome}.${k}`).toBe(true);
      }
    }
  });

  it('delta: sem mudanças → null; com mudança → só a entidade mudada', async () => {
    const sim = await bootHost();
    g._avtBuildStateTick(); // keyframe

    expect(g._avtBuildStateTick()).toBeNull(); // nada mudou

    sim.npc('ini_0').x += 1;
    const delta = g._avtBuildStateTick();
    expect(delta.full).toBe(false);
    expect(delta.entidades).toHaveLength(1);
    expect(delta.entidades[0].id).toBe('ini_0');
  });

  it('keyframe novo a cada 10 builds não-keyframe', async () => {
    await bootHost();
    const kf1 = g._avtBuildStateTick();
    expect(kf1.full).toBe(true);

    for (let i = 0; i < 9; i++) {
      expect(g._avtBuildStateTick()).toBeNull(); // deltas vazios (n = 1..9)
    }
    const kf2 = g._avtBuildStateTick();
    expect(kf2).toBeTruthy();
    expect(kf2.full).toBe(true);
  });

  it('sem autoridade de fase o build retorna null e zera a base', async () => {
    await bootHost();
    g._avtBuildStateTick();
    souHost = false;
    expect(g._avtBuildStateTick()).toBeNull();
    souHost = true;
    expect(g._avtBuildStateTick().full).toBe(true); // base zerada → keyframe de novo
  });
});

describe('avtReceberStateTick (lado cliente)', () => {
  it('cliente converge para o estado do host (posição, hp, status)', async () => {
    const sim = await bootHost();

    // Clone vira o "cliente B" (Bob), com o estado idêntico ao do host
    const estadoB = cloneEstado();
    estadoB.myCharNome = 'Bob';

    // Host evolui: Alice anda 1 célula (dentro da dead-band → snap direto no
    // cliente), goblin toma dano e ganha um status effect
    const aliceHost = sim.jogador();
    aliceHost.x += 1; aliceHost.renderX = aliceHost.x;
    const goblinHost = sim.npc('ini_0');
    goblinHost.hp -= 40;
    goblinHost.status_effects = [{ tipo: 'dot', _turnos_restantes: 2, dot_formula: '1d4' }];

    const kf = g._avtBuildStateTick();
    expect(kf.full).toBe(true);

    // Aplica no cliente B (não-host)
    const estadoA = g.AVT_STATE;
    g.AVT_STATE = estadoB;
    souHost = false;
    g.avtReceberStateTick(kf);
    souHost = true;
    g.AVT_STATE = estadoA;

    const aliceB = estadoB.entidades.find((e: any) => e.nome === 'Alice');
    const goblinB = estadoB.entidades.find((e: any) => e.id === 'ini_0');
    expect(aliceB.x).toBe(aliceHost.x);
    expect(goblinB.hp).toBe(goblinHost.hp);
    expect(goblinB.status_effects).toEqual(goblinHost.status_effects);

    // Digest canônico converge por completo (≤1 célula é a tolerância de
    // regime; aqui, com snap direto, a igualdade é exata)
    expect(digest(estadoB.entidades)).toBe(digest(sim.state.entidades));
  });

  it('tick de outra fase é ignorado por completo', async () => {
    const sim = await bootHost();
    const estadoB = cloneEstado();
    estadoB.myCharNome = 'Bob';

    sim.jogador().x += 1;
    const kf = g._avtBuildStateTick();
    kf.faseId = 'outra-fase';

    const antes = digest(estadoB.entidades);
    const estadoA = g.AVT_STATE;
    g.AVT_STATE = estadoB;
    souHost = false;
    g.avtReceberStateTick(kf);
    souHost = true;
    g.AVT_STATE = estadoA;

    expect(digest(estadoB.entidades)).toBe(antes);
  });

  it('host não aplica o próprio tick em si mesmo', async () => {
    const sim = await bootHost();
    const kf = g._avtBuildStateTick();

    sim.jogador().x += 3; // host diverge do payload de propósito
    const xHost = sim.jogador().x;
    g.avtReceberStateTick(kf); // souHost=true → deve ser no-op
    expect(sim.jogador().x).toBe(xHost);
  });
});
