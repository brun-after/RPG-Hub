// Despawn/respawn de objetos do mapa: baús abertos somem alguns segundos após
// a abertura (cull do host, inclusive estado legado sem stamp) sem ressuscitar
// via rd.baus; armadilhas dinâmicas (dynt_) spawnam pelo spawner dinâmico,
// disparam oneshot e expiram no TTL, mudando de lugar nos ciclos seguintes.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { bootAventuraSim } from './harness';

const g = globalThis as any;

// _escHtml vive em js/combat/reactions.ts (não importado pelo harness); o
// popup de loot usa-o ao montar innerHTML.
g._escHtml = g._escHtml || ((s: any) => String(s ?? ''));

afterEach(() => {
  vi.useRealTimers();
});

// Host da fase + carência de boot do cull vencida + spawner quieto (a menos
// que o teste peça): pré-condições para o cull rodar de forma determinística.
function prepararHost(sim: any, opts: { spawnerAtivo?: boolean } = {}) {
  g._avtSouHostDaFaseAtual = () => true;
  sim.state._cullGraceAte = 1;
  if (!opts.spawnerAtivo) sim.state._dynSpawnNextAt = Number.MAX_SAFE_INTEGER;
}

describe('baú aberto: despawn', () => {
  it('some de rd.objetos E rd.baus após ~5s; normalizador não ressuscita', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    prepararHost(sim);
    const rd = sim.state.dungeon.render_data;
    rd.baus = [{ id: 'bau_gen', nome: 'Baú Gerado', x: 3 / 24, y: 3 / 16, ouro: 10, loot_itens: [], aberto: false }];
    g._avtNormalizarObjetosDungeon(sim.state.dungeon);
    expect(rd.objetos.some((o: any) => o.id === 'bau_gen')).toBe(true);

    await g.avtAbrirBau('bau_gen');
    const bau = rd.objetos.find((o: any) => o.id === 'bau_gen');
    expect(bau.aberto).toBe(true);
    expect(bau._despawnEm).toBeGreaterThan(Date.now());

    sim.run(400); // > 5s de despawn + varredura de 1s
    expect(rd.objetos.some((o: any) => o.id === 'bau_gen')).toBe(false);
    expect((rd.baus || []).some((b: any) => b.id === 'bau_gen')).toBe(false);

    // Regressão: re-normalizar não pode recriar o baú removido
    g._avtNormalizarObjetosDungeon(sim.state.dungeon);
    expect(rd.objetos.some((o: any) => o.id === 'bau_gen')).toBe(false);
  });

  it('baú legado (aberto sem _despawnEm) ganha stamp retroativo e some', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    prepararHost(sim);
    const rd = sim.state.dungeon.render_data;
    const legado = {
      id: 'bau_legado', tipo: 'bau', nome: 'Baú Antigo', x: 10 / 24, y: 10 / 16,
      loot_itens: [], ouro: 0, aberto: true,
    };
    rd.objetos.push(legado);

    sim.run(70); // primeira varredura: stampa o despawn
    expect(legado._despawnEm).toBeGreaterThan(Date.now());
    expect(rd.objetos.some((o: any) => o.id === 'bau_legado')).toBe(true);

    sim.run(400); // vence o stamp → removido
    expect(rd.objetos.some((o: any) => o.id === 'bau_legado')).toBe(false);
  });

  it('não-host não remove nada (autoridade do cull é do host da fase)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    g._avtSouHostDaFaseAtual = () => false;
    sim.state._cullGraceAte = 1;
    sim.state._dynSpawnNextAt = Number.MAX_SAFE_INTEGER;
    const rd = sim.state.dungeon.render_data;
    rd.objetos.push({
      id: 'bau_guest_cull', tipo: 'bau', nome: 'Baú', x: 10 / 24, y: 10 / 16,
      loot_itens: [], ouro: 0, aberto: true, _despawnEm: Date.now() - 1000,
    });
    sim.run(150);
    expect(rd.objetos.some((o: any) => o.id === 'bau_guest_cull')).toBe(true);
  });

  it('guest: avtReceberObjPickup remove também de rd.baus (sem ressurreição)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const rd = sim.state.dungeon.render_data;
    rd.baus = [{ id: 'bau_guest', nome: 'Baú', x: 8 / 24, y: 8 / 16, ouro: 5, loot_itens: [], aberto: true }];
    g._avtNormalizarObjetosDungeon(sim.state.dungeon);
    expect(rd.objetos.some((o: any) => o.id === 'bau_guest')).toBe(true);

    g.avtReceberObjPickup({ objId: 'bau_guest' });
    expect(rd.objetos.some((o: any) => o.id === 'bau_guest')).toBe(false);
    expect(rd.baus.some((b: any) => b.id === 'bau_guest')).toBe(false);

    g._avtNormalizarObjetosDungeon(sim.state.dungeon);
    expect(rd.objetos.some((o: any) => o.id === 'bau_guest')).toBe(false);
  });
});

