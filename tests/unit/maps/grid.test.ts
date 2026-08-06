// Helpers de grid e crítico do mapa (js/maps/maps.js).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/maps/maps.js';
import { makeMapaEntry, resetEstadoGlobal } from '../../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => resetEstadoGlobal());

describe('normalizarPosicao', () => {
  it('mantém posição já no formato novo {col,row}', () => {
    const pos = { col: 3, row: 7 };
    expect(g.normalizarPosicao(pos, { largura_total: 20, altura_total: 20 })).toBe(pos);
  });

  it('converte formato antigo {x,y}% usando as dimensões do mapa', () => {
    expect(g.normalizarPosicao({ x: 50, y: 25 }, { largura_total: 20, altura_total: 20 }))
      .toEqual({ col: 10, row: 5 });
    expect(g.normalizarPosicao({ x: 100, y: 100 }, { largura_total: 30, altura_total: 10 }))
      .toEqual({ col: 30, row: 10 });
  });

  it('usa grid 20×20 como default sem mapa', () => {
    expect(g.normalizarPosicao({ x: 50, y: 50 }, null)).toEqual({ col: 10, row: 10 });
  });

  it('retorna null para posição nula ou incompleta', () => {
    expect(g.normalizarPosicao(null, null)).toBeNull();
    expect(g.normalizarPosicao({ x: 10 }, null)).toBeNull();
    expect(g.normalizarPosicao({}, null)).toBeNull();
  });
});

describe('pctParaCelula / _getMapaById', () => {
  it('converte % em célula usando o mapa registrado em RPG_DATA', () => {
    g.RPG_DATA = {
      mapas: [makeMapaEntry({ map_id: 'm1', largura_total: 40, altura_total: 10 })],
    };
    expect(g.pctParaCelula(50, 50, 'm1')).toEqual({ col: 20, row: 5 });
    expect(g._getMapaById('m1')?.map_id).toBe('m1');
    expect(g._getMapaById('inexistente')).toBeNull();
  });

  it('cai para grid 20×20 quando o mapa não existe', () => {
    g.RPG_DATA = { mapas: [] };
    expect(g.pctParaCelula(50, 50, 'nao-existe')).toEqual({ col: 10, row: 10 });
  });
});

describe('calcMaxFormula / calcCriticoThreshold', () => {
  it('máximo soma qtd*faces e apenas fixos positivos', () => {
    expect(g.calcMaxFormula([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 3 },
    ])).toBe(15);
    // fixo negativo não reduz o máximo
    expect(g.calcMaxFormula([
      { tipo: 'dado', qtd: 1, faces: 20 },
      { tipo: 'fixo', valor: -5 },
    ])).toBe(20);
    expect(g.calcMaxFormula([])).toBe(0);
    expect(g.calcMaxFormula(null)).toBe(0);
  });

  it('threshold de crítico é ceil(90% do máximo)', () => {
    expect(g.calcCriticoThreshold([{ tipo: 'dado', qtd: 1, faces: 20 }])).toBe(18);
    expect(g.calcCriticoThreshold([
      { tipo: 'dado', qtd: 2, faces: 6 },
      { tipo: 'fixo', valor: 3 },
    ])).toBe(14); // ceil(15 * 0.9)
    expect(g.calcCriticoThreshold([])).toBeNull();
  });
});
