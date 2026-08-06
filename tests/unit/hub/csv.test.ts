// Parser de CSV e de arquivo multi-seção do import (js/hub/import.js).
import { describe, it, expect } from 'vitest';
import '../../../js/hub/import.js';

const g = globalThis as any;

describe('parseCSVLine', () => {
  it('separa campos por vírgula', () => {
    expect(g.parseCSVLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('preserva vírgulas dentro de aspas', () => {
    expect(g.parseCSVLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
  });

  it('desescapa aspas duplas ("" → ")', () => {
    expect(g.parseCSVLine('"diz ""oi""",x')).toEqual(['diz "oi"', 'x']);
  });

  it('campos vazios e linha vazia', () => {
    expect(g.parseCSVLine('a,,c')).toEqual(['a', '', 'c']);
    expect(g.parseCSVLine('')).toEqual(['']);
  });

  it('aspas não fechadas: devolve o que conseguiu ler (com warning)', () => {
    expect(g.parseCSVLine('a,"sem fechar')).toEqual(['a', 'sem fechar']);
  });
});

describe('parseCSV', () => {
  it('mapeia linhas para objetos pelas colunas do cabeçalho', () => {
    const rows = g.parseCSV('nome,hp\nAria,100\nGoblin,30');
    expect(rows).toEqual([
      { nome: 'Aria', hp: '100' },
      { nome: 'Goblin', hp: '30' },
    ]);
  });

  it('linha com menos campos que o cabeçalho preenche com vazio', () => {
    const rows = g.parseCSV('nome,hp,xp\nAria,100');
    expect(rows).toEqual([{ nome: 'Aria', hp: '100', xp: '' }]);
  });

  it('ignora linhas em branco e faz trim de cabeçalho e valores', () => {
    const rows = g.parseCSV(' nome , hp \n\n Aria , 100 \n');
    expect(rows).toEqual([{ nome: 'Aria', hp: '100' }]);
  });

  it('só cabeçalho → sem linhas', () => {
    expect(g.parseCSV('nome,hp')).toEqual([]);
  });
});

describe('parseMultiSection', () => {
  it('divide por #SECTION e parseia cada bloco como CSV', () => {
    const texto = [
      '#SECTION:config',
      'rpg_id,name',
      'teste,RPG Teste',
      '#SECTION:characters',
      'nome,hp',
      'Aria,100',
    ].join('\n');
    const r = g.parseMultiSection(texto);
    expect(Object.keys(r)).toEqual(['config', 'characters']);
    expect(r.config).toEqual([{ rpg_id: 'teste', name: 'RPG Teste' }]);
    expect(r.characters).toEqual([{ nome: 'Aria', hp: '100' }]);
  });

  it('seção só com cabeçalho (sem dados) é descartada', () => {
    const r = g.parseMultiSection('#SECTION:config\nrpg_id,name');
    expect(r).toEqual({});
  });

  it('desescapa \\n literais para quebras de linha reais', () => {
    const r = g.parseMultiSection('#SECTION:lore\ntitulo,conteudo\nIntro,"linha1\\nlinha2"');
    expect(r.lore[0].conteudo).toBe('linha1\nlinha2');
  });

  it('ignora comentários iniciados por # que não são #SECTION', () => {
    const r = g.parseMultiSection([
      '# comentário geral',
      '#SECTION:config',
      '# comentário dentro da seção',
      'rpg_id,name',
      'teste,X',
    ].join('\n'));
    expect(r.config).toEqual([{ rpg_id: 'teste', name: 'X' }]);
  });
});
