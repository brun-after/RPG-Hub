// Botão único de jogar (js/systems/avt-menu.js): _avtMatchAoVivo decide entre
// ingressar numa partida ativa (linha de snapshot fresca) ou criar uma nova —
// mesma janela de frescor que RTNet._checkExistingHost usa ao entrar.
import { describe, it, expect, afterEach } from 'vitest';
import '../../../js/systems/avt-menu.js';

const g = globalThis as any;

afterEach(() => { delete g.sessionStateGet; });

function comRows(rows: any) {
  g.sessionStateGet = async () => rows;
}

describe('_avtMatchAoVivo', () => {
  it('linha fresca (< 35s) = partida viva', async () => {
    comRows([{ host_user_id: 'u1', updated_at: new Date(Date.now() - 10_000).toISOString() }]);
    const live = await g._avtMatchAoVivo('rpg-1');
    expect(live).toBeTruthy();
    expect(live.host_user_id).toBe('u1');
  });

  it('linha velha (> 35s) = sem partida', async () => {
    comRows([{ host_user_id: 'u1', updated_at: new Date(Date.now() - 120_000).toISOString() }]);
    expect(await g._avtMatchAoVivo('rpg-1')).toBe(null);
  });

  it('sem linha, sem host_user_id ou erro na consulta = sem partida', async () => {
    comRows([]);
    expect(await g._avtMatchAoVivo('rpg-1')).toBe(null);
    comRows([{ updated_at: new Date().toISOString() }]);
    expect(await g._avtMatchAoVivo('rpg-1')).toBe(null);
    g.sessionStateGet = async () => { throw new Error('rede'); };
    expect(await g._avtMatchAoVivo('rpg-1')).toBe(null);
  });

  it('sem rpgId ou sem sessionStateGet = null (não explode)', async () => {
    expect(await g._avtMatchAoVivo(null)).toBe(null);
    delete g.sessionStateGet;
    expect(await g._avtMatchAoVivo('rpg-1')).toBe(null);
  });
});
