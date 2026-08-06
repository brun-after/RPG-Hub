// Cálculo de nível de item dropado (js/systems/catalog.js).
import { describe, it, expect } from 'vitest';
import '../../../js/systems/catalog.js';
import { mockRandomSeq } from '../../helpers/fixtures';

const g = globalThis as any;

describe('_calcularNivelItem', () => {
  it('sem sorte devolve o nível do NPC (ou o tier como fallback)', () => {
    mockRandomSeq([0.99]); // acima da chance de subir nível
    expect(g._calcularNivelItem(2, 'comum', 7)).toBe(7);
    mockRandomSeq([0.99]);
    expect(g._calcularNivelItem(3, 'comum', null)).toBe(3);
  });

  it('com sorte sobe o nível dentro do teto da raridade', () => {
    // comum: chance 0.03, máx +1 → floor(1 + rng*1)
    mockRandomSeq([0.01, 0.5]);
    expect(g._calcularNivelItem(2, 'comum', 5)).toBe(6);

    // lendario: chance 0.25, máx +3 → floor(1 + 0.9*3) = 3
    mockRandomSeq([0.2, 0.9]);
    expect(g._calcularNivelItem(2, 'lendario', 5)).toBe(8);
  });

  it('raridade desconhecida nunca sobe de nível', () => {
    mockRandomSeq([0.0]); // rng < chance só se chance > 0
    expect(g._calcularNivelItem(1, 'inexistente', 4)).toBe(4);
  });
});
