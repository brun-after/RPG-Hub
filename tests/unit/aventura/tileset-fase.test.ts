// Resolução do tileset efetivo por fase (_avtResolverTilesetFase):
// próprio → fase anterior mais próxima com tileset próprio → principal → null.
// A config sempre acompanha a imagem escolhida.
import { describe, it, expect } from 'vitest';
import '../../../js/systems/aventura.js';

const g = globalThis as any;
const resolver = g._avtResolverTilesetFase;

const cfgA = { version: 2, cols: 4, rows: 4, blocos: { piso_1: 'bloco_3_0' } };
const cfgB = { version: 2, cols: 5, rows: 5, blocos: { piso_1: 'bloco_3_0', canto_int_NO: 'bloco_4_0' } };
const cfgP = { version: 2, cols: 4, rows: 5, blocos: { piso_1: 'bloco_3_0' } };
const principalDD = { tileset_img_url: 'p.png', tileset_config: cfgP };

describe('_avtResolverTilesetFase', () => {
  it('fase com tileset próprio usa a própria imagem e config', () => {
    const fase = { id: 'f2', ordem: 2, tileset_img_url: 'b.png', tileset_config: cfgB };
    const r = resolver(fase, [fase], principalDD);
    expect(r).toEqual({ imgUrl: 'b.png', config: cfgB, herdadoDe: null });
  });

  it('imagem própria sem config cai na config do principal (legado)', () => {
    const fase = { id: 'f2', ordem: 2, tileset_img_url: 'b.png' };
    const r = resolver(fase, [fase], principalDD);
    expect(r.imgUrl).toBe('b.png');
    expect(r.config).toBe(cfgP);
    expect(r.herdadoDe).toBe(null);
  });

  it('fase sem tileset herda da anterior mais próxima com tileset próprio', () => {
    const f1 = { id: 'f1', nome: 'Caverna', ordem: 1, tileset_img_url: 'a.png', tileset_config: cfgA };
    const f2 = { id: 'f2', ordem: 2 };
    const r = resolver(f2, [f1, f2], principalDD);
    expect(r).toEqual({ imgUrl: 'a.png', config: cfgA, herdadoDe: 'Caverna' });
  });

  it('cadeia de fases auto-geradas sem tileset resolve para a última com atlas', () => {
    const f1 = { id: 'f1', nome: 'Base', ordem: 1, tileset_img_url: 'a.png', tileset_config: cfgA };
    const f2 = { id: 'f2', ordem: 2, _autoGerada: true };
    const f3 = { id: 'f3', ordem: 3, _autoGerada: true };
    const fases = [f1, f2, f3];
    expect(resolver(f2, fases, principalDD).imgUrl).toBe('a.png');
    expect(resolver(f3, fases, principalDD).imgUrl).toBe('a.png');
    expect(resolver(f3, fases, principalDD).config).toBe(cfgA);
  });

  it('a config vem sempre da fase dona da imagem, nunca de outra', () => {
    const f1 = { id: 'f1', nome: 'Dona', ordem: 1, tileset_img_url: 'a.png', tileset_config: cfgA };
    const f2 = { id: 'f2', ordem: 2, tileset_config: cfgB }; // config órfã, sem imagem
    const r = resolver(f2, [f1, f2], principalDD);
    expect(r.imgUrl).toBe('a.png');
    expect(r.config).toBe(cfgA); // não mistura com a cfgB órfã da própria fase
  });

  it('sem anterior com tileset, cai no principal', () => {
    const f2 = { id: 'f2', ordem: 2 };
    const r = resolver(f2, [f2], principalDD);
    expect(r).toEqual({ imgUrl: 'p.png', config: cfgP, herdadoDe: 'Fase inicial' });
  });

  it('imagem em dungeon_data também conta como tileset próprio', () => {
    const fase = { id: 'f2', ordem: 2, dungeon_data: { tileset_img_url: 'dd.png', tileset_config: cfgA } };
    const r = resolver(fase, [fase], principalDD);
    expect(r).toEqual({ imgUrl: 'dd.png', config: cfgA, herdadoDe: null });
  });

  it('nada em lugar nenhum → null', () => {
    expect(resolver({ id: 'f1', ordem: 1 }, [], null)).toBe(null);
    expect(resolver({ id: 'f1', ordem: 1 }, [], { })).toBe(null);
  });

  it('fases de ordem posterior nunca são fonte de herança', () => {
    const f1 = { id: 'f1', ordem: 1 };
    const f3 = { id: 'f3', nome: 'Futura', ordem: 3, tileset_img_url: 'c.png', tileset_config: cfgB };
    const r = resolver(f1, [f1, f3], null);
    expect(r).toBe(null);
  });
});
