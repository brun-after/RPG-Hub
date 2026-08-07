// Armadilhas de skill do Modo Aventura: o jogador arma numa célula, um INIMIGO
// pisa e a armadilha dispara (one-shot). Cenários rodam no tick real da
// simulação com invariantes checadas a cada tick pelo harness.
import { describe, it, expect, afterEach, vi } from 'vitest';
import { bootAventuraSim } from './harness';

const g = globalThis as any;

afterEach(() => {
  vi.useRealTimers();
});

const efTrap = (extra: any = {}) => ({
  tipo: 'armadilha', armadilha_formula: '1d6', duracao_turnos: 5,
  armadilha_max: 2, armadilha_cor: '#e8604c', ...extra,
});

describe('armadilha-skill: registry', () => {
  it('normaliza como tipo próprio e NÃO entra nos status genéricos', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const norm = g.EFFECT_REGISTRY.normalizarEfeito({ armadilha_formula: '1d6' });
    expect(norm).toHaveLength(1);
    expect(norm[0].tipo).toBe('armadilha');
    expect(norm[0]._canonico).toBe(true);
    // isStatus:false → nenhum dispatch genérico o aplica como status no alvo
    expect(g.EFFECT_REGISTRY.statusTipos()).not.toContain('armadilha');
    // A skill 103 dos fixtures é reconhecida como skill de armadilha
    const sk103 = sim.state.skills.find((s: any) => s.id === 103);
    const ef = g._avtSkillTemArmadilha(sk103);
    expect(ef?.tipo).toBe('armadilha');
    expect(ef?.armadilha_formula).toBe('1d6');
  });
});

describe('armadilha-skill: disparo', () => {
  it('inimigo parado sobre a célula dispara na varredura de 1s (one-shot)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const goblin = sim.npc('ini_0');
    const hpAntes = goblin.hp;

    const cell = g._avtArmadilhaMarcarCelula(alice, 9, 3, efTrap());
    expect(cell).toBeTruthy();
    expect(sim.state._armadilhaCells).toHaveLength(1);

    goblin.x = 9; goblin.y = 3;
    goblin.renderX = 9; goblin.renderY = 3;
    sim.run(70); // ~1.2s sim — cobre a varredura periódica de 1s

    expect(goblin.hp).toBeLessThan(hpAntes);
    expect(sim.state._armadilhaCells).toHaveLength(0); // consumida
  });

  it('inimigo dispara ao CHEGAR na célula via waypoint (hook de movimento)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const goblin = sim.npc('ini_0');
    const hpAntes = goblin.hp;

    g._avtArmadilhaMarcarCelula(alice, 9, 3, efTrap());
    goblin._waypoints = [{ x: 9, y: 3 }]; // goblin está em (10,3) — 1 célula
    sim.run(300);

    expect(goblin.hp).toBeLessThan(hpAntes);
    expect(sim.state._armadilhaCells).toHaveLength(0);
  });

  it('jogador NÃO dispara a armadilha (predicado hostil)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const bob = sim.state.entidades.find((e: any) => e.nome === 'Bob');
    const hpAntes = bob.hp;

    g._avtArmadilhaMarcarCelula(alice, 4, 3, efTrap());
    bob.x = 4; bob.y = 3;
    bob.renderX = 4; bob.renderY = 3;
    sim.run(150);

    expect(bob.hp).toBe(hpAntes);
    expect(sim.state._armadilhaCells).toHaveLength(1); // intacta
  });

  it('efeito extra (stun) é aplicado no inimigo ao disparar', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const goblin = sim.npc('ini_0');

    g._avtArmadilhaMarcarCelula(alice, 9, 3,
      efTrap({ armadilha_efeito: { tipo: 'stun', duracao_turnos: 1 } }));
    goblin.x = 9; goblin.y = 3;
    goblin.renderX = 9; goblin.renderY = 3;
    sim.run(70);

    expect(goblin._stunned).toBe(true);
    expect((goblin.status_effects || []).some((e: any) => e.tipo === 'stun')).toBe(true);
    expect((sim.state._oocStatusEffects || []).some((o: any) => o.entId === 'ini_0')).toBe(true);
  });
});

