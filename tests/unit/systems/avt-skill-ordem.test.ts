// Ícone e ordenação de skills do controle mobile (js/systems/aventura.js):
// _avtSkillAbrev (fallback do rótulo), _avtGetSkillIcone (cadeia dbChar → ent) e
// _avtMoverSkillOrdem (↑/↓ renumera 1..n sequencial em skill_numeros).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/systems/aventura.js';

const g = globalThis as any;

describe('_avtSkillAbrev', () => {
  it('abrevia para 3 pontos de código, maiúsculos', () => {
    expect(g._avtSkillAbrev('Bola de Fogo')).toBe('BOL');
    expect(g._avtSkillAbrev('gelo')).toBe('GEL');
  });
  it('é seguro para emoji (não corta surrogate pair)', () => {
    expect(g._avtSkillAbrev('🔥bola')).toBe('🔥BO');
  });
  it('vazio vira marcador', () => {
    expect(g._avtSkillAbrev('')).toBe('•');
    expect(g._avtSkillAbrev(null)).toBe('•');
  });
});

describe('_avtGetSkillIcone', () => {
  it('dbChar tem prioridade sobre ent; vazio/ausente vira null', () => {
    const dbChar = { custom_attrs: { skill_icones: { a: '🔥' } } };
    const ent = { custom_attrs: { skill_icones: { a: '❄', b: '⚡', c: '  ' } } };
    expect(g._avtGetSkillIcone(dbChar, ent, 'a')).toBe('🔥');
    expect(g._avtGetSkillIcone(dbChar, ent, 'b')).toBe('⚡');
    expect(g._avtGetSkillIcone(dbChar, ent, 'c')).toBe(null);
    expect(g._avtGetSkillIcone(dbChar, ent, 'x')).toBe(null);
    expect(g._avtGetSkillIcone(null, null, 'a')).toBe(null);
  });
});

describe('_avtMoverSkillOrdem', () => {
  beforeEach(() => {
    g.AVT_STATE.skills = [
      { id: 'a', habilidade: 'Alfa' },
      { id: 'b', habilidade: 'Beta' },
      { id: 'c', habilidade: 'Gama' },
    ];
    g.AVT_STATE.entidades = [
      { id: 'e1', nome: 'Heroi', custom_attrs: { skills_ids: ['a', 'b', 'c'] } },
    ];
    g.AVT_STATE.chars = [];
    g._avtCharEditorRender = () => {};
  });

  it('sobe a skill e renumera 1..n sequencial', () => {
    g._avtMoverSkillOrdem('e1', 'b', -1);
    const nums = g.AVT_STATE.entidades[0].custom_attrs.skill_numeros;
    expect(nums).toEqual({ b: 1, a: 2, c: 3 });
  });

  it('desce a skill e a ordenação resultante segue os números', () => {
    g._avtMoverSkillOrdem('e1', 'a', 1);
    const ent = g.AVT_STATE.entidades[0];
    const ordenadas = g._avtSkillsOrdenadasPorNumero(g.AVT_STATE.skills, null, ent);
    expect(ordenadas.map((s: any) => s.id)).toEqual(['b', 'a', 'c']);
  });

  it('não faz nada nos extremos (primeira ↑ / última ↓)', () => {
    g._avtMoverSkillOrdem('e1', 'a', -1);
    expect(g.AVT_STATE.entidades[0].custom_attrs.skill_numeros).toBeUndefined();
    g._avtMoverSkillOrdem('e1', 'c', 1);
    expect(g.AVT_STATE.entidades[0].custom_attrs.skill_numeros).toBeUndefined();
  });

  it('duas trocas seguidas mantêm numeração densa e estável', () => {
    g._avtMoverSkillOrdem('e1', 'c', -1); // a, c, b
    g._avtMoverSkillOrdem('e1', 'c', -1); // c, a, b
    const nums = g.AVT_STATE.entidades[0].custom_attrs.skill_numeros;
    expect(nums).toEqual({ c: 1, a: 2, b: 3 });
  });
});
