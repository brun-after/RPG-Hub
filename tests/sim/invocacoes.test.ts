// Fundação das invocações (Fase 0): funil único de dano (_avtAplicarDanoInvocacao)
// com resistência e espelho de hp_atual, destruição ao zerar HP (inclusive presa
// na iniciativa — F2), morte do dono derruba as invocações (F1) e destruição
// idempotente (eco de broadcast). O catálogo INV_OCACOES é injetado direto como
// global — o loader real depende de `sb`, que não existe no harness.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { bootAventuraSim } from './harness';

const g = globalThis as any;

const DEF_SENTINELA = {
  id: 'inv-sentinela', rpg_id: 'rpg-sim', nome: 'Sentinela Sim',
  comportamento: 'protetor', dummy_explosivo: false,
  hp_base: 30, hp_atributo_scaling: null, hp_atributo_pct: 0,
  dano_formula: '1d6', cura_formula: null,
  resistencia_base: 0, resistencia_atributo_scaling: null, resistencia_atributo_pct: 0,
  duracao_base_turnos: 3, duracao_sabedoria_mult: 0, iniciativa_bonus: 0,
  visual_tipo: null, visual_config: {}, habilidades: [],
};

function invocar(sim: any, defOverrides: any = {}) {
  // AVT_STATE é singleton do módulo: invocações de um teste anterior sobrevivem
  // ao boot seguinte. Começar limpo mantém cada teste hermético.
  sim.state.invocacoes_ativas = [];
  sim.state.entidades = sim.state.entidades.filter((e: any) => e.tipo !== 'invocado');
  const def = { ...DEF_SENTINELA, ...defOverrides };
  g.INV_OCACOES = { catalogo: [def], carregado: true };
  g.avtInvocar('Alice', def.id);
  const inv = sim.state.invocacoes_ativas.find((i: any) => i.dono_char_nome === 'Alice');
  const ent = sim.state.entidades.find((e: any) => e.id === inv?.id);
  return { inv, ent };
}

afterEach(() => {
  vi.useRealTimers();
});

