// core/rtnet.js
// RTNet — Camada de transporte P2P para Modo Aventura
// WebRTC DataChannel mesh (≤6 jogadores) + sinalização Supabase + fallback gracioso
// API pública: RTNet.init / shutdown / broadcast / on / off / isHost / getHostId /
//              onHostChange / assumirHost / registrarSnapshotProvider /
//              requisitarSnapshot / persistirImediato

window.RTNet = (() => {

  // ── ESTADO INTERNO ─────────────────────────────────────────────
  const _s = {
    rpgId:    null,
    userId:   null,
    initialized: false,

    // WebRTC
    peers:       new Map(), // peerId → RTCPeerConnection
    channels:    new Map(), // peerId → RTCDataChannel (reliable)
    fastChannels:new Map(), // peerId → RTCDataChannel (unreliable)
    connectingTo:new Set(),

    // Host
    hostId:      null,
    _isHost:     false,
    hostCbs:     [],
    lastHostHb:  0,

    // Timers
    snapshotTimer:    null,
    heartbeatTimer:   null,
    _hostDeadTimer:   null,
    _candidateTimer:  null,

    // Event handlers
    handlers: new Map(),

    // Snapshot
    snapshotProvider: null,

    // Transport
    mode: 'supabase', // 'p2p' | 'mixed' | 'supabase'

    // Election candidates collected during window
    _candidates: new Map(), // userId → timestamp
  };

  const STUN_SERVERS      = [{ urls: 'stun:stun.l.google.com:19302' }];
  const HOST_HB_INTERVAL  = 5_000;   // ms — host heartbeat via signaling
  const HOST_DEAD_THRESH  = 30_000;  // ms — threshold para considerar host morto
  const SNAPSHOT_INTERVAL = 15_000;  // ms — snapshot periódico (camada B)
  const ELECTION_WAIT     = 400;     // ms — janela de coleta de candidatos

  // Mapa: tipo de evento → nome da função global handler (mesmo que realtime.js)
  const AVT_HANDLER_MAP = {
    avt_token_move:        'avtReceberMovimento',
    avt_combate_inicio:    'avtReceberCombateInicio',
    avt_batalha_update:    'avtReceberBatalhaUpdate',
    avt_combate_fim:       'avtReceberFimBatalha',
    avt_combate_join:      'avtReceberJoinBatalha',
    avt_npc_morreu:        'avtReceberNpcMorreu',
    avt_npc_perseguindo:   'avtReceberNpcPerseguindo',
    avt_npc_respawn:       'avtReceberNpcRespawn',
    avt_convite_combate:   'avtReceberConviteCombate',
    avt_xp_ganho:          'avtReceberXpGanho',
    avt_level_up:          'avtReceberLevelUp',
    avt_jogador_morreu:    'avtReceberJogadorMorreu',
    avt_jogador_ressurgiu: 'avtReceberJogadorRessurgiu',
    avt_skill_selecionada: 'avtReceberSkillSelecionada',
    avt_dado_rolado:       'avtReceberDadoRolado',
    avt_dano_visual:       'avtReceberDanoVisual',
    avt_hp_update:         'avtReceberHpUpdate',
    avt_member_linked:     'avtReceberMemberLinked',
    avt_primeiro_ataque:   'avtReceberPrimeiroAtaque',
  };

  // opts padrão por tipo de evento (camada A/B/C conforme plano §5)
  const EVENT_OPTS = {
    avt_token_move:        { persist: 'never',     reliable: false },
    avt_host_heartbeat:    { persist: 'never',     reliable: false },
    avt_combate_inicio:    { persist: 'immediate', reliable: true  },
    avt_batalha_update:    { persist: 'snapshot',  reliable: true  },
    avt_combate_fim:       { persist: 'immediate', reliable: true  },
    avt_combate_join:      { persist: 'snapshot',  reliable: true  },
    avt_npc_morreu:        { persist: 'immediate', reliable: true  },
    avt_npc_perseguindo:   { persist: 'never',     reliable: false },
    avt_npc_respawn:       { persist: 'immediate', reliable: true  },
    avt_convite_combate:   { persist: 'never',     reliable: false },
    avt_xp_ganho:          { persist: 'immediate', reliable: true  },
    avt_level_up:          { persist: 'immediate', reliable: true  },
    avt_jogador_morreu:    { persist: 'immediate', reliable: true  },
    avt_jogador_ressurgiu: { persist: 'immediate', reliable: true  },
    avt_skill_selecionada: { persist: 'never',     reliable: false },
    avt_dado_rolado:       { persist: 'never',     reliable: false },
    avt_dano_visual:       { persist: 'never',     reliable: false },
    avt_hp_update:         { persist: 'snapshot',  reliable: true  },
    avt_member_linked:     { persist: 'immediate', reliable: true  },
    avt_primeiro_ataque:   { persist: 'never',     reliable: false },
    avt_bau_aberto:        { persist: 'immediate', reliable: true  },
  };

  function _log(...a)  { try { console.log('[RTNet]',  ...a); } catch(_) {} }
  function _warn(...a) { try { console.warn('[RTNet]', ...a); } catch(_) {} }

  function _webRTCOk() { return typeof RTCPeerConnection !== 'undefined'; }

  // ── DISPATCH ────────────────────────────────────────────────────

  function _dispatch(tipo, payload) {
    // Handlers registrados via RTNet.on
    const hs = _s.handlers.get(tipo);
    if (hs) hs.forEach(h => { try { h(payload); } catch(e) { _warn('handler falhou:', tipo, e); } });

    // Handler global (retrocompat com realtime.js dispatcher)
    const fnName = AVT_HANDLER_MAP[tipo];
    if (fnName) {
      const fn = window[fnName];
      if (typeof fn === 'function') { try { fn(payload); } catch(e) { _warn('global handler:', fnName, e); } }
      else {
        // Enfileira igual ao realtime.js para quando handler ainda não carregou
        try {
          window.__avtPendingBroadcasts = window.__avtPendingBroadcasts || [];
          if (window.__avtPendingBroadcasts.length < 200) {
            window.__avtPendingBroadcasts.push({ ev: tipo, pl: payload, at: Date.now() });
          }
        } catch(_) {}
      }
    } else if (tipo === 'avt_bau_aberto') {
      try { if (typeof mostrarToast === 'function') mostrarToast((payload?.jogadorNome || 'Alguém') + ' abriu um baú!', 'ok'); } catch(_) {}
    }
  }

  // ── SINALIZAÇÃO (via Supabase Realtime existente) ───────────────

  function _signal(tipo, payload) {
    if (typeof realtimeBroadcast !== 'function') return;
    try { realtimeBroadcast('rtnet_' + tipo, { ...payload, _from: _s.userId }); } catch(e) { _warn('signal falhou:', tipo, e); }
  }

  // Chamado por realtime.js quando recebe evento rtnet_*
  function _handleSignaling(tipo, payload) {
    if (!_s.initialized) return;
    if (!payload) return;
    const from = payload._from;
    if (from === _s.userId) return; // ignorar self

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
    }
  }

  // ── WEBRTC ──────────────────────────────────────────────────────

  async function _connectTo(peerId) {
    if (_s.peers.has(peerId) || _s.connectingTo.has(peerId)) return;
    _s.connectingTo.add(peerId);
    _log('iniciando conexão WebRTC com', peerId);

    try {
      const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
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

  async function _onOffer(fromId, payload) {
    if (_s.peers.has(fromId)) return;
    _log('recebendo offer de', fromId);

    const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
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

  async function _onAnswer(fromId, payload) {
    const pc = _s.peers.get(fromId);
    if (!pc) return;
    try { await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp)); } catch(e) { _warn('setRemote:', e); }
  }

  async function _onIce(fromId, payload) {
    const pc = _s.peers.get(fromId);
    if (!pc) return;
    try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch(e) { _warn('addIce:', e); }
  }

  function _bindChannel(ch, peerId, kind) {
    ch.onopen  = () => { _log(`DataChannel ${kind} aberto com`, peerId); _updateMode(); };
    ch.onclose = () => { _cleanPeer(peerId); };
    ch.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        if (msg && msg.tipo) _dispatch(msg.tipo, msg.payload);
      } catch(err) { _warn('DataChannel parse:', err); }
    };
  }

  function _cleanPeer(peerId) {
    const pc = _s.peers.get(peerId);
    if (pc) { try { pc.close(); } catch(_) {} _s.peers.delete(peerId); }
    _s.channels.delete(peerId);
    _s.fastChannels.delete(peerId);
    _updateMode();
  }

  function _updateMode() {
    const openRel = [..._s.channels.values()].filter(ch => ch.readyState === 'open').length;
    const total   = _s.peers.size;
    _s.mode = total === 0 ? 'supabase' : openRel === total ? 'p2p' : 'mixed';
    _updateTransportIndicator();
  }

  // ── ELEIÇÃO DE HOST ─────────────────────────────────────────────

  async function _checkExistingHost() {
    try {
      if (typeof sessionStateGet !== 'function') return false;
      const rows = await sessionStateGet(_s.rpgId);
      if (!rows || !rows[0]) return false;
      const row = rows[0];
      const age = Date.now() - new Date(row.updated_at).getTime();
      if (age < HOST_DEAD_THRESH) {
        _log('host existente:', row.host_user_id, `(${Math.round(age/1000)}s atrás)`);
        _onHostElected(row.host_user_id);
        return true;
      }
    } catch(e) { _warn('checkExistingHost:', e); }
    return false;
  }

  function _startElection() {
    _s._candidates.clear();
    _s._candidates.set(_s.userId, Date.now());
    _signal('peer_announce', { isHostCandidate: true, userId: _s.userId });
    if (_s._candidateTimer) clearTimeout(_s._candidateTimer);
    _s._candidateTimer = setTimeout(_decideHost, ELECTION_WAIT);
  }

  function _onAnnounce(fromId, payload) {
    if (payload.isHostCandidate) {
      _s._candidates.set(fromId, Date.now());
      // Reiniciar janela de eleição para absorver o novo candidato
      if (_s._candidateTimer) {
        clearTimeout(_s._candidateTimer);
        _s._candidateTimer = setTimeout(_decideHost, 200);
      }
    }
    // WebRTC: iniciador é o de menor userId (evita colisão de offers)
    if (_webRTCOk() && !_s.peers.has(fromId) && !_s.connectingTo.has(fromId)) {
      if (_s.userId < fromId) _connectTo(fromId).catch(e => _warn('WebRTC:', e));
    }
  }

  function _decideHost() {
    _s._candidateTimer = null;
    if (_s.hostId) return; // já eleito por outro meio
    // Menor userId vence (determinístico)
    let winner = _s.userId;
    for (const uid of _s._candidates.keys()) { if (uid < winner) winner = uid; }

    if (winner === _s.userId) {
      _electSelf();
    } else {
      // Aguardar anúncio do vencedor; fallback se não vier
      setTimeout(() => { if (!_s.hostId) { _warn('host não anunciado, assumindo'); _electSelf(); } }, 2000);
    }
  }

  function _electSelf() {
    _log('eleito como host:', _s.userId);
    _signal('host_elected', { host_id: _s.userId });
    _onHostElected(_s.userId);
    _startSnapshotTimer();
  }

  function _onHostElected(hostId) {
    if (_s.hostId === hostId) return;
    _log('host eleito:', hostId);
    _s.hostId  = hostId;
    _s._isHost = (hostId === _s.userId);
    _s.lastHostHb = Date.now();
    _s.hostCbs.forEach(cb => { try { cb(hostId); } catch(_) {} });
    _updateHostIndicator();
    _resetHostWatch();
    if (_s._isHost) _startHostHeartbeat(); else _stopHostHeartbeat();
  }

  // ── HEARTBEAT ─────────────────────────────────────────────────

  function _startHostHeartbeat() {
    _stopHostHeartbeat();
    _s.heartbeatTimer = setInterval(async () => {
      _signal('host_heartbeat', { host_id: _s.userId });
      // Também toca updated_at no Supabase para detecção de queda por novos entrantes
      try {
        if (typeof sessionStateUpdate === 'function' && _s.snapshotProvider) {
          await sessionStateUpdate(_s.rpgId, _s.snapshotProvider()).catch(() => {});
        }
      } catch(_) {}
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
    _warn('host morto detectado');
    const banner = document.getElementById('avt-host-dead-banner');
    if (banner) banner.style.display = 'flex';
  }

  // ── SNAPSHOT ────────────────────────────────────────────────────

  function _startSnapshotTimer() {
    if (_s.snapshotTimer) clearInterval(_s.snapshotTimer);
    _s.snapshotTimer = setInterval(_saveSnapshot, SNAPSHOT_INTERVAL);
  }

  async function _saveSnapshot() {
    if (!_s._isHost || !_s.snapshotProvider) return;
    try { await sessionStateUpdate(_s.rpgId, _s.snapshotProvider()); } catch(e) { _warn('saveSnapshot:', e); }
  }

  async function _pushSnapshotTo(peerId) {
    if (!_s.snapshotProvider) return;
    try {
      const snapshot = _s.snapshotProvider();
      _signal('snapshot_response', { target_id: peerId, snapshot });
    } catch(e) { _warn('pushSnapshot:', e); }
  }

  function _applySnapshot(snapshot) {
    if (!snapshot) return;
    _log('aplicando snapshot do host');
    try {
      if (typeof AVT_STATE === 'undefined' || !AVT_STATE) return;
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

  function _broadcast(tipo, payload, opts) {
    const defaults = EVENT_OPTS[tipo] || { persist: 'never', reliable: true };
    const o = { ...defaults, ...opts };

    const frame = JSON.stringify({ tipo, payload });
    let allP2P = false;

    if (_s.mode !== 'supabase') {
      const chMap = o.reliable !== false ? _s.channels : _s.fastChannels;
      let ok = chMap.size > 0;
      for (const ch of chMap.values()) {
        if (ch.readyState === 'open') { try { ch.send(frame); } catch(e) { ok = false; } }
        else ok = false;
      }
      allP2P = ok;
    }

    if (!allP2P) {
      if (typeof realtimeBroadcast === 'function') {
        try { realtimeBroadcast(tipo, payload); } catch(e) { _warn('fallback broadcast:', e); }
      }
    }
  }

  // ── INDICADORES UI ──────────────────────────────────────────────

  function _updateTransportIndicator() {
    const el = document.getElementById('avt-p2p-indicator');
    if (!el) return;
    const map = { p2p: ['🟢', 'P2P ativo'], mixed: ['🟡', 'P2P parcial'], supabase: ['🔴', 'Supabase (fallback)'] };
    const [icon, title] = map[_s.mode] || ['🔴', 'Supabase'];
    el.textContent = icon; el.title = title;
    el.style.display = 'inline';
  }

  function _updateHostIndicator() {
    const el = document.getElementById('avt-host-indicator');
    if (!el) return;
    if (_s._isHost) {
      el.textContent = '⚡ Host';
      el.style.color = '#c8a84b';
      el.title = 'Você é o host desta sessão';
    } else if (_s.hostId) {
      el.textContent = '◉ Online';
      el.style.color = '#4fa3d1';
      el.title = 'Host: ' + _s.hostId.slice(0, 8) + '…';
    } else {
      el.textContent = '◯';
      el.style.color = '#7a92aa';
      el.title = 'Sem host eleito';
    }
    el.style.display = 'inline-block';
  }

  // ── API PÚBLICA ─────────────────────────────────────────────────

  return {
    get initialized() { return _s.initialized; },
    get mode()        { return _s.mode; },

    async init({ rpgId, userId, isAventura = true }) {
      if (_s.initialized) this.shutdown();
      _s.rpgId       = rpgId;
      _s.userId      = userId;
      _s.initialized = true;
      _s.hostId      = null;
      _s._isHost     = false;
      _s.mode        = 'supabase';
      _s.lastHostHb  = 0;
      _s._candidates.clear();
      _log('init rpgId:', rpgId, 'userId:', userId);

      // Marcar signaling como ativo (realtime.js usa isso para rotear)
      window.RTNet._signalingActive = true;
      _updateHostIndicator();
      _updateTransportIndicator();

      // Verificar se já existe um host ativo no Supabase
      const hasHost = await _checkExistingHost();

      if (hasHost) {
        // Anunciar chegada sem candidatura a host
        _signal('peer_announce', { isHostCandidate: false, userId });
        // Pedir snapshot ao host após ligação WebRTC
        setTimeout(() => this.requisitarSnapshot(), 1000);
      } else {
        // Nenhum host — iniciar eleição
        _startElection();
      }
    },

    shutdown() {
      _log('shutdown');
      _s.initialized = false;
      window.RTNet._signalingActive = false;

      [_s.snapshotTimer, _s.heartbeatTimer].forEach(t => { if (t) clearInterval(t); });
      [_s._hostDeadTimer, _s._candidateTimer].forEach(t => { if (t) clearTimeout(t); });
      _s.snapshotTimer = _s.heartbeatTimer = _s._hostDeadTimer = _s._candidateTimer = null;

      for (const pc of _s.peers.values()) { try { pc.close(); } catch(_) {} }
      _s.peers.clear(); _s.channels.clear(); _s.fastChannels.clear();
      _s.handlers.clear();
      _s.snapshotProvider = null;
      _s.hostId = null; _s._isHost = false;
      _s.mode = 'supabase';
      _s._candidates.clear();

      const banner = document.getElementById('avt-host-dead-banner');
      if (banner) banner.style.display = 'none';
      const hi = document.getElementById('avt-host-indicator');
      if (hi) hi.style.display = 'none';
      const pi = document.getElementById('avt-p2p-indicator');
      if (pi) pi.style.display = 'none';
    },

    broadcast(tipo, payload, opts) {
      if (!_s.initialized) {
        if (typeof realtimeBroadcast === 'function') realtimeBroadcast(tipo, payload);
        return;
      }
      _broadcast(tipo, payload, opts);
    },

    on(tipo, handler) {
      if (!_s.handlers.has(tipo)) _s.handlers.set(tipo, new Set());
      _s.handlers.get(tipo).add(handler);
    },

    off(tipo, handler) { _s.handlers.get(tipo)?.delete(handler); },

    isHost()    { return _s._isHost; },
    getHostId() { return _s.hostId; },

    onHostChange(cb) {
      _s.hostCbs.push(cb);
      return () => { _s.hostCbs = _s.hostCbs.filter(c => c !== cb); };
    },

    async assumirHost() {
      _log('assumindo host manualmente');
      // Reidratar a partir do snapshot Supabase antes de assumir
      try {
        if (typeof sessionStateGet === 'function') {
          const rows = await sessionStateGet(_s.rpgId);
          if (rows && rows[0]) _applySnapshot(rows[0].snapshot);
        }
      } catch(e) { _warn('reidratação ao assumir host:', e); }
      _electSelf();
      const banner = document.getElementById('avt-host-dead-banner');
      if (banner) banner.style.display = 'none';
    },

    registrarSnapshotProvider(fn) { _s.snapshotProvider = fn; },

    async requisitarSnapshot() {
      if (!_s.hostId || _s._isHost) return;
      _log('requisitando snapshot do host:', _s.hostId);
      _signal('snapshot_request', { target_id: _s.hostId });
    },

    async persistirImediato(rpcName, args) {
      if (!_s._isHost) return;
      try { if (typeof sbRpc === 'function') await sbRpc(rpcName, args); } catch(e) { _warn('persistirImediato:', rpcName, e); }
    },

    // Chamado por realtime.js ao receber eventos rtnet_* do Supabase
    _handleSignaling(tipo, payload) { _handleSignaling(tipo, payload); },
    _signalingActive: false,
  };

})();
