// Lógica de autorização client-side (js/core/events.ts).
// Importada pelo setup (prefixo core) — não precisa de import próprio.
import { describe, it, expect, beforeEach } from 'vitest';
import { resetEstadoGlobal } from '../../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => {
  resetEstadoGlobal();
  g.PERMISSOES_CONFIG = undefined;
});

describe('temPermissao', () => {
  it('mestre sempre tem permissão', () => {
    g.RPG_DATA = { myRole: 'mestre', myPermissoes: { abrir_bau: false } };
    expect(g.temPermissao('abrir_bau')).toBe(true);
    expect(g.temPermissao('qualquer_coisa')).toBe(true);
  });

  it('permissão explícita do jogador vence o default (inclusive false)', () => {
    g.PERMISSOES_CONFIG = [{ key: 'abrir_bau', padrao: true }];
    g.RPG_DATA = { myRole: 'jogador', myPermissoes: { abrir_bau: false } };
    expect(g.temPermissao('abrir_bau')).toBe(false);

    g.RPG_DATA = { myRole: 'jogador', myPermissoes: { abrir_bau: true } };
    expect(g.temPermissao('abrir_bau')).toBe(true);
  });

  it('sem permissão explícita cai no padrão do PERMISSOES_CONFIG', () => {
    g.PERMISSOES_CONFIG = [
      { key: 'abrir_bau', padrao: true },
      { key: 'editar_mapa', padrao: false },
    ];
    g.RPG_DATA = { myRole: 'jogador', myPermissoes: {} };
    expect(g.temPermissao('abrir_bau')).toBe(true);
    expect(g.temPermissao('editar_mapa')).toBe(false);
  });

  it('chave desconhecida ou config ausente nega por padrão', () => {
    g.RPG_DATA = { myRole: 'jogador', myPermissoes: {} };
    expect(g.temPermissao('nao_existe')).toBe(false);

    g.PERMISSOES_CONFIG = undefined;
    expect(g.temPermissao('abrir_bau')).toBe(false);
  });

  it('sem RPG_DATA carregado nega', () => {
    g.RPG_DATA = null;
    expect(g.temPermissao('abrir_bau')).toBe(false);
  });
});

describe('podeEditarPersonagem', () => {
  it('mestre edita qualquer personagem', () => {
    g.RPG_DATA = { myRole: 'mestre', linked: null };
    expect(g.podeEditarPersonagem('Aria')).toBe(true);
  });

  it('jogador só edita o personagem vinculado', () => {
    g.RPG_DATA = { myRole: 'jogador', linked: 'Aria' };
    expect(g.podeEditarPersonagem('Aria')).toBe(true);
    expect(g.podeEditarPersonagem('Goblin')).toBe(false);
  });

  it('sem vínculo não edita ninguém', () => {
    g.RPG_DATA = { myRole: 'jogador', linked: null };
    expect(g.podeEditarPersonagem('Aria')).toBe(false);
  });
});