describe('armadilhas dinâmicas (dynt_)', () => {
  const LC_TRAPS = {
    dyn_spawn_ativo: true, dyn_spawn_intervalo_s: 15,
    dyn_bau_max: 0, dyn_loot_max: 0, dyn_orbe_max: 0,
    dyn_trap_max: 2, dyn_trap_chance: 1, dyn_trap_ttl_s: 20,
  };

  it('spawner semeia até o máximo, oneshot dispara ao pisar, TTL expira e repõe', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    prepararHost(sim, { spawnerAtivo: true });
    sim.state.rpg.theme_json.level_config = { ...LC_TRAPS };
    sim.state._dynSpawnNextAt = 0;
    sim.tick();

    const rd = sim.state.dungeon.render_data;
    const traps = rd.objetos.filter((o: any) => String(o.id).startsWith('dynt_'));
    expect(traps).toHaveLength(2);
    for (const t of traps) {
      expect(t.tipo).toBe('armadilha_mestre');
      expect(t.modo).toBe('oneshot');
      expect(t.armada).toBe(true);
      expect(t.formula).toBe('1d6'); // nível 1 da fase
      expect(t._expiraEm).toBeGreaterThan(Date.now());
    }

    // Alice pisa numa trap: dano + objeto some (fluxo oneshot existente)
    const alice = sim.jogador();
    const [t0, t1] = traps;
    alice.x = Math.round(t0.x * 24); alice.y = Math.round(t0.y * 16);
    const hpAntes = alice.hp;
    g._avtChecarArmadilhaMestreNaPosicao(alice);
    expect(alice.hp).toBeLessThan(hpAntes);
    expect(rd.objetos.some((o: any) => o.id === t0.id)).toBe(false);

    // A trap restante expira no TTL e é removida pelo cull do host
    vi.advanceTimersByTime(21_000);
    sim.run(80);
    expect(rd.objetos.some((o: any) => o.id === t1.id)).toBe(false);

    // Próximo ciclo do spawner repõe a população em novas células
    sim.state._dynSpawnNextAt = 0;
    sim.tick();
    const novas = rd.objetos.filter((o: any) => String(o.id).startsWith('dynt_'));
    expect(novas).toHaveLength(2);
    expect(novas.some((t: any) => t.id === t0.id || t.id === t1.id)).toBe(false);
  });

  it('traps do mestre (traphm_, sem TTL) não são tocadas pelo cull', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    prepararHost(sim);
    const rd = sim.state.dungeon.render_data;
    rd.objetos.push({
      id: 'traphm_fixa', tipo: 'armadilha_mestre', nome: 'Espinhos',
      x: 12 / 24, y: 12 / 16, formula: '1d6', efeito: null,
      modo: 'oneshot', rearmar_s: 30, armada: true, _rearmarEm: null,
    });
    vi.advanceTimersByTime(30_000);
    sim.run(150);
    expect(rd.objetos.some((o: any) => o.id === 'traphm_fixa')).toBe(true);
  });
});
