// Lógica pura do editor de fases novo (js/aventura/fase-editor.js): balde,
// retângulo, undo/redo por lote, resize e derivação de salas do piso pintado.
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/systems/aventura.js';
import '../../../js/maps/fase-tileset.js';
import '../../../js/aventura/fase-editor.js';

const g = globalThis as any;
const FED = g.FED;

function grade(w: number, h: number, fill: any = 0) {
  return Array.from({ length: h }, () => Array(w).fill(fill));
}

beforeEach(() => {
  FED.w = 6; FED.h = 5;
  FED.tiles = grade(6, 5, 0);
  FED.undo = []; FED.redo = []; FED._stroke = null;
  FED.tool = 'floor'; FED.brushKey = null; FED.brushXf = 0;
  FED.aberto = false; // _fedRender vira no-op sem o canvas
});

describe('balde (_fedFill)', () => {
  it('preenche só a região contígua do mesmo valor', () => {
    FED.tiles[2][3] = 1; // ilha de piso isola nada — grid quase todo parede
    FED.tool = 'fill';
    g._fedStrokeStart();
    g._fedFill(0, 0);
    g._fedStrokeEnd();
    // tudo que era 0 conectado a (0,0) virou piso; a célula que já era 1 permanece
    expect(FED.tiles[0][0]).toBe(1);
    expect(FED.tiles[4][5]).toBe(1);
    expect(FED.tiles[2][3]).toBe(1);
    expect(FED.undo.length).toBe(1);
  });

  it('com pincel de tileset, preenche com a peça rotacionada', () => {
    FED.tool = 'fill'; FED.brushKey = 'parede_N'; FED.brushXf = 1;
    g._fedStrokeStart(); g._fedFill(0, 0); g._fedStrokeEnd();
    expect(FED.tiles[0][0]).toBe('parede_N@1');
  });
});

describe('retângulo (_fedRect)', () => {
  it('preenche a área entre as âncoras (qualquer ordem)', () => {
    g._fedStrokeStart();
    g._fedRect({ x: 4, y: 3 }, { x: 1, y: 1 });
    g._fedStrokeEnd();
    expect(FED.tiles[1][1]).toBe(1);
    expect(FED.tiles[3][4]).toBe(1);
    expect(FED.tiles[0][0]).toBe(0);
    expect(FED.tiles[4][5]).toBe(0);
  });
});

describe('undo/redo', () => {
  it('desfaz e refaz um traço', () => {
    g._fedStrokeStart();
    g._fedSet(1, 1, 1); g._fedSet(2, 1, 1);
    g._fedStrokeEnd();
    expect(FED.tiles[1][1]).toBe(1);
    g._fedUndo();
    expect(FED.tiles[1][1]).toBe(0);
    expect(FED.tiles[1][2]).toBe(0);
    g._fedRedo();
    expect(FED.tiles[1][1]).toBe(1);
    expect(FED.tiles[1][2]).toBe(1);
  });

  it('traço vazio não entra na pilha', () => {
    g._fedStrokeStart();
    g._fedSet(0, 0, 0); // mesmo valor → sem mudança
    g._fedStrokeEnd();
    expect(FED.undo.length).toBe(0);
  });
});

describe('_fedDerivarRooms', () => {
  it('deriva bounding boxes de componentes conexos de piso', () => {
    // duas salas desconexas: 2×2 no topo-esq e 1×3 na direita
    FED.tiles = grade(6, 5, 0);
    FED.tiles[0][0] = 1; FED.tiles[0][1] = 1; FED.tiles[1][0] = 1; FED.tiles[1][1] = 1;
    FED.tiles[2][4] = 1; FED.tiles[3][4] = 1; FED.tiles[4][4] = 1;
    const rooms = g._fedDerivarRooms();
    expect(rooms.length).toBe(2);
    expect(rooms[0].tipo).toBe('entrada');
    expect(rooms.some((r: any) => r.tipo === 'chefe')).toBe(true);
    const r0 = rooms[0];
    expect([r0.w, r0.h]).toEqual([2, 2]);
  });

  it('sem piso, retorna vazio (não explode)', () => {
    FED.tiles = grade(6, 5, 0);
    expect(g._fedDerivarRooms()).toEqual([]);
  });
});
