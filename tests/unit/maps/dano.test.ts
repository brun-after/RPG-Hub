// Pipeline de dano do mapa tático (js/maps/maps.js):
// debuffs → buffs de defesa → armadura → resistências → HP temporário.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/maps/maps.js';
import { makeChar, makeAttrDef, resetEstadoGlobal } from '../../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => resetEstadoGlobal());

// attrDef de armadura/resistência com opcoes serializadas como no banco
const defArmadura = (nome: string, cfg: any) =>
  makeAttrDef({ nome, categoria: 'resistencia', opcoes: JSON.stringify(cfg) });

describe('calcularDanoFinal', () => {
  it('retorna 0 para dano nulo ou negativo', () => {
    expect(g.calcularDanoFinal(0, 'fisico', makeChar(), [])).toBe(0);
    expect(g.calcularDanoFinal(-5, 'fisico', makeChar(), [])).toBe(0);
  });

  it('sem modificadores devolve o dano bruto', () => {
    expect(g.calcularDanoFinal(12, 'fisico', makeChar(), [])).toBe(12);
  });

  it('mod_dano de debuff ativo do alvo aumenta o dano', () => {
    const char = makeChar();
    char.buffs = [{ nome: 'Maldição', mod_dano: 5, mod_dano_turnos_restantes: 2 }];
    expect(g.calcularDanoFinal(10, 'fisico', char, [])).toBe(15);
  });

  it('mod_dano expirado (0 turnos restantes) é ignorado', () => {
    const char = makeChar();
    char.buffs = [{ nome: 'Maldição', mod_dano: 5, mod_dano_turnos_restantes: 0 }];
    expect(g.calcularDanoFinal(10, 'fisico', char, [])).toBe(10);
  });

  it('mod_dano negativo reduz com piso em 0', () => {
    const char = makeChar();
    char.buffs = [{ nome: 'Proteção', mod_dano: -15, mod_dano_turnos_restantes: 1 }];
    expect(g.calcularDanoFinal(10, 'fisico', char, [])).toBe(0);
  });

  it('mod_defesa de buff ativo reduz o dano', () => {
    const char = makeChar();
    char.buffs = [{ nome: 'Escudo Mágico', mod_defesa: 3, mod_defesa_turnos_restantes: 1 }];
    expect(g.calcularDanoFinal(10, 'fisico', char, [])).toBe(7);
  });

  it('armadura pct_geral reduz qualquer tipo de dano', () => {
    const char = makeChar({ custom_attrs: { atributos: { Armadura: 10 } } });
    const defs = [defArmadura('Armadura', { tipo: 'armadura', pct_geral: 50 })];
    // redução = ceil(10 * 50%) = 5
    expect(g.calcularDanoFinal(12, 'magico', char, defs)).toBe(7);
  });

  it('armadura pct_fisico só se aplica a dano físico', () => {
    const char = makeChar({ custom_attrs: { atributos: { Armadura: 10 } } });
    const defs = [defArmadura('Armadura', { tipo: 'armadura', pct_fisico: 30 })];
    expect(g.calcularDanoFinal(10, 'fisico', char, defs)).toBe(7); // -ceil(3)
    expect(g.calcularDanoFinal(10, 'magico', char, defs)).toBe(10);
  });

  it('resistência percentual reduz proporcional ao dano', () => {
    const char = makeChar({ custom_attrs: { atributos: { 'Res. Fogo': 25 } } });
    const defs = [defArmadura('Res. Fogo', { tipo: 'resistencia', damage_type: ['fogo'] })];
    // redução = ceil(10 * 25%) = 3
    expect(g.calcularDanoFinal(10, 'fogo', char, defs)).toBe(7);
    expect(g.calcularDanoFinal(10, 'gelo', char, defs)).toBe(10); // tipo não coberto
  });

  it('resistência modo absoluto reduz valor flat', () => {
    const char = makeChar({ custom_attrs: { atributos: { 'Res. Fogo': 4 } } });
    const defs = [defArmadura('Res. Fogo', {
      tipo: 'resistencia', modo: 'absoluto', damage_type: 'fogo',
    })];
    expect(g.calcularDanoFinal(10, 'fogo', char, defs)).toBe(6);
    expect(g.calcularDanoFinal(3, 'fogo', char, defs)).toBe(0); // piso em 0
  });

  it('aplica armadura antes da resistência (pipeline encadeado)', () => {
    const char = makeChar({
      custom_attrs: { atributos: { Armadura: 10, 'Res. Física': 50 } },
    });
    const defs = [
      defArmadura('Armadura', { tipo: 'armadura', pct_geral: 50 }),
      defArmadura('Res. Física', { tipo: 'resistencia', damage_type: ['fisico'] }),
    ];
    // 20 - ceil(10*50%)=5 → 15; 15 - ceil(15*50%)=8 → 7
    expect(g.calcularDanoFinal(20, 'fisico', char, defs)).toBe(7);
  });

  it('opcoes com JSON inválido são ignoradas sem quebrar', () => {
    const char = makeChar({ custom_attrs: { atributos: { Armadura: 10 } } });
    const defs = [makeAttrDef({ nome: 'Armadura', categoria: 'resistencia', opcoes: '{quebrado' })];
    expect(g.calcularDanoFinal(10, 'fisico', char, defs)).toBe(10);
  });
});