// Armadilha do MESTRE: objeto de fase oculto que dispara quando um JOGADOR pisa.
// O disparo é decidido pelo cliente do próprio jogador; sem RTNet o dano cai no
// fallback local de _avtRTBroadcastPlayerDamage (modo solo).
const injTrap = (sim: any, extra: any = {}) => {
  const trap = {
    id: 'traphm_teste', tipo: 'armadilha_mestre', nome: 'Espinhos',
    x: 4 / 24, y: 3 / 16, formula: '1d6', efeito: null,
    modo: 'oneshot', rearmar_s: 30, armada: true, _rearmarEm: null, ...extra,
  };
  sim.state.dungeon.render_data.objetos.push(trap);
  return trap;
};

describe('armadilha do mestre (objeto de fase)', () => {
  it('one-shot: jogador pisa, sofre dano e o objeto some', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const hpAntes = alice.hp;
    injTrap(sim);

    g._avtMoverJogador(1, 0); // (3,3) → (4,3), célula da armadilha
    sim.run(180);

    expect(alice.hp).toBeLessThan(hpAntes);
    expect(sim.state.dungeon.render_data.objetos
      .some((o: any) => o.id === 'traphm_teste')).toBe(false);
  });

  it('rearmar: desarma no disparo e rearma após o prazo', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const trap = injTrap(sim, { modo: 'rearmar', rearmar_s: 5 });

    g._avtMoverJogador(1, 0);
    sim.run(180);
    const hpApos1 = alice.hp;
    expect(hpApos1).toBeLessThan(alice.hpMax);
    expect(trap.armada).toBe(false);
    expect(trap._rearmarEm).toBeGreaterThan(Date.now());

    // Pisar de novo enquanto desarmada: nada acontece
    g._avtChecarArmadilhaMestreNaPosicao(alice);
    expect(alice.hp).toBe(hpApos1);

    vi.advanceTimersByTime(5200);
    sim.run(70); // varredura de 1s rearma pelo timestamp
    expect(trap.armada).toBe(true);

    g._avtChecarArmadilhaMestreNaPosicao(alice); // ainda sobre a célula (4,3)
    expect(alice.hp).toBeLessThan(hpApos1);
  });

  it('só o PRÓPRIO jogador dispara: NPC e aliado remoto não ativam', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const goblin = sim.npc('ini_0');
    const bob = sim.state.entidades.find((e: any) => e.nome === 'Bob');
    injTrap(sim);

    goblin.x = 4; goblin.y = 3; goblin.renderX = 4; goblin.renderY = 3;
    bob.x = 4; bob.y = 3; bob.renderX = 4; bob.renderY = 3;
    g._avtChecarArmadilhaMestreNaPosicao(goblin); // tipo 'inimigo' → early return
    g._avtChecarArmadilhaMestreNaPosicao(bob);    // não é myCharNome → early return
    sim.run(150);

    expect(goblin.hp).toBe(160);
    expect(bob.hp).toBe(bob.hpMax);
    expect(sim.state.dungeon.render_data.objetos
      .some((o: any) => o.id === 'traphm_teste')).toBe(true);
  });

  it('efeito extra (stun) aplica no jogador que pisou', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    injTrap(sim, { efeito: { tipo: 'stun', duracao_turnos: 1 } });

    g._avtMoverJogador(1, 0);
    sim.run(180);

    expect(alice._stunned).toBe(true);
    expect((alice.status_effects || []).some((e: any) => e.tipo === 'stun')).toBe(true);
    expect((sim.state._oocStatusEffects || []).some((o: any) => o.entNome === 'Alice')).toBe(true);
  });

  it('avtReceberObjSpawn faz merge por id (reposicionamento sincroniza)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    g.avtReceberObjSpawn({ obj: { id: 'obj-m', tipo: 'armadilha_mestre', x: 0.25, y: 0.25, armada: true } });
    g.avtReceberObjSpawn({ obj: { id: 'obj-m', tipo: 'armadilha_mestre', x: 0.75, y: 0.5, armada: false } });
    const objs = sim.state.dungeon.render_data.objetos.filter((o: any) => o.id === 'obj-m');
    expect(objs).toHaveLength(1);
    expect(objs[0].x).toBe(0.75);
    expect(objs[0].armada).toBe(false);
  });
});

