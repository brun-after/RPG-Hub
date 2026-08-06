// js/systems/avt-perf.js
// RPG Hub — Medição de desempenho do Modo Aventura (FPS, frame time, rede).
// Overlay leve atualizado a 2 Hz; custo por frame ~zero quando desativado.
// Ativação: ?perf=1 na URL, AVT_GRAFICOS.perfOverlay=true ou avtPerfToggle().

var AVT_PERF = (() => {
  const RING = 240; // ~4s de frames a 60fps
  const _ft = new Float32Array(RING);
  let _idx = 0, _count = 0;
  let _enabled = null;       // null = ainda não avaliado
  let _uiTimer = null;
  let _el = null;
  // Amostras anteriores dos contadores acumulados, para taxa por segundo
  let _prev = { p2pIn: 0, p2pOut: 0, wsIn: 0, wsOut: 0, ts: 0 };

  function _checkEnabled() {
    try {
      if (/[?&]perf=1/.test(location.search)) return true;
      if (typeof AVT_GRAFICOS !== 'undefined' && AVT_GRAFICOS && AVT_GRAFICOS.perfOverlay) return true;
    } catch (_) {}
    return false;
  }

  function _ensureOverlay() {
    if (_el && document.body.contains(_el)) return _el;
    _el = document.createElement('div');
    _el.id = 'avt-perf-overlay';
    _el.style.cssText =
      'position:fixed;top:6px;left:6px;z-index:99999;pointer-events:none;' +
      'background:rgba(10,14,20,.82);color:#9fdcae;border:1px solid #2c4436;' +
      'border-radius:6px;padding:6px 9px;font:11px/1.5 monospace;white-space:pre;' +
      'max-width:46vw;';
    document.body.appendChild(_el);
    return _el;
  }

  function _fpsStats() {
    const n = Math.min(_count, RING);
    if (!n) return { fps: 0, p95: 0, avg: 0 };
    let sum = 0;
    const arr = [];
    for (let i = 0; i < n; i++) { sum += _ft[i]; arr.push(_ft[i]); }
    arr.sort((a, b) => a - b);
    const avg = sum / n;
    const p95 = arr[Math.min(n - 1, Math.floor(n * 0.95))];
    return { fps: avg > 0 ? 1000 / avg : 0, p95, avg };
  }

  function _tickUI() {
    if (!_enabled) return;
    const el = _ensureOverlay();
    const { fps, p95, avg } = _fpsStats();

    let ents = 0, fase = '';
    try {
      ents = (typeof AVT_STATE !== 'undefined' && AVT_STATE && AVT_STATE.entidades) ? AVT_STATE.entidades.length : 0;
      fase = (typeof AVT_STATE !== 'undefined' && AVT_STATE && (AVT_STATE as any)._faseAtualId) || '';
    } catch (_) {}

    // Taxas de rede por segundo (diff dos acumulados)
    const now = performance.now();
    let p2p = { in: 0, out: 0, rtt: -1, mode: '—', peers: [] };
    try { if (typeof RTNet !== 'undefined' && RTNet.getStats) p2p = RTNet.getStats(); } catch (_) {}
    const ws = (globalThis.__rtWsStats || { in: 0, out: 0 });
    const dt = Math.max(0.001, (now - _prev.ts) / 1000);
    const rates = {
      p2pIn:  Math.round((p2p.in  - _prev.p2pIn)  / dt),
      p2pOut: Math.round((p2p.out - _prev.p2pOut) / dt),
      wsIn:   Math.round((ws.in   - _prev.wsIn)   / dt),
      wsOut:  Math.round((ws.out  - _prev.wsOut)  / dt),
    };
    _prev = { p2pIn: p2p.in, p2pOut: p2p.out, wsIn: ws.in, wsOut: ws.out, ts: now };

    const fallbackPeers = (p2p.peers || []).filter(p => !p.open).length;
    const rttTxt = p2p.rtt >= 0 ? p2p.rtt + 'ms' : '—';
    const linhas = [
      `FPS ${fps.toFixed(0)}  frame ${avg.toFixed(1)}ms  p95 ${p95.toFixed(1)}ms`,
      `entidades ${ents}${fase ? '  fase ' + fase : ''}`,
      `rede ${p2p.mode}  RTT ${rttTxt}`,
      `p2p ↓${rates.p2pIn}/s ↑${rates.p2pOut}/s   ws ↓${rates.wsIn}/s ↑${rates.wsOut}/s`,
    ];
    if (fallbackPeers > 0) linhas.push(`⚠ ${fallbackPeers} peer(s) em fallback WS`);
    el.textContent = linhas.join('\n');
  }

  function _start() {
    if (_uiTimer) return;
    _prev.ts = performance.now();
    _uiTimer = setInterval(_tickUI, 500);
    _tickUI();
  }

  function _stop() {
    if (_uiTimer) { clearInterval(_uiTimer); _uiTimer = null; }
    if (_el) { try { _el.remove(); } catch (_) {} _el = null; }
  }

  // ── Qualidade adaptativa ────────────────────────────────────────────────
  // Checa a cada 5s; exige FPS médio < 45 em DUAS checagens consecutivas com
  // frames fluindo (evita degradar por um único pico ou por aba em background).
  let _adaptTimer = null, _adaptStrikes = 0, _adaptLastCount = 0;
  function _adaptTick() {
    try {
      if (typeof AVT_GRAFICOS === 'undefined' || !AVT_GRAFICOS || AVT_GRAFICOS.adaptativo === false) return;
      if (typeof AVT_STATE === 'undefined' || !AVT_STATE || !AVT_STATE.canvas) { _adaptStrikes = 0; return; }
      const frames = _count - _adaptLastCount;
      _adaptLastCount = _count;
      if (frames < 30) { _adaptStrikes = 0; return; } // sem frames suficientes (menu/background)
      const { fps } = _fpsStats();
      if (fps > 0 && fps < 45) {
        _adaptStrikes++;
        if (_adaptStrikes >= 2) {
          _adaptStrikes = 0;
          if (typeof _avtGraficosDegradar === 'function') _avtGraficosDegradar();
        }
      } else {
        _adaptStrikes = 0;
      }
    } catch (_) {}
  }

  return {
    // Chamado 1x por frame pelo render loop da aventura, com dt em ms.
    // A gravação roda sempre (custo ~zero) para alimentar a qualidade adaptativa;
    // só o overlay é gated por _enabled.
    frame(dtMs) {
      if (typeof dtMs === 'number' && dtMs > 0 && dtMs < 10000) {
        _ft[_idx] = dtMs;
        _idx = (_idx + 1) % RING;
        _count++;
      }
      if (!_adaptTimer) _adaptTimer = setInterval(_adaptTick, 5000);
      if (_enabled === null) { _enabled = _checkEnabled(); if (_enabled) _start(); }
      if (_enabled && !_uiTimer) _start();
    },
    toggle(force) {
      _enabled = (force !== undefined) ? !!force : !_enabled;
      try {
        if (typeof AVT_GRAFICOS !== 'undefined' && AVT_GRAFICOS) {
          AVT_GRAFICOS.perfOverlay = _enabled;
          if (typeof _avtGraficosSalvar === 'function') _avtGraficosSalvar();
        }
      } catch (_) {}
      if (_enabled) _start(); else _stop();
      return _enabled;
    },
    get enabled() { return !!_enabled; },
    fpsAtual() { return _fpsStats().fps; },
    // Para o timer de qualidade adaptativa ao sair da aventura; frame() o
    // recria automaticamente quando o render loop voltar a rodar.
    pararAdaptativo() {
      if (_adaptTimer) { clearInterval(_adaptTimer); _adaptTimer = null; }
      _adaptStrikes = 0;
    },
  };
})();

// Ping/pong de RTT: o caminho P2P é interceptado dentro do RTNet; estes stubs
// atendem o caminho de fallback Supabase (dispatcher do realtime.ts).
function avtReceberPing(payload) {
  try { if (typeof RTNet !== 'undefined' && RTNet._onPing) RTNet._onPing(payload); } catch (_) {}
}
function avtReceberPong(payload) {
  try { if (typeof RTNet !== 'undefined' && RTNet._onPong) RTNet._onPong(payload); } catch (_) {}
}

function avtPerfToggle(force) { return AVT_PERF.toggle(force); }

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "AVT_PERF", { configurable: true, get: () => AVT_PERF });
Object.defineProperty(globalThis, "avtReceberPing", { configurable: true, writable: true, value: avtReceberPing });
Object.defineProperty(globalThis, "avtReceberPong", { configurable: true, writable: true, value: avtReceberPong });
Object.defineProperty(globalThis, "avtPerfToggle", { configurable: true, writable: true, value: avtPerfToggle });
