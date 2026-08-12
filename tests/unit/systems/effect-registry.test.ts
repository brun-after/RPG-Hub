// Registry central de tipos de efeito de skill (js/systems/effect-registry.js).
import { describe, it, expect } from 'vitest';
import '../../../js/systems/effect-registry.js';

const g = globalThis as any;
const REG = () => g.EFFECT_REGISTRY;

describe('EFFECT_REGISTRY.detect (table-driven)', () => {
  const casos: Array<[string, any]> = [
    ['dot', { dot_formula: '1d6' }],
    ['stun', { tipo: 'stun' }],
    ['silence', { tipo: 'silence' }],
    ['sem_movimento', { sem_movimento: true }],
    ['sem_ataque', { sem_ataque: true }],
    ['mod_dano', { mod_dano: -3 }],
    ['provocar', { tipo: 'provocar' }],
    ['hot', { hot_formula: '1d4' }],
    ['boost_dano', { boost_dano: 5 }],
    ['rec_atributo', { rec_atributo: 'Mana' }],
    ['imune_dano', { imune_dano: true }],
    ['fantasma', { tipo: 'fantasma' }],
    ['cura', { tipo: 'cura' }],
    ['empurrao', { tipo: 'empurrao' }],
    ['efeito_atrasado', { efeito_atrasado: true }],
    ['invocar_catalogo', { tipo: 'invocar_catalogo' }],
  ];

  it.each(casos)('detecta %s', (id, ef) => {
    const t = REG().get(id);
    expect(t).toBeTruthy();
    expect(t.detect(ef)).toBeTruthy();
  });

  it('mod_dano com valor 0 não é detectado', () => {
    expect(REG().get('mod_dano').detect({ mod_dano: 0 })).toBeFalsy();
  });

  it('duracaoDe lê o campo de duração específico do tipo', () => {
    expect(REG().get('dot').duracaoDe({ dot_turnos: 3 })).toBe(3);
    expect(REG().get('boost_dano').duracaoDe({ boost_dano_turnos: 2 })).toBe(2);
    expect(REG().get('cura').duracaoDe({ duracao_turnos: 9 })).toBe(0); // instantâneo
  });

  it('provocar: detecta pelo campo próprio, dura por provocar_turnos e é status negativo', () => {
    const t = REG().get('provocar');
    expect(t.detect({ provocar_turnos: 2 })).toBeTruthy();
    expect(t.duracaoDe({ provocar_turnos: 2 })).toBe(2);
    expect(t.duracaoDe({ duracao_turnos: 3 })).toBe(3); // fallback genérico
    expect(REG().statusTipos({ positivos: false })).toContain('provocar');
    expect(REG().orbEligible().some((o: any) => o.id === 'provocar')).toBe(false);
    // Normalização canônica: skill autorada só com provocar_turnos ganha tipo+duração
    const [norm] = REG().normalizarEfeito({ provocar_turnos: 2 });
    expect(norm.tipo).toBe('provocar');
    expect(norm.duracao_turnos).toBe(2);
  });

  it('get devolve null para id desconhecido', () => {
    expect(REG().get('nao_existe')).toBeNull();
  });
});

describe('statusTipos / orbEligible', () => {
  it('statusTipos retorna só tipos isStatus, filtráveis por polaridade', () => {
    const todos = REG().statusTipos();
    expect(todos).toContain('dot');
    expect(todos).toContain('hot');
    expect(todos).not.toContain('cura'); // isStatus: false

    const positivos = REG().statusTipos({ positivos: true });
    expect(positivos).toContain('hot');
    expect(positivos).not.toContain('dot');

    const negativos = REG().statusTipos({ positivos: false });
    expect(negativos).toContain('dot');
    expect(negativos).not.toContain('hot');
  });

  it('orbEligible retorna apenas tipos positivos com buildEfeito', () => {
    const orb = REG().orbEligible();
    const ids = orb.map((t: any) => t.id);
    expect(ids).toContain('hot');
    expect(ids).toContain('boost_dano');
    expect(ids).not.toContain('dot');
    for (const t of orb) {
      expect(t.orbEligible).toBe(true);
      expect(typeof t.buildEfeito).toBe('function');
      expect(t.positivo).toBe(true);
    }
  });
});

describe('normalizarEfeito', () => {
  it('entrada inválida → []; efeito já canônico passa intacto', () => {
    expect(REG().normalizarEfeito(null)).toEqual([]);
    expect(REG().normalizarEfeito('x')).toEqual([]);
    const canonico = { tipo: 'dot', _canonico: true };
    expect(REG().normalizarEfeito(canonico)).toEqual([canonico]);
  });

  it('efeito desconhecido passa adiante intacto', () => {
    const ef = { tipo: 'coisa_nova', foo: 1 };
    expect(REG().normalizarEfeito(ef)).toEqual([ef]);
  });

  it('efeito simples ganha tipo e duracao_turnos canônicos', () => {
    const [e] = REG().normalizarEfeito({ nome: 'Queimadura', dot_formula: '1d6', dot_turnos: 3 });
    expect(e.tipo).toBe('dot');
    expect(e.duracao_turnos).toBe(3);
    expect(e._canonico).toBe(true);
    expect(e.nome).toBe('Queimadura');
  });

  it('sem campo de duração cai para duracao_turnos do efeito ou 1', () => {
    const [semNada] = REG().normalizarEfeito({ tipo: 'stun' });
    expect(semNada.duracao_turnos).toBe(1);
    const [comDur] = REG().normalizarEfeito({ tipo: 'stun', duracao_turnos: 4 });
    expect(comDur.duracao_turnos).toBe(4);
  });

  it('efeito combinado é dividido em uma entrada canônica por componente', () => {
    const saida = REG().normalizarEfeito({
      nome: 'Chama Vampírica',
      dot_formula: '1d6', dot_turnos: 2,
      boost_dano: 5, boost_dano_turnos: 3,
      animacao_persistente: { pixi_studio_id: 'anim1' },
    });
    expect(saida.map((e: any) => e.tipo).sort()).toEqual(['boost_dano', 'dot']);

    const dot = saida.find((e: any) => e.tipo === 'dot');
    const boost = saida.find((e: any) => e.tipo === 'boost_dano');
    // campos do outro componente são removidos de cada entrada
    expect(dot.boost_dano).toBeUndefined();
    expect(boost.dot_formula).toBeUndefined();
    expect(dot.duracao_turnos).toBe(2);
    expect(boost.duracao_turnos).toBe(3);
    // animação persistente só na primeira entrada
    const comAnim = saida.filter((e: any) => e.animacao_persistente);
    expect(comAnim).toHaveLength(1);
  });
});

describe('normalizarEfeitos', () => {
  it('achata a lista preservando não-arrays', () => {
    const out = REG().normalizarEfeitos([
      { dot_formula: '1d6', dot_turnos: 2, boost_dano: 1, boost_dano_turnos: 1 },
      { tipo: 'cura' },
    ]);
    expect(out).toHaveLength(3); // 2 componentes + cura
    expect(REG().normalizarEfeitos(null)).toBeNull();
  });
});
