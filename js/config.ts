// config.js
// RPG Hub — Configuration constants and HUB_EVENTS event bus
// Includes: SUPABASE_URL, SUPABASE_KEY, HCAPTCHA_SITEKEY, HUB_EVENTS, EMAIL_CONFIRMATION_ENABLED

// ============================================================
// ⚠️  CONFIGURE SUAS CREDENCIAIS SUPABASE AQUI
//     Supabase → Settings → API
// ============================================================
const SUPABASE_URL = 'https://exfcimrtyuhygiicspwh.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4ZmNpbXJ0eXVoeWdpaWNzcHdoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzEzMzkzODAsImV4cCI6MjA4NjkxNTM4MH0.zb42JNBKIS3bC8NLoNEatHFXLvadcYb9ETFvI6el8n4';
const HCAPTCHA_SITEKEY = '127ce404-b488-410a-98dc-eaeab514bcf8'; // ← Substitua pela sua Site Key do hCaptcha

// ════════════════════════════════════════════════════════════════════════════
// 1.4 — HUB_EVENTS: Event Bus central do RPG Hub
// Uso: HUB_EVENTS.emit(tipo, dados) / HUB_EVENTS.on(tipo, fn)
// ════════════════════════════════════════════════════════════════════════════

// Célula do grid tático (col A-Z → 0-based, row 1-based → 0-based).
interface Celula { col: number; row: number; }

// Mapa evento → payload, fiel ao que os emissores enviam HOJE (Entrega 3).
// Onde emissores divergem, o tipo é a união com opcionais e o desvio está
// comentado — corrigir emissor/listener é trabalho de produto, não de tipo.
interface HubEventMap {
  token_moveu: { nome: string; deCelula?: Celula; paraCelula: Celula; movimentoRestante?: number };
  dano_aplicado: { atacante: string; alvo: string; valor: number; tipo: string };
  cura_aplicada: { origem: string; alvo: string; valor: number };
  turno_avancou: { personagem: string; rodada?: number; batalhaId?: string };
  habilidade_usada: { personagem: string; habilidade: string; alvo?: string };
  // Emissores divergem: maps.ts:6886 envia {zona, tipo}; maps.ts:9392 {zona, personagem}.
  zona_ativada: { zona: string; tipo?: string; personagem?: string };
  cena_carregada: { cena_id?: string; nome: string; narracao?: string };
  // BUG documentado: o emissor (hub.ts) preenche mapa_id com dados.batalhaId.
  batalha_iniciada: { mapa_id: string };
  batalha_encerrada: { mapa_id: string; resultado?: any };
  item_usado: { personagem: string; item: string; efeito?: string; aprovacao?: string };
  // Nomes registrados mas sem emissor hoje (listeners aguardando feature):
  token_selecionado: any;
  batalha_atualizada: any;
  criativo_adicionado: any;
  criativo_atualizado: any;
  // Documentado no catálogo original, sem emissor nem listener:
  loot_dropado: { npc?: string; itens?: any[]; posicao?: any };
}

const HUB_EVENTS = (() => {
  const _listeners: { [K in keyof HubEventMap]?: Array<(dados: any) => void> } = {};
  return {
    on<K extends keyof HubEventMap>(tipo: K, fn: (dados: HubEventMap[K]) => void) {
      if (!_listeners[tipo]) _listeners[tipo] = [];
      _listeners[tipo].push(fn);
    },
    off<K extends keyof HubEventMap>(tipo: K, fn: (dados: HubEventMap[K]) => void) {
      if (!_listeners[tipo]) return;
      _listeners[tipo] = _listeners[tipo].filter(f => f !== fn);
    },
    emit<K extends keyof HubEventMap>(tipo: K, dados: HubEventMap[K]) {
      (_listeners[tipo] || []).forEach(fn => {
        try { fn(dados); } catch(e) {
          console.warn('[HUB_EVENTS] erro em listener "' + tipo + '":', e);
        }
      });
    }
  };
})();


// ── CONFIGURAÇÃO DE E-MAIL ────────────────────────────────────
// Defina como true quando o DNS do Resend estiver propagado e

// ============================================================
// UTILIDADES: Tamanho de personagem por dispositivo
// ============================================================

function _isMobile() {
  return window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function _charSizeKey(nome: any) {
  const rpgId = window.RPG_DATA?.rpgId || 'default';
  return `rpghub_charsize_${rpgId}_${nome}`;
}

function _getMobileSize(nome: any) {
  try {
    const v = localStorage.getItem(_charSizeKey(nome));
    return v !== null ? parseFloat(v) : null;
  } catch { return null; }
}

function _setMobileSize(nome: any, val: any) {
  try { localStorage.setItem(_charSizeKey(nome), String(val)); } catch {}
}

// Função global para obter tamanho efetivo respeitando dispositivo
window._getCharTamanhoEfetivo = function (nome: any, ca: any) {
  if (_isMobile()) {
    const cached = _getMobileSize(nome);
    if (cached !== null) return Math.max(0.4, cached);
  }
  return Math.max(0.4, ca?.aparencia?.tamanho || 1.0);
};

// a confirmação de e-mail estiver habilitada no Supabase.
const EMAIL_CONFIRMATION_ENABLED = true;
// ============================================================

/* [migração-esm] accessors globais */
Object.defineProperty(globalThis, "SUPABASE_URL", { configurable: true, get: () => SUPABASE_URL });
Object.defineProperty(globalThis, "SUPABASE_KEY", { configurable: true, get: () => SUPABASE_KEY });
Object.defineProperty(globalThis, "HCAPTCHA_SITEKEY", { configurable: true, get: () => HCAPTCHA_SITEKEY });
Object.defineProperty(globalThis, "HUB_EVENTS", { configurable: true, get: () => HUB_EVENTS });
Object.defineProperty(globalThis, "_isMobile", { configurable: true, writable: true, value: _isMobile });
Object.defineProperty(globalThis, "_charSizeKey", { configurable: true, writable: true, value: _charSizeKey });
Object.defineProperty(globalThis, "_getMobileSize", { configurable: true, writable: true, value: _getMobileSize });
Object.defineProperty(globalThis, "_setMobileSize", { configurable: true, writable: true, value: _setMobileSize });
Object.defineProperty(globalThis, "EMAIL_CONFIRMATION_ENABLED", { configurable: true, get: () => EMAIL_CONFIRMATION_ENABLED });
