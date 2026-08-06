// Parser e rolagem de fórmulas de dados (js/combat/combat.js).
// As funções são lidas de globalThis — ver tests/setup/globals.ts.
import { describe, it, expect } from 'vitest';
import '../../../js/combat/combat.js';
import { mockRandomSeq } from '../../helpers/fixtures';

const g = globalThis as any;

describe('parsearFormulaDano', () => {
  it('parseia fórmula simples com bônus', () => {
    expect(g.parsearFormulaDano('2d6+3')).toEqual([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 3 },
    ]);
  });

  it('parseia multi-grupo "2d6+1d8+3"', () => {
    expect(g.parsearFormulaDano('2d6+1d8+3')).toEqual([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'dado', qtd: 1, faces: 8 },
      { tipo: 'fixo', valor: 3 },
    ]);
  });

  it('assume qtd=1 para "d20" sem quantidade', () => {
    expect(g.parsearFormulaDano('d20')).toEqual([{ tipo: 'dado', qtd: 1, faces: 20 }]);
  });

  it('ignora espaços e maiúsculas', () => {
    expect(g.parsearFormulaDano(' 2 D 6 + 1 ')).toEqual([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 1 },
    ]);
  });

  it('BUG-06: dados negativos viram grupo dado_negativo', () => {
    expect(g.parsearFormulaDano('1d6-2d4')).toEqual([
      { tipo: 'dado', qtd: 1, faces: 6 },
      { tipo: 'dado_negativo', qtd: 2, faces: 4 },
    ]);
  });

  it('"-d6" equivale a -1d6', () => {
    expect(g.parsearFormulaDano('-d6')).toEqual([
      { tipo: 'dado_negativo', qtd: 1, faces: 6 },
    ]);
  });

  it('bônus negativo vira fixo negativo', () => {
    expect(g.parsearFormulaDano('1d6-2')).toEqual([
      { tipo: 'dado', qtd: 1, faces: 6 },
      { tipo: 'fixo', valor: -2 },
    ]);
  });

  it('retorna null para vazio, "—" e lixo', () => {
    expect(g.parsearFormulaDano(null)).toBeNull();
    expect(g.parsearFormulaDano('')).toBeNull();
    expect(g.parsearFormulaDano('—')).toBeNull();
    expect(g.parsearFormulaDano('abc')).toBeNull();
  });

  it('descarta dado de 0 faces e bônus zero', () => {
    expect(g.parsearFormulaDano('2d0')).toBeNull();
    expect(g.parsearFormulaDano('0')).toBeNull();
  });
});

describe('formulaDeGrupos', () => {
  it('retorna "—" para vazio', () => {
    expect(g.formulaDeGrupos(null)).toBe('—');
    expect(g.formulaDeGrupos([])).toBe('—');
  });

  it('agrupa dados de mesmas faces e ordena por faces decrescentes', () => {
    const s = g.formulaDeGrupos([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'dado', qtd: 1, faces: 6 },
      { tipo: 'dado', qtd: 1, faces: 8 },
      { tipo: 'fixo', valor: 3 },
    ]);
    // Comportamento atual: bônus positivo sai com sinal duplicado ("++3") —
    // o join('+') soma com o prefixo '+' do bônus e o replace só trata "+-".
    // Cosmético: parsearFormulaDano re-lê "++3" como +3 sem perda.
    expect(s).toBe('1d8+3d6++3');
  });

  it('formata bônus negativo com sinal de menos', () => {
    expect(g.formulaDeGrupos([
      { tipo: 'dado', qtd: 1, faces: 6 },
      { tipo: 'fixo', valor: -2 },
    ])).toBe('1d6-2');
  });

  it('round-trip: parsear(formulaDeGrupos(g)) preserva os grupos', () => {
    const grupos = [
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'dado', qtd: 1, faces: 8 },
      { tipo: 'fixo', valor: 3 },
    ];
    const reparsed = g.parsearFormulaDano(g.formulaDeGrupos(grupos));
    // formulaDeGrupos canoniza a ordem (faces desc), o conteúdo é o mesmo
    expect(reparsed).toEqual([
      { tipo: 'dado', qtd: 1, faces: 8 },
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 3 },
    ]);
  });
});

describe('rolarGrupos', () => {
  it('retorna zero para grupos nulos', () => {
    expect(g.rolarGrupos(null)).toEqual({ total: 0, dados: [], bonus: 0 });
  });

  it('rola cada dado e soma bônus fixo', () => {
    // 2d6: random 5/6 → 6, 0 → 1
    mockRandomSeq([5 / 6, 0]);
    const r = g.rolarGrupos([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 3 },
    ]);
    expect(r.dados).toEqual([{ faces: 6, valor: 6 }, { faces: 6, valor: 1 }]);
    expect(r.total).toBe(10);
    expect(r.bonus).toBe(3);
  });

  it('BUG-06: dado_negativo subtrai do bônus', () => {
    // 1d6 → 3 (random 2/6), depois 1d4 negativo → 4 (random 3/4)
    mockRandomSeq([2 / 6, 3 / 4]);
    const r = g.rolarGrupos([
      { tipo: 'dado', qtd: 1, faces: 6 },
      { tipo: 'dado_negativo', qtd: 1, faces: 4 },
    ]);
    expect(r.dados).toEqual([{ faces: 6, valor: 3 }]);
    expect(r.total).toBe(0); // max(0, 3 - 4)
    // bônus exibido ajustado ao total capado: total - dadosTotal = -3, não -4
    expect(r.bonus).toBe(-3);
  });

  it('nunca retorna total negativo e ajusta o bônus efetivo', () => {
    mockRandomSeq([2 / 6]); // 1d6 → 3
    const r = g.rolarGrupos([
      { tipo: 'dado', qtd: 1, faces: 6 },
      { tipo: 'fixo', valor: -5 },
    ]);
    expect(r.total).toBe(0);
    expect(r.bonus).toBe(-3); // impede display "3 - 5 = 0"
  });
});

describe('rolarFormula (wrapper de compatibilidade)', () => {
  it('retorna forma neutra para null', () => {
    expect(g.rolarFormula(null)).toEqual({ total: 0, rolls: [], formula: '?' });
  });

  it('formato novo (array) delega a rolarGrupos', () => {
    mockRandomSeq([5 / 6, 0]);
    const r = g.rolarFormula([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 1 },
    ]);
    expect(r.rolls).toEqual([6, 1]);
    expect(r.total).toBe(8);
    expect(r.formula).toBe('2d6++1'); // sinal duplicado — ver nota em formulaDeGrupos
  });

  it('formato legado fixo', () => {
    expect(g.rolarFormula({ tipo: 'fixo', fixo: 5 })).toEqual({
      total: 5, rolls: [5], formula: '5',
    });
  });

  it('formato legado de objeto simples com bônus', () => {
    mockRandomSeq([0, 5 / 6]); // 1 e 6
    const r = g.rolarFormula({ qtd: 2, faces: 6, bonus: 2 });
    expect(r.rolls).toEqual([1, 6]);
    expect(r.total).toBe(9);
    expect(r.formula).toBe('2d6');
  });
});
