// Células com rotação e correções do pipeline de tileset (js/maps/fase-tileset.js):
// encoding "chave@t", predicados de parede/passabilidade coerentes (incl. porta),
// autotiler devolvendo SEMPRE chave semântica e merge canônico de blocos.
import { describe, it, expect } from 'vitest';
import '../../../js/systems/aventura.js';
import '../../../js/maps/fase-tileset.js';

const g = globalThis as any;

describe('_avtCellBase/_avtCellXform/_avtCellCom', () => {
  it('round-trip do encoding', () => {
    expect(g._avtCellCom('parede_N', 0)).toBe('parede_N');
    expect(g._avtCellCom('parede_N', 3)).toBe('parede_N@3');
    expect(g._avtCellBase('parede_N@3')).toBe('parede_N');
    expect(g._avtCellXform('parede_N@3')).toBe(3);
    expect(g._avtCellBase('piso_1')).toBe('piso_1');
    expect(g._avtCellXform('piso_1')).toBe(0);
  });

  it('não-strings passam intactos', () => {
    expect(g._avtCellBase(0)).toBe(0);
    expect(g._avtCellBase(null)).toBe(null);
    expect(g._avtCellXform(1)).toBe(0);
    expect(g._avtCellXform(null)).toBe(0);
  });

  it('sufixo inválido é ignorado (identidade)', () => {
    expect(g._avtCellXform('parede_N@9')).toBe(0);
    expect(g._avtCellXform('parede_N@x')).toBe(0);
  });
});

describe('predicados de parede/passabilidade', () => {
  it('_avtChaveEhParede reconhece paredes com e sem rotação', () => {
    expect(g._avtChaveEhParede('parede_N')).toBe(true);
    expect(g._avtChaveEhParede('parede_N@1')).toBe(true);
    expect(g._avtChaveEhParede('canto_int_SE@6')).toBe(true);
    expect(g._avtChaveEhParede('piso_1@2')).toBe(false);
    expect(g._avtChaveEhParede(null)).toBe(true);
    expect(g._avtChaveEhParede(0)).toBe(true);
    expect(g._avtChaveEhParede(1)).toBe(false);
  });

  it('porta e porta_fase são passáveis e não-parede (predicados concordam)', () => {
    const dungeon = { tiles: [['porta', 'porta_fase', 'piso_1@3', 'parede_N', null, 'bau']] };
    expect(g._avtTilePassavel(0, 0, dungeon)).toBe(true);
    expect(g._avtTilePassavel(1, 0, dungeon)).toBe(true);
    expect(g._avtTilePassavel(2, 0, dungeon)).toBe(true);
    expect(g._avtTilePassavel(3, 0, dungeon)).toBe(false);
    expect(g._avtTilePassavel(4, 0, dungeon)).toBe(false);
    expect(g._avtTilePassavel(5, 0, dungeon)).toBe(true);
    expect(g._avtChaveEhParede('porta')).toBe(false);
    expect(g._avtChaveEhParede('porta_fase')).toBe(false);
  });
});

describe('_avtTipoParede (autotiler)', () => {
  const blocosComInt = { canto_int_NO: 'bloco_4_0', canto_int_NE: 'bloco_4_1', canto_int_SO: 'bloco_4_2', canto_int_SE: 'bloco_4_3' };

  it('cantos côncavos retornam a CHAVE semântica, nunca o block-ref', () => {
    // S+E piso, diagonal SE piso → canto interno NO
    expect(g._avtTipoParede(false, true, true, false, false, false, true, false, blocosComInt)).toBe('canto_int_NO');
    expect(g._avtTipoParede(false, true, false, true, false, false, false, true, blocosComInt)).toBe('canto_int_NE');
    expect(g._avtTipoParede(true, false, true, false, true, false, false, false, blocosComInt)).toBe('canto_int_SO');
    expect(g._avtTipoParede(true, false, false, true, false, true, false, false, blocosComInt)).toBe('canto_int_SE');
  });

  it('sem canto_int no tileset, cai no fallback de parede', () => {
    expect(g._avtTipoParede(false, true, true, false, false, false, true, false, {})).toBe('parede_N');
    expect(g._avtTipoParede(true, false, false, true, false, true, false, false, {})).toBe('parede_S');
  });

  it('nunca retorna uma referência bloco_*', () => {
    const bools = [false, true];
    for (const N of bools) for (const S of bools) for (const E of bools) for (const W of bools)
      for (const NE of bools) for (const NW of bools) for (const SE of bools) for (const SW of bools) {
        const r = g._avtTipoParede(N, S, E, W, NE, NW, SE, SW, blocosComInt);
        if (typeof r === 'string') expect(r.startsWith('bloco_')).toBe(false);
      }
  });
});

describe('merge canônico de blocos', () => {
  it('completa chaves ausentes com o canônico e mantém as fornecidas', () => {
    const b = g._avtMergeBlocosCanonicos({ piso_1: 'bloco_2_2' }, 4, 4);
    expect(b.piso_1).toBe('bloco_2_2');       // fornecido vence
    expect(b.parede_N).toBe('bloco_1_0');     // canônico completa
    expect(b.porta_fase).toBe('bloco_3_3');   // rows>=4 canônico
  });

  it('descarta referências fora do grid', () => {
    const b = g._avtMergeBlocosCanonicos({ decorX: 'bloco_9_9', ok: 'bloco_0_0@1' }, 4, 4);
    expect(b.decorX).toBeUndefined();
    expect(b.ok).toBe('bloco_0_0@1');         // rotação aceita
  });

  it('faseTilesetValidarJSON usa o merge (canto_int ausente no JSON da IA)', () => {
    const cfg = g.faseTilesetValidarJSON({ cols: 5, rows: 4, blocos: { piso_1: 'bloco_3_0' } });
    expect(cfg.blocos.canto_int_NO).toBe('bloco_4_0');
    expect(cfg.blocos.piso_1).toBe('bloco_3_0');
  });
});

describe('_avtGetTileSemanticKey — SAÍDA', () => {
  it('com tileset que tem porta_fase, SAÍDA usa o portal; sem ele, null (fallback legado)', () => {
    const dungeon = { tiles: [[2]], w: 1, h: 1 };
    g.AVT_STATE._tilesetConfig = { blocos: { porta_fase: 'bloco_3_3' } };
    expect(g._avtGetTileSemanticKey(0, 0, dungeon)).toBe('porta_fase');
    g.AVT_STATE._tilesetConfig = { blocos: {} };
    expect(g._avtGetTileSemanticKey(0, 0, dungeon)).toBe(null);
    g.AVT_STATE._tilesetConfig = null;
  });
});
