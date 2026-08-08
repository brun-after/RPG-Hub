// Janelas de interação do Modo Aventura: abrir baú/loja mostra contagem acima
// da janela, congela o jogador local (pausado para todos os efeitos) e fecha
// sozinha ao zerar; a loja entra em recarga de 10s por jogador ao fechar.
// Roda no harness determinístico (fake timers + RNG seedado).
import { describe, it, expect, afterEach, vi } from 'vitest';
import '../../js/systems/avt-inventario.js'; // AVT_INV/loja não entram no boot padrão do harness
import { bootAventuraSim } from './harness';
import { stubFetchRotas } from '../helpers/mock-fetch';
import { rotasAventura } from './fixtures-aventura';

const g = globalThis as any;

// _escHtml vive em js/combat/reactions.ts (não importado pelo harness); o
// popup de loot e o modal da loja usam-no ao montar innerHTML.
g._escHtml = g._escHtml || ((s: any) => String(s ?? ''));

afterEach(() => {
  vi.useRealTimers();
  // O módulo é singleton e cada teste re-seta o relógio para a mesma época:
  // congelamento/cooldowns/loja de um teste anterior ficariam "no futuro".
  if (g.AVT_STATE) { g.AVT_STATE._congeladoAte = 0; g.AVT_STATE._oocCooldowns = {}; }
  if (g.AVT_INV) (g.AVT_INV as any)._lojaAberta = null;
  document.getElementById('avt-loja-modal')?.remove();
  if (typeof g._avtCountdownBadgeLimpar === 'function') g._avtCountdownBadgeLimpar();
});

// Baú injetado na célula de spawn da Alice (3,3) — só ouro, para não depender
// do fluxo de POST de inventário.
const injBau = (sim: any, extra: any = {}) => {
  const bau = {
    id: 'bau_janela', tipo: 'bau', nome: 'Baú Sim', x: 3 / 24, y: 3 / 16,
    loot_itens: [], ouro: 40, aberto: false, trancado: false, ...extra,
  };
  sim.state.dungeon.render_data.objetos.push(bau);
  return bau;
};

const ROW_COMPRADO = {
  id: 'inv-comprado', rpg_id: 'rpg-sim', character_id: 'char-alice',
  item_catalog_id: 'it-pocao', quantidade: 1, equipado: false,
  slot_equipado: null, bonus_snapshot: null,
};

async function bootComLoja(estoque: any, opts: { ouro?: number } = {}) {
  const sim = await bootAventuraSim({ charNome: 'Alice' });
  stubFetchRotas([
    { match: /\/rest\/v1\/inventario$/, resposta: [ROW_COMPRADO], status: 200 },
    ...rotasAventura(),
  ]);
  const loja = { id: 'loja1', tipo: 'loja', nome: 'Empório Sim', icone: '🛒', x: 4 / 24, y: 3 / 16, estoque };
  sim.state.dungeon.render_data.objetos.push(loja);
  const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
  char.custom_attrs.ouro = opts.ouro ?? 100;
  await g.avtInvInit('rpg-sim');
  (g.AVT_INV.inventarios as any)['char-alice'] = (g.AVT_INV.inventarios as any)['char-alice'] || [];
  return { sim, loja, char };
}

