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
