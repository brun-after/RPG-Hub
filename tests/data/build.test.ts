// Normalizadores de configuração da campanha (js/core/supabase.ts):
// buildLevelConfig, calcularHpMaxComAtributos (BUG-08) e buildTheme.
import { describe, it, expect } from 'vitest';

const g = globalThis as any;

describe('buildLevelConfig', () => {
  it('config vazia retorna null', () => {
    expect(g.buildLevelConfig({})).toBeNull();
  });

  it('parseia números com defaults para valores inválidos', () => {
    expect(g.buildLevelConfig({ nivel_maximo: '30', hp_base: '150', hp_por_nivel: '12' }))
      .toEqual({ nivel_maximo: 30, hp_base: 150, hp_por_nivel: 12 });
    // valor não-numérico cai no default de cada campo
    expect(g.buildLevelConfig({ nivel_maximo: 'abc' })).toEqual({ nivel_maximo: 20 });
    expect(g.buildLevelConfig({ hp_base: 'x' })).toEqual({ hp_base: 100 });
  });

  it('hp_attr passa direto e hp_attr_mult aceita float', () => {
    expect(g.buildLevelConfig({ hp_attr: 'Constituição', hp_attr_mult: '2.5' }))
      .toEqual({ hp_attr: 'Constituição', hp_attr_mult: 2.5 });
  });

  it('campos *_json são parseados; JSON inválido é omitido', () => {
    const lc = g.buildLevelConfig({ aumentos_automaticos_json: '{"2":{"hp":10}}' });
    expect(lc.aumentos_automaticos).toEqual({ '2': { hp: 10 } });
    expect(g.buildLevelConfig({ aumentos_automaticos_json: '{quebrado' })).toBeNull();
  });

  it('turno_modo_exclusivo aceita "true" string e boolean', () => {
    expect(g.buildLevelConfig({ turno_modo_exclusivo: 'true' }).turno_modo_exclusivo).toBe(true);
    expect(g.buildLevelConfig({ turno_modo_exclusivo: true }).turno_modo_exclusivo).toBe(true);
    expect(g.buildLevelConfig({ turno_modo_exclusivo: 'false' }).turno_modo_exclusivo).toBe(false);
  });
});

describe('calcularHpMaxComAtributos (BUG-08)', () => {
  it('hp explícito tem prioridade absoluta', () => {
    expect(g.calcularHpMaxComAtributos({ hp_base: 100 }, { For: 10 }, 55, 9)).toBe(55);
  });

  it('sem config usa base 100 sem bônus', () => {
    expect(g.calcularHpMaxComAtributos(null, null, null)).toBe(100);
  });

  it('soma hp_por_nivel a partir do nível 2 (BUG-08: nível entra na conta)', () => {
    const lc = { hp_base: 100, hp_por_nivel: 10 };
    expect(g.calcularHpMaxComAtributos(lc, null, null, 1)).toBe(100);
    expect(g.calcularHpMaxComAtributos(lc, null, null, 3)).toBe(120);
    expect(g.calcularHpMaxComAtributos(lc, null, null)).toBe(100); // default nível 1
    expect(g.calcularHpMaxComAtributos(lc, null, null, 0)).toBe(100); // clamp mínimo 1
  });

  it('atributo × multiplicador entra com ceil', () => {
    const lc = { hp_base: 100, hp_attr: 'Con', hp_attr_mult: 2 };
    expect(g.calcularHpMaxComAtributos(lc, { Con: 5.5 }, null)).toBe(111); // ceil(100+11)
  });

  it('nível + atributo combinados', () => {
    const lc = { hp_base: 100, hp_por_nivel: 10, hp_attr: 'Con', hp_attr_mult: 2 };
    expect(g.calcularHpMaxComAtributos(lc, { Con: 3 }, null, 2)).toBe(116);
  });

  it('atributo ausente no personagem conta como 0', () => {
    const lc = { hp_base: 100, hp_attr: 'Con', hp_attr_mult: 2 };
    expect(g.calcularHpMaxComAtributos(lc, {}, null)).toBe(100);
  });
});

describe('buildTheme', () => {
  it('preenche a paleta e fontes default', () => {
    const t = g.buildTheme({});
    expect(t.preto).toBe('#080c10');
    expect(t.primario).toBe('#4fa3d1');
    expect(t.font_display).toBe('Cinzel');
    expect(t.font_text).toBe('Crimson Text');
    expect(t.animation).toBe('flame');
    expect(t.level_config).toBeUndefined(); // sem level_config vazio
  });

  it('overrides do CSV vencem os defaults', () => {
    const t = g.buildTheme({ theme_preto: '#000000', font_display: 'Metamorphous' });
    expect(t.preto).toBe('#000000');
    expect(t.font_display).toBe('Metamorphous');
  });

  it('embute level_config quando a config traz campos de nível', () => {
    const t = g.buildTheme({ hp_base: '150', hp_attr: 'Vigor', hp_attr_mult: '3' });
    expect(t.level_config).toEqual({ hp_base: 150, hp_attr: 'Vigor', hp_attr_mult: 3 });
  });
});
