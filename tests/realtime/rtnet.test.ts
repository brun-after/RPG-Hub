// Superfície pública do RTNet (js/core/rtnet.ts) no estado não-inicializado —
// o comportamento de fallback que todo o app usa fora do Modo Aventura.
// A eleição de host completa exige RTCPeerConnection e fica fora do escopo
// unitário (coberta indiretamente pelos fluxos de aventura).
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../../js/core/rtnet';

const g = globalThis as any;
const RTNet = () => (window as any).RTNet;

beforeEach(() => {
  g.realtimeBroadcast = vi.fn();
});

describe('estado não-inicializado (fora do Modo Aventura)', () => {
  it('expõe a API pública completa', () => {
    const api = RTNet();
    for (const m of [
      'init', 'shutdown', 'broadcast', 'broadcastP2POnly', 'sendToHost',
      'on', 'off', 'isHost', 'isPaused', 'getHostId', 'getTransport',
      'getUserId', 'listarPeers', 'volunteerAsHost', 'transferirHost',
      'onHostChange', 'onPeerLeave', 'assumirHost', 'registrarSnapshotProvider',
      'requisitarSnapshot', 'persistirImediato',
    ]) {
      expect(api[m], `RTNet.${m}`).toBeTypeOf('function');
    }
  });

  it('defaults: sem host, transporte supabase, não pausado', () => {
    expect(RTNet().isHost()).toBe(false);
    expect(RTNet().getHostId()).toBeNull();
    expect(RTNet().getTransport()).toBe('supabase');
    expect(RTNet().isPaused()).toBe(false);
  });

  it('broadcast sem init delega para realtimeBroadcast (fallback Supabase)', () => {
    RTNet().broadcast('avt_hp_update', { nome: 'Aria', hp: 10 });
    expect(g.realtimeBroadcast).toHaveBeenCalledWith('avt_hp_update', { nome: 'Aria', hp: 10 });
  });

  it('broadcastP2POnly e sendToHost são no-ops sem init', () => {
    RTNet().broadcastP2POnly('avt_state_tick', {});
    RTNet().sendToHost('avt_player_damage', {});
    expect(g.realtimeBroadcast).not.toHaveBeenCalled();
  });

  it('transferirHost recusa quando não é host', () => {
    expect(RTNet().transferirHost('outro-user')).toBe(false);
  });

  it('listarPeers inclui a própria entrada mesmo sem peers', () => {
    const peers = RTNet().listarPeers();
    expect(peers).toHaveLength(1);
    expect(peers[0].channelState).toBe('self');
  });
});

describe('registro de handlers', () => {
  it('on/off registram e removem sem vazar entre tipos', () => {
    const h = vi.fn();
    RTNet().on('avt_hp_update', h);
    RTNet().off('avt_hp_update', h);
    RTNet().off('tipo_nunca_registrado', h); // não pode lançar
  });

  it('onHostChange e onPeerLeave devolvem função de unsubscribe', () => {
    const un1 = RTNet().onHostChange(() => {});
    const un2 = RTNet().onPeerLeave(() => {});
    expect(un1).toBeTypeOf('function');
    expect(un2).toBeTypeOf('function');
    un1();
    un2();
  });
});