describe('armadilha-skill: limites e expiração', () => {
  it('armadilha_max remove a mais antiga do caster ao exceder', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();

    g._avtArmadilhaMarcarCelula(alice, 7, 7, efTrap()); // max: 2
    vi.advanceTimersByTime(20); // expiry distinto para ordenar "mais antiga"
    g._avtArmadilhaMarcarCelula(alice, 8, 7, efTrap());
    vi.advanceTimersByTime(20);
    g._avtArmadilhaMarcarCelula(alice, 9, 7, efTrap());

    const minhas = g._avtArmadilhasDoCaster('Alice');
    expect(minhas).toHaveLength(2);
    expect(minhas.some((c: any) => c.x === 7 && c.y === 7)).toBe(false); // a antiga caiu
    expect(minhas.some((c: any) => c.x === 9 && c.y === 7)).toBe(true);
  });

  it('armadilha expira e é removida pelo prune sem disparar', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const goblin = sim.npc('ini_0');
    const hpAntes = goblin.hp;

    g._avtArmadilhaMarcarCelula(alice, 9, 3, efTrap({ duracao_turnos: 1 })); // 1 turno = 3s OOC
    vi.advanceTimersByTime(3200);
    sim.run(70); // varredura de 1s roda o prune

    expect(sim.state._armadilhaCells).toHaveLength(0);
    goblin.x = 9; goblin.y = 3;
    goblin.renderX = 9; goblin.renderY = 3;
    sim.run(70);
    expect(goblin.hp).toBe(hpAntes); // expirou sem ferir
  });

  it('fluxo de cast OOC: mira → clique arma, debita custo e entra em cooldown', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const char = sim.state.chars.find((c: any) => c.nome === 'Alice');
    const manaAntes = char.custom_attrs.atributos.Mana;

    g._avtIniciarModoArmadilha(103, alice); // Armadilha de Caça (1 Mana, alcance 3, cd 2t)
    expect(sim.state._modoArmadilhaCelula?.skId).toBe(103);
    const tiles = sim.state._habilidadeRange?.tiles || [];
    expect(tiles.length).toBeGreaterThan(0);
    // Alcance Chebyshev ≤ 3 a partir de (3,3); célula de Bob (5,3) fica fora (ocupada)
    expect(tiles.every((t: any) => Math.max(Math.abs(t.x - 3), Math.abs(t.y - 3)) <= 3)).toBe(true);
    expect(tiles.some((t: any) => t.x === 5 && t.y === 3)).toBe(false);

    await g._avtArmarArmadilhaEm(4, 3);
    expect(sim.state._armadilhaCells).toHaveLength(1);
    expect(sim.state._modoArmadilhaCelula).toBeNull();
    expect(char.custom_attrs.atributos.Mana).toBe(manaAntes - 1);
    const oocKey = (alice.id || alice.nome) + '_103';
    expect(sim.state._oocCooldowns[oocKey]).toBeGreaterThan(Date.now());

    // Em cooldown: novo arm não cria célula nem debita de novo
    g._avtIniciarModoArmadilha(103, alice);
    await g._avtArmarArmadilhaEm(6, 6);
    expect(sim.state._armadilhaCells).toHaveLength(1);
    expect(char.custom_attrs.atributos.Mana).toBe(manaAntes - 1);
  });

  it('fora do alcance da skill não arma (modo continua ativo)', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    g._avtIniciarModoArmadilha(103, alice);
    await g._avtArmarArmadilhaEm(10, 10); // dist Chebyshev 7 > alcance 3
    expect(sim.state._armadilhaCells ?? []).toHaveLength(0);
    expect(sim.state._modoArmadilhaCelula?.skId).toBe(103);
    g._avtCancelarModoArmadilha();
    expect(sim.state._modoArmadilhaCelula).toBeNull();
  });

  it('não arma em célula de parede', async () => {
    const sim = await bootAventuraSim({ charNome: 'Alice' });
    const alice = sim.jogador();
    const cell = g._avtArmadilhaMarcarCelula(alice, 0, 0, efTrap()); // borda = parede
    expect(cell).toBeNull();
    expect(sim.state._armadilhaCells ?? []).toHaveLength(0);
  });
});