describe('obterHpAtualSeguro (BUG-03)', () => {
  it('respeita hp_atual definido, inclusive 0', () => {
    expect(g.obterHpAtualSeguro(makeChar({ hp_atual: 0 }))).toBe(0);
    expect(g.obterHpAtualSeguro(makeChar({ hp_atual: 37 }))).toBe(37);
  });

  it('inicializa com hp_max quando hp_atual é null e persiste no objeto', () => {
    const char = makeChar({ hp_atual: null, custom_attrs: { hp_max: 80 } });
    expect(g.obterHpAtualSeguro(char)).toBe(80);
    expect(char.hp_atual).toBe(80);
  });

  it('usa 100 como hp_max default', () => {
    const char = { hp_atual: null, custom_attrs: {} };
    expect(g.obterHpAtualSeguro(char)).toBe(100);
  });
});

describe('calcularDanoComResistencia', () => {
  it('aplica multiplicador de resistência com floor', () => {
    const alvo = makeChar({ custom_attrs: { resistencias: { fogo: 0.5 } } });
    expect(g.calcularDanoComResistencia(11, 'fogo', alvo)).toBe(5);
  });

  it('multiplicador 0 = imune; >1 = vulnerável; ausente = 1.0', () => {
    const alvo = makeChar({ custom_attrs: { resistencias: { fogo: 0, gelo: 1.5 } } });
    expect(g.calcularDanoComResistencia(10, 'fogo', alvo)).toBe(0);
    expect(g.calcularDanoComResistencia(10, 'gelo', alvo)).toBe(15);
    expect(g.calcularDanoComResistencia(10, 'veneno', alvo)).toBe(10);
  });

  it('tipo de dano ausente cai para "fisico"', () => {
    const alvo = makeChar({ custom_attrs: { resistencias: { fisico: 0.5 } } });
    expect(g.calcularDanoComResistencia(10, null, alvo)).toBe(5);
  });
});

describe('aplicarDanoComHpTemporario', () => {
  it('shield absorve dano menor que o hp temporário', () => {
    const char = makeChar({ hp_atual: 50, custom_attrs: { hp_temporario: 10 } });
    expect(g.aplicarDanoComHpTemporario(char, 6)).toEqual({
      danoReal: 0, hpTempConsumido: 6, novoHp: 50, novoHpTemp: 4,
    });
  });

  it('shield quebra e o excedente vaza para o HP', () => {
    const char = makeChar({ hp_atual: 50, custom_attrs: { hp_temporario: 5 } });
    expect(g.aplicarDanoComHpTemporario(char, 9)).toEqual({
      danoReal: 4, hpTempConsumido: 5, novoHp: 46, novoHpTemp: 0,
    });
  });

  it('sem shield aplica dano direto com piso em 0', () => {
    const char = makeChar({ hp_atual: 3, custom_attrs: {} });
    expect(g.aplicarDanoComHpTemporario(char, 9)).toEqual({
      danoReal: 9, hpTempConsumido: 0, novoHp: 0, novoHpTemp: 0,
    });
  });
});
