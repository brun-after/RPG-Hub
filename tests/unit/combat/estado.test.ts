// Validação de estado de combate, críticos, custo de recurso e distância
// (js/combat/combat.js).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/combat/combat.js';
import { makeChar, makeMapa, resetEstadoGlobal } from '../../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => resetEstadoGlobal());

describe('validarEstadoCombate', () => {
  const estadoValido = () => ({
    atacanteNome: 'Aria',
    contexto: 'campanha',
    habilidadeSel: { alvo_tipo: 'inimigo' },
    alvoNome: 'Goblin',
    dadosRolados: null,
    _pendingTrigger: false,
  });

  it('aceita estado completo', () => {
    g.COMBATE = estadoValido();
    expect(g.validarEstadoCombate()).toBe(true);
  });

  it('rejeita sem atacante, contexto ou habilidade', () => {
    g.COMBATE = { ...estadoValido(), atacanteNome: null };
    expect(g.validarEstadoCombate()).toBe(false);
    g.COMBATE = { ...estadoValido(), contexto: null };
    expect(g.validarEstadoCombate()).toBe(false);
    g.COMBATE = { ...estadoValido(), habilidadeSel: null };
    expect(g.validarEstadoCombate()).toBe(false);
  });

  it('exige alvo quando a habilidade não é própria/AoE global', () => {
    g.COMBATE = { ...estadoValido(), alvoNome: null };
    expect(g.validarEstadoCombate()).toBe(false);
  });

  it('dispensa alvo para alvo_tipo proprio e todos_*', () => {
    for (const alvo_tipo of ['proprio', 'todos_inimigos', 'todos_aliados']) {
      g.COMBATE = { ...estadoValido(), habilidadeSel: { alvo_tipo }, alvoNome: null };
      expect(g.validarEstadoCombate()).toBe(true);
    }
  });

  it('aceita AoE com _alvosAoE preenchido no lugar de alvoNome', () => {
    g.COMBATE = { ...estadoValido(), alvoNome: null, _alvosAoE: ['Goblin', 'Orc'] };
    expect(g.validarEstadoCombate()).toBe(true);
  });

  it('rejeita trigger pendente sem dados rolados', () => {
    g.COMBATE = { ...estadoValido(), _pendingTrigger: true, dadosRolados: null };
    expect(g.validarEstadoCombate()).toBe(false);
  });
});

describe('calcularDanoCritico', () => {
  it.each([
    [1, 0, 'erro', 0],
    [3, 0, 'erro', 0],
    [4, 10, 'normal', 1],
    [12, 10, 'normal', 1],
    [13, 12, 'critico_menor', 1.2],
    [15, 12, 'critico_menor', 1.2],
    [16, 15, 'critico', 1.5],
    [19, 15, 'critico', 1.5],
    [20, 20, 'critico_total', 2],
  ])('d20=%i sobre dano 10 → %i (%s)', (d20, dano, tipo, mult) => {
    const r = g.calcularDanoCritico(10, d20);
    expect(r.dano).toBe(dano);
    expect(r.tipo).toBe(tipo);
    expect(r.multiplicador).toBe(mult);
  });

  it('arredonda o dano crítico para cima', () => {
    expect(g.calcularDanoCritico(5, 13).dano).toBe(6); // ceil(5 * 1.2)
    expect(g.calcularDanoCritico(7, 16).dano).toBe(11); // ceil(7 * 1.5)
  });

  it('d20 inválido devolve dano base como normal', () => {
    for (const d20 of [0, 21, null, undefined]) {
      const r = g.calcularDanoCritico(10, d20);
      expect(r.dano).toBe(10);
      expect(r.tipo).toBe('normal');
    }
  });
});

describe('parsearCustoRSV', () => {
  it('parseia "quantidade atributo"', () => {
    expect(g.parsearCustoRSV('10 Mana')).toEqual({ quantidade: 10, atributo: 'Mana' });
    expect(g.parsearCustoRSV('3.5 Ki')).toEqual({ quantidade: 3.5, atributo: 'Ki' });
    expect(g.parsearCustoRSV('  5 Pontos de Fúria  ')).toEqual({
      quantidade: 5, atributo: 'Pontos de Fúria',
    });
  });

  it('retorna null para vazio, passiva e formato inválido', () => {
    expect(g.parsearCustoRSV(null)).toBeNull();
    expect(g.parsearCustoRSV('')).toBeNull();
    expect(g.parsearCustoRSV('passiva')).toBeNull();
    expect(g.parsearCustoRSV('Passiva')).toBeNull();
    expect(g.parsearCustoRSV('Mana')).toBeNull(); // sem quantidade
  });
});

describe('atkDistanciaCelulas', () => {
  beforeEach(() => {
    const mapa = makeMapa({ map_id: 'mapa-1', largura_total: 20, altura_total: 20 });
    g.RPG_DATA = {
      characters: [makeChar({ nome: 'Aria' }), makeChar({ id: 'c2', nome: 'Goblin' })],
    };
    g.MAPA_STATE.mapaAtualId = 'mapa-1';
    g._getMapaById = () => mapa;
  });

  it('distância Chebyshev: diagonal conta como 1', () => {
    const pos: any = { Aria: { col: 2, row: 3 }, Goblin: { col: 5, row: 7 } };
    g.getPosicaoNoMapa = (c: any) => pos[c.nome];
    expect(g.atkDistanciaCelulas('Aria', 'Goblin', 'campanha')).toBe(4); // max(3, 4)

    pos.Goblin = { col: 5, row: 6 };
    expect(g.atkDistanciaCelulas('Aria', 'Goblin', 'campanha')).toBe(3); // max(3, 3)

    pos.Goblin = { col: 2, row: 3 };
    expect(g.atkDistanciaCelulas('Aria', 'Goblin', 'campanha')).toBe(0);
  });

  it('converte posições em % para células quando não há col/row', () => {
    const pos: any = {
      Aria: { x: 0, y: 0 },      // célula (0, 0)
      Goblin: { x: 50, y: 25 },  // célula (10, 5) num grid 20×20
    };
    g.getPosicaoNoMapa = (c: any) => pos[c.nome];
    expect(g.atkDistanciaCelulas('Aria', 'Goblin', 'campanha')).toBe(10);
  });

  it('retorna null sem personagem, sem mapa ou sem posição', () => {
    g.getPosicaoNoMapa = () => ({ col: 0, row: 0 });
    expect(g.atkDistanciaCelulas('Aria', 'Inexistente', 'campanha')).toBeNull();

    g.MAPA_STATE.mapaAtualId = null;
    expect(g.atkDistanciaCelulas('Aria', 'Goblin', 'campanha')).toBeNull();

    g.MAPA_STATE.mapaAtualId = 'mapa-1';
    g.getPosicaoNoMapa = () => null;
    expect(g.atkDistanciaCelulas('Aria', 'Goblin', 'campanha')).toBeNull();
  });
});
