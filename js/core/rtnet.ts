// core/rtnet.js
// RTNet — Camada de transporte P2P para Modo Aventura
// WebRTC DataChannel mesh (≤6 jogadores) + sinalização Supabase + fallback gracioso
// API pública: RTNet.init / shutdown / broadcast / on / off / isHost / getHostId /
//              onHostChange / assumirHost / registrarSnapshotProvider /
//              requisitarSnapshot / persistirImediato / transferirHost /
//              listarPeers / isPaused / getTransport
//
// Modelo de host (revisado):
//   • Primeiro a entrar é host. Quem entra depois NÃO disputa; só vira host se
//     o host atual sair sem transferir (banner manual "Assumir host").
//   • Host pode transferir manualmente: host_transfer_offer → host_transfer_ack.
//   • Sem host válido → RTNet._paused = true; aventura pausa simulação até
//     alguém clicar "Assumir host".
//   • Tick autoritativo: host emite avt_state_tick a cada 100ms (STATE_TICK_INTERVAL, canal reliable).

window.RTNet = (() => {

  // ── ESTADO INTERNO ─────────────────────────────────────────────
  const _s = {
    rpgId:    null as any,
    userId:   null as any,
    initialized: false,
    joinedAt: 0,            // ms epoch — minha entrada
    paused:   false,

    // WebRTC
    peers:       new Map<string, RTCPeerConnection>(),
    channels:    new Map<string, RTCDataChannel>(),          // reliable
    fastChannels:new Map<string, RTCDataChannel>(),          // unreliable
    connectingTo:new Set<string>(),
    peerJoinTs:  new Map<string, number>(),                  // ms epoch reportado pelo peer

    // Host
    hostId:      null as any,
    _isHost:     false,
    hostCbs:     [] as any[],
    lastHostHb:  0,

    // Timers
    snapshotTimer:    null as any,
    heartbeatTimer:   null as any,
    stateTickTimer:   null as any,
    _hostDeadTimer:   null as any,
    _candidateTimer:  null as any,
    _soloHostTimer:   null as any,
    periodicSyncTimer:null as any,

    // Event handlers
    handlers: new Map<string, Set<(payload: any) => void>>(),

    // Snapshot
    snapshotProvider: null as any,

    // Transport
    mode: 'supabase', // 'p2p' | 'mixed' | 'supabase'

    // Election candidates collected during window
    _candidates: new Map<string, number>(),                  // userId → joinTs

    // Voluntary host election
    _volunteers:    [] as any[],     // { userId, ts } — candidatos ao host (modo voluntário)
    _volunteerTimer: null as any,  // timer de janela de coleta de volunteers

    // Peer leave callbacks
    _peerLeaveCallbacks: [] as any[],

    // Telemetria (AVT_PERF): contadores de mensagens e RTT ao host
    _stats: { in: 0, out: 0, rtt: -1 },
    _pingTimer: null as any,
  };

  // TURN opcional via env (Vite): VITE_TURN_URL / VITE_TURN_USER / VITE_TURN_PASS.
  // Sem TURN, peers atrás de NAT simétrico caem silenciosamente para o fallback Supabase.
  const _ICE_ENV = (() => { try { return (import.meta as any).env || {}; } catch(_) { return {}; } })();
  function _iceServers() {
    const servers: any = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (_ICE_ENV.VITE_TURN_URL) {
      servers.push({
        urls: _ICE_ENV.VITE_TURN_URL,
        username: _ICE_ENV.VITE_TURN_USER || undefined,
        credential: _ICE_ENV.VITE_TURN_PASS || undefined,
      });
    }
    return servers;
  }
  const HOST_HB_INTERVAL     = 5_000;   // ms — host heartbeat via signaling
  const HOST_DEAD_THRESH     = 15_000;  // ms — host considerado morto sem heartbeats
  const SNAPSHOT_INTERVAL    = 15_000;  // ms — snapshot persistido em banco
  const SNAPSHOT_SKIP_MAX_MS = 20_000;  // ms — snapshot inalterado pode pular no máx. 1 tick seguido
  const DB_HOST_FRESH_MS     = 35_000;  // ms — idade máx. da linha de snapshot p/ aceitar host existente
                                        //      (cobre o tick pulado: idade real chega a ~30s em idle)
  // Exposto p/ a sonda "partida viva?" do menu (avt-menu._avtMatchAoVivo) usar
  // exatamente a mesma janela de frescor de _checkExistingHost.
  try { (window as any).RTNET_HOST_FRESH_MS = DB_HOST_FRESH_MS; } catch (_) {}
  const STATE_TICK_INTERVAL  = 100;     // ms — tick autoritativo via DataChannel (10 Hz, confiável)
  const ELECTION_WAIT        = 250;     // ms — janela curta de coleta (apenas empate raro)
  const ELECTION_MODE        = 'voluntary'; // 'auto' = primeiro a entrar; 'voluntary' = aguarda host_volunteer
  const PERIODIC_SYNC_INTERVAL = 10_000; // ms — ressincronização periódica forçada
  const PING_INTERVAL        = 2_000;   // ms — medição de RTT ao host (canal fast)

  // ── Catálogo único dos eventos avt_* (Entrega 3) ──────────────────────────
  // Fonte de verdade para os 4 consumidores que antes mantinham cópias
  // divergentes: AVT_HANDLER_MAP e EVENT_OPTS (derivados abaixo) e o
  // dispatcher + flush do fallback Supabase em realtime.ts (via
  // window.AVT_EVENTS). A divergência dropava eventos: o flush descartava
  // ~20 tipos enfileirados pré-join e o fallback não roteava avt_obj_spawn,
  // avt_rastro_marcar etc.; o DataChannel não roteava avt_invocacao_destruida.
  // handler: função global receptora (ausente = tratado em camada própria);
  // persist/reliable/relay: opts de transporte (ausentes = defaults do caller).
  interface AvtEventSpec {
    handler?: string;
    persist?: 'never' | 'snapshot' | 'immediate';
    reliable?: boolean;
    relay?: boolean;
  }
  const AVT_EVENTS: Record<string, AvtEventSpec> = {
    avt_token_move:        { handler: 'avtReceberMovimento',        persist: 'never',     reliable: false },
    avt_host_heartbeat:    { handler: 'avtReceberHostHeartbeat',    persist: 'never',     reliable: false }, // interceptado na camada de transporte do RTNet; handler é o stub do fallback
    avt_combate_inicio:    { handler: 'avtReceberCombateInicio',    persist: 'immediate', reliable: true  },
    avt_batalha_update:    { handler: 'avtReceberBatalhaUpdate',    persist: 'snapshot',  reliable: true  },
    avt_combate_fim:       { handler: 'avtReceberFimBatalha',       persist: 'immediate', reliable: true  },
    avt_combate_join:      { handler: 'avtReceberJoinBatalha',      persist: 'snapshot',  reliable: true  },
    avt_npc_morreu:        { handler: 'avtReceberNpcMorreu',        persist: 'immediate', reliable: true  },
    avt_npc_perseguindo:   { handler: 'avtReceberNpcPerseguindo',   persist: 'never',     reliable: false },
    avt_npc_respawn:       { handler: 'avtReceberNpcRespawn',       persist: 'immediate', reliable: true  },
    avt_convite_combate:   { handler: 'avtReceberConviteCombate',   persist: 'never',     reliable: false },
    avt_xp_ganho:          { handler: 'avtReceberXpGanho',          persist: 'immediate', reliable: true  },
    avt_level_up:          { handler: 'avtReceberLevelUp',          persist: 'immediate', reliable: true  },
    avt_jogador_morreu:    { handler: 'avtReceberJogadorMorreu',    persist: 'immediate', reliable: true  },
    avt_jogador_ressurgiu: { handler: 'avtReceberJogadorRessurgiu', persist: 'immediate', reliable: true  },
    avt_jogador_visivel:   { handler: 'avtReceberJogadorVisivel',   persist: 'immediate', reliable: true  },
    avt_jogador_pausado:   { handler: 'avtReceberJogadorPausado',   persist: 'immediate', reliable: true  },
    avt_char_saiu:         { handler: 'avtReceberCharSaiu',         persist: 'immediate', reliable: true  },
    avt_skill_selecionada: { handler: 'avtReceberSkillSelecionada', persist: 'never',     reliable: false, relay: true },
    avt_dado_rolado:       { handler: 'avtReceberDadoRolado',       persist: 'never',     reliable: false, relay: true },
    avt_dano_visual:       { handler: 'avtReceberDanoVisual',       persist: 'never',     reliable: false, relay: true },
    avt_dano_visual_batch: { handler: 'avtReceberDanoVisualBatch',  persist: 'never',     reliable: false, relay: true },
    avt_hp_update:         { handler: 'avtReceberHpUpdate',         persist: 'snapshot',  reliable: true  },
    avt_member_linked:     { handler: 'avtReceberMemberLinked',     persist: 'immediate', reliable: true  },
    avt_primeiro_ataque:   { handler: 'avtReceberPrimeiroAtaque',   persist: 'never',     reliable: false, relay: true },
    avt_skill_anim:        { handler: 'avtReceberSkillAnim',        persist: 'never',     reliable: true,  relay: true },
    avt_attack_anim:       { handler: 'avtReceberAttackAnim',       persist: 'never',     reliable: true,  relay: true },
    avt_level_config_update:{ handler: 'avtReceberLevelConfigUpdate', persist: 'immediate', reliable: true },
    // [HOST-RTC]
    avt_state_tick:           { handler: 'avtReceberStateTick',          persist: 'never', reliable: true },
    avt_player_action:        { handler: 'avtReceberPlayerAction',       persist: 'never', reliable: true },
    avt_authoritative_apply:  { handler: 'avtReceberAuthoritativeApply', persist: 'never', reliable: true },
    // [HP-AUTHORITY v22]
    avt_player_hp:            { handler: 'avtReceberPlayerHp',           persist: 'never', reliable: true },
    avt_player_damage:        { handler: 'avtReceberPlayerDamage',       persist: 'never', reliable: true },
    // [COLISAO + ENTIDADE]
    avt_colisao_config:       { handler: 'avtReceberColisaoConfig' },
    avt_entidade_nova:        { handler: 'avtReceberEntidadeNova' },
    avt_invocacao_destruida:  { handler: 'avtReceberInvocacaoDestruida' },
    avt_invocacao_update:     { handler: 'avtReceberInvocacaoUpdate',    persist: 'never', reliable: true },
    // [MOVE-INPUT]
    avt_move_input:           { handler: 'avtReceberMoveInput',          persist: 'never', reliable: true },
    // [SYNC-COMPLETO]
    avt_item_equipado:        { handler: 'avtReceberItemEquipado',       persist: 'never', reliable: true },
    avt_item_desequipado:     { handler: 'avtReceberItemDesequipado',    persist: 'never', reliable: true },
    avt_char_update:          { handler: 'avtReceberCharUpdate',         persist: 'never', reliable: true },
    // [RECURSOS + BAÚS]
    avt_rsv_update:           { handler: 'avtReceberRsvUpdate',          persist: 'never', reliable: true },
    avt_bau_aberto:           { handler: 'avtReceberBauAberto',          persist: 'immediate', reliable: true },
    // [OBJETOS]
    avt_obj_spawn:            { handler: 'avtReceberObjSpawn',           persist: 'immediate', reliable: true },
    avt_obj_pickup:           { handler: 'avtReceberObjPickup',          persist: 'immediate', reliable: true },
    avt_armadilha_obj_disparo:{ handler: 'avtReceberArmadilhaObjDisparo', persist: 'immediate', reliable: true },
    avt_loja_update:          { handler: 'avtReceberLojaUpdate',         persist: 'immediate', reliable: true },
    // [COBERTURA COMPLETA]
    avt_rastro_marcar:        { handler: 'avtReceberRastroMarcar',       persist: 'never', reliable: true },
    avt_armadilha_marcar:     { handler: 'avtReceberArmadilhaMarcar',    persist: 'never', reliable: true },
    avt_armadilha_remover:    { handler: 'avtReceberArmadilhaRemover',   persist: 'never', reliable: true },
    avt_ooc_cooldown:         { handler: 'avtReceberOocCooldown',        persist: 'never', reliable: true },
    avt_inv_update:           { handler: 'avtReceberInvUpdate',          persist: 'never', reliable: true },
    // [FASES]
    avt_fase_mudou:           { handler: 'avtReceberFaseMudou' },
    avt_fase_host:            { handler: 'avtReceberFaseHost',           persist: 'never', reliable: true },
    avt_fase_host_release:    { handler: 'avtReceberFaseHostRelease',    persist: 'never', reliable: true },
    avt_porta_proxima:        { handler: 'avtReceberPortaProxima' },
    avt_dungeon_update:       { handler: 'avtReceberDungeonUpdate',      persist: 'never', reliable: true },
    // presença por fase: tratada por handler anônimo via RTNet.on (avt-menu.ts)
    avt_fase_presenca:        {},
    // [VFX persistente]
    avt_efeito_anim_start:    { handler: 'avtReceberEfeitoAnimStart',    persist: 'never', reliable: true, relay: true },
    avt_efeito_anim_stop:     { handler: 'avtReceberEfeitoAnimStop',     persist: 'never', reliable: true, relay: true },
    // [PERF] ping/pong tratados na camada de transporte; handlers = stubs do fallback
    avt_ping:                 { handler: 'avtReceberPing',               persist: 'never', reliable: false },
    avt_pong:                 { handler: 'avtReceberPong',               persist: 'never', reliable: false },
  };
  try { (window as any).AVT_EVENTS = AVT_EVENTS; } catch(_) {}

  // Derivados do catálogo — mesmo conteúdo que os literais antigos, sem cópia.
  const AVT_HANDLER_MAP: Record<string, string> = {};
  const EVENT_OPTS: Record<string, Partial<AvtEventSpec>> = {};
  for (const _ev in AVT_EVENTS) {
    const _spec = AVT_EVENTS[_ev];
    if (_spec.handler) AVT_HANDLER_MAP[_ev] = _spec.handler;
    if (_spec.persist !== undefined) {
      EVENT_OPTS[_ev] = { persist: _spec.persist, reliable: !!_spec.reliable };
      if (_spec.relay) EVENT_OPTS[_ev].relay = true;
    }
  }

  function _log(...a: any[])  { try { console.log('[RTNet]',  ...a); } catch(_) {} }
  function _warn(...a: any[]) { try { console.warn('[RTNet]', ...a); } catch(_) {} }

  function _webRTCOk() { return typeof RTCPeerConnection !== 'undefined'; }

  // ── DISPATCH ────────────────────────────────────────────────────

  function _dispatch(tipo: any, payload: any) {
    _s._stats.in++;
    // Heartbeat do host via DataChannel — resetar watchdog de host morto
    if (tipo === 'avt_host_heartbeat') {
      const hId = payload?.host_id;
      if (hId && hId === _s.hostId) { _s.lastHostHb = Date.now(); _resetHostWatch(); }
      return;
    }
    // Ping/pong de RTT — tratados na camada de transporte
    if (tipo === 'avt_ping') { _onPing(payload); return; }
    if (tipo === 'avt_pong') { _onPong(payload); return; }
    const hs = _s.handlers.get(tipo);
    if (hs) hs.forEach(h => { try { h(payload); } catch(e) { _warn('handler falhou:', tipo, e); } });

    const fnName = AVT_HANDLER_MAP[tipo];
    if (fnName) {
      const fn = (window as any)[fnName];
      if (typeof fn === 'function') { try { (fn as any)(payload); } catch(e) { _warn('global handler:', fnName, e); } }
      else {
        try {
          window.__avtPendingBroadcasts = window.__avtPendingBroadcasts || [];
          if (window.__avtPendingBroadcasts.length < 200) {
            window.__avtPendingBroadcasts.push({ ev: tipo, pl: payload, at: Date.now() });
          }
        } catch(_) {}
      }
    }
  }

  // ── SINALIZAÇÃO (via Supabase Realtime existente) ───────────────

  function _signal(tipo: any, payload: any) {
    if (typeof realtimeBroadcast !== 'function') return;
    try { realtimeBroadcast('rtnet_' + tipo, { ...payload, _from: _s.userId }); } catch(e) { _warn('signal falhou:', tipo, e); }
  }

  function _handleSignaling(tipo: any, payload: any) {
    if (!_s.initialized) return;
    if (!payload) return;
    const from = payload._from;
    if (from === _s.userId) return;

    switch (tipo) {
      case 'peer_announce':     _onAnnounce(from, payload); break;
      case 'peer_offer':        if (payload.target_id === _s.userId) _onOffer(from, payload).catch(e => _warn('offer:', e)); break;
      case 'peer_answer':       if (payload.target_id === _s.userId) _onAnswer(from, payload).catch(e => _warn('answer:', e)); break;
      case 'peer_ice':          if (payload.target_id === _s.userId) _onIce(from, payload).catch(e => _warn('ice:', e)); break;
      case 'host_elected':      _onHostElected(payload.host_id); break;
      case 'host_heartbeat':
        if (payload.host_id === _s.hostId) { _s.lastHostHb = Date.now(); _resetHostWatch(); }
        break;
      case 'snapshot_request':
        if (_s._isHost && payload.target_id === _s.userId) _pushSnapshotTo(payload._from);
        break;
      case 'snapshot_response':
        if (payload.target_id === _s.userId) _applySnapshot(payload.snapshot);
        break;
      // [HOST-RTC] Transferência manual de host
      case 'host_transfer_offer':
        if (payload.target_id === _s.userId) _onHostTransferOffer(from, payload);
        break;
      case 'host_transfer_ack':
        _onHostTransferAck(payload.new_host_id, payload.old_host_id);
        break;
      case 'host_volunteer':
        // Candidatura voluntária ao host: coleta numa janela de 200ms e elege o menor ts
        if (!_s.hostId) {
          _s._volunteers.push(payload);
          clearTimeout(_s._volunteerTimer);
          _s._volunteerTimer = setTimeout(_decideHostFromVolunteers, 200);
        }
        break;
    }
  }

  // ── WEBRTC ──────────────────────────────────────────────────────

  async function _connectTo(peerId: any) {
    if (_s.peers.has(peerId) || _s.connectingTo.has(peerId)) return;
    _s.connectingTo.add(peerId);
    _log('iniciando conexão WebRTC com', peerId);

    try {
      const pc = new RTCPeerConnection({ iceServers: _iceServers() });
      _s.peers.set(peerId, pc);

      const ch = pc.createDataChannel('game', { ordered: true });
      _bindChannel(ch, peerId, 'reliable');
      _s.channels.set(peerId, ch);

      const fch = pc.createDataChannel('fast', { ordered: false, maxRetransmits: 0 });
      _bindChannel(fch, peerId, 'unreliable');
      _s.fastChannels.set(peerId, fch);

      pc.onicecandidate = e => {
        if (e.candidate) _signal('peer_ice', { target_id: peerId, candidate: e.candidate.toJSON() });
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') _cleanPeer(peerId);
      };

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      _signal('peer_offer', { target_id: peerId, sdp: offer });
    } catch(e) {
      _warn('WebRTC connect falhou:', e);
      _cleanPeer(peerId);
    } finally {
      _s.connectingTo.delete(peerId);
    }
  }

  async function _onOffer(fromId: any, payload: any) {
    if (_s.peers.has(fromId)) return;
    _log('recebendo offer de', fromId);

    const pc = new RTCPeerConnection({ iceServers: _iceServers() });
    _s.peers.set(fromId, pc);

    pc.ondatachannel = e => {
      const ch = e.channel;
      if (ch.label === 'game') {
        _s.channels.set(fromId, ch);
        _bindChannel(ch, fromId, 'reliable');
      } else if (ch.label === 'fast') {
        _s.fastChannels.set(fromId, ch);
        _bindChannel(ch, fromId, 'unreliable');
      }
    };
    pc.onicecandidate = e => {
      if (e.candidate) _signal('peer_ice', { target_id: fromId, candidate: e.candidate.toJSON() });
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') _cleanPeer(fromId);
    };

    await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    _signal('peer_answer', { target_id: fromId, sdp: answer });
  }

  async function _onAnswer(fromId: any, payload: any) {
    const pc = _s.peers.get(fromId);
    if (!pc) return;
    try { await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch(e) { _warn('setRemote:', e); }
  }

  async function _onIce(fromId: any, payload: any) {
    const pc = _s.peers.get(fromId);
    if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch(e) { _warn('addIce:', e); }
  }

  function _bindChannel(ch: any, peerId: any, kind: any) {
    ch.onopen  = () => { _log(`DataChannel ${kind} aberto com`, peerId); _updateMode(); };
    ch.onclose = () => { _cleanPeer(peerId); };
    ch.onmessage = (e: any) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.tipo) {
          // [RELAY] Host repassa eventos one-shot de um cliente aos demais peers, pois o
          // remetente só nos envia a nós (star). Mantém o frame original intacto.
          if (_s._isHost && EVENT_OPTS[msg.tipo] && EVENT_OPTS[msg.tipo].relay) {
            _relayFanout(e.data, msg.tipo, peerId);
          }
          _dispatch(msg.tipo, msg.payload);
        }
      } catch(err) { _warn('DataChannel parse:', err); }
    };
  }

  // [RELAY] Reenvia um frame já serializado a todos os peers abertos exceto o remetente.
  // Usa o mapa de canais conforme a confiabilidade do evento.
  function _relayFanout(frame: any, tipo: any, exceptPeerId: any) {
    const o: Partial<AvtEventSpec> = EVENT_OPTS[tipo] || {};
    const chMap = o.reliable !== false ? _s.channels : _s.fastChannels;
    for (const [pid, ch] of chMap.entries()) {
      if (pid === exceptPeerId) continue;
      if (ch.readyState === 'open') { try { ch.send(frame); } catch(_) {} }
    }
  }

  function _cleanPeer(peerId: any) {
    // peerId IS the userId in this mesh — notify before cleaning
    if (_s.peers.has(peerId) && _s._peerLeaveCallbacks.length) {
      _s._peerLeaveCallbacks.forEach(fn => { try { fn(peerId); } catch(_) {} });
    }
    const pc = _s.peers.get(peerId);
    if (pc) { try { pc.close(); } catch(_) {} _s.peers.delete(peerId); }
    _s.channels.delete(peerId);
    _s.fastChannels.delete(peerId);
    _s.peerJoinTs.delete(peerId);
    _updateMode();
  }

  function _updateMode() {
    const prev    = _s.mode;
    const openRel = [..._s.channels.values()].filter(ch => ch.readyState === 'open').length;
    const total   = _s.peers.size;
    _s.mode = total === 0 ? 'supabase' : openRel === total ? 'p2p' : 'mixed';
    _updateTransportIndicator();
    if (_s.mode !== prev) {
      try { window.dispatchEvent(new CustomEvent('rtnet:modechange', { detail: { mode: _s.mode, prev } })); } catch(_) {}
    }
    _avisarFallbackSePersistir();
  }

  // Aviso único por sessão quando o transporte fica degradado com peers presentes
  // (mesh P2P incompleta → eventos passam pelo Supabase, com mais latência).
  // Grace de 15s: durante o handshake WebRTC o modo passa por 'mixed'
  // legitimamente; só avisa se a degradação persistir. Sessão solo não avisa.
  let _fallbackAvisado = false;
  let _fallbackAvisoTimer: ReturnType<typeof setTimeout> | null = null;
  function _avisarFallbackSePersistir() {
    const degradado = _s.mode !== 'p2p' && _s.peerJoinTs.size > 0;
    if (!degradado) {
      if (_fallbackAvisoTimer) { clearTimeout(_fallbackAvisoTimer); _fallbackAvisoTimer = null; }
      return;
    }
    if (_fallbackAvisado || _fallbackAvisoTimer) return;
    _fallbackAvisoTimer = setTimeout(() => {
      _fallbackAvisoTimer = null;
      if (_fallbackAvisado || !_s.initialized) return;
      if (_s.mode === 'p2p' || _s.peerJoinTs.size === 0) return;
      _fallbackAvisado = true;
      try {
        const toast = (window as any).mostrarToast;
        if (typeof toast === 'function') {
          toast('Sem conexão direta (P2P) com algum jogador — usando fallback Supabase, com mais latência. Um servidor TURN resolve NAT restrito (docs/setup.md).', 'aviso');
        }
      } catch(_) {}
    }, 15000);
  }

  // ── ELEIÇÃO DE HOST ─────────────────────────────────────────────

  async function _checkExistingHost() {
    try {
      if (typeof sessionStateGet !== 'function') return false;
      const rows = await sessionStateGet(_s.rpgId);
      if (!rows || !rows[0]) return false;
      const row = rows[0];
      const age = Date.now() - new Date(row.updated_at).getTime();
      // Janela maior que HOST_DEAD_THRESH: o updated_at vem do snapshot de 15s,
      // que pode pular 1 tick quando o estado não muda (ver _saveSnapshot) —
      // a vitalidade fina do host segue coberta pelo heartbeat P2P de 5s.
      if (age < DB_HOST_FRESH_MS) {
        _log('host existente:', row.host_user_id, `(${Math.round(age/1000)}s atrás)`);
        _onHostElected(row.host_user_id);
        return true;
      }
    } catch(e) { _warn('checkExistingHost:', e); }
    return false;
  }

  function _startElection() {
    if (ELECTION_MODE === 'voluntary') {
      // Anuncia presença sem candidatar-se: host será eleito só quando alguém clicar "Iniciar como Host"
      _signal('peer_announce', { isHostCandidate: false, userId: _s.userId, joinTs: _s.joinedAt });
      // Auto-promoção em sessão SOLO: se, após a janela, ninguém mais anunciou presença
      // e não há host, assume host localmente — evita o jogador solo ficar preso na sala
      // de espera (falsa sensação de "pausado"). Em multiplayer, a presença de outros
      // peers cancela a auto-promoção e a eleição voluntária normal prevalece.
      if (_s._soloHostTimer) clearTimeout(_s._soloHostTimer);
      _s._soloHostTimer = setTimeout(() => {
        _s._soloHostTimer = null;
        if (_s.hostId) return;              // host já eleito/encontrado
        if (_s.peerJoinTs.size > 0) return; // há outros peers → aguarda host voluntário
        _log('sessão solo detectada — auto-promovendo a host');
        _electSelf();
      }, 3000);
      return;
    }
    _s._candidates.clear();
    _s._candidates.set(_s.userId, _s.joinedAt);
    // Anuncia já candidatando-se; quem chegar depois vê e desiste.
    _signal('peer_announce', { isHostCandidate: true, userId: _s.userId, joinTs: _s.joinedAt });
    if (_s._candidateTimer) clearTimeout(_s._candidateTimer);
    _s._candidateTimer = setTimeout(_decideHost, ELECTION_WAIT);
  }

  // Elege host com base nas candidaturas voluntárias recebidas
  function _decideHostFromVolunteers() {
    if (_s.hostId) return; // já eleito
    if (!_s._volunteers || _s._volunteers.length === 0) return;
    let winner = null, winnerTs = Infinity;
    for (const v of _s._volunteers) {
      const ts = typeof v.ts === 'number' ? v.ts : 0;
      const uid = v.userId || v._from || '';
      if (ts < winnerTs || (ts === winnerTs && uid < (winner ? (winner.userId || winner._from || '') : ''))) {
        winner = v; winnerTs = ts;
      }
    }
    if (!winner) return;
    const winnerId = winner.userId || winner._from || '';
    _log('host voluntário eleito:', winnerId);
    if (winnerId === _s.userId) {
      _electSelf();
    } else {
      _onHostElected(winnerId);
    }
  }

  function _onAnnounce(fromId: any, payload: any) {
    const ts = typeof payload.joinTs === 'number' ? payload.joinTs : Date.now();
    _s.peerJoinTs.set(fromId, ts);
    if (payload.isHostCandidate) {
      _s._candidates.set(fromId, ts);
      if (_s._candidateTimer) {
        clearTimeout(_s._candidateTimer);
        _s._candidateTimer = setTimeout(_decideHost, 150);
      }
    }
    // Se já temos host, informa o entrante.
    if (_s._isHost && fromId) {
      _signal('host_elected', { host_id: _s.userId });
    }
    // WebRTC handshake — iniciador é o de menor userId.
    if (_webRTCOk() && !_s.peers.has(fromId) && !_s.connectingTo.has(fromId)) {
      if (_s.userId < fromId) _connectTo(fromId).catch(e => _warn('WebRTC:', e));
    }
  }

  // "Primeiro a entrar" — vencedor tem menor joinTs; tiebreak por userId.
  function _decideHost() {
    _s._candidateTimer = null;
    if (_s.hostId) return;
    let winner = _s.userId;
    let winnerTs = _s.joinedAt;
    for (const [uid, ts] of _s._candidates.entries()) {
      if (ts < winnerTs || (ts === winnerTs && uid < winner)) {
        winner = uid; winnerTs = ts;
      }
    }
    if (winner === _s.userId) {
      _electSelf();
    } else {
      setTimeout(() => { if (!_s.hostId) { _warn('host não anunciado, assumindo'); _electSelf(); } }, 2000);
    }
  }

  function _electSelf() {
    _log('eleito como host:', _s.userId);
    _signal('host_elected', { host_id: _s.userId });
    _onHostElected(_s.userId);
    _startSnapshotTimer();
  }

  function _onHostElected(hostId: any) {
    if (_s.hostId === hostId) return;
    _log('host eleito:', hostId);
    const wasHost = _s._isHost;
    _s.hostId  = hostId;
    _s._isHost = (hostId === _s.userId);
    _s.lastHostHb = Date.now();
    _s.paused = false;
    _s.hostCbs.forEach(cb => { try { cb(hostId); } catch(_) {} });
    _updateHostIndicator();
    _resetHostWatch();
    if (_s._isHost) {
      _startHostHeartbeat();
      if (!wasHost) _startSnapshotTimer();
    } else {
      _stopHostHeartbeat();
    }
    // Tick autoritativo roda em todos os peers (gate por fase em _avtBuildStateTick),
    // para suportar host por fase mesmo em quem não é o host rtnet global.
    _startStateTick();
    try { window.dispatchEvent(new CustomEvent('rtnet:hostchange', { detail: { hostId, isHost: _s._isHost } })); } catch(_) {}
  }

  // ── TRANSFERÊNCIA MANUAL DE HOST ────────────────────────────────

  function _onHostTransferOffer(fromId: any, payload: any) {
    // Apenas aceita se vier do host atual
    if (fromId !== _s.hostId) { _warn('host_transfer ignorado — origem não é host:', fromId); return; }
    _log('recebido pedido de host_transfer de', fromId);
    // Assume imediatamente; persiste em banco antes para reduzir janela.
    _signal('host_transfer_ack', { new_host_id: _s.userId, old_host_id: fromId });
    _onHostElected(_s.userId);
  }

  function _onHostTransferAck(newHostId: any, oldHostId: any) {
    if (!newHostId) return;
    _log('host transfer ack:', oldHostId, '→', newHostId);
    _onHostElected(newHostId);
  }

  // ── HEARTBEAT ─────────────────────────────────────────────────

  function _startHostHeartbeat() {
    _stopHostHeartbeat();
    _s.heartbeatTimer = setInterval(() => {
      if (_s.mode !== 'supabase') {
        // P2P disponível: envia heartbeat pelo DataChannel confiável
        _broadcast('avt_host_heartbeat', { host_id: _s.userId }, { reliable: true });
      } else {
        // Fallback Supabase: usa canal de sinalização (comportamento anterior)
        _signal('host_heartbeat', { host_id: _s.userId });
      }
    }, HOST_HB_INTERVAL);
  }

  function _stopHostHeartbeat() {
    if (_s.heartbeatTimer) { clearInterval(_s.heartbeatTimer); _s.heartbeatTimer = null; }
  }

  function _resetHostWatch() {
    if (_s._hostDeadTimer) { clearTimeout(_s._hostDeadTimer); _s._hostDeadTimer = null; }
    if (_s._isHost) return;
    _s._hostDeadTimer = setTimeout(_onHostDead, HOST_DEAD_THRESH);
  }

  function _onHostDead() {
    _warn('host morto detectado — pausando aventura');
    _s.paused = true;
    _s.hostId = null;
    _stopStateTick();
    _updateHostIndicator();
    const banner = document.getElementById('avt-host-dead-banner');
    if (banner) banner.style!.display = 'flex';
    try { window.dispatchEvent(new CustomEvent('rtnet:hostlost')); } catch(_) {}
  }

  // ── PING/PONG (medição de RTT ao host) ─────────────────────────

  function _startPingTimer() {
    _stopPingTimer();
    _s._pingTimer = setInterval(() => {
      if (!_s.initialized) return;
      if (_s._isHost) { _s._stats.rtt = 0; return; }
      if (!_s.hostId) { _s._stats.rtt = -1; return; }
      const payload = { from: _s.userId, t: performance.now() };
      const ch = _s.fastChannels.get(_s.hostId);
      if (ch && ch.readyState === 'open') {
        try { ch.send(JSON.stringify({ tipo: 'avt_ping', payload })); _s._stats.out++; return; } catch(_) {}
      }
      // Fallback Supabase: mede o round-trip via WS (host ecoa pelo mesmo caminho)
      if (typeof realtimeBroadcast === 'function') {
        try { realtimeBroadcast('avt_ping', payload); _s._stats.out++; } catch(_) {}
      }
    }, PING_INTERVAL);
  }

  function _stopPingTimer() {
    if (_s._pingTimer) { clearInterval(_s._pingTimer); _s._pingTimer = null; }
    _s._stats.rtt = -1;
  }

  function _onPing(payload: any) {
    // Só o host responde (via Supabase o ping chega a todos os peers)
    if (!_s._isHost || !payload || !payload.from || payload.from === _s.userId) return;
    const pong = { to: payload.from, t: payload.t };
    const ch = _s.fastChannels.get(payload.from);
    if (ch && ch.readyState === 'open') {
      try { ch.send(JSON.stringify({ tipo: 'avt_pong', payload: pong })); _s._stats.out++; return; } catch(_) {}
    }
    if (typeof realtimeBroadcast === 'function') {
      try { realtimeBroadcast('avt_pong', pong); _s._stats.out++; } catch(_) {}
    }
  }

  function _onPong(payload: any) {
    if (!payload || payload.to !== _s.userId || typeof payload.t !== 'number') return;
    _s._stats.rtt = Math.max(0, Math.round(performance.now() - payload.t));
    // Cadência natural do ping (2s) já limita a frequência deste repaint.
    try { _updateTransportIndicator(); } catch (_) {}
  }

  // ── TICK AUTORITATIVO (host → todos, STATE_TICK_INTERVAL = 100ms) ──────────

  function _startStateTick() {
    _stopStateTick();
    // O timer roda em TODOS os peers; a autoridade é decidida por _avtBuildStateTick,
    // que só produz tick quando este cliente é o host da SUA fase atual (host por fase).
    // Assim um guest que vira host de outra fase também emite o tick daquela fase.
    _s.stateTickTimer = setInterval(() => {
      try {
        if (typeof window._avtBuildStateTick === 'function') {
          const tick = window._avtBuildStateTick();
          if (tick) _broadcast('avt_state_tick', tick);
        }
      } catch(e) { _warn('stateTick:', e); }
    }, STATE_TICK_INTERVAL);
  }

  function _stopStateTick() {
    if (_s.stateTickTimer) { clearInterval(_s.stateTickTimer); _s.stateTickTimer = null; }
  }

  // ── SNAPSHOT ────────────────────────────────────────────────────

  function _startSnapshotTimer() {
    if (_s.snapshotTimer) clearInterval(_s.snapshotTimer);
    // Host novo escreve já: após transferência/eleição a linha do banco pode estar
    // com o updated_at do host anterior, e quem entra usa essa idade como frescor.
    _lastSnapshotJson = null; _lastSnapshotTs = 0;
    _s.snapshotTimer = setInterval(_saveSnapshot, SNAPSHOT_INTERVAL);
    _saveSnapshot();
  }

  let _lastSnapshotJson: any = null;
  let _lastSnapshotTs   = 0;
  async function _saveSnapshot() {
    if (!_s._isHost || !_s.snapshotProvider) return;
    // sessionStateUpdate roteia rpgIds não-UUID para avt_session_state
    // (migration_avt_session_state.sql); erro (ex.: migração não aplicada) é tolerado.
    try {
      const snapshot = _s.snapshotProvider();
      let json = null;
      try { json = JSON.stringify(snapshot); } catch(_) {}
      // Estado idêntico ao da última escrita (lobby/exploração em idle): pula o
      // write de dezenas de KB no banco. Nunca pula dois ticks seguidos: o
      // updated_at da linha também é o sinal de frescor do host para quem entra
      // (_checkExistingHost/DB_HOST_FRESH_MS) e para a cláusula de takeover (30s)
      // do RPC update_session_snapshot.
      if (json !== null && json === _lastSnapshotJson && (Date.now() - _lastSnapshotTs) < SNAPSHOT_SKIP_MAX_MS) return;
      await sessionStateUpdate(_s.rpgId, snapshot);
      _lastSnapshotJson = json;
      _lastSnapshotTs   = Date.now();
    } catch(e) { _warn('saveSnapshot:', e); }
  }

  async function _pushSnapshotTo(peerId: any) {
    if (!_s.snapshotProvider) return;
    try {
      const snapshot = _s.snapshotProvider();
      _signal('snapshot_response', { target_id: peerId, snapshot });
    } catch(e) { _warn('pushSnapshot:', e); }
  }

  function _applySnapshot(snapshot: any) {
    if (!snapshot) return;
    _log('aplicando snapshot do host');
    try {
      if (typeof AVT_STATE === 'undefined' || !AVT_STATE) return;
      // Isolamento por fase: não aplicar snapshot de fase diferente da minha.
      const _minhaFase = (AVT_STATE as any)._faseAtualId || 'principal';
      if (snapshot.faseId != null && snapshot.faseId !== _minhaFase) return;
      // Merge não-destrutivo (preserva posição do MEU personagem) quando disponível
      if (typeof window !== 'undefined' && typeof window.avtAplicarSnapshotMerge === 'function') {
        try { window.avtAplicarSnapshotMerge(snapshot); return; } catch(e) { _warn('avtAplicarSnapshotMerge falhou, fallback:', e); }
      }
      if (snapshot.entidades)          AVT_STATE.entidades          = snapshot.entidades;
      if (snapshot.batalhas)           AVT_STATE.batalhas           = snapshot.batalhas;
      if (Array.isArray(snapshot.globalLog)) AVT_STATE.globalLog   = snapshot.globalLog;
      if (snapshot.npcTimers)          AVT_STATE.npcTimers          = snapshot.npcTimers;
      if (snapshot._fleeTracker)       AVT_STATE._fleeTracker       = snapshot._fleeTracker;
      if (snapshot._oocCooldowns)      AVT_STATE._oocCooldowns      = snapshot._oocCooldowns;
      if (snapshot._oocStatusEffects)  AVT_STATE._oocStatusEffects  = snapshot._oocStatusEffects;
      if (snapshot.batalhaAutoSuspensa !== undefined) AVT_STATE.batalhaAutoSuspensa = snapshot.batalhaAutoSuspensa;
      if (typeof _avtReconciliarEntidades === 'function') _avtReconciliarEntidades();
      if (typeof _avtRenderHpBar === 'function') _avtRenderHpBar();
    } catch(e) { _warn('applySnapshot:', e); }
  }

  // ── BROADCAST ───────────────────────────────────────────────────

  function _broadcast<K extends AvtEventName>(tipo: K, payload?: AvtPayloadMap[K], opts?: any) {
    const defaults = EVENT_OPTS[tipo] || { persist: 'never', reliable: true };
    const o = { ...defaults, ...opts };

    const frame = JSON.stringify({ tipo, payload });

    // [RELAY] Eventos one-shot originados por um jogador (skill anim, dano visual, etc.)
    // são roteados pelo host (star) em vez de depender do mesh cliente↔cliente, que pode
    // falhar sem TURN e fazer o evento chegar só ao host. O host faz o fan-out aos demais
    // peers ao receber (ver _bindChannel). Sem duplicação: o não-host envia só ao host.
    if (o.relay && !_s._isHost && _s.hostId && _s.mode !== 'supabase') {
      const chMap = o.reliable !== false ? _s.channels : _s.fastChannels;
      const hostCh = chMap.get(_s.hostId);
      if (hostCh && hostCh.readyState === 'open') {
        try { hostCh.send(frame); _s._stats.out++; return; } catch(_) {}
      }
      // Canal do host indisponível → fallback Supabase (alcança todos os assinantes).
      if (typeof realtimeBroadcast === 'function') {
        try { realtimeBroadcast(tipo, payload); _s._stats.out++; } catch(e) { _warn('relay fallback:', e); }
      }
      return;
    }

    let allP2P = false;

    if (_s.mode !== 'supabase') {
      const chMap = o.reliable !== false ? _s.channels : _s.fastChannels;
      let ok = chMap.size > 0;
      for (const ch of chMap.values()) {
        if (ch.readyState === 'open') { try { ch.send(frame); _s._stats.out++; } catch(e) { ok = false; } }
        else ok = false;
      }
      allP2P = ok;
    }

    if (!allP2P) {
      // "Solo" apenas quando não há nenhum peer conhecido — nem WebRTC nem Supabase signaling.
      // _s.peerJoinTs é preenchido em _onAnnounce assim que qualquer peer anuncia chegada,
      // antes mesmo do WebRTC abrir; _s.peers só tem conexões WebRTC abertas.
      const hasAnyPeer = (_s.peers.size > 0) || (_s.peerJoinTs.size > 0);
      if (!hasAnyPeer) {
        _dispatch(tipo, payload);
        return;
      }
      if (typeof realtimeBroadcast === 'function') {
        // Contabiliza também o caminho supabase — sem isso getStats().out fica 0
        // no fallback e mascara se o cliente está de fato emitindo.
        try { realtimeBroadcast(tipo, payload); _s._stats.out++; } catch(e) { _warn('fallback broadcast:', e); }
      }
    }
  }

  // Unicast direcionado (jogador → host)
  function _sendToHost(tipo: any, payload: any) {
    if (!_s.hostId) return;
    if (_s._isHost) { _dispatch(tipo, payload); return; }
    const ch = _s.channels.get(_s.hostId);
    if (ch && ch.readyState === 'open') {
      try { ch.send(JSON.stringify({ tipo, payload })); _s._stats.out++; return; } catch(_) {}
    }
    // Fallback: broadcast (host filtra)
    if (typeof realtimeBroadcast === 'function') {
      try { realtimeBroadcast(tipo, payload); _s._stats.out++; } catch(_) {}
    }
  }

  // ── INDICADORES UI ──────────────────────────────────────────────

  function _updateTransportIndicator() {
    const el = document.getElementById('avt-p2p-indicator');
    if (!el) return;
    const map: Record<string, any> = { p2p: ['🟢', 'P2P ativo'], mixed: ['🟡', 'P2P parcial'], supabase: ['🔴', 'Supabase (fallback)'] };
    const [icon, title] = map[_s.mode] || ['🔴', 'Supabase'];
    const degradado = _s.mode !== 'p2p' && _s.peerJoinTs.size > 0;
    // RTT ao host (ping de 2s) visível no header: "está travando" vira número.
    const rtt = _s._stats.rtt;
    const temRtt = !_s._isHost && Number.isFinite(rtt) && rtt > 0;
    const rttQual = !temRtt ? '' : rtt >= 250 ? 'conexão lenta' : rtt >= 100 ? 'conexão razoável' : 'conexão boa';
    el.textContent = icon + (temRtt ? ` ${rtt}ms` : '');
    const base = degradado
      ? title + ' — sem conexão direta com algum jogador (latência maior). Um servidor TURN resolve NAT restrito; veja docs/setup.md.'
      : title;
    el.title = base + (temRtt ? ` · RTT ao host ${rtt}ms (${rttQual})` : '');
    el.style!.display = 'inline';
  }

  function _updateHostIndicator() {
    const el = document.getElementById('avt-host-indicator');
    if (el) {
      if (_s._isHost) {
        el.textContent = '⚡ Host';
        el.style!.color = '#c8a84b';
        el.style!.cursor = 'pointer';
        el.title = 'Clique para transferir o host';
      } else if (_s.hostId) {
        el.textContent = '◉ Online';
        el.style!.color = '#4fa3d1';
        el.style!.cursor = 'default';
        el.title = 'Host: ' + _s.hostId.slice(0, 8) + '…';
      } else {
        el.textContent = '◯';
        el.style!.color = '#7a92aa';
        el.style!.cursor = 'default';
        el.title = 'Sem host eleito';
      }
      el.style!.display = 'inline-block';
    }
    // Re-render topbar button if presente
    try { if (typeof window._avtRenderTopbar === 'function') window._avtRenderTopbar(); } catch(_) {}
  }

  // ── RECONNECT HOOK (chamado por realtime.js) ────────────────────

  function _onSignalingReconnect() {
    if (!_s.initialized) return;
    _log('signaling reconectado — re-anunciando');
    _signal('peer_announce', { isHostCandidate: !_s.hostId, userId: _s.userId, joinTs: _s.joinedAt });
    if (_s._isHost) {
      _signal('host_elected', { host_id: _s.userId });
    } else if (_s.hostId) {
      // Solicita snapshot imediato para ressincronizar após reconexão
      setTimeout(() => {
        if (_s.initialized && !_s._isHost && _s.hostId) {
          _signal('snapshot_request', { target_id: _s.hostId });
        }
      }, 500);
    }
  }

  // ── API PÚBLICA ─────────────────────────────────────────────────

  return {
    get initialized() { return _s.initialized; },
    get mode()        { return _s.mode; },
    get hostId()      { return _s.hostId; },

    async init({ rpgId, userId, isAventura = true }: any) {
      if (_s.initialized) this.shutdown();
      _s.rpgId       = rpgId;
      _s.userId      = userId;
      _s.initialized = true;
      _s.joinedAt    = Date.now();
      _s.paused      = false;
      _s.hostId      = null;
      _s._isHost     = false;
      _s.mode        = 'supabase';
      _s.lastHostHb  = 0;
      _s._candidates.clear();
      _s.peerJoinTs.clear();
      _s._volunteers = [];
      if (_s._volunteerTimer) { clearTimeout(_s._volunteerTimer); _s._volunteerTimer = null; }
      _fallbackAvisado = false;
      if (_fallbackAvisoTimer) { clearTimeout(_fallbackAvisoTimer); _fallbackAvisoTimer = null; }
      _log('init rpgId:', rpgId, 'userId:', userId, 'joinedAt:', _s.joinedAt);

      window.RTNet._signalingActive = true;
      _updateHostIndicator();
      _updateTransportIndicator();

      const hasHost = await _checkExistingHost();

      if (hasHost) {
        // Anuncia chegada sem candidatar-se (host já existe e está fresco).
        _signal('peer_announce', { isHostCandidate: false, userId, joinTs: _s.joinedAt });
        setTimeout(() => this.requisitarSnapshot(), 1000);
      } else {
        // Sem host fresco → eu sou o primeiro a entrar (ou ninguém aguenta o lease).
        _startElection();
      }

      // Timer de ressincronização periódica para não-host. Jitter por cliente (±2.5s)
      // para evitar que todos os players peçam o snapshot ao host no mesmo instante
      // (pico de carga a cada 10s com 6 jogadores).
      if (_s.periodicSyncTimer) clearInterval(_s.periodicSyncTimer);
      const _periodMs = PERIODIC_SYNC_INTERVAL + Math.round((Math.random() * 2 - 1) * 2500);
      _s.periodicSyncTimer = setInterval(() => {
        if (_s.initialized && !_s._isHost && _s.hostId) {
          _log('sync periódico — solicitando snapshot do host');
          _signal('snapshot_request', { target_id: _s.hostId });
        }
      }, _periodMs);

      _s._stats = { in: 0, out: 0, rtt: -1 };
      _startPingTimer();
    },

    shutdown() {
      _log('shutdown');
      // Se sou host, tenta transferir gracefully para o peer mais antigo.
      try {
        if (_s._isHost) {
          let best = null, bestTs = Infinity;
          for (const [pid, ts] of _s.peerJoinTs.entries()) {
            if (ts < bestTs) { bestTs = ts; best = pid; }
          }
          if (best) _signal('host_transfer_ack', { new_host_id: best, old_host_id: _s.userId });
        }
      } catch(_) {}

      _s.initialized = false;
      window.RTNet._signalingActive = false;

      [_s.snapshotTimer, _s.heartbeatTimer, _s.stateTickTimer, _s.periodicSyncTimer].forEach(t => { if (t) clearInterval(t); });
      [_s._hostDeadTimer, _s._candidateTimer, _s._soloHostTimer].forEach(t => { if (t) clearTimeout(t); });
      _s.snapshotTimer = _s.heartbeatTimer = _s.stateTickTimer = _s._hostDeadTimer = _s._candidateTimer = _s.periodicSyncTimer = null;
      _lastSnapshotJson = null; _lastSnapshotTs = 0;
      if (_fallbackAvisoTimer) { clearTimeout(_fallbackAvisoTimer); _fallbackAvisoTimer = null; }
      _stopPingTimer();

      for (const pc of _s.peers.values()) { try { pc.close(); } catch(_) {} }
      _s.peers.clear(); _s.channels.clear(); _s.fastChannels.clear();
      _s.handlers.clear();
      _s.snapshotProvider = null;
      _s.hostId = null; _s._isHost = false;
      _s.mode = 'supabase';
      _s.paused = false;
      _s._candidates.clear();
      _s.peerJoinTs.clear();
      _s._volunteers = [];
      _s._peerLeaveCallbacks = [];

      const banner = document.getElementById('avt-host-dead-banner');
      if (banner) banner.style!.display = 'none';
      const hi = document.getElementById('avt-host-indicator');
      if (hi) hi.style!.display = 'none';
      const pi = document.getElementById('avt-p2p-indicator');
      if (pi) pi.style!.display = 'none';
    },

    broadcast<K extends AvtEventName>(tipo: K, payload?: AvtPayloadMap[K], opts?: any) {
      if (!_s.initialized) {
        if (typeof realtimeBroadcast === 'function') realtimeBroadcast(tipo, payload);
        return;
      }
      _broadcast(tipo, payload, opts);
    },

    broadcastP2POnly(tipo: any, payload: any, opts: any) {
      if (!_s.initialized || _s.mode === 'supabase') return;
      const defaults = EVENT_OPTS[tipo] || { persist: 'never', reliable: true };
      const o = { ...defaults, ...opts };
      const frame = JSON.stringify({ tipo, payload });
      const chMap = o.reliable !== false ? _s.channels : _s.fastChannels;
      for (const ch of chMap.values()) {
        if (ch.readyState === 'open') { try { ch.send(frame); } catch(e) { _warn('broadcastP2POnly:', e); } }
      }
    },

    sendToHost(tipo: any, payload: any) {
      if (!_s.initialized) return;
      _sendToHost(tipo, payload);
    },

    on(tipo: any, handler: any) {
      if (!_s.handlers.has(tipo)) _s.handlers.set(tipo, new Set());
      _s.handlers.get(tipo)!.add!(handler)!;
    },

    off(tipo: any, handler: any) { _s.handlers.get(tipo)?.delete(handler); },

    isHost()    { return _s._isHost; },
    isPaused()  { return !!_s.paused; },
    getHostId() { return _s.hostId; },
    getTransport() { return _s.mode; },
    getUserId() { return _s.userId; },

    // Telemetria para o overlay AVT_PERF: mensagens P2P acumuladas, RTT ao host
    // e estado por peer (fallback = peer sem canal aberto → tráfego via Supabase).
    getStats() {
      const peers = [];
      for (const [pid] of _s.peers.entries()) {
        const ch = _s.channels.get(pid);
        peers.push({ userId: pid, open: !!(ch && ch.readyState === 'open') });
      }
      return { in: _s._stats.in, out: _s._stats.out, rtt: _s._stats.rtt, mode: _s.mode, peers };
    },

    // Handlers de ping/pong para o caminho de fallback Supabase (o caminho P2P
    // é interceptado em _dispatch antes do lookup global).
    _onPing(payload: any) { _onPing(payload); },
    _onPong(payload: any) { _onPong(payload); },

    listarPeers() {
      const out = [];
      for (const [pid] of _s.peers.entries()) {
        const ch = _s.channels.get(pid);
        out.push({
          userId: pid,
          joinTs: _s.peerJoinTs.get(pid) || 0,
          channelState: ch ? ch.readyState : 'none',
        });
      }
      // Inclui o próprio usuário
      out.unshift({ userId: _s.userId, joinTs: _s.joinedAt, channelState: 'self' });
      return out;
    },

    // Candidatura voluntária ao host (chamado pelo botão "Iniciar como Host" na sala de espera)
    volunteerAsHost() {
      if (!_s.initialized) return;
      if (_s.hostId) return; // já há host
      const v = { userId: _s.userId, ts: Date.now(), _from: _s.userId };
      _log('volunteerAsHost:', _s.userId);
      _signal('host_volunteer', v);
      // Processa localmente também (self-broadcast não chega de volta via Supabase)
      _s._volunteers.push(v);
      clearTimeout(_s._volunteerTimer);
      _s._volunteerTimer = setTimeout(_decideHostFromVolunteers, 200);
    },

    // Expõe mapa de joinTs dos peers para listagem na sala de espera
    _peerJoinTs() { return _s.peerJoinTs; },

    transferirHost(targetUserId: any) {
      if (!_s._isHost) { _warn('transferirHost: só o host pode transferir'); return false; }
      if (!targetUserId || targetUserId === _s.userId) return false;
      _log('transferindo host para', targetUserId);
      _signal('host_transfer_offer', { target_id: targetUserId });
      return true;
    },

    onHostChange(cb: any) {
      _s.hostCbs.push(cb);
      return () => { _s.hostCbs = _s.hostCbs.filter(c => c !== cb); };
    },

    onPeerLeave(fn: any) {
      _s._peerLeaveCallbacks.push(fn);
      return () => { _s._peerLeaveCallbacks = _s._peerLeaveCallbacks.filter(c => c !== fn); };
    },

    async assumirHost() {
      _log('assumindo host manualmente');
      try {
        if (typeof sessionStateGet === 'function') {
          const rows = await sessionStateGet(_s.rpgId);
          if (rows && rows[0]) _applySnapshot(rows[0].snapshot);
        }
      } catch(e) { _warn('reidratação ao assumir host:', e); }
      _s.paused = false;
      _electSelf();
      const banner = document.getElementById('avt-host-dead-banner');
      if (banner) banner.style!.display = 'none';
    },

    registrarSnapshotProvider(fn: any) { _s.snapshotProvider = fn; },

    async requisitarSnapshot() {
      if (!_s.hostId || _s._isHost) return;
      _log('requisitando snapshot do host:', _s.hostId);
      _signal('snapshot_request', { target_id: _s.hostId });
    },

    async persistirImediato(rpcName: any, args: any) {
      if (!_s._isHost) return;
      try { if (typeof sbRpc === 'function') await sbRpc(rpcName, args); } catch(e) { _warn('persistirImediato:', rpcName, e); }
    },

    _handleSignaling(tipo: any, payload: any) { _handleSignaling(tipo, payload); },
    _onSignalingReconnect() { _onSignalingReconnect(); },
    _signalingActive: false,
  };

})();

/* [migração-esm] accessors globais */
