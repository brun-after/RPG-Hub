// lib/realtime.js
// Cliente WebSocket Supabase Realtime — escuta eventos da campanha
// Suporta: postgres_changes (INSERT/UPDATE/DELETE) + broadcast

import WebSocket from 'ws';

export class RealtimeClient {
  constructor(supabaseUrl, anonKey, authToken, logger) {
    this.wsUrl = supabaseUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://') + '/realtime/v1/websocket?apikey=' + anonKey + '&vsn=1.0.0';
    this.anonKey = anonKey;
    this.authToken = authToken;
    this.logger = logger;
    this.ws = null;
    this.handlers = {}; // { eventType: [fn, ...] }
    this.subscriptions = []; // canais inscritos
    this.heartbeatInterval = null;
    this.reconnectAttempts = 0;
    this.maxReconnect = 5;
    this._ready = false;
    this._readyCallbacks = [];
  }

  // Aguarda conexão WebSocket estar pronta
  waitReady() {
    if (this._ready) return Promise.resolve();
    return new Promise(res => this._readyCallbacks.push(res));
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl, {
        headers: { 'Authorization': `Bearer ${this.authToken || this.anonKey}` }
      });

      this.ws.on('open', () => {
        this.reconnectAttempts = 0;
        this._startHeartbeat();
        this._ready = true;
        this._readyCallbacks.forEach(cb => cb());
        this._readyCallbacks = [];
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const msg = JSON.parse(data.toString());
          this._dispatch(msg);
        } catch {}
      });

      this.ws.on('error', (err) => {
        this.logger?.warn(`[Realtime] WS error: ${err.message}`);
        reject(err);
      });

      this.ws.on('close', () => {
        this._ready = false;
        this._stopHeartbeat();
        if (this.reconnectAttempts < this.maxReconnect) {
          const delay = Math.pow(2, this.reconnectAttempts) * 1000;
          this.reconnectAttempts++;
          this.logger?.warn(`[Realtime] Reconectando em ${delay}ms (tentativa ${this.reconnectAttempts})`);
          setTimeout(() => this.connect().catch(() => {}), delay);
        }
      });
    });
  }

  disconnect() {
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.removeAllListeners();
      this.ws.close();
      this.ws = null;
    }
    this._ready = false;
  }

  // Inscreve em eventos de tabela postgres_changes
  subscribeTable(table, rpgId, eventTypes = ['INSERT', 'UPDATE', 'DELETE']) {
    const topic = `realtime:public:${table}`;
    const ref = String(Date.now());
    const msg = {
      topic,
      event: 'phx_join',
      payload: {
        config: {
          broadcast: { self: false },
          presence: { key: '' },
          postgres_changes: eventTypes.map(event => ({
            event,
            schema: 'public',
            table,
            filter: `rpg_id=eq.${rpgId}`,
          })),
        },
      },
      ref,
    };
    this._send(msg);
    this.subscriptions.push({ topic, ref });
    return this;
  }

  // Inscreve em canal broadcast de chat/combate
  subscribeBroadcast(rpgId) {
    const topic = `realtime:chat:${rpgId}`;
    const ref = String(Date.now() + 1);
    const msg = {
      topic,
      event: 'phx_join',
      payload: {
        config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [] },
      },
      ref,
    };
    this._send(msg);
    this.subscriptions.push({ topic, ref });
    return this;
  }

  // Registra handler para tipo de evento
  // tipo pode ser: 'INSERT', 'UPDATE', 'DELETE', 'broadcast', tabela específica
  on(tipo, handler) {
    if (!this.handlers[tipo]) this.handlers[tipo] = [];
    this.handlers[tipo].push(handler);
    return this;
  }

  off(tipo, handler) {
    if (!this.handlers[tipo]) return;
    this.handlers[tipo] = this.handlers[tipo].filter(h => h !== handler);
  }

  _dispatch(msg) {
    if (msg.event === 'phx_reply' || msg.event === 'phx_error') return;

    // postgres_changes
    if (msg.event === 'postgres_changes') {
      const payload = msg.payload?.data;
      if (!payload) return;
      const { type, table, record, old_record } = payload;
      this._emit(type, { table, record, old_record }); // 'INSERT', 'UPDATE', 'DELETE'
      this._emit(`${table}:${type}`, { record, old_record }); // 'characters:UPDATE'
    }

    // broadcast (chat, combate, animações)
    if (msg.event === 'broadcast') {
      const { event, payload } = msg.payload || {};
      this._emit('broadcast', { event, payload });
      if (event) this._emit(`broadcast:${event}`, payload);
    }
  }

  _emit(tipo, dados) {
    (this.handlers[tipo] || []).forEach(fn => {
      try { fn(dados); } catch(e) {
        this.logger?.warn(`[Realtime] Handler erro para "${tipo}": ${e.message}`);
      }
    });
  }

  _send(msg) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  _startHeartbeat() {
    this.heartbeatInterval = setInterval(() => {
      this._send({ topic: 'phoenix', event: 'heartbeat', payload: {}, ref: 'hb' });
    }, 30000);
  }

  _stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }
}
