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

describe('zoom (_fedCalcularZoomFit)', () => {
  it('enquadra um 60×40 num canvas 800×500 com folga e pan centralizado', () => {
    const f = g._fedCalcularZoomFit(800, 500, 60, 40);
    // limitante vertical: 0.95 * 500/(40*24)
    expect(f.zoom).toBeCloseTo(0.95 * 500 / (40 * 24), 4);
    expect(f.panX).toBeCloseTo((800 - 60 * 24 * f.zoom) / 2, 4);
    expect(f.panY).toBeCloseTo((500 - 40 * 24 * f.zoom) / 2, 4);
  });

  it('mapa minúsculo não passa do teto 1.5', () => {
    expect(g._fedCalcularZoomFit(800, 500, 8, 8).zoom).toBe(1.5);
  });

  it('canvas minúsculo respeita o piso FED_ZMIN', () => {
    expect(g._fedCalcularZoomFit(40, 30, 120, 120).zoom).toBeCloseTo(0.1, 6);
  });
});

describe('vínculo peça↔função (_fedVincularPapel)', () => {
  beforeEach(() => {
    FED.modo = 'draft';
    FED.tsCfg = { version: 2, cols: 5, rows: 4, blocos: { bau: 'bloco_3_2' } };
  });

  it('vincula uma função a outra célula do atlas (re-vínculo substitui)', () => {
    expect(g._fedVincularPapel('bau', 2, 3)).toBe('bau');
    expect(FED.tsCfg.blocos.bau).toBe('bloco_2_3');
  });

  it('sanitiza chave livre', () => {
    expect(g._fedVincularPapel('decor 1', 4, 0)).toBe('decor_1');
    expect(FED.tsCfg.blocos.decor_1).toBe('bloco_4_0');
  });

  it('chave vazia ou inválida não vincula', () => {
    expect(g._fedVincularPapel('', 1, 1)).toBe(null);
    expect(g._fedVincularPapel('___', 1, 1)).toBe(null);
    expect(Object.keys(FED.tsCfg.blocos)).toEqual(['bau']);
  });

  it('_fedChavePorCelula resolve pelo config do draft (inclusive refs com @t)', () => {
    FED.tsCfg.blocos.parede_L = 'bloco_1_0@1';
    expect(g._fedChavePorCelula(3, 2)).toBe('bau');
    expect(g._fedChavePorCelula(1, 0)).toBe('parede_L');
    expect(g._fedChavePorCelula(0, 0)).toBe(null);
  });
});

describe('tileset em draft', () => {
  it('_fedPreloadTileset usa {aplicar:false} e guarda as texturas locais', async () => {
    const chamadas: any[] = [];
    const orig = g._avtCarregarTileset;
    g._avtCarregarTileset = (_u: any, _c: any, opts: any) => {
      chamadas.push(opts);
      return Promise.resolve({ piso_1: 'tex' });
    };
    try {
      FED.modo = 'draft'; FED.tsUrl = 'blob:atlas'; FED.tsHerdadoDe = null;
      FED.tsCfg = { version: 2, cols: 4, rows: 4, blocos: {} };
      FED.texs = null; FED.aberto = false;
      g._fedPreloadTileset();
      await new Promise(r => setTimeout(r, 0));
      expect(chamadas).toEqual([{ aplicar: false }]);
      expect(FED.texs).toEqual({ piso_1: 'tex' });
    } finally { g._avtCarregarTileset = orig; }
  });

  it('_fedExportarDraft inclui tileset_config só quando o tileset é próprio', () => {
    FED.modo = 'draft';
    FED.tiles = grade(6, 5, 0); FED.tiles[1][1] = 1;
    FED.rooms = [{ id: 'sala_1', x: 1, y: 1, w: 1, h: 1, tipo: 'entrada' }];
    FED.portasInternas = []; FED.spawns = [];
    FED.tsCfg = { version: 2, cols: 4, rows: 4, blocos: { bau: 'bloco_3_2' } };
    FED.tsHerdadoDe = null;
    let exportado: any = null;
    FED.onExport = (d: any) => { exportado = d; };
    g._fedExportarDraft();
    expect(exportado.tileset_config).toEqual(FED.tsCfg);
    expect(exportado.tileset_config).not.toBe(FED.tsCfg); // cópia, não referência

    FED.tsHerdadoDe = 'Fase inicial';
    FED.onExport = (d: any) => { exportado = d; };
    g._fedExportarDraft();
    expect(exportado.tileset_config).toBeUndefined();
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
