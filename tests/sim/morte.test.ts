// Morte de jogador: além da perda de XP, o personagem perde um percentual
// aleatório do ouro acumulado (entre min e max do level_config; padrão 10–50%).
// Roda no harness determinístico; o PATCH de characters é mockado.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { bootAventuraSim } from './harness';

const g = globalThis as any;

afterEach(() => {
  vi.useRealTimers();
});

describe('morte: perda de ouro', () => {
  it('perde entre 10% e 50% do ouro; broadcast carrega ouroPerdido/novoOuro', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
    char.custom_attrs.ouro = 1000;

    const broadcasts: any[] = [];
    const orig = g._avtBroadcast;
    g._avtBroadcast = (tipo: any, payload: any) => { broadcasts.push({ tipo, payload }); };
    try {
      alice.hp = 0;
      await g._avtProcessarMorteJogador(alice, null);
    } finally {
      g._avtBroadcast = orig;
    }

    const perda = 1000 - char.custom_attrs.ouro;
    expect(perda).toBeGreaterThanOrEqual(100); // 10% de 1000
    expect(perda).toBeLessThanOrEqual(500);    // 50% de 1000
    const ev = broadcasts.find((b: any) => b.tipo === 'avt_jogador_morreu');
    expect(ev.payload.ouroPerdido).toBe(perda);
    expect(ev.payload.novoOuro).toBe(char.custom_attrs.ouro);
  });

  it('sem ouro: nada a perder, nunca fica negativo', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
    char.custom_attrs.ouro = 0;

    alice.hp = 0;
    await g._avtProcessarMorteJogador(alice, null);
    expect(char.custom_attrs.ouro).toBe(0);
  });

  it('percentuais configuráveis: min=max=0 desliga a perda', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
    char.custom_attrs.ouro = 500;
    sim.state.rpg.theme_json.level_config = {
      morte_ouro_perda_min_pct: 0, morte_ouro_perda_max_pct: 0,
    };

    alice.hp = 0;
    await g._avtProcessarMorteJogador(alice, null);
    expect(char.custom_attrs.ouro).toBe(500);
  });

  it('receiver espelha novoOuro no char local e mantém os demais campos', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const bob = sim.state.chars.find((c: any) => c.nome === 'Bob');
    bob.custom_attrs.ouro = 300;

    g.avtReceberJogadorMorreu({
      charNome: 'Bob', xpPerdido: 50, novoXp: 0, nivelAntes: 1, nivelDepois: 1,
      ouroPerdido: 120, novoOuro: 180,
    });
    expect(bob.custom_attrs.ouro).toBe(180);
  });
});
