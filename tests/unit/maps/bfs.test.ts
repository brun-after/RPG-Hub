// Alcance de movimento (BFS 4-direções), células com alvo e bloqueio por
// paredes. A implementação viva de paredeBloqueiaMovimento é a de
// js/maps/tactical.js (publicada no global e com wrapper de blockers) — a
// cópia em js/ui/tabs.js nunca é publicada.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/maps/maps.js';
import '../../../js/maps/tactical.js';
import { makeChar, makeMapaEntry, resetEstadoGlobal } from '../../helpers/fixtures';

const g = globalThis as any;

const chave = (l: { c: number; r: number }) => `${l.c}_${l.r}`;

beforeEach(() => {
  resetEstadoGlobal();
  g.RPG_DATA = { mapas: [], characters: [] };
});

function comParedes(paredes: any[], objetos: any[] = []) {
  g.RPG_DATA.mapas = [makeMapaEntry({
    map_id: 'm1',
    largura_total: 10,
    altura_total: 10,
    render_data: { paredes, objetos },
  })];
}

describe('paredeBloqueiaMovimento', () => {
  it('sem paredes não bloqueia nada', () => {
    comParedes([]);
    expect(g.paredeBloqueiaMovimento('m1', 2, 2, 1, 0)).toBe(false);
  });

  it('parede vertical bloqueia travessia horizontal da borda', () => {
    // parede vertical na borda x=3, cobrindo a linha 2
    comParedes([{ tipo: 'v', col: 3, row: 2 }]);
    expect(g.paredeBloqueiaMovimento('m1', 2, 2, 1, 0)).toBe(true);  // 2→3 cruza x=3
    expect(g.paredeBloqueiaMovimento('m1', 3, 2, -1, 0)).toBe(true); // 3→2 cruza x=3
    expect(g.paredeBloqueiaMovimento('m1', 2, 3, 1, 0)).toBe(false); // outra linha
    expect(g.paredeBloqueiaMovimento('m1', 2, 2, 0, 1)).toBe(false); // vertical não bloqueia
  });

  it('parede horizontal bloqueia travessia vertical da borda', () => {
    comParedes([{ tipo: 'h', col: 5, row: 4 }]);
    expect(g.paredeBloqueiaMovimento('m1', 5, 3, 0, 1)).toBe(true);  // desce cruzando y=4
    expect(g.paredeBloqueiaMovimento('m1', 5, 4, 0, -1)).toBe(true); // sobe cruzando y=4
    expect(g.paredeBloqueiaMovimento('m1', 4, 3, 0, 1)).toBe(false);
  });

  it('formato legado {col1,row1,col2,row2} é normalizado; diagonal é ignorada', () => {
    comParedes([
      { col1: 3, row1: 5, col2: 3, row2: 2 },  // vertical, row = min(5,2) = 2
      { col1: 0, row1: 0, col2: 2, row2: 2 },  // diagonal → ignorada
    ]);
    expect(g.paredeBloqueiaMovimento('m1', 2, 2, 1, 0)).toBe(true);
    expect(g.paredeBloqueiaMovimento('m1', 0, 0, 1, 0)).toBe(false);
    expect(g.paredeBloqueiaMovimento('m1', 1, 1, 0, 1)).toBe(false);
  });

  it('blocker ocupa a célula de destino inteira (wrapper de tactical.js)', () => {
    comParedes([], [{ tipo: 'blocker', col: 4, row: 4 }]);
    expect(g.paredeBloqueiaMovimento('m1', 3, 4, 1, 0)).toBe(true);
    expect(g.paredeBloqueiaMovimento('m1', 4, 3, 0, 1)).toBe(true);
    expect(g.paredeBloqueiaMovimento('m1', 3, 3, 1, 0)).toBe(false);
  });
});

describe('_bfsCelulas', () => {
  it('movimento 1 em grid aberto alcança os 4 vizinhos ortogonais', () => {
    comParedes([]);
    const r = g._bfsCelulas(5, 5, 1, 'm1', 10, 10);
    expect(r.map(chave).sort()).toEqual(['4_5', '5_4', '5_6', '6_5']);
  });

  it('movimento 2 alcança o losango de distância Manhattan ≤ 2 (12 células)', () => {
    comParedes([]);
    const r = g._bfsCelulas(5, 5, 2, 'm1', 10, 10);
    expect(r).toHaveLength(12);
    expect(r.map(chave)).toContain('3_5');
    expect(r.map(chave)).toContain('4_4');
    expect(r.map(chave)).not.toContain('3_3'); // dist 4, fora do alcance
  });

  it('respeita os limites do grid', () => {
    comParedes([]);
    const r = g._bfsCelulas(0, 0, 1, 'm1', 10, 10);
    expect(r.map(chave).sort()).toEqual(['0_1', '1_0']);
  });

  it('parede corta o caminho e força contorno', () => {
    // parede vertical na borda x=5 cobrindo a linha 5: (4,5) → (5,5) bloqueado
    comParedes([{ tipo: 'v', col: 5, row: 5 }]);
    const r1 = g._bfsCelulas(4, 5, 1, 'm1', 10, 10);
    expect(r1.map(chave)).not.toContain('5_5');
    // com movimento 2 dá para contornar por cima ou por baixo
    const r2 = g._bfsCelulas(4, 5, 2, 'm1', 10, 10);
    expect(r2.map(chave)).toContain('5_4');
    expect(r2.map(chave)).toContain('5_6');
    expect(r2.map(chave)).not.toContain('5_5'); // ainda precisa de 3 passos
  });
});

describe('_celulasComAlvo', () => {
  it('marca células com outro personagem dentro do alcance Chebyshev', () => {
    comParedes([]);
    g.RPG_DATA.characters = [
      makeChar({ nome: 'Aria' }),
      makeChar({ id: 'c2', nome: 'Goblin' }),
      makeChar({ id: 'c3', nome: 'Orc' }),
    ];
    const pos: any = {
      Aria: { col: 5, row: 5 },
      Goblin: { col: 6, row: 6 },  // dist 1
      Orc: { col: 9, row: 5 },     // dist 4
    };
    g.getPosicaoNoMapa = (ch: any) => pos[ch.nome] || null;

    const r = g._celulasComAlvo(5, 5, 2, 'm1', 10, 10, 'Aria');
    expect(r.map(chave)).toEqual(['6_6']);
  });

  it('exclui a própria célula e o próprio personagem', () => {
    comParedes([]);
    g.RPG_DATA.characters = [makeChar({ nome: 'Aria' })];
    g.getPosicaoNoMapa = () => ({ col: 5, row: 5 });
    expect(g._celulasComAlvo(5, 5, 3, 'm1', 10, 10, 'Aria')).toEqual([]);
  });
});
