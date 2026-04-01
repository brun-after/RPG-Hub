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
const HUB_EVENTS = (() => {
  const _listeners = {};
  return {
    on(tipo, fn) {
      if (!_listeners[tipo]) _listeners[tipo] = [];
      _listeners[tipo].push(fn);
    },
    off(tipo, fn) {
      if (!_listeners[tipo]) return;
      _listeners[tipo] = _listeners[tipo].filter(f => f !== fn);
    },
    emit(tipo, dados) {
      (_listeners[tipo] || []).forEach(fn => {
        try { fn(dados); } catch(e) {
          console.warn('[HUB_EVENTS] erro em listener "' + tipo + '":', e);
        }
      });
    }
  };
})();

// Eventos disponíveis:
//   token_moveu       { nome, deCelula, paraCelula, movimentoRestante }
//   dano_aplicado     { atacante, alvo, valor, tipo }
//   cura_aplicada     { origem, alvo, valor }
//   turno_avancou     { personagem, rodada }
//   habilidade_usada  { personagem, habilidade, alvo }
//   zona_ativada      { zona, personagem }
//   cena_carregada    { cena_id, nome }
//   batalha_iniciada  { mapa_id }
//   batalha_encerrada { mapa_id, resultado }
//   item_usado        { personagem, item, efeito, aprovacao }
//   loot_dropado      { npc, itens, posicao }


// ── CONFIGURAÇÃO DE E-MAIL ────────────────────────────────────
// Defina como true quando o DNS do Resend estiver propagado e

// ============================================================
// UTILIDADES: Tamanho de personagem por dispositivo
// ============================================================

function _isMobile() {
  return window.innerWidth <= 768 ||
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function _charSizeKey(nome) {
  const rpgId = window.RPG_DATA?.rpgId || 'default';
  return `rpghub_charsize_${rpgId}_${nome}`;
}

function _getMobileSize(nome) {
  try {
    const v = localStorage.getItem(_charSizeKey(nome));
    return v !== null ? parseFloat(v) : null;
  } catch { return null; }
}

function _setMobileSize(nome, val) {
  try { localStorage.setItem(_charSizeKey(nome), String(val)); } catch {}
}

// Função global para obter tamanho efetivo respeitando dispositivo
window._getCharTamanhoEfetivo = function (nome, ca) {
  if (_isMobile()) {
    const cached = _getMobileSize(nome);
    if (cached !== null) return Math.max(0.4, cached);
  }
  return Math.max(0.4, ca?.aparencia?.tamanho || 1.0);
};

// a confirmação de e-mail estiver habilitada no Supabase.
const EMAIL_CONFIRMATION_ENABLED = true;
// ============================================================
