// Smoke da infraestrutura de testes: valida que o setup (tests/setup/globals.ts)
// populou os globals do prefixo core e que o event bus funciona.
import { describe, it, expect, vi } from 'vitest';

const g = globalThis as any;

describe('infraestrutura de testes', () => {
  it('setup popula os globals do prefixo core (config/state/utils/supabase/events)', () => {
    expect(typeof g.HUB_EVENTS?.on).toBe('function');
    expect(typeof g.sb).toBe('function');
    expect(typeof g.temPermissao).toBe('function');
    expect(typeof g.processCustomSVG).toBe('function');
    expect(g.SUPABASE_URL).toMatch(/^https:\/\//);
    expect(g.MAPA_STATE).toBeTruthy();
  });

  it('HUB_EVENTS entrega eventos aos listeners e isola erros', () => {
    const recebido: any[] = [];
    const ouvinte = (dados: any) => recebido.push(dados);
    const quebrado = vi.fn(() => { throw new Error('listener quebrado'); });

    g.HUB_EVENTS.on('teste_infra', quebrado);
    g.HUB_EVENTS.on('teste_infra', ouvinte);
    g.HUB_EVENTS.emit('teste_infra', { valor: 42 });

    expect(quebrado).toHaveBeenCalledOnce();
    expect(recebido).toEqual([{ valor: 42 }]);

    g.HUB_EVENTS.off('teste_infra', ouvinte);
    g.HUB_EVENTS.off('teste_infra', quebrado);
    g.HUB_EVENTS.emit('teste_infra', { valor: 1 });
    expect(recebido).toEqual([{ valor: 42 }]);
  });

  it('estado global tem setters funcionais (RPG_DATA, SESSION)', () => {
    g.RPG_DATA = { myRole: 'mestre' };
    expect(g.RPG_DATA.myRole).toBe('mestre');
    g.RPG_DATA = null;
    expect(g.RPG_DATA).toBeNull();
  });
});
