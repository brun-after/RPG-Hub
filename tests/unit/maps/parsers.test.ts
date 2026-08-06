// Parser do Pacote de Sessão (DSL de texto) e helpers (js/maps/maps.js).
import { describe, it, expect, beforeEach } from 'vitest';
import '../../../js/maps/maps.js';
import { makeChar, makeMapaEntry, resetEstadoGlobal } from '../../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => resetEstadoGlobal());

describe('_parseCoordenada', () => {
  it('converte notação de planilha para {col,row} zero-based', () => {
    expect(g._parseCoordenada('A1')).toEqual({ col: 0, row: 0 });
    expect(g._parseCoordenada('B3')).toEqual({ col: 1, row: 2 });
    expect(g._parseCoordenada('Z10')).toEqual({ col: 25, row: 9 });
    expect(g._parseCoordenada('AA10')).toEqual({ col: 26, row: 9 }); // base 26
  });

  it('aceita minúsculas e espaços nas bordas', () => {
    expect(g._parseCoordenada(' c4 ')).toEqual({ col: 2, row: 3 });
  });

  it('retorna null para formato inválido', () => {
    expect(g._parseCoordenada(null)).toBeNull();
    expect(g._parseCoordenada('')).toBeNull();
    expect(g._parseCoordenada('11')).toBeNull();
    expect(g._parseCoordenada('A')).toBeNull();
    expect(g._parseCoordenada('A1B')).toBeNull();
  });
});

describe('_parseRetangulo', () => {
  it('parseia "A1:C3" para o retângulo em células', () => {
    expect(g._parseRetangulo('A1:C3')).toEqual({ c1: 0, r1: 0, c2: 2, r2: 2 });
  });

  it('retorna null sem ":" ou com coordenada inválida', () => {
    expect(g._parseRetangulo('A1')).toBeNull();
    expect(g._parseRetangulo('A1:xx')).toBeNull();
    expect(g._parseRetangulo(null)).toBeNull();
  });
});

describe('_parseLinha', () => {
  it('SESSÃO: extrai nome e sistema', () => {
    const r = g._parseLinha('SESSÃO: "A Cripta" | sistema: dnd5e', null);
    expect(r.status).toBe('ok');
    expect(r.acao).toEqual({ tipo: 'sessao', nome: 'A Cripta', sistema: 'dnd5e' });
  });

  it('CENA com cenário existente fica ok; inexistente vira aviso sem mapa', () => {
    g.RPG_DATA = { mapas: [makeMapaEntry({ map_id: 'cripta_n1' })] };

    const ok = g._parseLinha('CENA 1 cenario: cripta_n1', null);
    expect(ok.status).toBe('ok');
    expect(ok.acao).toMatchObject({ tipo: 'cena', cena_id: 'cena_1', cenario: 'cripta_n1' });

    const aviso = g._parseLinha('CENA 2 cenario: nao_existe', null);
    expect(aviso.status).toBe('aviso');
    expect(aviso.acao).toMatchObject({ tipo: 'cena', cena_id: 'cena_2', cenario: null });
  });

  it('NARRAÇÃO: remove aspas e vincula à cena atual', () => {
    const r = g._parseLinha('NARRAÇÃO: "Vocês entram na cripta."', 'cena_1');
    expect(r.status).toBe('ok');
    expect(r.acao).toEqual({
      tipo: 'narracao', texto: 'Vocês entram na cripta.', cena_id: 'cena_1',
    });
  });

  it('SPAWN: resolve personagem case-insensitive e reporta não encontrado', () => {
    g.RPG_DATA = { characters: [makeChar({ nome: 'Goblin Arqueiro' })] };

    const ok = g._parseLinha('SPAWN: goblin arqueiro B3', 'cena_1');
    expect(ok.status).toBe('aviso'); // nome corrigido (capitalização)
    expect(ok.acao.spawns[0]).toMatchObject({
      nome: 'Goblin Arqueiro', coord: { col: 1, row: 2 }, corrigido: true,
    });

    const erro = g._parseLinha('SPAWN: Dragao Z9', 'cena_1');
    expect(erro.status).toBe('erro');
    expect(erro.acao).toBeNull();

    // Nome acentuado nem casa no regex de token (\w não cobre "ã") e cai no
    // branch "Nenhum personagem válido" — comportamento atual documentado.
    const acento = g._parseLinha('SPAWN: Dragão Z9', 'cena_1');
    expect(acento.status).toBe('erro');
    expect(acento.msg).toMatch(/Nenhum personagem válido/);
  });

  it('FOG: gradual, sem_fog e retângulo', () => {
    expect(g._parseLinha('FOG: revelar_gradual', 'cena_1').acao)
      .toEqual({ tipo: 'fog', modo: 'gradual', cena_id: 'cena_1' });
    expect(g._parseLinha('FOG: sem_fog', null).acao)
      .toEqual({ tipo: 'fog', modo: 'desativar', cena_id: null });
    const rect = g._parseLinha('FOG: A1:B2', null);
    expect(rect.acao).toEqual({
      tipo: 'fog', modo: 'revelar_rect', rect: { c1: 0, r1: 0, c2: 1, r2: 1 }, cena_id: null,
    });
    expect(g._parseLinha('FOG: xyz', null).status).toBe('erro');
  });

  it('ZONA: extrai tipo, coordenada e label', () => {
    const r = g._parseLinha('ZONA: perigo B2 "Armadilha"', 'cena_1');
    expect(r.status).toBe('ok');
    expect(r.acao).toMatchObject({
      tipo: 'zona', zona_tipo: 'perigo', coord: { col: 1, row: 1 }, label: 'Armadilha',
    });
  });

  it('linha desconhecida vira aviso ignorado', () => {
    const r = g._parseLinha('QUALQUERCOISA: abc', null);
    expect(r.status).toBe('aviso');
    expect(r.acao).toBeNull();
  });
});

describe('parsePacote', () => {
  it('ignora vazios/comentários e propaga a cena atual entre linhas', () => {
    g.RPG_DATA = { mapas: [makeMapaEntry({ map_id: 'mapa_x' })], characters: [] };
    const texto = [
      '// comentário',
      '',
      'SESSÃO: "Teste"',
      'CENA 1 cenario: mapa_x',
      'NARRAÇÃO: "olá"',
      '# outro comentário',
      'BATALHA: iniciar',
    ].join('\n');

    const r = g.parsePacote(texto);
    expect(r).toHaveLength(4);
    expect(r.map((l: any) => l.acao.tipo)).toEqual(['sessao', 'cena', 'narracao', 'batalha']);
    // narração e batalha herdaram a cena definida na linha anterior
    expect(r[2].acao.cena_id).toBe('cena_1');
    expect(r[3].acao.cena_id).toBe('cena_1');
  });
});

describe('_parseDCData', () => {
  it('parseia payload JSON com prefixo __DC__', () => {
    expect(g._parseDCData('__DC__{"dc":15,"atributo":"Força"}'))
      .toEqual({ dc: 15, atributo: 'Força' });
  });

  it('retorna null sem prefixo ou com JSON inválido', () => {
    expect(g._parseDCData('2d6+3')).toBeNull();
    expect(g._parseDCData('__DC__{quebrado')).toBeNull();
    expect(g._parseDCData(null)).toBeNull();
  });
});
