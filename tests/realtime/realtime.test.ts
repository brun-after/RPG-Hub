// Máquina de estados do cliente Phoenix/Supabase Realtime
// (js/core/realtime.ts): joins, heartbeat, socket zumbi, reconexão com
// backoff, outbox e throttles — tudo com WebSocket mockado e timers falsos.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import '../../js/core/realtime';
import { MockWebSocket } from '../helpers/mock-ws';
import { resetEstadoGlobal } from '../helpers/fixtures';

const g = globalThis as any;

function conectarAberto(rpgId = 'rpg-teste') {
  g.iniciarRealtime(rpgId);
  const ws = MockWebSocket.last();
  ws._open();
  return ws;
}

beforeEach(() => {
  resetEstadoGlobal();
  vi.useFakeTimers();
  MockWebSocket.reset();
  vi.stubGlobal('WebSocket', MockWebSocket);
  g.CURRENT_RPG = 'rpg-teste'; // realtimeBroadcast resolve o rpgId daqui
});

afterEach(() => {
  g.fecharRealtime();
  vi.useRealTimers();
});

describe('conexão e joins', () => {
  it('abre o socket na URL do Supabase Realtime com a apikey', () => {
    g.iniciarRealtime('rpg-teste');
    const ws = MockWebSocket.last();
    expect(ws.url).toBe(
      `${g.SUPABASE_URL.replace('https', 'wss')}/realtime/v1/websocket?apikey=${g.SUPABASE_KEY}&vsn=1.0.0`,
    );
  });

  it('ao abrir faz phx_join de todos os tópicos com refs únicos', () => {
    const ws = conectarAberto();
    const joins = ws.framesDe('phx_join');
    const topicos = joins.map(j => j.topic);
    expect(topicos).toContain('realtime:public:characters:rpg_id=eq.rpg-teste');
    expect(topicos).toContain('realtime:public:batalhas:rpg_id=eq.rpg-teste');
    expect(topicos).toContain('realtime:chat:rpg-teste');
    expect(topicos).toContain('realtime:public:npc_state:rpg_id=eq.rpg-teste');

    const refs = joins.map(j => j.ref);
    expect(new Set(refs).size).toBe(refs.length); // refs monotônicos únicos
  });

  it('join com phx_reply de erro é re-tentado com backoff curto', async () => {
    const ws = conectarAberto();
    const join = ws.framesDe('phx_join')[0];
    ws._message({ event: 'phx_reply', ref: join.ref, payload: { status: 'error' } });

    await vi.advanceTimersByTimeAsync(300); // 300ms × 2^0
    const rejoins = ws.framesDe('phx_join').filter(j => j.topic === join.topic);
    expect(rejoins.length).toBe(2);
    expect(rejoins[1].ref).not.toBe(rejoins[0].ref);
  });
});

describe('heartbeat e socket zumbi', () => {
  it('envia heartbeat phoenix a cada 25s enquanto houver replies', async () => {
    const ws = conectarAberto();
    await vi.advanceTimersByTimeAsync(25_000);
    let hbs = ws.framesDe('heartbeat');
    expect(hbs).toHaveLength(1);
    expect(hbs[0].topic).toBe('phoenix');

    // qualquer phx_reply zera o contador de pendentes
    ws._message({ event: 'phx_reply', ref: hbs[0].ref, payload: { status: 'ok' } });
    await vi.advanceTimersByTimeAsync(25_000);
    hbs = ws.framesDe('heartbeat');
    expect(hbs).toHaveLength(2);
  });

  it('2 heartbeats sem resposta fecham o socket e agendam reconexão', async () => {
    const ws = conectarAberto();
    await vi.advanceTimersByTimeAsync(25_000); // pendente=1, envia hb
    expect(ws.readyState).toBe(MockWebSocket.OPEN);

    await vi.advanceTimersByTimeAsync(25_000); // pendente=2 → zumbi → close
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);

    const antes = MockWebSocket.instances.length;
    await vi.advanceTimersByTimeAsync(1000); // 1ª reconexão em 1s
    expect(MockWebSocket.instances.length).toBe(antes + 1);
  });
});

describe('reconexão com backoff exponencial', () => {
  it('tenta reconectar em 1s, depois 2s, depois 4s', async () => {
    const ws1 = conectarAberto();
    ws1._serverClose();

    await vi.advanceTimersByTimeAsync(999);
    expect(MockWebSocket.instances).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWebSocket.instances).toHaveLength(2);

    // 2ª queda (sem abrir) → 2s
    MockWebSocket.last()._serverClose();
    await vi.advanceTimersByTimeAsync(1999);
    expect(MockWebSocket.instances).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWebSocket.instances).toHaveLength(3);

    // 3ª queda → 4s
    MockWebSocket.last()._serverClose();
    await vi.advanceTimersByTimeAsync(3999);
    expect(MockWebSocket.instances).toHaveLength(3);
    await vi.advanceTimersByTimeAsync(1);
    expect(MockWebSocket.instances).toHaveLength(4);
  });

  it('reconexão bem-sucedida zera o backoff e refaz os joins', async () => {
    const ws1 = conectarAberto();
    const joins1 = ws1.framesDe('phx_join').length;
    ws1._serverClose();

    await vi.advanceTimersByTimeAsync(1000);
    const ws2 = MockWebSocket.last();
    expect(ws2).not.toBe(ws1);
    ws2._open();
    expect(ws2.framesDe('phx_join').length).toBe(joins1); // re-join de tudo

    // nova queda volta ao delay inicial de 1s (tentativas zeradas no onopen)
    ws2._serverClose();
    await vi.advanceTimersByTimeAsync(1000);
    expect(MockWebSocket.instances).toHaveLength(3);
  });
});

