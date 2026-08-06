// Mapeamento de atributos customizados → grupos base (js/systems/attribute-mapping.js).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/systems/attribute-mapping.js';

const g = globalThis as any;

beforeEach(() => {
  g.ATTR_MAPPING_CACHE = {};
});

describe('_normalizarAttr', () => {
  it('normaliza caixa e espaços; tolera null', () => {
    expect(g._normalizarAttr('  Força Bruta ')).toBe('força bruta');
    expect(g._normalizarAttr('MANA')).toBe('mana');
    expect(g._normalizarAttr(null)).toBe('');
    expect(g._normalizarAttr(undefined)).toBe('');
  });
});

describe('salvarMapeamento — validações pré-rede', () => {
  it('rejeita nome vazio ou com caracteres inválidos', async () => {
    await expect(g.salvarMapeamento('rpg1', '', 'forca'))
      .rejects.toThrow('Nome de atributo inválido');
    await expect(g.salvarMapeamento('rpg1', 'nome<script>', 'forca'))
      .rejects.toThrow('Nome de atributo inválido');
  });

  it('aceita acentos e hífens no nome, mas rejeita grupo base desconhecido', async () => {
    await expect(g.salvarMapeamento('rpg1', 'Força-Mística', 'sabedoria'))
      .rejects.toThrow('Grupo base inválido');
    await expect(g.salvarMapeamento('rpg1', 'Vigor', 'hp'))
      .rejects.toThrow('Grupo base inválido');
  });

  it('GRUPOS_VALIDOS expõe os quatro grupos canônicos', () => {
    expect(g.GRUPOS_VALIDOS).toEqual(['forca', 'destreza', 'constituicao', 'inteligencia']);
  });
});

describe('getGrupoDeAtributo / getAtributosPorGrupo (leitura do cache)', () => {
  beforeEach(() => {
    g.ATTR_MAPPING_CACHE = {
      rpg1: [
        { nome_customizado: 'Vigor', grupo_base: 'constituicao' },
        { nome_customizado: 'Astúcia', grupo_base: 'inteligencia' },
        { nome_customizado: 'Raciocínio', grupo_base: 'inteligencia' },
      ],
    };
  });

  it('resolve o grupo pelo nome, insensível a caixa', () => {
    expect(g.getGrupoDeAtributo('rpg1', 'vigor')).toBe('constituicao');
    expect(g.getGrupoDeAtributo('rpg1', 'VIGOR ')).toBe('constituicao');
    expect(g.getGrupoDeAtributo('rpg1', 'Inexistente')).toBeNull();
    expect(g.getGrupoDeAtributo('rpg2', 'Vigor')).toBeNull(); // campanha sem cache
  });

  it('lista atributos de um grupo', () => {
    expect(g.getAtributosPorGrupo('rpg1', 'inteligencia')).toEqual(['Astúcia', 'Raciocínio']);
    expect(g.getAtributosPorGrupo('rpg1', 'forca')).toEqual([]);
  });
});