describe('invocações: fundação', () => {
  it('avtInvocar cria entidade + registro com HP espelhado', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim);
    expect(inv).toBeTruthy();
    expect(ent).toBeTruthy();
    expect(ent.tipo).toBe('invocado');
    expect(ent.hp).toBe(30);
    expect(inv.hp_atual).toBe(30);
    expect(g._avtInvAtivaDe(ent)).toBe(inv);
  });

  it('dano pelo funil sincroniza hp_atual (F4) e espelha na iniciativa', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim);
    const bat = {
      id: 'bat-t', iniciativa: [{ ...ent, initRoll: 10 }], envolvidos: [ent.id],
      turnoIdx: 0, log: [], movimentoRestante: {}, _cooldowns: {},
    };
    const aplicado = g._avtAplicarDanoInvocacao(ent, 12, bat);
    expect(aplicado).toBe(12);
    expect(ent.hp).toBe(18);
    expect(inv.hp_atual).toBe(18);
    expect(bat.iniciativa[0].hp).toBe(18);
  });

  it('resistencia_base reduz o dano como redução plana', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim, { resistencia_base: 5 });
    const aplicado = g._avtAplicarDanoInvocacao(ent, 12, null);
    expect(aplicado).toBe(7);
    expect(ent.hp).toBe(23);
    expect(inv.hp_atual).toBe(23);
    // resistência nunca "cura": dano menor que a redução vira 0, não negativo
    expect(g._avtAplicarDanoInvocacao(ent, 3, null)).toBe(0);
    expect(ent.hp).toBe(23);
  });

  it('resistencia_atributo_scaling soma a redução pelo atributo do dono', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    // Alice tem Força 14 → 14 × 50% = 7 de redução extra (+2 base = 9)
    const { ent } = invocar(sim, {
      resistencia_base: 2, resistencia_atributo_scaling: 'Força', resistencia_atributo_pct: 50,
    });
    expect(g._avtAplicarDanoInvocacao(ent, 20, null)).toBe(11);
  });

  it('zerar HP destrói a invocação: some das entidades, do registro e da iniciativa', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim);
    const bat = {
      id: 'bat-t', iniciativa: [{ ...ent, initRoll: 10 }], envolvidos: [ent.id],
      turnoIdx: 0, log: [], movimentoRestante: {}, _cooldowns: {},
    };
    g._avtAplicarDanoInvocacao(ent, 999, bat);
    expect(sim.state.entidades.some((e: any) => e.id === inv.id)).toBe(false);
    expect(sim.state.invocacoes_ativas.length).toBe(0);
    expect(bat.iniciativa.some((e: any) => e.id === inv.id)).toBe(false);
    expect(bat.envolvidos).not.toContain(inv.id);
  });

  it('F2: _avtTurnoAvancar destrói invocação com hp 0 presa na iniciativa', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim);
    // Simula o bug antigo: HP zerado por fora do funil, entrada segue na iniciativa
    ent.hp = 0;
    const alice = sim.jogador();
    const goblin = sim.npc('ini_0');
    const bat = {
      id: 'bat-t', turnoIdx: 0, log: [], movimentoRestante: {}, _cooldowns: {},
      iniciativa: [
        { ...alice, initRoll: 20 },
        { ...ent, initRoll: 10, hp: 0 },
        { ...goblin, initRoll: 5 },
      ],
      envolvidos: [alice.id, ent.id, goblin.id],
    };
    sim.state.batalhas.push(bat);
    g._avtTurnoAvancar(bat);
    expect(bat.iniciativa.some((e: any) => e.id === inv.id)).toBe(false);
    expect(sim.state.entidades.some((e: any) => e.id === inv.id)).toBe(false);
    expect(sim.state.invocacoes_ativas.length).toBe(0);
    // O combate segue com os vivos
    expect(bat.iniciativa.some((e: any) => e.id === goblin.id)).toBe(true);
  });

  it('F1: morte do dono destrói suas invocações', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv } = invocar(sim);
    const alice = sim.jogador();
    alice.hp = 0;
    await g._avtProcessarMorteJogador(alice, null);
    expect(sim.state.invocacoes_ativas.length).toBe(0);
    expect(sim.state.entidades.some((e: any) => e.id === inv.id)).toBe(false);
  });

  it('F1: invocação de outro dono sobrevive à morte de Alice', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv } = invocar(sim);
    inv.dono_char_nome = 'Bob'; // reatribui o vínculo — dono diferente do morto
    const alice = sim.jogador();
    alice.hp = 0;
    await g._avtProcessarMorteJogador(alice, null);
    expect(sim.state.invocacoes_ativas.some((i: any) => i.id === inv.id)).toBe(true);
  });

  it('destruição é idempotente: segunda chamada não emite broadcast de novo', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv } = invocar(sim);
    const broadcasts: any[] = [];
    const orig = g._avtBroadcast;
    g._avtBroadcast = (tipo: any, payload: any) => { broadcasts.push({ tipo, payload }); };
    try {
      g._avtDestruirInvocacao(inv.id, null, 'dispensada');
      g._avtDestruirInvocacao(inv.id, null, 'dispensada'); // eco/duplicata
    } finally {
      g._avtBroadcast = orig;
    }
    const evs = broadcasts.filter((b: any) => b.tipo === 'avt_invocacao_destruida');
    expect(evs.length).toBe(1);
    expect(evs[0].payload.motivo).toBe('dispensada');
  });

  it('F5: peer registra invocacoes_ativas ao receber avt_entidade_nova (rastro não é hostil)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    sim.state.invocacoes_ativas = [];
    sim.state.entidades = sim.state.entidades.filter((e: any) => e.tipo !== 'invocado');
    // Payload como o emitido por avtInvocar em OUTRO cliente (spread da entidade)
    const invAtiva = {
      id: 'invocado_remoto_1', invocacao_def: { ...DEF_SENTINELA }, dono_char_nome: 'Bob',
      hp_atual: 30, hpMax: 30, _turnosRestantes: 3, _cooldowns: {}, _modo: 'autonoma',
    };
    g.avtReceberEntidadeNova({
      entidade: {
        id: 'invocado_remoto_1', nome: 'Sentinela Sim', tipo: 'invocado',
        x: 6, y: 3, hp: 30, hpMax: 30, _invAtiva: invAtiva,
      },
      faseId: 'principal',
    });
    const ent = sim.state.entidades.find((e: any) => e.id === 'invocado_remoto_1');
    expect(ent).toBeTruthy();
    expect(sim.state.invocacoes_ativas.some((i: any) => i.id === 'invocado_remoto_1')).toBe(true);
    // Antes do F5 este cliente classificava a invocação aliada como hostil
    expect(g._avtRastroEhHostil(ent)).toBe(false);
  });

  it('F5: merge de snapshot preserva as minhas invocações e adota as dos outros', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv } = invocar(sim); // minha (Alice), autoritativa local
    const remota = {
      id: 'invocado_bob_1', invocacao_def: { ...DEF_SENTINELA, id: 'inv-bob' },
      dono_char_nome: 'Bob', hp_atual: 12, hpMax: 30, _turnosRestantes: 2,
    };
    // Snapshot remoto traz a minha DESATUALIZADA (hp 1) + a do Bob
    g.avtAplicarSnapshotMerge({
      faseId: 'principal',
      invocacoes_ativas: [{ ...inv, hp_atual: 1 }, remota],
    });
    const minha = sim.state.invocacoes_ativas.find((i: any) => i.id === inv.id);
    expect(minha).toBe(inv);          // mesma referência local
    expect(minha.hp_atual).toBe(30);  // snapshot não sobrescreveu a minha
    expect(sim.state.invocacoes_ativas.some((i: any) => i.id === 'invocado_bob_1')).toBe(true);
  });

  it('F3: modo vem do catálogo (controle) e decide quem age no turno', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim, { controle: 'comandada' });
    expect(inv._modo).toBe('comandada');
    // Dono offline (sem heartbeat) → cai para IA, combate não trava
    expect(g._avtInvTurnoAutonomo(ent)).toBe(true);
    // Dono online → o host NÃO age; o turno é do dono via overlay
    sim.jogador()._lastGameSeen = Date.now();
    expect(g._avtInvTurnoAutonomo(ent)).toBe(false);
    // Autônoma age sempre, com dono online ou não
    const { ent: entAuto } = invocar(sim);
    expect(g._avtInvTurnoAutonomo(entAuto)).toBe(true);
  });

  it('F3: avtReceberInvocacaoUpdate aplica modo/ordem/hp na entrada local', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim);
    g.avtReceberInvocacaoUpdate({
      invId: inv.id, faseId: 'principal',
      modo: 'comandada', ordem: { tipo: 'focar', alvoId: 'ini_0' }, hp: 21,
    });
    expect(inv._modo).toBe('comandada');
    expect(inv._ordem).toEqual({ tipo: 'focar', alvoId: 'ini_0' });
    expect(inv.hp_atual).toBe(21);
    expect(ent.hp).toBe(21);
  });

  it('P2 provocar: _avtProvocadorDe resolve o provocador ativo pelo efeito', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { ent } = invocar(sim);
    const goblin = sim.npc('ini_0');
    // Espelho de iniciativa do NPC com o efeito aplicado pela skill da invocação
    const npcIni = {
      ...goblin,
      status_effects: [{ tipo: 'provocar', _turnos_restantes: 2, _casterId: ent.id, _casterNome: ent.nome }],
    };
    expect(g._avtProvocadorDe(npcIni)).toBe(ent);
    // Sem id, resolve pelo nome do caster
    npcIni.status_effects = [{ tipo: 'provocar', _turnos_restantes: 1, _casterNome: ent.nome } as any];
    expect(g._avtProvocadorDe(npcIni)).toBe(ent);
    // Expirado → ninguém provoca
    npcIni.status_effects = [{ tipo: 'provocar', _turnos_restantes: 0, _casterId: ent.id } as any];
    expect(g._avtProvocadorDe(npcIni)).toBe(null);
    // Provocador morto → cadeia segue para o próximo degrau da pirâmide
    npcIni.status_effects = [{ tipo: 'provocar', _turnos_restantes: 2, _casterId: ent.id } as any];
    ent.hp = 0;
    expect(g._avtProvocadorDe(npcIni)).toBe(null);
  });

  it('P2 guardião: intercepta pct do dano do dono no raio, pelo funil da invocação', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim, { guardiao: { pct_intercepta: 50, raio: 3 } });
    const alice = sim.jogador();
    ent.x = alice.x + 1; ent.y = alice.y; // Chebyshev 1 ≤ raio 3
    const restante = g._avtInterceptarDanoGuardiao(alice, 10, null);
    expect(restante).toBe(5);
    expect(ent.hp).toBe(25);        // desvio entrou pelo funil (sem resistência)
    expect(inv.hp_atual).toBe(25);  // espelho sincronizado
    // Fora do raio → dano integral ao dono
    ent.x = alice.x + 9;
    expect(g._avtInterceptarDanoGuardiao(alice, 10, null)).toBe(10);
    // Guardião de OUTRO dono não intercepta
    ent.x = alice.x + 1;
    inv.dono_char_nome = 'Bob';
    expect(g._avtInterceptarDanoGuardiao(alice, 10, null)).toBe(10);
  });

  it('P2 sacrifício cura_dono: cura o dono e destrói com motivo sacrificio', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv } = invocar(sim, { sacrificio: { tipo: 'cura_dono', formula: '5' } });
    const alice = sim.jogador();
    alice.hp = Math.max(1, alice.hp - 10);
    const hpAntes = alice.hp;
    const broadcasts: any[] = [];
    const orig = g._avtBroadcast;
    g._avtBroadcast = (tipo: any, payload: any) => { broadcasts.push({ tipo, payload }); };
    try { g._avtSacrificarInvocacao(inv.id); } finally { g._avtBroadcast = orig; }
    expect(alice.hp).toBe(hpAntes + 5);
    expect(sim.state.invocacoes_ativas.length).toBe(0);
    expect(sim.state.entidades.some((e: any) => e.id === inv.id)).toBe(false);
    const ev = broadcasts.find((b: any) => b.tipo === 'avt_invocacao_destruida');
    expect(ev?.payload?.motivo).toBe('sacrificio');
  });

  it('P2 sacrifício explosao: fere inimigos no raio com a fórmula própria', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim, { sacrificio: { tipo: 'explosao', formula: '3', raio: 2 } });
    const goblin = sim.npc('ini_0');
    goblin.x = ent.x + 1; goblin.y = ent.y;
    const hpAntes = goblin.hp;
    g._avtSacrificarInvocacao(inv.id);
    expect(goblin.hp).toBe(hpAntes - 3);
    expect(sim.state.invocacoes_ativas.length).toBe(0);
  });

  it('P2 sacrifício buff_dono: efeitos canônicos no dono (status + registro OOC)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv } = invocar(sim, {
      sacrificio: { tipo: 'buff_dono', efeitos: [{ tipo: 'boost_dano', boost_dano: 5, duracao_turnos: 2 }] },
    });
    const alice = sim.jogador();
    sim.state._oocStatusEffects = [];
    g._avtSacrificarInvocacao(inv.id);
    const ef = (alice.status_effects || []).find((e: any) => e.tipo === 'boost_dano');
    expect(ef).toBeTruthy();
    expect(ef._turnos_restantes).toBe(2);
    expect(ef._ooc).toBe(true); // fora de combate → contrato dos buffs OOC
    expect(sim.state._oocStatusEffects.some((r: any) => r.entId === alice.id && r.ef.tipo === 'boost_dano')).toBe(true);
    expect(sim.state.invocacoes_ativas.length).toBe(0);
  });

  it('P2 destruição com motivo sacrificio NÃO dispara a explosão do dummy', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim, { dummy_explosivo: true });
    const goblin = sim.npc('ini_0');
    goblin.x = ent.x + 1; goblin.y = ent.y;
    const bat = {
      id: 'bat-t', iniciativa: [{ ...ent, initRoll: 10 }, { ...goblin, initRoll: 5 }],
      envolvidos: [ent.id, goblin.id], turnoIdx: 0, log: [], movimentoRestante: {}, _cooldowns: {},
    };
    const hpAntes = goblin.hp;
    g._avtDestruirInvocacao(inv.id, bat, 'sacrificio');
    expect(goblin.hp).toBe(hpAntes); // sem explosão de morte
    // Controle: com motivo 'morreu' o dummy explode normalmente
    const { inv: inv2, ent: ent2 } = invocar(sim, { dummy_explosivo: true });
    goblin.x = ent2.x + 1; goblin.y = ent2.y;
    const bat2 = {
      id: 'bat-t2', iniciativa: [{ ...ent2, initRoll: 10 }, { ...goblin, initRoll: 5 }],
      envolvidos: [ent2.id, goblin.id], turnoIdx: 0, log: [], movimentoRestante: {}, _cooldowns: {},
    };
    g._avtDestruirInvocacao(inv2.id, bat2, 'morreu');
    expect(goblin.hp).toBeLessThan(hpAntes);
  });

  it('DOT em combate passa pelo funil e destrói a invocação ao zerar', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const { inv, ent } = invocar(sim);
    ent.hp = 2;
    const iniEntry = {
      ...ent, initRoll: 10, hp: 2,
      status_effects: [{ tipo: 'dot', dot_formula: '1d4', _turnos_restantes: 2 }],
    };
    const bat = {
      id: 'bat-t', iniciativa: [iniEntry], envolvidos: [ent.id],
      turnoIdx: 0, log: [], movimentoRestante: {}, _cooldowns: {},
    };
    g._avtProcessarStatusEffects(bat, iniEntry);
    // 1d4 ≥ 1 sempre mata com hp 2? Não — mas o espelho tem que valer sempre:
    if (ent.hp <= 0) {
      expect(sim.state.invocacoes_ativas.length).toBe(0);
      expect(sim.state.entidades.some((e: any) => e.id === inv.id)).toBe(false);
    } else {
      expect(inv.hp_atual).toBe(ent.hp);
    }
  });
});