describe('outbox de broadcasts', () => {
  it('broadcast com socket fechado vai para a fila e é despachado no open', () => {
    g.iniciarRealtime('rpg-teste');
    const ws = MockWebSocket.last(); // ainda CONNECTING

    g.realtimeBroadcast('combate_evento', { acao: 'ataque' });
    expect(ws.sent).toHaveLength(0);

    ws._open();
    const broadcasts = ws.framesDe('broadcast').filter(f => f.payload.event === 'combate_evento');
    expect(broadcasts).toHaveLength(1);
    expect(broadcasts[0].payload.payload).toEqual({ acao: 'ataque' });
    expect(broadcasts[0].topic).toBe('realtime:chat:rpg-teste');
  });

  it('fila limita a 100 mensagens descartando as mais antigas', () => {
    g.iniciarRealtime('rpg-teste');
    const ws = MockWebSocket.last();

    for (let i = 0; i < 105; i++) g.realtimeBroadcast('combate_evento', { n: i });
    ws._open();

    const broadcasts = ws.framesDe('broadcast').filter(f => f.payload.event === 'combate_evento');
    expect(broadcasts).toHaveLength(100);
    expect(broadcasts[0].payload.payload.n).toBe(5); // 0–4 descartados
    expect(broadcasts[99].payload.payload.n).toBe(104);
  });
});

describe('throttle de avt_token_move (~60ms por entidade)', () => {
  it('coalesce movimentos contíguos enviando só o último payload', async () => {
    const ws = conectarAberto();

    g.realtimeBroadcast('avt_token_move', { nome: 'Aria', x: 1 });
    g.realtimeBroadcast('avt_token_move', { nome: 'Aria', x: 2 });
    g.realtimeBroadcast('avt_token_move', { nome: 'Aria', x: 3 });
    expect(ws.framesDe('broadcast')).toHaveLength(0); // nada imediato

    await vi.advanceTimersByTimeAsync(60);
    const moves = ws.framesDe('broadcast').filter(f => f.payload.event === 'avt_token_move');
    expect(moves).toHaveLength(1);
    expect(moves[0].payload.payload).toEqual({ nome: 'Aria', x: 3 });
  });

  it('entidades diferentes têm throttles independentes', async () => {
    const ws = conectarAberto();
    g.realtimeBroadcast('avt_token_move', { nome: 'Aria', x: 1 });
    g.realtimeBroadcast('avt_token_move', { nome: 'Goblin', x: 9 });

    await vi.advanceTimersByTimeAsync(60);
    const moves = ws.framesDe('broadcast').filter(f => f.payload.event === 'avt_token_move');
    expect(moves.map(m => m.payload.payload.nome).sort()).toEqual(['Aria', 'Goblin']);
  });
});

describe('avt_player_hp (patch v12 clobbered — comportamento atual)', () => {
  // O IIFE _rtPatchV12HpThrottle embrulha window.realtimeBroadcast com
  // coalescing de 60ms, mas o rodapé "[migração-esm] accessors globais"
  // (realtime.ts:838) roda DEPOIS e redefine globalThis.realtimeBroadcast com
  // a função crua — o wrapper nunca é alcançado por quem chama o global.
  // Este teste documenta o comportamento vigente (sem coalescing); se o
  // wrapper for reativado um dia, ele deve passar a coalescer e este teste
  // deve ser atualizado junto.
  it('cada update de HP sai imediatamente (sem coalescing)', () => {
    const ws = conectarAberto();

    g.realtimeBroadcast('avt_player_hp', { nome: 'Aria', hp: 50 });
    g.realtimeBroadcast('avt_player_hp', { nome: 'Aria', hp: 40 });
    g.realtimeBroadcast('avt_player_hp', { nome: 'Aria', hp: 0 });

    const hps = ws.framesDe('broadcast').filter(f => f.payload.event === 'avt_player_hp');
    expect(hps.map(f => f.payload.payload.hp)).toEqual([50, 40, 0]);
  });
});

describe('fecharRealtime', () => {
  it('fecha o socket, limpa o sender da sessão e o estado do chat', () => {
    const ws = conectarAberto();
    expect(g.__rtSendBroadcast).toBeTypeOf('function');

    g.fecharRealtime();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
    expect(g.realtimeWS).toBeNull();
    expect(g.__rtSendBroadcast).toBeUndefined();
    expect(g.CHAT.online).toEqual([]);
    expect(g.CHAT.rpgId).toBeNull();
  });
});
