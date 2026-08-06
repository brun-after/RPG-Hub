// Helpers de estado global (js/state.ts): vínculo skill↔personagem,
// normalização de URL de imagem, config de dados e aliases de tipo de mapa.
import { describe, it, expect, beforeEach } from 'vitest';
import { makeChar, resetEstadoGlobal } from '../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => {
  resetEstadoGlobal();
  localStorage.clear();
});

describe('_skCharId / _skFiltrarPorChar', () => {
  beforeEach(() => {
    g.RPG_DATA = { characters: [makeChar({ id: 'uuid-aria', nome: 'Aria' })] };
  });

  it('resolve o UUID pelo nome', () => {
    expect(g._skCharId('Aria')).toBe('uuid-aria');
    expect(g._skCharId('Inexistente')).toBeNull();
    expect(g._skCharId(null)).toBeNull();
  });

  it('filtra por character_id com fallback para registros legados por nome', () => {
    const skills = [
      { id: 1, character_id: 'uuid-aria', personagem: 'Aria' },
      { id: 2, character_id: null, personagem: 'Aria' },      // legado
      { id: 3, character_id: 'uuid-outro', personagem: 'Aria' }, // outro char renomeado
      { id: 4, character_id: null, personagem: 'Goblin' },
    ];
    const r = g._skFiltrarPorChar(skills, 'Aria');
    expect(r.map((s: any) => s.id)).toEqual([1, 2]);
  });

  it('sem UUID resolvível filtra apenas por nome', () => {
    const skills = [
      { id: 1, personagem: 'Goblin' },
      { id: 2, personagem: 'Aria' },
    ];
    expect(g._skFiltrarPorChar(skills, 'Goblin').map((s: any) => s.id)).toEqual([1]);
  });
});

describe('normalizeImgUrl', () => {
  it('converte variantes de link do Google Drive para lh3', () => {
    expect(g.normalizeImgUrl('https://drive.google.com/file/d/ABC_12-3/view?usp=sharing'))
      .toBe('https://lh3.googleusercontent.com/d/ABC_12-3');
    expect(g.normalizeImgUrl('https://drive.google.com/open?id=XYZ789'))
      .toBe('https://lh3.googleusercontent.com/d/XYZ789');
  });

  it('mantém URLs já normalizadas ou externas; faz trim', () => {
    expect(g.normalizeImgUrl('https://lh3.googleusercontent.com/d/ABC'))
      .toBe('https://lh3.googleusercontent.com/d/ABC');
    expect(g.normalizeImgUrl('  https://exemplo.com/img.png  '))
      .toBe('https://exemplo.com/img.png');
    expect(g.normalizeImgUrl('')).toBe('');
    expect(g.normalizeImgUrl(null)).toBeNull();
  });
});

describe('getDiceConfig / setDiceConfig', () => {
  it('sem config salva devolve TIPOS_DADO padrão', () => {
    expect(g.getDiceConfig('rpg1')).toEqual([4, 6, 8, 10, 20, 100]);
  });

  it('persiste e lê config por campanha', () => {
    g.setDiceConfig('rpg1', [6, 20]);
    expect(g.getDiceConfig('rpg1')).toEqual([6, 20]);
    expect(g.getDiceConfig('rpg2')).toEqual([4, 6, 8, 10, 20, 100]);
  });

  it('JSON corrompido no storage cai no padrão', () => {
    localStorage.setItem('rpghub_dice_rpg1', '{quebrado');
    expect(g.getDiceConfig('rpg1')).toEqual([4, 6, 8, 10, 20, 100]);
  });
});

describe('mapaGetTipo (aliases retrocompatíveis)', () => {
  it('traduz nomes antigos e preserva os novos', () => {
    expect(g.mapaGetTipo({ tipo: 'geral' })).toBe('mundo');
    expect(g.mapaGetTipo({ tipo: 'local' })).toBe('tatico');
    expect(g.mapaGetTipo({ tipo: 'fase' })).toBe('fase');
    expect(g.mapaGetTipo({})).toBe('mundo'); // default
    expect(g.mapaGetTipo(null)).toBe('mundo');
  });

  it('predicados mapaIsMundo/Tatico/Fase usam os aliases', () => {
    expect(g.mapaIsMundo({ tipo: 'geral' })).toBe(true);
    expect(g.mapaIsTatico({ tipo: 'local' })).toBe(true);
    expect(g.mapaIsFase({ tipo: 'fase' })).toBe(true);
    expect(g.mapaIsTatico({ tipo: 'mundo' })).toBe(false);
  });
});