describe('baú: janela com contagem + congelamento', () => {
  it('abre, saqueia, congela ~3s (sem movimento) e fecha sozinho', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
    char.custom_attrs.ouro = 0;
    injBau(sim);

    await g.avtAbrirBau('bau_janela');

    // Loot entregue normalmente + janela com badge de contagem + congelamento
    expect(char.custom_attrs.ouro).toBe(40);
    expect(document.getElementById('avt-loot-popup')).toBeTruthy();
    expect(document.getElementById('avt-countdown-badge')).toBeTruthy();
    expect(alice._pausado).toBe(true);

    // Movimento bloqueado durante o congelamento
    g._avtMoverJogador(1, 0);
    sim.run(30);
    expect(Math.round(alice.x)).toBe(3);

    // ~3.5s depois: janela e badge fechados, congelamento liberado
    sim.run(180);
    expect(document.getElementById('avt-countdown-badge')).toBeNull();
    expect(document.getElementById('avt-loot-popup')).toBeNull();
    expect(alice._pausado).toBeUndefined();

    g._avtMoverJogador(1, 0);
    sim.run(90);
    expect(Math.round(alice.x)).toBe(4);
  });

  it('baú trancado: palavra errada não abre nem congela; a certa abre e congela', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    injBau(sim, { trancado: true, chave_palavra: 'abracadabra' });

    vi.stubGlobal('prompt', vi.fn(() => 'errada'));
    await g.avtAbrirBau('bau_janela');
    expect(alice._pausado).toBeUndefined();
    expect(document.getElementById('avt-loot-popup')).toBeNull();

    vi.stubGlobal('prompt', vi.fn(() => 'abracadabra'));
    await g.avtAbrirBau('bau_janela');
    expect(alice._pausado).toBe(true);
    expect(document.getElementById('avt-loot-popup')).toBeTruthy();
  });

  it('congelado é imune a DOT (tick re-baseado, sem dano acumulado)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    injBau(sim);
    await g.avtAbrirBau('bau_janela');
    expect(alice._pausado).toBe(true);

    const hpAntes = alice.hp;
    sim.state._oocStatusEffects.push({
      entId: alice.id, entNome: alice.nome, lastTickAt: Date.now() - 10_000,
      ef: { tipo: 'dot', dot_formula: '1d4', _turnos_restantes: 9, expiry_ms: Date.now() + 120_000 },
    });
    sim.run(120); // ~2s congelado: ticks devidos são pulados e re-baseados
    expect(alice.hp).toBe(hpAntes);

    sim.run(400); // descongela (~3s) e o DOT volta a ticar (cd padrão 3s)
    expect(alice.hp).toBeLessThan(hpAntes);
  });
});

describe('loja: janela com contagem + recarga por jogador', () => {
  it('abre congelando, recusa fechar antes, fecha sozinha e arma recarga de 10s', async () => {
    const { sim } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }]);
    await g.avtAbrirLoja('loja1');

    expect(document.getElementById('avt-loja-modal')).toBeTruthy();
    expect(document.getElementById('avt-countdown-badge')).toBeTruthy();
    expect(sim.jogador()._pausado).toBe(true);

    // Fechamento manual (×/clique fora) recusado durante a contagem
    g.avtFecharLoja();
    expect(document.getElementById('avt-loja-modal')).toBeTruthy();

    // ~5.5s: fechou sozinha, descongelou e armou a recarga
    sim.run(330);
    expect(document.getElementById('avt-loja-modal')).toBeNull();
    expect(sim.jogador()._pausado).toBeUndefined();
    const cd = sim.state._oocCooldowns['loja_char-alice_loja1'];
    expect(cd).toBeGreaterThan(Date.now());

    // Em recarga: reabrir é recusado
    await g.avtAbrirLoja('loja1');
    expect((g.AVT_INV as any)._lojaAberta).toBeNull();

    // Recarga vencida: abre de novo
    vi.advanceTimersByTime(11_000);
    await g.avtAbrirLoja('loja1');
    expect((g.AVT_INV as any)._lojaAberta).toBeTruthy();
  });

  it('comprar durante a janela congelada funciona', async () => {
    const { sim, char } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }]);
    await g.avtAbrirLoja('loja1');
    expect(sim.jogador()._pausado).toBe(true);
    await g.avtLojaComprar('loja1', 'it-pocao'); // Poção, valor_base 30
    expect(char.custom_attrs.ouro).toBe(70);
  });

  it('morrer com a loja aberta fecha a janela, arma a recarga e descongela', async () => {
    const { sim } = await bootComLoja([{ item_id: 'it-pocao', qtd: 1 }]);
    await g.avtAbrirLoja('loja1');
    const alice = sim.jogador();
    alice.hp = 0;
    await g._avtProcessarMorteJogador(alice, null);

    expect(document.getElementById('avt-loja-modal')).toBeNull();
    expect(sim.state._oocCooldowns['loja_char-alice_loja1']).toBeGreaterThan(Date.now());
    expect(sim.state._congeladoAte || 0).toBe(0);
  });

  it('exclusão mútua: não abre baú durante a janela da loja', async () => {
    const { sim } = await bootComLoja([]);
    injBau(sim);
    await g.avtAbrirLoja('loja1');
    await g.avtAbrirBau('bau_janela');
    const bau = sim.state.dungeon.render_data.objetos.find((o: any) => o.id === 'bau_janela');
    expect(bau.aberto).toBe(false);
    expect(document.getElementById('avt-loot-popup')).toBeNull();
  });
});
