// sb() — o chokepoint de toda a comunicação com o PostgREST
// (js/core/supabase.ts): headers, refresh de sessão em 401 e retry de
// statement timeout (57014). O mock é sempre no fetch: mockar `sb` no global
// não afeta as chamadas internas do próprio módulo (binding léxico).
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { makeResponse } from '../helpers/mock-fetch';
import { resetEstadoGlobal } from '../helpers/fixtures';

const g = globalThis as any;

beforeEach(() => {
  resetEstadoGlobal();
  g.authRefreshSession = vi.fn();
  g.authSair = vi.fn();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('sb — requisição e headers', () => {
  it('monta a URL do PostgREST e parseia JSON de resposta 200', async () => {
    const fetchMock = vi.fn(async () => makeResponse(200, [{ id: 1 }]));
    vi.stubGlobal('fetch', fetchMock);

    const rows = await g.sb('characters?select=*');
    expect(rows).toEqual([{ id: 1 }]);

    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe(`${g.SUPABASE_URL}/rest/v1/characters?select=*`);
    expect(init.headers['apikey']).toBe(g.SUPABASE_KEY);
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.headers['Prefer']).toBe('return=representation');
    expect(init.headers['Authorization']).toBeUndefined(); // sem sessão
  });

  it('inclui Bearer da sessão e aceita Prefer customizado', async () => {
    g.SESSION = { access_token: 'tok-123' };
    const fetchMock = vi.fn(async () => makeResponse(200, []));
    vi.stubGlobal('fetch', fetchMock);

    await g.sb('characters', { prefer: 'return=minimal' });
    const [, init] = fetchMock.mock.calls[0] as any;
    expect(init.headers['Authorization']).toBe('Bearer tok-123');
    expect(init.headers['Prefer']).toBe('return=minimal');
  });

  it('204 e corpo vazio retornam null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse(204)));
    expect(await g.sb('characters')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => makeResponse(200, '')));
    expect(await g.sb('characters')).toBeNull();

    vi.stubGlobal('fetch', vi.fn(async () => makeResponse(200, '   ')));
    expect(await g.sb('characters')).toBeNull();
  });
});

describe('sb — 401 e refresh de sessão', () => {
  it('401 com refresh bem-sucedido refaz a chamada uma vez', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse(401, 'JWT expired'))
      .mockResolvedValueOnce(makeResponse(200, [{ ok: true }]));
    vi.stubGlobal('fetch', fetchMock);
    g.authRefreshSession = vi.fn(async () => true);

    const rows = await g.sb('characters');
    expect(rows).toEqual([{ ok: true }]);
    expect(g.authRefreshSession).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(g.authSair).not.toHaveBeenCalled();
  });

  it('401 com refresh falho desloga e retorna null', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => makeResponse(401, 'JWT expired')));
    g.authRefreshSession = vi.fn(async () => false);

    expect(await g.sb('characters')).toBeNull();
    expect(g.authSair).toHaveBeenCalledOnce();
  });
});

describe('sb — retry de statement timeout (57014)', () => {
  it('erro 57014 tenta de novo com backoff 1s/2s/3s e estoura na 4ª falha', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(async () =>
      makeResponse(500, '{"code":"57014","message":"canceling statement due to statement timeout"}'));
    vi.stubGlobal('fetch', fetchMock);

    const p = g.sb('tabela_lenta');
    const rejeicao = expect(p).rejects.toThrow('57014');

    await vi.advanceTimersByTimeAsync(1000); // retry 1
    await vi.advanceTimersByTimeAsync(2000); // retry 2
    await vi.advanceTimersByTimeAsync(3000); // retry 3
    await rejeicao;
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('recupera se um retry responder 200', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(makeResponse(500, 'erro 57014: timeout'))
      .mockResolvedValueOnce(makeResponse(200, [{ id: 7 }]));
    vi.stubGlobal('fetch', fetchMock);

    const p = g.sb('tabela_lenta');
    await vi.advanceTimersByTimeAsync(1000);
    expect(await p).toEqual([{ id: 7 }]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('erro sem 57014 estoura imediatamente com o corpo da resposta', async () => {
    vi.stubGlobal('fetch', vi.fn(async () =>
      makeResponse(400, '{"code":"23505","message":"duplicate key"}')));
    await expect(g.sb('characters')).rejects.toThrow('duplicate key');
  });
});

describe('sbRpc', () => {
  it('POST em /rpc/<nome> com args serializados', async () => {
    const fetchMock = vi.fn(async () => makeResponse(200, { hp: 42 }));
    vi.stubGlobal('fetch', fetchMock);

    const r = await g.sbRpc('npc_apply_damage', { _npc: 'x', _delta: -5 });
    expect(r).toEqual({ hp: 42 });

    const [url, init] = fetchMock.mock.calls[0] as any;
    expect(url).toBe(`${g.SUPABASE_URL}/rest/v1/rpc/npc_apply_damage`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ _npc: 'x', _delta: -5 });
  });
});
